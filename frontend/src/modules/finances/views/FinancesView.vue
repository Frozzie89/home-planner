<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useFinancesStore } from '@/modules/finances/stores/finances';
import { useHouseholdStore } from '@/modules/household/stores/household';
import { useAuthStore } from '@/shared/stores/auth';
import { pb } from '@/shared/lib/pocketbase';
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers';
import BalanceCard from '@/modules/finances/components/BalanceCard.vue';
import AddExpenseSheet from '@/modules/finances/components/AddExpenseSheet.vue';
import ExpenseList from '@/modules/finances/components/ExpenseList.vue';
import EditExpenseSheet from '@/modules/finances/components/EditExpenseSheet.vue';
import BottomSheet from '@/shared/components/BottomSheet.vue';
import SettleCelebration from '@/modules/finances/components/SettleCelebration.vue';
import Skeleton from 'primevue/skeleton';
import { getMemberName } from '@/shared/lib/memberHelpers';
import type {
  Expense,
  NewExpensePayload,
  UpdateExpensePayload,
  Balance,
} from '@/modules/finances/types';
import type { RecordSubscription } from 'pocketbase';

const financesStore = useFinancesStore();
const householdStore = useHouseholdStore();
const authStore = useAuthStore();

function handleSSEEvent(event: RecordSubscription<Expense>) {
  financesStore.applySSEEvent(event.action as 'create' | 'update' | 'delete', event.record);
}

onMounted(() => {
  financesStore.load();
  if (authStore.householdId) {
    void pb.collection('expenses').subscribe<Expense>('*', handleSSEEvent, {
      filter: `household_id = "${authStore.householdId}"`,
    });
  }
});

onUnmounted(() => {
  pb.collection('expenses').unsubscribe();
});

const memberMap = computed(() => {
  const map = new Map<string, (typeof financesStore.members)[number]>();
  for (const m of financesStore.members) map.set(m.id, m);
  return map;
});

const showAddSheet = ref(false);

const viewerDefaultPortion = computed(() => {
  if (!authStore.memberId) return 50;
  return householdStore.split_ratios[authStore.memberId] ?? 50;
});

function openAddSheet() {
  financesStore.addExpenseStatus = 'idle';
  showAddSheet.value = true;
}

async function handleExpenseSubmit(payload: NewExpensePayload) {
  await financesStore.addExpense(payload);
}

// === Edit / Delete handlers ==================================================

const editingExpense = ref<Expense | null>(null);
const showEditSheet = ref(false);
const deletingExpense = ref<Expense | null>(null);
const showDeleteConfirm = ref(false);

function handleEditExpense(expense: Expense) {
  if (financesStore.deleteExpenseStatus === 'loading') return;
  financesStore.updateExpenseStatus = 'idle';
  editingExpense.value = expense;
  showEditSheet.value = true;
}

function handleDeleteExpense(expense: Expense) {
  if (financesStore.updateExpenseStatus === 'loading') return;
  financesStore.deleteExpenseStatus = 'idle';
  deletingExpense.value = expense;
  showDeleteConfirm.value = true;
}

async function handleExpenseUpdate(payload: UpdateExpensePayload) {
  if (!editingExpense.value) return;
  await financesStore.updateExpense(editingExpense.value.id, payload);
}

async function confirmDelete() {
  if (!deletingExpense.value) return;
  showDeleteConfirm.value = false;
  await financesStore.deleteExpense(deletingExpense.value.id);
  deletingExpense.value = null;
}

// === Settle-up handlers ======================================================

const showSettleConfirm = ref(false);
const settlingBalance = ref<Balance | null>(null);

const settlingMemberName = computed(() => {
  if (!settlingBalance.value) return '';
  const m = memberMap.value.get(settlingBalance.value.member_b_id);
  return m ? getMemberName(m) : '';
});

function openSettleConfirm(balance: Balance) {
  settlingBalance.value = balance;
  showSettleConfirm.value = true;
}

function handleSettleConfirm() {
  if (!settlingBalance.value) return;
  showSettleConfirm.value = false;
  financesStore.settleUp({
    member_a_id: settlingBalance.value.member_a_id,
    member_b_id: settlingBalance.value.member_b_id,
  });
  settlingBalance.value = null;
}

// === Summary banner ==========================================================

const netAmount = computed(() =>
  financesStore.bilateralBalances.reduce((sum, b) => sum + b.amount, 0)
);

const nonZeroBalanceCount = computed(
  () => financesStore.bilateralBalances.filter((b) => b.amount !== 0).length
);

const showSummaryBanner = computed(() => nonZeroBalanceCount.value > 1 && netAmount.value !== 0);

const summaryLabel = computed(() =>
  netAmount.value > 0 ? 'Overall, you are owed' : 'Overall, you owe'
);

const formattedNetAmount = computed(() => {
  const fmt = new Intl.NumberFormat(getCurrencyLocale(householdStore.currency), {
    style: 'currency',
    currency: householdStore.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const abs = fmt.format(Math.abs(netAmount.value) / 100);
  return netAmount.value > 0 ? `+${abs}` : `−${abs}`; // U+2212 minus sign
});
</script>

<template>
  <AddExpenseSheet
    v-model:open="showAddSheet"
    :currency="householdStore.currency"
    :default-portion="viewerDefaultPortion"
    @submit="handleExpenseSubmit"
  />

  <!-- Edit expense sheet -->
  <EditExpenseSheet
    v-if="editingExpense"
    v-model:open="showEditSheet"
    :expense="editingExpense"
    :currency="householdStore.currency"
    @update="handleExpenseUpdate"
  />

  <!-- Delete confirmation sheet -->
  <BottomSheet v-model:open="showDeleteConfirm" title="Delete Expense">
    <p class="delete-confirm-text">Delete "{{ deletingExpense?.title }}"? This cannot be undone.</p>
    <div class="delete-confirm-actions">
      <button type="button" class="btn-cancel" @click="showDeleteConfirm = false">Cancel</button>
      <button type="button" class="btn-delete" @click="confirmDelete">Delete</button>
    </div>
  </BottomSheet>

  <!-- Settle-up confirmation sheet -->
  <BottomSheet v-model:open="showSettleConfirm" title="Settle Up">
    <p class="settle-confirm-text">
      Confirm you've settled the balance with {{ settlingMemberName }}?
    </p>
    <div class="delete-confirm-actions">
      <button type="button" class="btn-cancel" @click="showSettleConfirm = false">Cancel</button>
      <button type="button" class="btn-settle" @click="handleSettleConfirm">Confirm</button>
    </div>
  </BottomSheet>

  <div class="finances-page">
    <!-- Desktop: page header with + Add expense button -->
    <div class="page-header">
      <p class="page-title">Finances</p>
      <button type="button" class="btn-add-desktop" @click="openAddSheet">+ Add expense</button>
    </div>

    <!-- Balance cards or skeleton -->
    <template v-if="financesStore.loadStatus === 'idle' || financesStore.loadStatus === 'loading'">
      <Skeleton height="72px" border-radius="12px" />
    </template>
    <template v-else-if="financesStore.loadStatus === 'error'">
      <p class="load-error">Could not load balances. Please refresh to try again.</p>
    </template>
    <template v-else>
      <template v-for="balance in financesStore.bilateralBalances" :key="balance.member_b_id">
        <BalanceCard
          v-if="memberMap.get(balance.member_b_id)"
          :balance="balance"
          :other-member="memberMap.get(balance.member_b_id)!"
          :currency="householdStore.currency"
          @settle-up="openSettleConfirm(balance)"
        />
        <SettleCelebration
          v-if="memberMap.get(balance.member_b_id)"
          :active="financesStore.isSettledPair(balance.member_b_id)"
          :other-member-name="getMemberName(memberMap.get(balance.member_b_id)!)"
        />
      </template>

      <!-- Summary banner -->
      <div v-if="showSummaryBanner" class="summary-banner">
        <span class="summary-label">{{ summaryLabel }}</span>
        <span class="summary-amount" :class="netAmount > 0 ? 'net-positive' : 'net-negative'">{{
          formattedNetAmount
        }}</span>
      </div>

      <template v-if="financesStore.bilateralBalances.length === 0">
        <p class="empty-state">Add another member to see balances here.</p>
      </template>
    </template>

    <!-- Inline error banners for add/edit/delete failures -->
    <div
      v-if="financesStore.addExpenseStatus === 'error'"
      class="expense-error-banner"
      role="alert"
    >
      Couldn't save the expense. Please try again.
    </div>
    <div
      v-if="financesStore.updateExpenseStatus === 'error'"
      class="expense-error-banner"
      role="alert"
    >
      Couldn't save the changes. Please try again.
    </div>
    <div
      v-if="financesStore.deleteExpenseStatus === 'error'"
      class="expense-error-banner"
      role="alert"
    >
      Couldn't delete the expense. Please try again.
    </div>

    <!-- Expense list (smart component reads from store) -->
    <ExpenseList @edit="handleEditExpense" @delete="handleDeleteExpense" />
  </div>

  <!-- Mobile FAB  - fixed position above bottom nav -->
  <button type="button" class="fab" aria-label="Add expense" @click="openAddSheet">
    <i class="pi pi-plus" />
  </button>
</template>

<style scoped>
.finances-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.page-header {
  display: none;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

.page-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text-primary);
}

.btn-add-desktop {
  background-color: var(--p-primary-active-color);
  color: var(--p-primary-contrast-color);
  border: none;
  border-radius: 8px;
  padding: 0 var(--space-2);
  height: 40px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-add-desktop:hover {
  opacity: 0.9;
}

.fab {
  position: fixed;
  bottom: calc(64px + var(--space-2));
  right: var(--space-2);
  width: 56px;
  height: 56px;
  min-width: 56px;
  min-height: 56px;
  border-radius: 50%;
  background-color: var(--color-accent, #d4845a);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 50;
}

.fab:hover {
  opacity: 0.9;
}

.expense-error-banner {
  background-color: color-mix(in srgb, var(--color-balance-negative) 15%, var(--p-surface-card));
  border: 1px solid var(--color-balance-negative);
  border-radius: 8px;
  padding: var(--space-1) var(--space-2);
  color: var(--color-balance-negative);
  font-size: 0.875rem;
}

.empty-state {
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--space-4) 0;
  margin: 0;
}

.load-error {
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--space-3) 0;
  margin: 0;
}

.delete-confirm-text {
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
}

.delete-confirm-actions {
  display: flex;
  gap: var(--space-1);
}

.btn-cancel {
  flex: 1;
  min-height: 48px;
  background: var(--p-surface-border);
  color: var(--color-text-primary);
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-delete {
  flex: 1;
  min-height: 48px;
  background-color: var(--color-balance-negative);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-delete:hover,
.btn-cancel:hover {
  opacity: 0.9;
}

.settle-confirm-text {
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
}

.btn-settle {
  flex: 1;
  min-height: 48px;
  background-color: var(--color-accent, #d4845a);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-settle:hover {
  opacity: 0.9;
}

/* Summary banner */
.summary-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background-color: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  gap: var(--space-2);
}

.summary-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.summary-amount {
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.summary-amount.net-positive {
  color: var(--color-balance-positive);
}

.summary-amount.net-negative {
  color: var(--color-balance-negative);
}

@media (min-width: 1024px) {
  .page-header {
    display: flex;
  }

  .fab {
    display: none;
  }
}
</style>
