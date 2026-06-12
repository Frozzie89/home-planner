<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { getMemberName } from '@/shared/lib/memberHelpers';
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers';
import type { Balance } from '@/modules/finances/types';
import type { MemberRecord } from '@/modules/household/types';

const props = defineProps<{
  balance: Balance;
  otherMember: MemberRecord;
  currency: string;
}>();

const emit = defineEmits<{ 'settle-up': [] }>();

const isPositive = computed(() => props.balance.amount > 0);
const isNegative = computed(() => props.balance.amount < 0);
const isZero = computed(() => props.balance.amount === 0);

// === Animated display amount =================================================

const displayedAmount = ref(props.balance.amount);
let rafId: number | null = null;

watch(
  () => props.balance.amount,
  (newVal) => {
    if (typeof window === 'undefined') {
      displayedAmount.value = newVal;
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayedAmount.value = newVal;
      return;
    }

    const from = displayedAmount.value;
    const to = newVal;
    const start = performance.now();
    const duration = 300;

    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      displayedAmount.value = Math.round(from + (to - from) * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        displayedAmount.value = to;
        rafId = null;
      }
    }

    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(step);
  }
);

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
});

const otherName = computed(() => getMemberName(props.otherMember));

const directionText = computed(() => {
  if (isPositive.value) return `${otherName.value} owes you`;
  if (isNegative.value) return `You owe ${otherName.value}`;
  return 'All settled';
});

// aria-label uses the real (non-animated) amount for correctness
const formattedAmount = computed(() => {
  const fmt = new Intl.NumberFormat(getCurrencyLocale(props.currency), {
    style: 'currency',
    currency: props.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const abs = fmt.format(Math.abs(props.balance.amount) / 100);
  const sign = isPositive.value ? '+' : isNegative.value ? '−' : '';
  return `${sign}${abs}`;
});

// Split amount into parts for animated integer display
const amountParts = computed(() => {
  const fmt = new Intl.NumberFormat(getCurrencyLocale(props.currency), {
    style: 'currency',
    currency: props.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const parts = fmt.formatToParts(Math.abs(displayedAmount.value) / 100);
  let prefix = '';
  let intPart = '';
  let frac = '';
  let suffix = '';

  type Phase = 'pre' | 'int' | 'frac' | 'post';
  let phase: Phase = 'pre';

  for (const p of parts) {
    if (p.type === 'integer' || p.type === 'group') {
      phase = 'int';
      intPart += p.value;
    } else if (p.type === 'decimal' || p.type === 'fraction') {
      phase = 'frac';
      frac += p.value;
    } else if (phase === 'frac' || phase === 'post') {
      phase = 'post';
      suffix += p.value;
    } else {
      prefix += p.value;
    }
  }

  // Sign and color use the real (non-animated) amount  - never flip mid-animation
  const sign = isPositive.value ? '+' : isNegative.value ? '−' : ''; // U+2212 minus sign
  return { sign, prefix, intPart, frac, suffix };
});

const cardClass = computed(() => ({
  'state-nonzero': !isZero.value,
  'state-zero': isZero.value,
}));

const amountClass = computed(() => ({
  'amt-positive': isPositive.value,
  'amt-negative': isNegative.value,
  'amt-zero': isZero.value,
}));
</script>

<template>
  <div class="slim-card" :class="cardClass" role="region" :aria-label="`Balance with ${otherName}`">
    <div class="slim-info">
      <div class="slim-name">{{ otherName }}</div>
      <div class="slim-dir" :class="{ 'dir-settled': isZero }">{{ directionText }}</div>
    </div>
    <div class="slim-amt" :class="amountClass" aria-live="polite" :aria-label="formattedAmount">
      <span class="amt-main"
        >{{ amountParts.sign }}{{ amountParts.prefix }}{{ amountParts.intPart }}</span
      ><span class="amt-frac">{{ amountParts.frac }}</span
      ><span v-if="amountParts.suffix" class="amt-main">{{ amountParts.suffix }}</span>
    </div>
    <div class="slim-action">
      <button v-if="!isZero" type="button" class="btn-settle" @click="emit('settle-up')">
        Settle up
      </button>
      <div v-else class="settled-check" aria-hidden="true">✓</div>
    </div>
  </div>
</template>

<style scoped>
.slim-card {
  background-color: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  @media (prefers-reduced-motion: no-preference) {
    transition: background-color 300ms ease-out;
  }
}

.slim-card.state-nonzero {
  border-left: 4px solid var(--color-accent, #d4845a);
}

.slim-card.state-zero {
  background-color: #fdf3dc;
}

.slim-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

@media (max-width: 600px) {
  .slim-card {
    flex-wrap: wrap;
  }

  .slim-info {
    flex: none;
    width: 100%;
  }
}

.slim-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slim-dir {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.slim-dir.dir-settled {
  color: #2d6b4a;
  font-weight: 500;
}

.slim-amt {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  @media (prefers-reduced-motion: no-preference) {
    transition: color 300ms ease-out;
  }
}

.slim-action {
  flex-shrink: 0;
  width: 88px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.slim-amt.amt-positive {
  color: var(--color-balance-positive);
}
.slim-amt.amt-negative {
  color: var(--color-balance-negative);
}
.slim-amt.amt-zero {
  color: var(--color-text-secondary);
}

.amt-main {
  font-size: 2rem;
  font-weight: 700;
}

.amt-frac {
  font-size: 1.5rem;
  font-weight: 600;
}

.btn-settle {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 var(--space-2);
  background-color: transparent;
  color: #9b4e2a;
  border: 2px solid var(--color-accent, #d4845a);
  border-radius: 20px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.btn-settle:hover {
  opacity: 0.9;
}

.settled-check {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid #e8a838;
  color: #e8a838;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  font-weight: 700;
  opacity: 0.8;
}
</style>
