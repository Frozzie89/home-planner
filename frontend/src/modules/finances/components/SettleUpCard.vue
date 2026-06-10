<script setup lang="ts">
import { computed } from 'vue'
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers'
import { getMemberName } from '@/shared/lib/memberHelpers'
import type { Balance } from '@/modules/finances/types'
import type { MemberRecord } from '@/modules/household/types'

const props = defineProps<{
  balance: Balance
  otherMember: MemberRecord
  currency: string
}>()

defineEmits<{ 'settle-up': [] }>()

const otherName = computed(() => getMemberName(props.otherMember))

const formattedAmount = computed(() => {
  const fmt = new Intl.NumberFormat(getCurrencyLocale(props.currency), {
    style: 'currency',
    currency: props.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return fmt.format(Math.abs(props.balance.amount) / 100)
})

const subText = computed(() =>
  props.balance.amount > 0
    ? `${otherName.value} owes you ${formattedAmount.value}`
    : `You owe ${otherName.value} ${formattedAmount.value}`
)
</script>

<template>
  <div class="settle-up-card" role="region" aria-label="Settle up action">
    <div class="settle-text">
      <p class="settle-title">Settle up with {{ otherName }}</p>
      <p class="settle-sub">{{ subText }}</p>
    </div>
    <button type="button" class="btn-settle-up" @click="$emit('settle-up')">
      Settle up
    </button>
  </div>
</template>

<style scoped>
.settle-up-card {
  background-color: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-left: 4px solid var(--color-accent, #D4845A);
  border-radius: 10px;
  padding: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.settle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settle-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.settle-sub {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.btn-settle-up {
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 var(--space-2);
  background-color: var(--color-accent, #D4845A);
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.btn-settle-up:hover {
  opacity: 0.9;
}
</style>
