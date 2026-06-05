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
const inviteLink = ref('')
const inviteCopied = ref(false)
const inviteStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
let inviteCopiedTimer: ReturnType<typeof setTimeout> | null = null
const removeStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')

// Role management state
const showPromoteSheet = ref(false)
const showDemoteSheet = ref(false)
const showDeleteHouseholdSheet = ref(false)
const memberToPromote = ref<MemberRecord | null>(null)
const memberToDemote = ref<MemberRecord | null>(null)
const promoteStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
const demoteStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
const deleteHouseholdStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
const lastAdminError = ref('')

const splitRatioSum = computed(() =>
  Object.values(splitRatioForm.value).reduce((sum, v) => sum + (v ?? 0), 0)
)

const isSplitRatioValid = computed(() => splitRatioSum.value === 100)

const isSingleMember = computed(() => members.value.length === 1)
const adminCount = computed(() => members.value.filter(m => m.role === 'admin').length)
const isSoleMember = isSingleMember

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
  const u = member.expand?.user_id
  return u?.name || u?.username || u?.email || 'Unknown member'
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
    splitRatioForm.value = {}
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
  lastAdminError.value = ''
  if (member.role === 'admin' && adminCount.value === 1) {
    lastAdminError.value = 'At least one admin must remain in the household'
    return
  }
  memberToRemove.value = member
  showRemoveSheet.value = true
}

function closeRemoveSheet() {
  showRemoveSheet.value = false
  memberToRemove.value = null
  removeStatus.value = 'idle'
}

async function handleRemoveConfirm() {
  if (!memberToRemove.value || removeStatus.value === 'loading') return
  removeStatus.value = 'loading'
  try {
    await pb.collection('members').delete(memberToRemove.value.id)
    lastAdminError.value = ''
    closeRemoveSheet()
    await loadSettings()
    toast.add({ severity: 'success', summary: 'Member removed', life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't remove member — try again", life: 5000 })
    removeStatus.value = 'error'
  }
}

function closePromoteSheet() {
  showPromoteSheet.value = false
  memberToPromote.value = null
  promoteStatus.value = 'idle'
}

function handlePromoteRequest(member: MemberRecord) {
  memberToPromote.value = member
  showPromoteSheet.value = true
}

async function handlePromoteConfirm() {
  if (!memberToPromote.value || promoteStatus.value === 'loading') return
  promoteStatus.value = 'loading'
  try {
    await pb.collection('members').update(memberToPromote.value.id, { role: 'admin' })
    lastAdminError.value = ''
    closePromoteSheet()
    await loadSettings()
    toast.add({ severity: 'success', summary: 'Member promoted to Admin', life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't promote member — try again", life: 5000 })
    promoteStatus.value = 'error'
  }
}

function closeDemoteSheet() {
  showDemoteSheet.value = false
  memberToDemote.value = null
  demoteStatus.value = 'idle'
}

function handleDemoteRequest(member: MemberRecord) {
  lastAdminError.value = ''
  if (member.user_id === authStore.userId && adminCount.value === 1) {
    lastAdminError.value = 'At least one admin must remain in the household'
    return
  }
  memberToDemote.value = member
  showDemoteSheet.value = true
}

async function handleDemoteConfirm() {
  if (!memberToDemote.value || demoteStatus.value === 'loading') return
  demoteStatus.value = 'loading'
  try {
    const isSelf = memberToDemote.value.user_id === authStore.userId
    await pb.collection('members').update(memberToDemote.value.id, { role: 'member' })
    closeDemoteSheet()
    await loadSettings()
    toast.add({ severity: 'success', summary: 'Admin demoted to Member', life: 3000 })
    if (isSelf) {
      await authStore.loadMembership()
    }
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't demote admin — try again", life: 5000 })
    demoteStatus.value = 'error'
  }
}

function closeDeleteHouseholdSheet() {
  showDeleteHouseholdSheet.value = false
  deleteHouseholdStatus.value = 'idle'
}

function handleDeleteHouseholdRequest() {
  showDeleteHouseholdSheet.value = true
}

async function handleDeleteHouseholdConfirm() {
  if (deleteHouseholdStatus.value === 'loading') return
  deleteHouseholdStatus.value = 'loading'
  try {
    await pb.send('/api/household', { method: 'DELETE' })
    closeDeleteHouseholdSheet()
    await authStore.loadMembership()
    await router.push('/setup')
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't delete household — try again", life: 5000 })
    deleteHouseholdStatus.value = 'error'
  }
}

function closeInviteSheet() {
  showInviteSheet.value = false
  inviteLink.value = ''
  inviteCopied.value = false
  inviteStatus.value = 'idle'
  if (inviteCopiedTimer !== null) {
    clearTimeout(inviteCopiedTimer)
    inviteCopiedTimer = null
  }
}

async function handleInviteOpen() {
  if (!authStore.householdId) return
  inviteStatus.value = 'loading'
  try {
    // Reuse an existing unaccepted invite to avoid accumulating orphaned tokens
    let token: string
    try {
      const existing = await pb.collection('invitations').getFirstListItem<{ token: string }>(
        pb.filter('household_id = {:hid} && accepted = false', { hid: authStore.householdId })
      )
      token = existing['token']
    } catch (e: any) {
      if (e?.status !== 404) throw e
      // No existing invite — create one
      const record = await pb.collection('invitations').create<{ token: string }>({
        household_id: authStore.householdId,
      })
      token = record['token']
    }
    inviteLink.value = `${window.location.origin}/invite/${token}`
    inviteStatus.value = 'success'
    showInviteSheet.value = true
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't generate invite link — try again", life: 5000 })
    inviteStatus.value = 'error'
  }
}

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    inviteCopied.value = true
    if (inviteCopiedTimer !== null) clearTimeout(inviteCopiedTimer)
    inviteCopiedTimer = setTimeout(() => { inviteCopied.value = false; inviteCopiedTimer = null }, 1500)
  } catch {
    // clipboard may be unavailable in some environments
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
          @promote="handlePromoteRequest"
          @demote="handleDemoteRequest"
        />
        <p v-if="lastAdminError" class="last-admin-error" role="alert">{{ lastAdminError }}</p>
        <Button
          label="Invite member"
          class="invite-btn"
          outlined
          :loading="inviteStatus === 'loading'"
          @click="handleInviteOpen"
        />

        <template v-if="isSoleMember">
          <p class="section-label danger-section">DANGER ZONE</p>
          <div class="danger-zone">
            <p class="danger-description">
              You are the only member of this household. Deleting it is permanent and cannot be undone.
            </p>
            <Button
              label="Delete household"
              severity="danger"
              outlined
              class="delete-household-btn"
              @click="handleDeleteHouseholdRequest"
            />
          </div>
        </template>

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
      <label for="invite-link">Share this link</label>
      <InputText
        id="invite-link"
        :model-value="inviteLink"
        readonly
      />
    </div>
    <div class="sheet-actions">
      <Button
        :label="inviteCopied ? 'Copied!' : 'Copy link'"
        outlined
        @click="copyInviteLink"
      />
      <Button label="Done" @click="closeInviteSheet" />
    </div>
  </BottomSheet>

  <BottomSheet v-model:open="showRemoveSheet" title="Remove member">
    <p class="confirm-text">
      Remove <strong>{{ memberToRemove ? (memberToRemove.expand?.user_id?.name || memberToRemove.expand?.user_id?.email || 'this member') : '' }}</strong> from the household?
      They will lose access immediately.
    </p>
    <div class="sheet-actions">
      <Button label="Cancel" text @click="closeRemoveSheet" />
      <Button
        label="Remove"
        severity="danger"
        :loading="removeStatus === 'loading'"
        @click="handleRemoveConfirm"
      />
    </div>
  </BottomSheet>

  <BottomSheet v-model:open="showPromoteSheet" title="Promote to Admin">
    <p class="confirm-text">
      Promote <strong>{{ memberToPromote ? getMemberName(memberToPromote) : '' }}</strong> to Admin?
      They will be able to invite members, manage roles, and change household preferences.
    </p>
    <div class="sheet-actions">
      <Button label="Cancel" text @click="closePromoteSheet" />
      <Button
        label="Promote"
        :loading="promoteStatus === 'loading'"
        @click="handlePromoteConfirm"
      />
    </div>
  </BottomSheet>

  <BottomSheet v-model:open="showDemoteSheet" title="Demote to Member">
    <p class="confirm-text">
      Demote <strong>{{ memberToDemote ? getMemberName(memberToDemote) : '' }}</strong> to Member?
      They will no longer be able to manage members or household preferences.
    </p>
    <div class="sheet-actions">
      <Button label="Cancel" text @click="closeDemoteSheet" />
      <Button
        label="Demote"
        severity="danger"
        :loading="demoteStatus === 'loading'"
        @click="handleDemoteConfirm"
      />
    </div>
  </BottomSheet>

  <BottomSheet v-model:open="showDeleteHouseholdSheet" title="Delete Household">
    <p class="confirm-text">
      <strong>This action is permanent and cannot be undone.</strong>
    </p>
    <p class="confirm-text">
      All expenses, meal plans, grocery lists, invitations, and member data for this household will be permanently deleted. There is no recovery.
    </p>
    <div class="sheet-actions">
      <Button label="Cancel" text @click="closeDeleteHouseholdSheet" />
      <Button
        label="Delete household"
        severity="danger"
        :loading="deleteHouseholdStatus === 'loading'"
        @click="handleDeleteHouseholdConfirm"
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

.last-admin-error {
  font-size: 0.875rem;
  color: var(--color-balance-negative);
  margin: 0;
  padding: var(--space-1) 0;
}

.danger-section {
  color: var(--color-balance-negative);
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid color-mix(in srgb, var(--color-balance-negative) 30%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-balance-negative) 5%, transparent);
}

.danger-description {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.delete-household-btn {
  width: 100%;
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
