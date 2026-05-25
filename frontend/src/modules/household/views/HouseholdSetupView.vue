<template>
  <div class="setup-page">
    <div class="setup-card">
      <h1 class="setup-title">Create your household</h1>
      <p class="setup-subtitle">You'll become the Admin and can invite others after setup.</p>

      <div class="form-field">
        <label for="household-name">Household Name</label>
        <InputText
          id="household-name"
          v-model="householdName"
          :class="{ 'p-invalid': nameError }"
          placeholder="e.g. The Joneses"
          @blur="validateName"
        />
        <small v-if="nameError" class="field-error">{{ nameError }}</small>
      </div>

      <div class="form-field">
        <label for="currency">Display Currency</label>
        <Select
          id="currency"
          v-model="selectedCurrency"
          :options="CURRENCY_OPTIONS"
          option-label="label"
          option-value="code"
        />
      </div>

      <p v-if="createStatus === 'error'" class="submit-error">
        Something went wrong. Please try again.
      </p>

      <Button
        label="Create Household"
        class="create-btn"
        :disabled="!isFormValid || createStatus === 'loading'"
        :loading="createStatus === 'loading'"
        @click="handleSubmit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { pb } from '@/shared/lib/pocketbase'
import { useAuthStore } from '@/shared/stores/auth'
import { useHouseholdStore } from '@/modules/household/stores/household'

const CURRENCY_OPTIONS = [
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'DKK', label: 'DKK — Danish Krone' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'NOK', label: 'NOK — Norwegian Krone' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'USD', label: 'USD — US Dollar' },
]

const router = useRouter()
const authStore = useAuthStore()
const householdStore = useHouseholdStore()

const householdName = ref('')
const selectedCurrency = ref('EUR')
const nameError = ref('')
const createStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')

const isFormValid = computed(() => householdName.value.trim() !== '')

function validateName() {
  nameError.value = householdName.value.trim() === '' ? 'Household name is required' : ''
}

async function handleSubmit() {
  validateName()
  if (!isFormValid.value) return

  createStatus.value = 'loading'
  try {
    const household = await pb.collection('households').create({
      name: householdName.value.trim(),
      currency: selectedCurrency.value,
      split_ratios: {},
      reminder_day: 'Monday',
    })

    const member = await pb.collection('members').create({
      household_id: household.id,
      user_id: authStore.userId,
      role: 'admin',
    })

    await pb.collection('households').update(household.id, {
      split_ratios: { [member.id]: 100 },
    })

    authStore.householdId = household.id
    authStore.role = 'admin'

    householdStore.populate({
      id: household.id,
      name: household.name,
      currency: household.currency,
      split_ratios: { [member.id]: 100 },
      reminder_day: household.reminder_day,
    })

    createStatus.value = 'success'
    await router.push('/finances')
  } catch {
    createStatus.value = 'error'
  }
}
</script>

<style scoped>
.setup-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--p-surface-ground);
  padding: var(--space-2);
}

.setup-card {
  width: 100%;
  max-width: 480px;
  background-color: var(--p-surface-card);
  border-radius: 12px;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.setup-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.setup-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

.field-error {
  color: var(--color-balance-negative);
  font-size: 0.75rem;
  margin-top: 4px;
  display: block;
}

:deep(.p-invalid .p-inputtext),
:deep(.p-inputtext.p-invalid) {
  border-color: var(--color-balance-negative);
  background-color: color-mix(in srgb, var(--color-balance-negative) 8%, transparent);
}

.submit-error {
  color: var(--color-balance-negative);
  font-size: 0.875rem;
  margin: 0;
}

.create-btn {
  width: 100%;
  margin-top: var(--space-1);
}
</style>
