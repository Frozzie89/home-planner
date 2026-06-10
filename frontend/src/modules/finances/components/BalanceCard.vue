<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { getMemberName } from '@/shared/lib/memberHelpers'
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers'
import type { Balance } from '@/modules/finances/types'
import type { MemberRecord } from '@/modules/household/types'

const props = defineProps<{
  balance: Balance
  otherMember: MemberRecord
  currency: string
  settled?: boolean
  hasExpenses?: boolean
  headerLabel?: string  // "YOUR BALANCE" for single-pair, "WITH [NAME]" for multi-pair
}>()

const isPositive = computed(() => props.balance.amount > 0)
const isNegative = computed(() => props.balance.amount < 0)
const isZero = computed(() => props.balance.amount === 0)
const isZeroFresh = computed(() => isZero.value && !props.settled && !props.hasExpenses)
const isZeroSettled = computed(() => isZero.value && props.settled)

// ── Animated display amount ───────────────────────────────────────────────────

const displayedAmount = ref(props.balance.amount)
let rafId: number | null = null

watch(() => props.balance.amount, (newVal) => {
  if (typeof window === 'undefined') {
    displayedAmount.value = newVal
    return
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    displayedAmount.value = newVal
    return
  }

  const from = displayedAmount.value
  const to = newVal
  const start = performance.now()
  const duration = 300

  function step(now: number) {
    const t = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 2) // ease-out quadratic
    displayedAmount.value = Math.round(from + (to - from) * eased)
    if (t < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      displayedAmount.value = to
      rafId = null
    }
  }

  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(step)
})

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})

const otherName = computed(() => getMemberName(props.otherMember))

const header = computed(() =>
  props.headerLabel ?? `WITH ${otherName.value.toUpperCase()}`
)

// Split amount into prefix (leading currency/literal), intPart (integer+groups),
// frac (decimal separator + fraction digits), and suffix (trailing currency/literal).
// This handles all locale orderings: "€45.80", "45.80 €", "CHF 45.80", "45.80 CHF".
// Uses displayedAmount.value for the animated integer; sign/color use props.balance.amount.
const amountParts = computed(() => {
  const fmt = new Intl.NumberFormat(getCurrencyLocale(props.currency), {
    style: 'currency',
    currency: props.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const parts = fmt.formatToParts(Math.abs(displayedAmount.value) / 100)
  let prefix = ''   // leading currency + literals (before integer)
  let intPart = ''  // integer digits + group separators
  let frac = ''     // decimal separator + fraction digits
  let suffix = ''   // trailing currency + literals (after fraction)

  type Phase = 'pre' | 'int' | 'frac' | 'post'
  let phase: Phase = 'pre'

  for (const p of parts) {
    if (p.type === 'integer' || p.type === 'group') {
      phase = 'int'
      intPart += p.value
    } else if (p.type === 'decimal' || p.type === 'fraction') {
      phase = 'frac'
      frac += p.value
    } else if (phase === 'frac' || phase === 'post') {
      phase = 'post'
      suffix += p.value
    } else {
      prefix += p.value
    }
  }

  // Sign and color use the real (non-animated) amount — never flip mid-animation
  const sign = isPositive.value ? '+' : isNegative.value ? '−' : '' // U+2212 minus sign
  return { sign, prefix, intPart, frac, suffix }
})

// aria-label uses the real (non-animated) amount for correctness
const formattedAmount = computed(() => {
  const fmt = new Intl.NumberFormat(getCurrencyLocale(props.currency), {
    style: 'currency',
    currency: props.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const abs = fmt.format(Math.abs(props.balance.amount) / 100)
  const sign = isPositive.value ? '+' : isNegative.value ? '−' : ''
  return `${sign}${abs}`
})

const sublabel = computed(() => {
  if (isPositive.value) return `${otherName.value} owes you`
  if (isNegative.value) return `You owe ${otherName.value}`
  if (isZeroFresh.value) return 'No expenses logged this period'
  if (isZeroSettled.value) return 'All settled. Nothing owed.'
  return ''
})

const ariaLabel = computed(() => {
  if (isZeroFresh.value || isZeroSettled.value) return `Balance with ${otherName.value}: ${formattedAmount.value}`
  return `Current balance: ${formattedAmount.value}, ${sublabel.value}`
})

const cardClass = computed(() => ({
  'state-settled': isZeroSettled.value,
}))

const amountClass = computed(() => ({
  'state-positive': isPositive.value,
  'state-negative': isNegative.value,
  'state-zero': isZero.value,
}))
</script>

<template>
  <div class="balance-card" :class="cardClass" role="region" :aria-label="`Balance with ${otherName}`">
    <div class="balance-header-label">{{ header }}</div>
    <div class="balance-amount" :class="amountClass" aria-live="polite" :aria-label="ariaLabel">
      <span class="amount-main">{{ amountParts.sign }}{{ amountParts.prefix }}{{ amountParts.intPart }}</span><span class="amount-frac">{{ amountParts.frac }}</span><span v-if="amountParts.suffix" class="amount-main">{{ amountParts.suffix }}</span>
    </div>
    <div class="balance-sublabel">
      {{ sublabel }}
    </div>
    <div v-if="isZeroSettled" class="settled-checkmark" aria-hidden="true">✓</div>
  </div>
</template>

<style scoped>
/* Matches .pref-card from ProfileView / HouseholdSettingsView */
.balance-card {
  background-color: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;
  @media (prefers-reduced-motion: no-preference) {
    transition: background-color 300ms ease-out 300ms;
  }
}

.balance-card.state-settled {
  background-color: #FDF3DC; /* golden wash — design spec exact hex for settled state */
}

/* Matches .field-label-upper from ProfileView / HouseholdSettingsView */
.balance-header-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
}

.balance-amount {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  display: flex;
  align-items: baseline;
  @media (prefers-reduced-motion: no-preference) {
    transition: color 300ms ease-out;
  }
}

.balance-amount.state-positive { color: var(--color-balance-positive); }
.balance-amount.state-negative { color: var(--color-balance-negative); }
.balance-amount.state-zero     { color: var(--color-text-secondary); }

.amount-main {
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1.1;
}

.amount-frac {
  font-size: 1.75rem;
  font-weight: 600;
}

.balance-sublabel {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.balance-card.state-settled .balance-sublabel {
  color: var(--color-balance-positive, #4A9068);
  font-weight: 500;
}

.settled-checkmark {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid #E8A838;
  color: #E8A838;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  opacity: 0.7;
}

@media (prefers-reduced-motion: no-preference) {
  .balance-card.state-settled .balance-sublabel {
    animation: settle-sublabel-in 200ms ease-out 500ms both;
  }

  .balance-card.state-settled .settled-checkmark {
    animation: settle-badge-in 200ms ease-out 600ms both;
  }

  @keyframes settle-sublabel-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes settle-badge-in {
    from { opacity: 0; }
    to   { opacity: 0.7; }
  }
}
</style>
