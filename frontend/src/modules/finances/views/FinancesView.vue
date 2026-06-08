<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers'
import { useFinancesStore } from '@/modules/finances/stores/finances'
import { useHouseholdStore } from '@/modules/household/stores/household'
import { useAuthStore } from '@/shared/stores/auth'
import BalanceCard from '@/modules/finances/components/BalanceCard.vue'
import AddExpenseSheet from '@/modules/finances/components/AddExpenseSheet.vue'
import Skeleton from 'primevue/skeleton'
import type { NewExpensePayload } from '@/modules/finances/types'
// ExpenseList will be imported in Story 3.3

const financesStore = useFinancesStore()
const householdStore = useHouseholdStore()
const authStore = useAuthStore()

onMounted(() => {
  financesStore.load()
})

const memberMap = computed(() => {
  const map = new Map<string, (typeof financesStore.members)[number]>()
  for (const m of financesStore.members) map.set(m.id, m)
  return map
})

// Single pair -> "YOUR BALANCE"; multiple pairs -> "WITH [NAME]" (computed in BalanceCard)
const isSinglePair = computed(() => financesStore.bilateralBalances.length === 1)

const showAddSheet = ref(false)

const viewerDefaultPortion = computed(() => {
  if (!authStore.memberId) return 50
  return householdStore.split_ratios[authStore.memberId] ?? 50
})

async function handleExpenseSubmit(payload: NewExpensePayload) {
  await financesStore.addExpense(payload)
}
</script>

<template>
  <AddExpenseSheet
    v-model:open="showAddSheet"
    :currency="householdStore.currency"
    :default-portion="viewerDefaultPortion"
    @submit="handleExpenseSubmit"
  />
  <div class="finances-page">
    <!-- Desktop: page header with + Add expense button -->
    <div class="page-header">
      <h2 class="page-title">Finances</h2>
      <button
        type="button"
        class="btn-add-desktop"
        @click="showAddSheet = true"
      >
        + Add expense
      </button>
    </div>

    <!-- Balance cards or skeleton -->
    <template v-if="financesStore.loadStatus === 'idle' || financesStore.loadStatus === 'loading'">
      <Skeleton height="96px" border-radius="12px" />
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
          :settled="false"
          :header-label="isSinglePair ? 'YOUR BALANCE' : undefined"
        />
      </template>
      <template v-if="financesStore.bilateralBalances.length === 0">
        <p class="empty-state">Add another member to see balances here.</p>
      </template>
    </template>

    <!-- Expense list area (full implementation in Story 3.3) -->
    <div class="expense-list-area">
      <!-- Inline error banner when optimistic write fails -->
      <div
        v-if="financesStore.addExpenseStatus === 'error'"
        class="expense-error-banner"
        role="alert"
      >
        Couldn't save the expense. Please try again.
      </div>

      <template v-if="financesStore.loadStatus === 'success' && financesStore.expenses.length === 0">
        <p class="empty-state">Nothing here yet — add your first expense</p>
      </template>
      <template v-else-if="financesStore.loadStatus === 'success'">
        <!-- Basic read-only expense rows with transition for optimistic UI — Stories 3.2/3.3 -->
        <TransitionGroup name="expense-list" tag="div" class="expense-rows">
          <div
            v-for="expense in financesStore.expenses"
            :key="expense.id"
            class="expense-stub"
          >
            <span>{{ expense.title }}</span>
            <span>{{
              new Intl.NumberFormat(getCurrencyLocale(householdStore.currency), {
                style: 'currency',
                currency: householdStore.currency,
                currencyDisplay: 'narrowSymbol',
              }).format(expense.amount / 100)
            }}</span>
          </div>
        </TransitionGroup>
      </template>
    </div>
  </div>

  <!-- Mobile FAB — fixed position above bottom nav -->
  <button
    type="button"
    class="fab"
    aria-label="Add expense"
    @click="showAddSheet = true"
  >
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
  background-color: var(--p-primary-color);
  color: white;
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
  background-color: var(--color-accent, #D4845A);
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

.expense-list-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.expense-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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

.expense-stub {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2);
  background: var(--p-surface-card);
  border-radius: 8px;
}

/* Expense list enter animation — highlights new items */
.expense-list-enter-active {
  transition: all 300ms ease-out;
}

.expense-list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
  background-color: color-mix(in srgb, var(--color-balance-positive) 25%, var(--p-surface-card));
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
