<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers'
import { getMemberName } from '@/shared/lib/memberHelpers'
import { useFinancesStore } from '@/modules/finances/stores/finances'
import { useHouseholdStore } from '@/modules/household/stores/household'
import { useAuthStore } from '@/shared/stores/auth'
import BalanceCard from '@/modules/finances/components/BalanceCard.vue'
import AddExpenseSheet from '@/modules/finances/components/AddExpenseSheet.vue'
import Skeleton from 'primevue/skeleton'
import type { Expense, NewExpensePayload } from '@/modules/finances/types'
// ExpenseList / ExpenseItem components will be extracted in Story 3.3

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

const isSinglePair = computed(() => financesStore.bilateralBalances.length === 1)

const showAddSheet = ref(false)

const viewerDefaultPortion = computed(() => {
  if (!authStore.memberId) return 50
  return householdStore.split_ratios[authStore.memberId] ?? 50
})

function openAddSheet() {
  financesStore.addExpenseStatus = 'idle'
  showAddSheet.value = true
}

async function handleExpenseSubmit(payload: NewExpensePayload) {
  await financesStore.addExpense(payload)
}

// ── Expense display helpers ──────────────────────────────────────────────────

function fmt(currency: string) {
  return new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  })
}

// Parse "YYYY-MM-DD ..." as local midnight to avoid UTC-to-local shift mangling the date
function parseExpenseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function formatDay(dateStr: string): string {
  return parseExpenseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function payerLabel(expense: Expense): string {
  if (expense.member_id === authStore.memberId) {
    return 'You paid'
  }
  const member = memberMap.value.get(expense.member_id)
  return member ? `${getMemberName(member)} paid` : 'Someone paid'
}

// Returns the portion as "70%" only when it differs from the payer's default split ratio.
function customPortion(expense: Expense): string | null {
  const defaultRatio = householdStore.split_ratios[expense.member_id]
  if (defaultRatio === undefined || expense.portion === defaultRatio) return null
  return `${expense.portion}%`
}

// Viewer's share in integer cents.
// If viewer paid: their portion of the bill (what they keep).
// If other paid: viewer's proportional slice of the remainder.
function viewerShareCents(expense: Expense): number {
  if (expense.member_id === authStore.memberId) {
    return Math.round(expense.amount * expense.portion / 100)
  }
  const remainder = Math.trunc(expense.amount * (100 - expense.portion) / 100)
  const viewerRatio = householdStore.split_ratios[authStore.memberId ?? ''] ?? 0
  const totalNonPayerRatio = Object.entries(householdStore.split_ratios)
    .filter(([id]) => id !== expense.member_id)
    .reduce((sum, [, r]) => sum + r, 0)
  if (totalNonPayerRatio === 0) return 0
  return Math.round(remainder * viewerRatio / totalNonPayerRatio)
}

// Deterministic soft-color avatar palette keyed by expense id
const PALETTES = [
  { bg: '#EBF4FF', fg: '#4A7FBF' },
  { bg: '#FFF6E8', fg: '#C47A3A' },
  { bg: '#FFEEF0', fg: '#BF4A55' },
  { bg: '#EDFAF4', fg: '#3AAF7A' },
  { bg: '#F2EEFF', fg: '#8A5BBF' },
  { bg: '#FFF3E8', fg: '#BF7A3A' },
  { bg: '#EEF2FF', fg: '#5B6EBE' },
]

function avatarPalette(id: string) {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTES[hash % PALETTES.length]!
}

// Group expenses by calendar month, preserving store order (newest first)
const groupedExpenses = computed(() => {
  type Group = { monthKey: string; monthLabel: string; totalCents: number; expenses: Expense[] }
  const groups: Group[] = []
  const map = new Map<string, Group>()

  for (const expense of financesStore.expenses) {
    const d = parseExpenseDate(expense.date)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()

    if (!map.has(monthKey)) {
      const g: Group = { monthKey, monthLabel, totalCents: 0, expenses: [] }
      map.set(monthKey, g)
      groups.push(g)
    }
    const g = map.get(monthKey)!
    g.totalCents += expense.amount
    g.expenses.push(expense)
  }

  return groups
})
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
      <p class="page-title">Finances</p>
      <button
        type="button"
        class="btn-add-desktop"
        @click="openAddSheet"
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

    <!-- Expense list area -->
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
        <!-- Monthly groups — Story 3.3 will extract into ExpenseList + ExpenseItem components -->
        <div
          v-for="group in groupedExpenses"
          :key="group.monthKey"
          class="month-group"
        >
          <!-- Month header -->
          <div class="month-header">
            <span class="month-label">{{ group.monthLabel }}</span>
            <span class="month-meta">
              {{ fmt(householdStore.currency).format(group.totalCents / 100) }}
              · {{ group.expenses.length }} {{ group.expenses.length === 1 ? 'expense' : 'expenses' }}
            </span>
          </div>

          <!-- Expense items card -->
          <TransitionGroup tag="div" name="expense-list" class="expense-card" :css="false">
            <div
              v-for="expense in group.expenses"
              :key="expense.id"
              class="expense-item"
              :class="{
                'expense-item--new': expense.id.startsWith('optimistic-'),
                'expense-item--last': expense === group.expenses[group.expenses.length - 1],
              }"
            >
              <!-- Avatar -->
              <div
                class="expense-avatar"
                :style="{ backgroundColor: avatarPalette(expense.id).bg }"
              >
                <i class="pi pi-receipt" :style="{ color: avatarPalette(expense.id).fg }" />
              </div>

              <!-- Main content -->
              <div class="expense-content">
                <span class="expense-title">{{ expense.title }}</span>
                <span class="expense-meta">
                  {{ payerLabel(expense) }} · {{ formatDay(expense.date) }}{{ customPortion(expense) ? ` · ${customPortion(expense)}` : '' }}
                </span>
              </div>

              <!-- Amounts -->
              <div class="expense-amounts">
                <span class="expense-amount">
                  {{ fmt(householdStore.currency).format(expense.amount / 100) }}
                </span>
                <span class="expense-share">
                  Your share {{ fmt(householdStore.currency).format(viewerShareCents(expense) / 100) }}
                </span>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
    </div>
  </div>

  <!-- Mobile FAB — fixed position above bottom nav -->
  <button
    type="button"
    class="fab"
    aria-label="Add expense"
    @click="openAddSheet"
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

/* ── Expense list ── */

.expense-list-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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

/* ── Month group ── */

.month-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.month-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 2px;
}

.month-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}

.month-meta {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

/* ── Expense card (groups items) ── */

.expense-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  overflow: hidden;
}

/* ── Individual expense row ── */

.expense-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  border-bottom: 1px solid var(--p-surface-border);
  transition: background-color 600ms ease-out;
}

.expense-item--last {
  border-bottom: none;
}

.expense-item--new {
  animation: highlight-new 1.4s ease-out forwards;
}

@keyframes highlight-new {
  0%   { background-color: color-mix(in srgb, var(--color-balance-positive) 30%, var(--p-surface-card)); }
  100% { background-color: transparent; }
}

/* ── Avatar ── */

.expense-avatar {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
}

/* ── Content (title + meta) ── */

.expense-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.expense-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expense-meta {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

/* ── Amounts ── */

.expense-amounts {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.expense-amount {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.expense-share {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
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
