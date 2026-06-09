import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { pb } from '@/shared/lib/pocketbase'
import { useAuthStore } from '@/shared/stores/auth'
import { useHouseholdStore } from '@/modules/household/stores/household'
import type { Expense, Balance, NewExpensePayload, UpdateExpensePayload } from '@/modules/finances/types'
import type { MemberRecord } from '@/modules/household/types'

export const useFinancesStore = defineStore('finances', () => {
  const authStore = useAuthStore()
  const expenses = ref<Expense[]>([])
  const members = ref<MemberRecord[]>([])
  const loadStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
  const addExpenseStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
  const updateExpenseStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
  const deleteExpenseStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')

  watch(() => authStore.isAuthenticated, (isAuth) => {
    if (!isAuth) reset()
  })

  // Bilateral balances: one entry per (viewer, otherMember) pair.
  // Positive = viewer is owed; Negative = viewer owes.
  // All arithmetic operates on integer cents — never floats.
  const bilateralBalances = computed<Balance[]>(() => {
    const householdStore = useHouseholdStore()
    const viewerMemberId = authStore.memberId
    if (!viewerMemberId || members.value.length < 2) return []

    const splitRatios = householdStore.split_ratios
    const otherMembers = members.value.filter(m => m.id !== viewerMemberId)

    // Hoist viewer-side invariants outside the per-expense loop
    const otherNonViewerIds = otherMembers.map(m => m.id)
    const totalOtherRatio = otherNonViewerIds.reduce((sum, id) => sum + (splitRatios[id] ?? 0), 0)
    const viewerRatio = splitRatios[viewerMemberId] ?? 0

    return otherMembers.map(other => {
      let balance = 0 // integer cents; positive = viewer is owed

      // Hoist other-side invariant per bilateral pair
      const otherNonOtherIds = members.value.filter(m => m.id !== other.id).map(m => m.id)
      const totalViewerSideRatio = otherNonOtherIds.reduce((sum, id) => sum + (splitRatios[id] ?? 0), 0)
      const otherRatio = splitRatios[other.id] ?? 0

      for (const expense of expenses.value) {
        if (expense.member_id === viewerMemberId) {
          // Viewer paid — compute this other member's share of the non-viewer portion
          const remainder = Math.trunc(expense.amount * (100 - expense.portion) / 100)
          if (totalOtherRatio > 0) {
            balance += Math.round(remainder * otherRatio / totalOtherRatio)
          }
        } else if (expense.member_id === other.id) {
          // Other paid — compute viewer's share of the non-other portion
          const remainder = Math.trunc(expense.amount * (100 - expense.portion) / 100)
          if (totalViewerSideRatio > 0) {
            balance -= Math.round(remainder * viewerRatio / totalViewerSideRatio)
          }
        }
        // Expenses by a third-party member do not affect this bilateral pair
      }

      return { member_a_id: viewerMemberId, member_b_id: other.id, amount: balance }
    })
  })

  async function load() {
    if (loadStatus.value === 'loading') return
    if (!authStore.householdId) {
      loadStatus.value = 'error'
      return
    }
    loadStatus.value = 'loading'
    try {
      await Promise.all([loadExpenses(), loadMembers()])
      loadStatus.value = 'success'
    } catch {
      // Clear partial data so bilateralBalances never operates on a mismatched set
      expenses.value = []
      members.value = []
      loadStatus.value = 'error'
    }
  }

  async function loadExpenses() {
    // The listRule enforces household isolation server-side; no redundant client filter needed.
    const result = await pb.collection('expenses').getFullList<Expense>({
      sort: '-date',
    })
    expenses.value = result
  }

  async function loadMembers() {
    const result = await pb.collection('members').getFullList<MemberRecord>({
      expand: 'user_id',
    })
    members.value = result
  }

  async function addExpense(payload: NewExpensePayload) {
    if (!authStore.householdId || !authStore.memberId) return
    if (loadStatus.value !== 'success') return
    if (addExpenseStatus.value === 'loading') return

    addExpenseStatus.value = 'loading'
    const optimisticId = `optimistic-${Date.now()}`

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
    }

    const snapshot = [...expenses.value]
    const withOptimistic = [optimisticExpense, ...expenses.value]
    withOptimistic.sort((a, b) => b.date.localeCompare(a.date))
    expenses.value = withOptimistic

    try {
      const created = await pb.collection('expenses').create<Expense>({
        household_id: authStore.householdId,
        member_id: authStore.memberId,
        title: payload.title,
        amount: payload.amount,
        portion: payload.portion,
        date: payload.date,
      })
      const idx = expenses.value.findIndex(e => e.id === optimisticId)
      if (idx >= 0) {
        const updated = [...expenses.value.slice(0, idx), created, ...expenses.value.slice(idx + 1)]
        updated.sort((a, b) => b.date.localeCompare(a.date))
        expenses.value = updated
      }
      addExpenseStatus.value = 'success'
    } catch {
      if (!authStore.isAuthenticated) return
      expenses.value = snapshot
      addExpenseStatus.value = 'error'
    }
  }

  async function updateExpense(id: string, payload: UpdateExpensePayload) {
    if (!authStore.householdId || !authStore.memberId) return
    if (updateExpenseStatus.value === 'loading') return

    updateExpenseStatus.value = 'loading'
    const snapshot = [...expenses.value]

    const idx = expenses.value.findIndex(e => e.id === id)
    if (idx < 0) {
      updateExpenseStatus.value = 'error'
      return
    }

    const optimistic: Expense = {
      ...expenses.value[idx]!,
      title: payload.title,
      amount: payload.amount,
      portion: payload.portion,
      date: payload.date,
      updated: new Date().toISOString(),
    }
    const withUpdate = [...expenses.value]
    withUpdate[idx] = optimistic
    withUpdate.sort((a, b) => b.date.localeCompare(a.date))
    expenses.value = withUpdate

    try {
      const result = await pb.collection('expenses').update<Expense>(id, {
        title: payload.title,
        amount: payload.amount,
        portion: payload.portion,
        date: payload.date,
      })
      const syncIdx = expenses.value.findIndex(e => e.id === id)
      if (syncIdx >= 0) {
        const synced = [...expenses.value]
        synced[syncIdx] = result
        synced.sort((a, b) => b.date.localeCompare(a.date))
        expenses.value = synced
      }
      updateExpenseStatus.value = 'success'
    } catch {
      if (!authStore.isAuthenticated) return
      expenses.value = snapshot
      updateExpenseStatus.value = 'error'
    }
  }

  async function deleteExpense(id: string) {
    if (!authStore.householdId) return
    if (deleteExpenseStatus.value === 'loading') return

    deleteExpenseStatus.value = 'loading'
    const snapshot = [...expenses.value]

    expenses.value = expenses.value.filter(e => e.id !== id)

    try {
      await pb.collection('expenses').delete(id)
      deleteExpenseStatus.value = 'success'
    } catch {
      if (!authStore.isAuthenticated) return
      expenses.value = snapshot
      deleteExpenseStatus.value = 'error'
    }
  }

  function reset() {
    expenses.value = []
    members.value = []
    loadStatus.value = 'idle'
    addExpenseStatus.value = 'idle'
    updateExpenseStatus.value = 'idle'
    deleteExpenseStatus.value = 'idle'
  }

  return {
    expenses, members, loadStatus, bilateralBalances, load, reset,
    addExpenseStatus, addExpense,
    updateExpenseStatus, updateExpense,
    deleteExpenseStatus, deleteExpense,
  }
})
