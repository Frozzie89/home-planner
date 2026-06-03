<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { pb } from '@/shared/lib/pocketbase'
import { useAuthStore } from '@/shared/stores/auth'
import { useHouseholdStore } from '@/modules/household/stores/household'
import type { Household } from '@/shared/types'
import type { MemberRecord } from '@/modules/household/types'
import MemberList from '@/modules/household/components/MemberList.vue'
import BottomSheet from '@/shared/components/BottomSheet.vue'

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

const REMINDER_DAY_OPTIONS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

const router = useRouter()
const authStore = useAuthStore()
const householdStore = useHouseholdStore()
const toast = useToast()

const fetchStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
const saveStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')

const formData = ref({
  name: '',
  currency: 'EUR',
  reminder_day: 'Monday',
})
const splitRatioForm = ref<Record<string, number>>({})
const members = ref<MemberRecord[]>([])
const originalData = ref<{
  name: string
  currency: string
  reminder_day: string
  split_ratios: Record<string, number>
} | null>(null)

const nameError = ref('')

// Member management state
const showInviteSheet = ref(false)
const showRemoveSheet = ref(false)
const memberToRemove = ref<MemberRecord | null>(null)
const inviteEmail = ref('')
const inviteEmailError = ref('')
const inviteStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
const removeStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')

const splitRatioSum = computed(() =>
  Object.values(splitRatioForm.value).reduce((sum, v) => sum + (v ?? 0), 0)
)

const isSplitRatioValid = computed(() => splitRatioSum.value === 100)

const isSingleMember = computed(() => members.value.length === 1)

const hasChanges = computed(() => {
  if (!originalData.value) return false
  if (formData.value.name.trim() !== originalData.value.name) return true
  if (formData.value.currency !== originalData.value.currency) return true
  if (formData.value.reminder_day !== originalData.value.reminder_day) return true
  for (const [memberId, ratio] of Object.entries(splitRatioForm.value)) {
    if (originalData.value.split_ratios[memberId] !== ratio) return true
  }
  return false
})

const canSave = computed(() =>
  hasChanges.value &&
  isSplitRatioValid.value &&
  formData.value.name.trim() !== '' &&
  saveStatus.value !== 'loading'
)

function validateName() {
  nameError.value = formData.value.name.trim() === '' ? 'Household name is required' : ''
}

function getMemberName(member: MemberRecord): string {
  return member.expand?.user_id?.name || member.expand?.user_id?.email || 'Member'
}

function onSplitRatioChange(changedMemberId: string) {
  if (members.value.length !== 2) return
  const otherMember = members.value.find(m => m.id !== changedMemberId)
  if (!otherMember) return
  const changedValue = splitRatioForm.value[changedMemberId] ?? 0
  splitRatioForm.value[otherMember.id] = Math.max(0, Math.min(100, 100 - changedValue))
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/finances')
}

async function loadSettings() {
  if (fetchStatus.value === 'loading') return
  if (!authStore.householdId) { fetchStatus.value = 'error'; return }
  fetchStatus.value = 'loading'
  try {
    const [household, membersList] = await Promise.all([
      pb.collection('households').getOne<Household>(authStore.householdId),
      pb.collection('members').getFullList<MemberRecord>({
        filter: `household_id = "${authStore.householdId}"`,
        expand: 'user_id',
      }),
    ])
    formData.value.name = household.name.trim()
    formData.value.currency = household.currency
    formData.value.reminder_day = household.reminder_day
    members.value = membersList
    for (const member of membersList) {
      splitRatioForm.value[member.id] = household.split_ratios[member.id] ?? 0
    }
    // Single-member: always 100 — InputNumber is disabled; DB may have 0 if never explicitly set
    if (membersList.length === 1 && membersList[0]) {
      splitRatioForm.value[membersList[0].id] = 100
    }
    originalData.value = {
      name: household.name.trim(),
      currency: household.currency,
      reminder_day: household.reminder_day,
      split_ratios: { ...splitRatioForm.value },
    }
    fetchStatus.value = 'success'
  } catch {
    fetchStatus.value = 'error'
  }
}

onMounted(loadSettings)

// Reset saveStatus to 'idle' when the user edits the form after a save attempt
watch([formData, splitRatioForm], () => {
  if (saveStatus.value === 'success' || saveStatus.value === 'error') {
    saveStatus.value = 'idle'
  }
}, { deep: true })

function handleRemoveMemberRequest(member: MemberRecord) {
  memberToRemove.value = member
  showRemoveSheet.value = true
}

async function handleRemoveConfirm() {
  if (!memberToRemove.value) return
  removeStatus.value = 'loading'
  try {
    await pb.collection('members').delete(memberToRemove.value.id)
    showRemoveSheet.value = false
    memberToRemove.value = null
    removeStatus.value = 'idle'
    await loadSettings()
    toast.add({ severity: 'success', summary: 'Member removed', life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't remove member — try again", life: 5000 })
    removeStatus.value = 'error'
  }
}

function validateInviteEmail(): boolean {
  const email = inviteEmail.value.trim()
  if (!email) {
    inviteEmailError.value = 'Email is required'
    return false
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    inviteEmailError.value = 'Please enter a valid email address'
    return false
  }
  inviteEmailError.value = ''
  return true
}

function closeInviteSheet() {
  showInviteSheet.value = false
  inviteEmail.value = ''
  inviteEmailError.value = ''
  inviteStatus.value = 'idle'
}

async function handleInviteSubmit() {
  if (!validateInviteEmail()) return
  if (!authStore.householdId) return
  inviteStatus.value = 'loading'
  const emailSnapshot = inviteEmail.value.trim()
  try {
    await pb.collection('invitations').create({
      household_id: authStore.householdId,
      invited_email: emailSnapshot,
    })
    closeInviteSheet()
    toast.add({
      severity: 'success',
      summary: 'Invitation sent',
      detail: `An invitation has been registered for ${emailSnapshot}. They can join after signing in.`,
      life: 5000,
    })
    inviteStatus.value = 'success'
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't send invitation — try again", life: 5000 })
    inviteStatus.value = 'error'
  }
}

async function handleSave() {
  validateName()
  if (!canSave.value) return
  if (!authStore.householdId) return
  saveStatus.value = 'loading'
  try {
    const payload = {
      name: formData.value.name.trim(),
      currency: formData.value.currency,
      split_ratios: { ...splitRatioForm.value },
      reminder_day: formData.value.reminder_day,
    }
    const updated = await pb.collection('households').update<Household>(authStore.householdId, payload)

    householdStore.populate({
      id: updated.id,
      name: updated.name,
      currency: updated.currency,
      split_ratios: updated.split_ratios,
      reminder_day: updated.reminder_day,
    })

    originalData.value = {
      name: updated.name,
      currency: updated.currency,
      reminder_day: updated.reminder_day,
      split_ratios: { ...updated.split_ratios },
    }
    toast.add({ severity: 'success', summary: 'Household preferences saved', life: 3000 })
    saveStatus.value = 'success'
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't save — try again", life: 5000 })
    saveStatus.value = 'error'
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <button class="back-btn" @click="goBack">
        <i class="pi pi-arrow-left" />
        <span>Back</span>
      </button>
      <h2 class="settings-title">Household Preferences</h2>
    </div>

    <template v-if="fetchStatus === 'loading' || fetchStatus === 'idle'">
      <Skeleton height="3rem" class="mb-3" />
      <Skeleton height="3rem" class="mb-3" />
      <Skeleton height="3rem" class="mb-3" />
      <Skeleton height="3rem" class="mb-3" />
    </template>

    <template v-else-if="fetchStatus === 'success'">
      <div class="settings-card">
        <p class="section-label">HOUSEHOLD</p>
        <div class="form-field">
          <label for="household-name">Household name</label>
          <InputText
            id="household-name"
            v-model="formData.name"
            :class="{ 'p-invalid': nameError }"
            maxlength="64"
            @blur="validateName"
          />
          <small v-if="nameError" class="field-error">{{ nameError }}</small>
        </div>

        <p class="section-label">FINANCES</p>
        <div class="form-field">
          <label for="currency">Display currency</label>
          <Select
            id="currency"
            v-model="formData.currency"
            :options="CURRENCY_OPTIONS"
            option-label="label"
            option-value="code"
          />
        </div>
        <div class="form-field">
          <p class="field-label">Default split ratio</p>
          <div
            v-for="member in members"
            :key="member.id"
            class="split-row"
          >
            <span class="member-name">{{ getMemberName(member) }}</span>
            <InputNumber
              v-model="splitRatioForm[member.id]"
              :disabled="isSingleMember"
              :min="0"
              :max="100"
              :max-fraction-digits="0"
              suffix="%"
              @update:model-value="onSplitRatioChange(member.id)"
            />
          </div>
          <div
            class="split-sum"
            :class="{ valid: isSplitRatioValid, invalid: !isSplitRatioValid }"
          >
            {{ splitRatioSum }} / 100
            <span v-if="isSplitRatioValid"> ✓</span>
            <span v-else> — adjust to reach 100</span>
          </div>
        </div>

        <p class="section-label">FOOD</p>
        <div class="form-field">
          <label for="reminder-day">Planning reminder day</label>
          <Select
            id="reminder-day"
            v-model="formData.reminder_day"
            :options="REMINDER_DAY_OPTIONS"
          />
        </div>

        <p class="section-label">MEMBERS</p>
        <MemberList
          :members="members"
          :current-user-id="authStore.userId ?? ''"
          @remove="handleRemoveMemberRequest"
        />
        <Button
          label="Invite member"
          class="invite-btn"
          outlined
          @click="showInviteSheet = true"
        />

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
  <BottomSheet v-model:open="showInviteSheet" title="Invite member">
    <div class="form-field">
      <label for="invite-email">Email address</label>
      <InputText
        id="invite-email"
        v-model="inviteEmail"
        type="email"
        placeholder="name@example.com"
        :class="{ 'p-invalid': inviteEmailError }"
        @blur="validateInviteEmail"
      />
      <small v-if="inviteEmailError" class="field-error">{{ inviteEmailError }}</small>
    </div>
    <div class="sheet-actions">
      <Button label="Cancel" text @click="closeInviteSheet" />
      <Button
        label="Send invite"
        :disabled="!inviteEmail.trim() || !!inviteEmailError"
        :loading="inviteStatus === 'loading'"
        @click="handleInviteSubmit"
      />
    </div>
  </BottomSheet>

  <BottomSheet v-model:open="showRemoveSheet" title="Remove member">
    <p class="confirm-text">
      Remove <strong>{{ memberToRemove ? (memberToRemove.expand?.user_id?.name || memberToRemove.expand?.user_id?.email || 'this member') : '' }}</strong> from the household?
      They will lose access immediately.
    </p>
    <div class="sheet-actions">
      <Button label="Cancel" text @click="showRemoveSheet = false" />
      <Button
        label="Remove"
        severity="danger"
        :loading="removeStatus === 'loading'"
        @click="handleRemoveConfirm"
      />
    </div>
  </BottomSheet>

  <Toast />
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-primary);
  border-radius: 8px;
  padding: 0 8px 0 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.back-btn:hover {
  background-color: var(--p-surface-hover);
}

.settings-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.settings-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  margin: var(--space-2) 0 var(--space-1);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label,
.field-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text-primary);
  margin: 0;
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

.split-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.member-name {
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

.split-sum {
  font-size: 0.875rem;
  font-weight: 500;
  padding: var(--space-1) 0;
}

.split-sum.valid {
  color: var(--color-balance-positive, #22c55e);
}

.split-sum.invalid {
  color: var(--color-balance-negative);
}

.save-btn {
  width: 100%;
  margin-top: var(--space-2);
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

.invite-btn {
  width: 100%;
  margin-top: var(--space-1);
}

.sheet-actions {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
  margin-top: var(--space-2);
}

.confirm-text {
  font-size: 0.875rem;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
}

@media (min-width: 768px) {
  .settings-card {
    max-width: 480px;
    margin: 0 auto;
    background-color: var(--p-surface-card);
    border-radius: 12px;
    padding: var(--space-4);
  }
}
</style>
