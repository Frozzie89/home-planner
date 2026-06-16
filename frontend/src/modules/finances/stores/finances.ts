import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { pb } from '@/shared/lib/pocketbase';
import { useAuthStore } from '@/shared/stores/auth';
import { useHouseholdStore } from '@/modules/household/stores/household';
import type {
  Expense,
  Balance,
  NewExpensePayload,
  UpdateExpensePayload,
  SettleUpPayload,
  Settlement,
} from '@/modules/finances/types';
import type { MemberRecord } from '@/modules/household/types';

const byDateDesc = (a: Expense, b: Expense) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0);

export const useFinancesStore = defineStore('finances', () => {
  const authStore = useAuthStore();
  const expenses = ref<Expense[]>([]);
  const members = ref<MemberRecord[]>([]);
  const loadStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
  const addExpenseStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
  const updateExpenseStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
  const deleteExpenseStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
  const activeSettlements = ref<Settlement[]>([]);

  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (!isAuth) reset();
    }
  );

  /** One balance entry per (viewer, otherMember) pair, in integer cents. Positive = viewer is owed; negative = viewer owes. */
  // All arithmetic operates on integer cents - never floats.
  const bilateralBalances = computed<Balance[]>(() => {
    const householdStore = useHouseholdStore();
    const viewerMemberId = authStore.memberId;
    if (!viewerMemberId || members.value.length < 2) return [];

    const splitRatios = householdStore.split_ratios;
    const otherMembers = members.value.filter((m) => m.id !== viewerMemberId);

    const viewerMember = members.value.find((m) => m.id === viewerMemberId);
    const viewerJoinDate = viewerMember?.created?.replace('T', ' ') ?? null;

    // Hoist viewer-side invariants outside the per-expense loop
    const otherNonViewerIds = otherMembers.map((m) => m.id);
    const totalOtherRatio = otherNonViewerIds.reduce((sum, id) => sum + (splitRatios[id] ?? 0), 0);
    const viewerRatio = splitRatios[viewerMemberId] ?? 0;

    return otherMembers.map((other) => {
      let balance = 0;

      const otherNonOtherIds = members.value.filter((m) => m.id !== other.id).map((m) => m.id);
      const totalViewerSideRatio = otherNonOtherIds.reduce(
        (sum, id) => sum + (splitRatios[id] ?? 0),
        0
      );
      const otherRatio = splitRatios[other.id] ?? 0;

      // Find the latest settlement for this pair
      const latestSettlement = activeSettlements.value
        .filter(
          (s) =>
            (s.member_a_id === viewerMemberId && s.member_b_id === other.id) ||
            (s.member_a_id === other.id && s.member_b_id === viewerMemberId)
        )
        .sort((a, b) =>
          b.settled_at > a.settled_at ? 1 : b.settled_at < a.settled_at ? -1 : 0
        )[0];
      const settlementCutoff = latestSettlement?.settled_at ?? null;

      for (const expense of expenses.value) {
        const expTimestamp = (expense.created ?? '9999-12-31 23:59:59.999Z').replace('T', ' ');
        if (viewerJoinDate !== null && expTimestamp < viewerJoinDate) continue;
        if (expTimestamp < other.created.replace('T', ' ')) continue;
        if (settlementCutoff !== null && expTimestamp <= settlementCutoff) continue;

        if (expense.member_id === viewerMemberId) {
          const remainder = Math.trunc((expense.amount * (100 - expense.portion)) / 100);
          if (totalOtherRatio > 0) {
            balance += Math.round((remainder * otherRatio) / totalOtherRatio);
          }
        } else if (expense.member_id === other.id) {
          const remainder = Math.trunc((expense.amount * (100 - expense.portion)) / 100);
          if (totalViewerSideRatio > 0) {
            balance -= Math.round((remainder * viewerRatio) / totalViewerSideRatio);
          }
        }
        // Expenses by a third-party member do not affect this bilateral pair
      }

      return { member_a_id: viewerMemberId, member_b_id: other.id, amount: balance };
    });
  });

  async function load() {
    if (loadStatus.value === 'loading') return;
    if (!authStore.householdId) {
      loadStatus.value = 'error';
      return;
    }
    loadStatus.value = 'loading';
    try {
      await Promise.all([loadExpenses(), loadMembers(), loadSettlements()]);
      loadStatus.value = 'success';
    } catch {
      // Clear partial data so bilateralBalances never operates on a mismatched set
      expenses.value = [];
      members.value = [];
      activeSettlements.value = [];
      loadStatus.value = 'error';
    }
  }

  async function loadExpenses() {
    // The listRule enforces household isolation server-side; no redundant client filter needed.
    const result = await pb.collection('expenses').getFullList<Expense>({
      sort: '-date',
    });
    expenses.value = result;
  }

  async function loadMembers() {
    const result = await pb.collection('members').getFullList<MemberRecord>({
      expand: 'user_id',
    });
    members.value = result;
  }

  async function loadSettlements() {
    const result = await pb.collection('settlements').getFullList<Settlement>({
      sort: '-settled_at',
    });
    activeSettlements.value = result;
  }

  /** Adds an expense with optimistic UI. On success, deduplicates against any SSE echo that may arrive before the POST response. */
  async function addExpense(payload: NewExpensePayload) {
    if (!authStore.householdId || !authStore.memberId) return;
    if (loadStatus.value !== 'success') return;
    if (addExpenseStatus.value === 'loading') return;

    addExpenseStatus.value = 'loading';
    const optimisticId = `optimistic-${Date.now()}`;

    const optimisticExpense: Expense = {
      id: optimisticId,
      household_id: authStore.householdId,
      member_id: authStore.memberId,
      title: payload.title,
      amount: payload.amount,
      portion: payload.portion,
      date: payload.date,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    const snapshot = [...expenses.value];
    const withOptimistic = [optimisticExpense, ...expenses.value];
    withOptimistic.sort(byDateDesc);
    expenses.value = withOptimistic;

    try {
      const created = await pb.collection('expenses').create<Expense>({
        household_id: authStore.householdId,
        member_id: authStore.memberId,
        title: payload.title,
        amount: payload.amount,
        portion: payload.portion,
        date: payload.date,
      });
      const idx = expenses.value.findIndex((e) => e.id === optimisticId);
      if (idx >= 0) {
        // Strip the optimistic entry AND any SSE echo of the real record that may
        // have arrived before this response (SSE-before-POST race).
        const without = expenses.value.filter((e) => e.id !== optimisticId && e.id !== created.id);
        const updated = [...without, created];
        updated.sort(byDateDesc);
        expenses.value = updated;
      }
      addExpenseStatus.value = 'success';
    } catch {
      if (!authStore.isAuthenticated) return;
      expenses.value = snapshot;
      addExpenseStatus.value = 'error';
    }
  }

  /** Updates an expense with optimistic UI. Reverts on error unless the session ended mid-flight. */
  async function updateExpense(id: string, payload: UpdateExpensePayload) {
    if (!authStore.householdId || !authStore.memberId) return;
    if (updateExpenseStatus.value === 'loading') return;

    updateExpenseStatus.value = 'loading';
    const snapshot = [...expenses.value];

    const idx = expenses.value.findIndex((e) => e.id === id);
    if (idx < 0) {
      updateExpenseStatus.value = 'error';
      return;
    }

    const optimistic: Expense = {
      ...expenses.value[idx]!,
      title: payload.title,
      amount: payload.amount,
      portion: payload.portion,
      date: payload.date,
      updated: new Date().toISOString(),
    };
    const withUpdate = [...expenses.value];
    withUpdate[idx] = optimistic;
    withUpdate.sort(byDateDesc);
    expenses.value = withUpdate;

    try {
      const result = await pb.collection('expenses').update<Expense>(id, {
        title: payload.title,
        amount: payload.amount,
        portion: payload.portion,
        date: payload.date,
      });
      const syncIdx = expenses.value.findIndex((e) => e.id === id);
      if (syncIdx >= 0) {
        const synced = [...expenses.value];
        synced[syncIdx] = result;
        synced.sort(byDateDesc);
        expenses.value = synced;
      }
      updateExpenseStatus.value = 'success';
    } catch {
      if (!authStore.isAuthenticated) {
        updateExpenseStatus.value = 'idle';
        return;
      }
      expenses.value = snapshot;
      updateExpenseStatus.value = 'error';
    }
  }

  /** Deletes an expense with optimistic UI. Reverts on error unless the session ended mid-flight. */
  async function deleteExpense(id: string) {
    if (!authStore.householdId) return;
    if (deleteExpenseStatus.value === 'loading') return;

    deleteExpenseStatus.value = 'loading';
    const snapshot = [...expenses.value];

    expenses.value = expenses.value.filter((e) => e.id !== id);

    try {
      await pb.collection('expenses').delete(id);
      deleteExpenseStatus.value = 'success';
    } catch {
      if (!authStore.isAuthenticated) {
        deleteExpenseStatus.value = 'idle';
        return;
      }
      expenses.value = snapshot;
      deleteExpenseStatus.value = 'error';
    }
  }

  /** Applies a realtime SSE event. A create upserts by id to deduplicate against an optimistic entry for the same record. */
  function applySSEEvent(action: 'create' | 'update' | 'delete', record: Expense) {
    if (action === 'create') {
      const idx = expenses.value.findIndex((e) => e.id === record.id);
      if (idx >= 0) {
        const synced = [...expenses.value];
        synced[idx] = record;
        synced.sort(byDateDesc);
        expenses.value = synced;
      } else {
        const withNew = [...expenses.value, record];
        withNew.sort(byDateDesc);
        expenses.value = withNew;
      }
    } else if (action === 'update') {
      const idx = expenses.value.findIndex((e) => e.id === record.id);
      if (idx >= 0) {
        const updated = [...expenses.value];
        updated[idx] = record;
        updated.sort(byDateDesc);
        expenses.value = updated;
      }
    } else if (action === 'delete') {
      expenses.value = expenses.value.filter((e) => e.id !== record.id);
    }
  }

  /** Persists a settlement record to PocketBase with optimistic update. */
  async function settleUp(payload: SettleUpPayload) {
    if (!authStore.householdId) return;
    const optimisticId = `optimistic-settlement-${Date.now()}`;
    const settled_at = new Date().toISOString().replace('T', ' ');
    const optimistic: Settlement = {
      id: optimisticId,
      household_id: authStore.householdId,
      member_a_id: payload.member_a_id,
      member_b_id: payload.member_b_id,
      settled_at,
      created: settled_at,
      updated: settled_at,
    };
    activeSettlements.value = [...activeSettlements.value, optimistic];

    try {
      const created = await pb.collection('settlements').create<Settlement>({
        household_id: authStore.householdId,
        member_a_id: payload.member_a_id,
        member_b_id: payload.member_b_id,
        settled_at,
      });
      // Replace optimistic with real server record
      activeSettlements.value = activeSettlements.value.map((s) =>
        s.id === optimisticId ? created : s
      );
    } catch {
      activeSettlements.value = activeSettlements.value.filter((s) => s.id !== optimisticId);
    }
  }

  function isSettledPair(memberBId: string): boolean {
    const viewerMemberId = authStore.memberId;
    if (!viewerMemberId) return false;
    const hasSettlement = activeSettlements.value.some(
      (s) =>
        (s.member_a_id === viewerMemberId && s.member_b_id === memberBId) ||
        (s.member_a_id === memberBId && s.member_b_id === viewerMemberId)
    );
    if (!hasSettlement) return false;
    // If new expenses exist post-settlement, balance is non-zero and celebration goes away automatically.
    const balance = bilateralBalances.value.find((b) => b.member_b_id === memberBId);
    return balance?.amount === 0;
  }

  function reset() {
    expenses.value = [];
    members.value = [];
    loadStatus.value = 'idle';
    addExpenseStatus.value = 'idle';
    updateExpenseStatus.value = 'idle';
    deleteExpenseStatus.value = 'idle';
    activeSettlements.value = [];
  }

  return {
    expenses,
    members,
    loadStatus,
    bilateralBalances,
    load,
    reset,
    addExpenseStatus,
    addExpense,
    updateExpenseStatus,
    updateExpense,
    deleteExpenseStatus,
    deleteExpense,
    applySSEEvent,
    activeSettlements,
    settleUp,
    isSettledPair,
  };
});
