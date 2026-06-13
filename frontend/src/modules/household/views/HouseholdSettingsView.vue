<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { pb } from '@/shared/lib/pocketbase';
import { useAuthStore } from '@/shared/stores/auth';
import { useHouseholdStore } from '@/modules/household/stores/household';
import type { Household } from '@/shared/types';
import type { MemberRecord } from '@/modules/household/types';
import SplitRatioEditor from '@/modules/household/components/SplitRatioEditor.vue';
import MembersSection from '@/modules/household/components/MembersSection.vue';
import HouseholdDangerZone from '@/modules/household/components/HouseholdDangerZone.vue';

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
];

const REMINDER_DAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const authStore = useAuthStore();
const householdStore = useHouseholdStore();
const toast = useToast();

const fetchStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
const saveStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');

const formData = ref({
  name: '',
  currency: 'EUR',
  reminder_day: 'Monday',
});
const splitRatioForm = ref<Record<string, number>>({});
const members = ref<MemberRecord[]>([]);
const originalData = ref<{
  name: string;
  currency: string;
  reminder_day: string;
  split_ratios: Record<string, number>;
} | null>(null);

const nameError = ref('');

const splitRatioSum = computed(() =>
  Object.values(splitRatioForm.value).reduce((sum, v) => sum + (v ?? 0), 0)
);
const isSplitRatioValid = computed(() => splitRatioSum.value === 100);

const sortedMembers = computed(() =>
  [...members.value].sort((a, b) =>
    a.user_id === authStore.userId ? -1 : b.user_id === authStore.userId ? 1 : 0
  )
);

const isSingleMember = computed(() => members.value.length === 1);
const adminCount = computed(() => members.value.filter((m) => m.role === 'admin').length);
const isSoleMember = isSingleMember;

const hasChanges = computed(() => {
  if (!originalData.value) return false;
  if (formData.value.name.trim() !== originalData.value.name) return true;
  if (formData.value.currency !== originalData.value.currency) return true;
  if (formData.value.reminder_day !== originalData.value.reminder_day) return true;
  for (const [memberId, ratio] of Object.entries(splitRatioForm.value)) {
    if (originalData.value.split_ratios[memberId] !== ratio) return true;
  }
  return false;
});

const canSave = computed(
  () =>
    hasChanges.value &&
    isSplitRatioValid.value &&
    formData.value.name.trim() !== '' &&
    saveStatus.value !== 'loading'
);

function validateName() {
  nameError.value = formData.value.name.trim() === '' ? 'Household name is required' : '';
}

async function loadSettings() {
  if (fetchStatus.value === 'loading') return;
  if (!authStore.householdId) {
    fetchStatus.value = 'error';
    return;
  }
  fetchStatus.value = 'loading';
  try {
    const [household, membersList] = await Promise.all([
      pb.collection('households').getOne<Household>(authStore.householdId),
      pb.collection('members').getFullList<MemberRecord>({
        filter: `household_id = "${authStore.householdId}"`,
        expand: 'user_id',
      }),
    ]);
    formData.value.name = household.name.trim();
    formData.value.currency = household.currency;
    formData.value.reminder_day = household.reminder_day;
    members.value = membersList;
    const ratios = household.split_ratios ?? {};
    splitRatioForm.value = {};
    for (const member of membersList) {
      splitRatioForm.value[member.id] = ratios[member.id] ?? 0;
    }
    // Single-member: always 100 - InputNumber is disabled; DB may have 0 if never explicitly set
    if (membersList.length === 1 && membersList[0]) {
      splitRatioForm.value[membersList[0].id] = 100;
    }
    originalData.value = {
      name: household.name.trim(),
      currency: household.currency,
      reminder_day: household.reminder_day,
      split_ratios: { ...splitRatioForm.value },
    };
    fetchStatus.value = 'success';
  } catch {
    fetchStatus.value = 'error';
  }
}

onMounted(loadSettings);

// Reset saveStatus to 'idle' when the user edits the form after a save attempt
watch(
  [formData, splitRatioForm],
  () => {
    if (saveStatus.value === 'success' || saveStatus.value === 'error') {
      saveStatus.value = 'idle';
    }
  },
  { deep: true }
);

async function handleSave() {
  validateName();
  if (!canSave.value) return;
  if (!authStore.householdId) return;
  saveStatus.value = 'loading';
  try {
    const payload = {
      name: formData.value.name.trim(),
      currency: formData.value.currency,
      split_ratios: { ...splitRatioForm.value },
      reminder_day: formData.value.reminder_day,
    };
    const updated = await pb
      .collection('households')
      .update<Household>(authStore.householdId, payload);

    householdStore.populate({
      id: updated.id,
      name: updated.name,
      currency: updated.currency,
      split_ratios: updated.split_ratios,
      reminder_day: updated.reminder_day,
    });

    originalData.value = {
      name: updated.name,
      currency: updated.currency,
      reminder_day: updated.reminder_day,
      split_ratios: { ...updated.split_ratios },
    };
    toast.add({ severity: 'success', summary: 'Household preferences saved', life: 3000 });
    saveStatus.value = 'success';
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't save - try again", life: 5000 });
    saveStatus.value = 'error';
  }
}
</script>

<template>
  <div class="settings-page">
    <h2 class="settings-title">Household Preferences</h2>

    <template v-if="fetchStatus === 'loading' || fetchStatus === 'idle'">
      <div class="pref-sections">
        <Skeleton height="5rem" class="mb-3" />
        <Skeleton height="5rem" class="mb-3" />
        <Skeleton height="8rem" class="mb-3" />
        <Skeleton height="5rem" class="mb-3" />
      </div>
    </template>

    <template v-else-if="fetchStatus === 'success'">
      <div class="pref-sections">
        <!-- HOUSEHOLD -->
        <div class="pref-section">
          <p class="section-label">HOUSEHOLD</p>
          <div class="pref-card">
            <label class="field-label-upper" for="household-name">HOUSEHOLD NAME</label>
            <InputText
              id="household-name"
              v-model="formData.name"
              :class="{ 'p-invalid': nameError }"
              maxlength="64"
              @blur="validateName"
            />
            <small v-if="nameError" class="field-error">{{ nameError }}</small>
          </div>
        </div>

        <!-- FINANCES -->
        <div class="pref-section">
          <p class="section-label">FINANCES</p>
          <div class="pref-card">
            <label class="field-label-upper" for="currency">DISPLAY CURRENCY</label>
            <Select
              id="currency"
              v-model="formData.currency"
              :options="CURRENCY_OPTIONS"
              option-label="label"
              option-value="code"
            />
          </div>
          <SplitRatioEditor
            v-model:split-ratios="splitRatioForm"
            :members="sortedMembers"
            :is-single-member="isSingleMember"
          />
        </div>

        <!-- FOOD -->
        <div class="pref-section">
          <p class="section-label">FOOD</p>
          <div class="pref-card">
            <label class="field-label-upper" for="reminder-day">PLANNING REMINDER DAY</label>
            <Select
              id="reminder-day"
              v-model="formData.reminder_day"
              :options="REMINDER_DAY_OPTIONS"
            />
          </div>
        </div>

        <!-- MEMBERS -->
        <MembersSection
          :members="members"
          :current-user-id="authStore.userId ?? ''"
          :admin-count="adminCount"
          @changed="loadSettings"
        />

        <!-- DANGER ZONE -->
        <HouseholdDangerZone v-if="isSoleMember" />

        <Button
          label="Save Changes"
          class="save-btn"
          :disabled="!canSave"
          :loading="saveStatus === 'loading'"
          @click="handleSave"
        />
      </div>
    </template>

    <template v-else-if="fetchStatus === 'error'">
      <p class="fetch-error">
        Couldn't load settings.
        <button class="retry-btn" @click="loadSettings">Try again</button>
      </p>
    </template>
  </div>
  <Toast />
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.settings-title {
  margin-bottom: var(--space-1);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.pref-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pref-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  margin: 0;
  text-transform: uppercase;
}

.pref-card {
  background-color: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label-upper {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
}

.field-error {
  color: var(--color-balance-negative);
  font-size: 0.75rem;
  margin-top: 2px;
  display: block;
}

:deep(.p-invalid .p-inputtext),
:deep(.p-inputtext.p-invalid) {
  border-color: var(--color-balance-negative);
  background-color: color-mix(in srgb, var(--color-balance-negative) 8%, transparent);
}

.save-btn {
  width: 100%;
}

.fetch-error {
  font-size: 0.875rem;
  color: var(--color-balance-negative);
  margin: 0;
}

.retry-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--p-primary-color);
  text-decoration: underline;
  font-family: inherit;
  font-size: inherit;
  padding: 0;
}

.mb-3 {
  margin-bottom: 0.75rem;
}

@media (min-width: 768px) {
  .settings-title {
    font-size: 1.875rem;
  }
}
</style>
