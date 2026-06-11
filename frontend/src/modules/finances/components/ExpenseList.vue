<script setup lang="ts">
import { computed } from 'vue';
import { useFinancesStore } from '@/modules/finances/stores/finances';
import { useHouseholdStore } from '@/modules/household/stores/household';
import { useAuthStore } from '@/shared/stores/auth';
import { getMemberName } from '@/shared/lib/memberHelpers';
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers';
import ExpenseItem from './ExpenseItem.vue';
import type { Expense } from '@/modules/finances/types';
import Skeleton from 'primevue/skeleton';

const emit = defineEmits<{
  edit: [expense: Expense];
  delete: [expense: Expense];
}>();

const financesStore = useFinancesStore();
const householdStore = useHouseholdStore();
const authStore = useAuthStore();

const memberMap = computed(() => {
  const map = new Map<string, (typeof financesStore.members)[number]>();
  for (const m of financesStore.members) map.set(m.id, m);
  return map;
});

function fmt(currency: string) {
  return new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  });
}

function parseExpenseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function payerLabel(expense: Expense): string {
  if (expense.member_id === authStore.memberId) {
    return 'You paid';
  }
  const member = memberMap.value.get(expense.member_id);
  return member ? `${getMemberName(member)} paid` : 'Someone paid';
}

function customPortion(expense: Expense): string | null {
  const defaultRatio = householdStore.split_ratios[expense.member_id];
  if (defaultRatio === undefined || expense.portion === defaultRatio) return null;
  return `${expense.portion}%`;
}

function viewerShareCents(expense: Expense): number {
  if (expense.member_id === authStore.memberId) {
    return Math.round((expense.amount * expense.portion) / 100);
  }
  const remainder = Math.trunc((expense.amount * (100 - expense.portion)) / 100);
  const viewerRatio = householdStore.split_ratios[authStore.memberId ?? ''] ?? 0;
  const totalNonPayerRatio = Object.entries(householdStore.split_ratios)
    .filter(([id]) => id !== expense.member_id)
    .reduce((sum, [, r]) => sum + r, 0);
  if (totalNonPayerRatio === 0) return 0;
  return Math.round((remainder * viewerRatio) / totalNonPayerRatio);
}

const PALETTES = [
  { bg: '#EBF4FF', fg: '#4A7FBF' },
  { bg: '#FFF6E8', fg: '#C47A3A' },
  { bg: '#FFEEF0', fg: '#BF4A55' },
  { bg: '#EDFAF4', fg: '#3AAF7A' },
  { bg: '#F2EEFF', fg: '#8A5BBF' },
  { bg: '#FFF3E8', fg: '#BF7A3A' },
  { bg: '#EEF2FF', fg: '#5B6EBE' },
];

function avatarPalette(id: string) {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length]!;
}

function canModify(expense: Expense): boolean {
  return expense.member_id === authStore.memberId || authStore.role === 'admin';
}

const groupedExpenses = computed(() => {
  type Group = { monthKey: string; monthLabel: string; totalCents: number; expenses: Expense[] };
  const groups: Group[] = [];
  const map = new Map<string, Group>();

  for (const expense of financesStore.expenses) {
    const d = parseExpenseDate(expense.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      .toUpperCase();

    if (!map.has(monthKey)) {
      const g: Group = { monthKey, monthLabel, totalCents: 0, expenses: [] };
      map.set(monthKey, g);
      groups.push(g);
    }
    const g = map.get(monthKey)!;
    g.totalCents += expense.amount;
    g.expenses.push(expense);
  }

  return groups;
});
</script>

<template>
  <!-- Loading skeleton -->
  <template v-if="financesStore.loadStatus === 'idle' || financesStore.loadStatus === 'loading'">
    <Skeleton height="72px" border-radius="8px" />
    <Skeleton height="72px" border-radius="8px" />
  </template>

  <!-- Error state -->
  <p v-else-if="financesStore.loadStatus === 'error'" class="load-error">
    Could not load expenses. Please refresh.
  </p>

  <!-- Empty state -->
  <p v-else-if="financesStore.expenses.length === 0" class="empty-state">
    Nothing here yet — add your first expense
  </p>

  <!-- Monthly groups -->
  <template v-else>
    <div v-for="group in groupedExpenses" :key="group.monthKey" class="month-group">
      <div class="month-header">
        <span class="month-label">{{ group.monthLabel }}</span>
        <span class="month-meta">
          {{ fmt(householdStore.currency).format(group.totalCents / 100) }}
          · {{ group.expenses.length }} {{ group.expenses.length === 1 ? 'expense' : 'expenses' }}
        </span>
      </div>

      <TransitionGroup tag="div" name="expense-list" class="expense-card" :css="false">
        <ExpenseItem
          v-for="(expense, index) in group.expenses"
          :key="expense.id"
          :expense="expense"
          :currency="householdStore.currency"
          :payer-label="payerLabel(expense)"
          :custom-portion-label="customPortion(expense)"
          :viewer-share-cents="viewerShareCents(expense)"
          :is-last="index === group.expenses.length - 1"
          :can-modify="canModify(expense)"
          :avatar-style="avatarPalette(expense.id)"
          @edit="emit('edit', expense)"
          @delete="emit('delete', expense)"
        />
      </TransitionGroup>
    </div>
  </template>
</template>

<style scoped>
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

.expense-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  overflow: hidden;
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

.expense-list-enter-active {
  transition: all 0.3s ease;
}

.expense-list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
