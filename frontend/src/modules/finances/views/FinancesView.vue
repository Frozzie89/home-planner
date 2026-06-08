<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers'
import { useFinancesStore } from '@/modules/finances/stores/finances'
import { useHouseholdStore } from '@/modules/household/stores/household'
import BalanceCard from '@/modules/finances/components/BalanceCard.vue'
import Skeleton from 'primevue/skeleton'
// ExpenseList will be imported in Story 3.3

const financesStore = useFinancesStore()
const householdStore = useHouseholdStore()

onMounted(() => {
  financesStore.load()
})

function getMemberById(memberId: string) {
  return financesStore.members.find(m => m.id === memberId)
}

// Single pair -> "YOUR BALANCE"; multiple pairs -> "WITH [NAME]" (computed in BalanceCard)
const isSinglePair = computed(() => financesStore.bilateralBalances.length === 1)
</script>

<template>
  <div class="finances-page">
    <!-- Balance cards or skeleton -->
    <template v-if="financesStore.loadStatus === 'loading'">
      <Skeleton height="96px" border-radius="12px" />
    </template>
    <template v-else>
      <template v-for="balance in financesStore.bilateralBalances" :key="balance.member_b_id">
        <BalanceCard
          v-if="getMemberById(balance.member_b_id)"
          :balance="balance"
          :other-member="getMemberById(balance.member_b_id)!"
          :currency="householdStore.currency"
          :settled="false"
          :header-label="isSinglePair ? 'YOUR BALANCE' : undefined"
        />
      </template>
    </template>

    <!-- Expense list area (full implementation in Story 3.3) -->
    <div class="expense-list-area">
      <template v-if="financesStore.loadStatus === 'success' && financesStore.expenses.length === 0">
        <p class="empty-state">Nothing here yet — add your first expense</p>
      </template>
      <template v-else-if="financesStore.loadStatus === 'success'">
        <!-- Basic read-only expense rows — Stories 3.2/3.3 will replace with ExpenseList -->
        <div
          v-for="expense in financesStore.expenses"
          :key="expense.id"
          class="expense-stub"
        >
          <span>{{ expense.title }}</span>
          <span>{{ new Intl.NumberFormat(getCurrencyLocale(householdStore.currency), { style: 'currency', currency: householdStore.currency, currencyDisplay: 'narrowSymbol' }).format(expense.amount / 100) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.finances-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.expense-list-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.empty-state {
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--space-4) 0;
  margin: 0;
}

.expense-stub {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2);
  background: var(--p-surface-card);
  border-radius: 8px;
}
</style>
