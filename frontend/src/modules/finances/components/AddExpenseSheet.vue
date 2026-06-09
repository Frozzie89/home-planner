<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BottomSheet from '@/shared/components/BottomSheet.vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import type { NewExpensePayload } from '@/modules/finances/types'
import { getCurrencyLocale } from '@/shared/lib/currencyHelpers'
import { getLocaleDateFormat } from '@/shared/lib/dateHelpers'

const localeDateFormat = getLocaleDateFormat(navigator.language)

const props = defineProps<{
  currency: string
  defaultPortion: number
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submit: [payload: NewExpensePayload]
}>()

const title = ref('')
const amountRaw = ref<number | null>(null)
const date = ref<Date>(new Date())
const portion = ref(props.defaultPortion)
const showMoreOptions = ref(false)

const titleTouched = ref(false)
const amountTouched = ref(false)

const titleError = computed(() =>
  titleTouched.value && !title.value.trim() ? 'Title is required' : ''
)
const amountError = computed(() =>
  amountTouched.value && (amountRaw.value === null || amountRaw.value <= 0)
    ? 'Amount is required'
    : ''
)
const canConfirm = computed(
  () => !!title.value.trim() && amountRaw.value !== null && amountRaw.value > 0
)

function handleConfirm() {
  if (!canConfirm.value) return
  const amountCents = Math.round(amountRaw.value! * 100)
  const d = date.value
  const now = new Date()
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}Z`
  emit('submit', {
    title: title.value.trim(),
    amount: amountCents,
    date: dateStr,
    portion: Math.min(100, Math.max(0, Math.round(portion.value))),
  })
  open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    date.value = new Date()
  } else {
    title.value = ''
    amountRaw.value = null
    date.value = new Date()
    portion.value = props.defaultPortion
    showMoreOptions.value = false
    titleTouched.value = false
    amountTouched.value = false
  }
}, { flush: 'sync' })
</script>

<template>
  <BottomSheet v-model:open="open" title="Add Expense">
    <div class="field" :class="{ 'field-error': titleError }">
      <label for="expense-title">Title</label>
      <InputText
        id="expense-title"
        v-model="title"
        placeholder="e.g. Groceries"
        @blur="() => { if (open) titleTouched = true }"
      />
      <span v-if="titleError" class="field-error-text">{{ titleError }}</span>
    </div>

    <div class="field" :class="{ 'field-error': amountError }">
      <label for="expense-amount">Amount</label>
      <InputNumber
        inputId="expense-amount"
        v-model="amountRaw"
        mode="currency"
        :currency="currency"
        :locale="getCurrencyLocale(currency)"
        :max-fraction-digits="2"
        :min-fraction-digits="2"
        @blur="amountTouched = true"
      />
      <span v-if="amountError" class="field-error-text">{{ amountError }}</span>
    </div>

    <button
      type="button"
      class="more-options-toggle"
      @click="showMoreOptions = !showMoreOptions"
    >
      More options
      <i :class="showMoreOptions ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
    </button>

    <div v-if="showMoreOptions" class="more-options">
      <div class="field">
        <label for="expense-date">Date</label>
        <DatePicker inputId="expense-date" v-model="date" :date-format="localeDateFormat" />
      </div>

      <div class="field">
        <label for="expense-portion">Your share: {{ portion }}%</label>
        <InputNumber
          inputId="expense-portion"
          v-model="portion"
          :min="0"
          :max="100"
          :max-fraction-digits="0"
          suffix="%"
        />
      </div>
    </div>

    <button
      type="button"
      class="btn-confirm"
      :disabled="!canConfirm"
      @click="handleConfirm"
    >
      Confirm
    </button>
  </BottomSheet>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.field :deep(input),
.field :deep(.p-inputtext) {
  width: 100%;
}

.field-error :deep(input),
.field-error :deep(.p-inputnumber-input) {
  border-color: var(--color-balance-negative);
  background-color: color-mix(in srgb, var(--color-balance-negative) 10%, transparent);
}

.field-error-text {
  color: var(--color-balance-negative);
  font-size: 0.75rem;
  margin-top: 4px;
}

.more-options-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: none;
  border: none;
  padding: 0;
  color: var(--color-text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  font-family: inherit;
}

.more-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.btn-confirm {
  width: 100%;
  min-height: 48px;
  background-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
