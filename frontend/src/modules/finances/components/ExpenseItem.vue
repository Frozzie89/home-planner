<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers';
import type { Expense } from '@/modules/finances/types';

const props = defineProps<{
  expense: Expense;
  currency: string;
  payerLabel: string;
  customPortionLabel: string | null;
  viewerShareCents: number;
  isLast: boolean;
  canModify: boolean;
  avatarStyle: { bg: string; fg: string };
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
}>();

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

const formattedDate = computed(() =>
  parseDate(props.expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
);

const fmt = computed(
  () =>
    new Intl.NumberFormat(getCurrencyLocale(props.currency), {
      style: 'currency',
      currency: props.currency,
      currencyDisplay: 'narrowSymbol',
    })
);

const formattedAmount = computed(() => fmt.value.format(props.expense.amount / 100));
const formattedShare = computed(() => fmt.value.format(props.viewerShareCents / 100));

// Long-press state for touch devices
const isActive = ref(false);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

function onTouchStart() {
  longPressTimer = setTimeout(() => {
    isActive.value = true;
  }, 500);
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onRowClick() {
  if (isActive.value) isActive.value = false;
}

onUnmounted(cancelLongPress);
</script>

<template>
  <div
    class="expense-item"
    :class="{
      'expense-item--new': expense.id.startsWith('optimistic-'),
      'expense-item--last': isLast,
      'expense-item--active': isActive,
    }"
    @touchstart.passive="onTouchStart"
    @touchend="cancelLongPress"
    @touchmove="cancelLongPress"
    @click="onRowClick"
  >
    <!-- Avatar -->
    <div class="expense-avatar" :style="{ backgroundColor: avatarStyle.bg }">
      <i class="pi pi-receipt" :style="{ color: avatarStyle.fg }" />
    </div>

    <!-- Main content -->
    <div class="expense-content">
      <span class="expense-title">{{ expense.title }}</span>
      <span class="expense-meta">
        {{ payerLabel }} · {{ formattedDate
        }}{{ customPortionLabel ? ` · ${customPortionLabel}` : '' }}
      </span>
    </div>

    <!-- Amounts -->
    <div class="expense-amounts">
      <span class="expense-amount">{{ formattedAmount }}</span>
      <span class="expense-share">Your share {{ formattedShare }}</span>
    </div>

    <!-- Edit / Delete actions — revealed on hover (desktop) or long-press (mobile) -->
    <div v-if="canModify" class="expense-actions">
      <button type="button" class="action-btn" aria-label="Edit expense" @click.stop="emit('edit')">
        <i class="pi pi-pencil" />
      </button>
      <button
        type="button"
        class="action-btn action-btn--delete"
        aria-label="Delete expense"
        @click.stop="emit('delete')"
      >
        <i class="pi pi-trash" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.expense-item {
  position: relative;
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
  0% {
    background-color: color-mix(in srgb, var(--color-balance-positive) 30%, var(--p-surface-card));
  }
  100% {
    background-color: transparent;
  }
}

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

/* Actions overlay — hidden by default, revealed on hover or long-press */

.expense-actions {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
  align-items: center;
  /* Gradient fade so the buttons emerge cleanly over the amounts */
  padding-left: 24px;
  background: linear-gradient(to right, transparent, var(--p-surface-card) 40%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
}

.expense-item:hover .expense-actions,
.expense-item--active .expense-actions {
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.action-btn:hover {
  background-color: var(--p-surface-hover);
  color: var(--color-text-primary);
}

.action-btn--delete:hover {
  color: var(--color-balance-negative);
}
</style>
