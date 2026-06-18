<script setup lang="ts">
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { pb } from '@/shared/lib/pocketbase';
import { useAuthStore } from '@/shared/stores/auth';
import { getMemberName } from '@/shared/lib/memberHelpers';
import type { MemberRecord } from '@/modules/household/types';
import MemberList from '@/modules/household/components/MemberList.vue';
import BottomSheet from '@/shared/components/BottomSheet.vue';

const props = defineProps<{
  members: MemberRecord[];
  currentUserId: string;
  adminCount: number;
}>();

const emit = defineEmits<{
  changed: [];
}>();

const authStore = useAuthStore();
const toast = useToast();

const showInviteSheet = ref(false);
const showRemoveSheet = ref(false);
const showPromoteSheet = ref(false);
const showDemoteSheet = ref(false);

const memberToRemove = ref<MemberRecord | null>(null);
const memberToPromote = ref<MemberRecord | null>(null);
const memberToDemote = ref<MemberRecord | null>(null);

const inviteLink = ref('');
const inviteCopied = ref(false);
const inviteStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
let inviteCopiedTimer: ReturnType<typeof setTimeout> | null = null;

const removeStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
const promoteStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
const demoteStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');
const lastAdminError = ref('');

function closeInviteSheet() {
  showInviteSheet.value = false;
  inviteLink.value = '';
  inviteCopied.value = false;
  inviteStatus.value = 'idle';
  if (inviteCopiedTimer !== null) {
    clearTimeout(inviteCopiedTimer);
    inviteCopiedTimer = null;
  }
}

async function handleInviteOpen() {
  if (!authStore.householdId) return;
  if (inviteStatus.value === 'loading') return;
  inviteStatus.value = 'loading';
  try {
    // Reuse an existing unaccepted invite to avoid accumulating orphaned tokens
    let token: string;
    try {
      const existing = await pb.collection('invitations').getFirstListItem<{
        token: string;
      }>(pb.filter('household_id = {:hid} && accepted = false', { hid: authStore.householdId }));
      token = existing['token'];
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
      const record = await pb.collection('invitations').create<{ token: string }>({
        household_id: authStore.householdId,
      });
      token = record['token'];
    }
    inviteLink.value = `${window.location.origin}/invite/${token}`;
    inviteStatus.value = 'success';
    showInviteSheet.value = true;
  } catch {
    toast.add({
      severity: 'error',
      summary: "Couldn't generate invite link - try again",
      life: 5000,
    });
    inviteStatus.value = 'error';
  }
}

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    inviteCopied.value = true;
    if (inviteCopiedTimer !== null) clearTimeout(inviteCopiedTimer);
    inviteCopiedTimer = setTimeout(() => {
      inviteCopied.value = false;
      inviteCopiedTimer = null;
    }, 1500);
  } catch {
    // clipboard may be unavailable in some environments
  }
}

function handleRemoveMemberRequest(member: MemberRecord) {
  lastAdminError.value = '';
  if (member.role === 'admin' && props.adminCount === 1) {
    lastAdminError.value = 'At least one admin must remain in the household';
    return;
  }
  memberToRemove.value = member;
  showRemoveSheet.value = true;
}

function closeRemoveSheet() {
  showRemoveSheet.value = false;
  memberToRemove.value = null;
  removeStatus.value = 'idle';
}

async function handleRemoveConfirm() {
  if (!memberToRemove.value || removeStatus.value === 'loading') return;
  removeStatus.value = 'loading';
  try {
    await pb.collection('members').delete(memberToRemove.value.id);
    lastAdminError.value = '';
    closeRemoveSheet();
    emit('changed');
    toast.add({ severity: 'success', summary: 'Member removed', life: 3000 });
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't remove member - try again", life: 5000 });
    removeStatus.value = 'error';
  }
}

function handlePromoteRequest(member: MemberRecord) {
  memberToPromote.value = member;
  showPromoteSheet.value = true;
}

function closePromoteSheet() {
  showPromoteSheet.value = false;
  memberToPromote.value = null;
  promoteStatus.value = 'idle';
}

async function handlePromoteConfirm() {
  if (!memberToPromote.value || promoteStatus.value === 'loading') return;
  promoteStatus.value = 'loading';
  try {
    await pb.collection('members').update(memberToPromote.value.id, { role: 'admin' });
    lastAdminError.value = '';
    closePromoteSheet();
    emit('changed');
    toast.add({ severity: 'success', summary: 'Member promoted to Admin', life: 3000 });
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't promote member - try again", life: 5000 });
    promoteStatus.value = 'error';
  }
}

function handleDemoteRequest(member: MemberRecord) {
  lastAdminError.value = '';
  if (member.user_id === props.currentUserId && props.adminCount === 1) {
    lastAdminError.value = 'At least one admin must remain in the household';
    return;
  }
  memberToDemote.value = member;
  showDemoteSheet.value = true;
}

function closeDemoteSheet() {
  showDemoteSheet.value = false;
  memberToDemote.value = null;
  demoteStatus.value = 'idle';
}

async function handleDemoteConfirm() {
  if (!memberToDemote.value || demoteStatus.value === 'loading') return;
  demoteStatus.value = 'loading';
  try {
    const isSelf = memberToDemote.value.user_id === props.currentUserId;
    await pb.collection('members').update(memberToDemote.value.id, { role: 'member' });
    closeDemoteSheet();
    emit('changed');
    toast.add({ severity: 'success', summary: 'Admin demoted to Member', life: 3000 });
    if (isSelf) {
      await authStore.loadMembership();
    }
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't demote admin - try again", life: 5000 });
    demoteStatus.value = 'error';
  }
}
</script>

<template>
  <div class="pref-section">
    <p class="section-label">MEMBERS</p>
    <div class="pref-card members-card">
      <MemberList
        :members="members"
        :current-user-id="currentUserId"
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
    </div>
  </div>

  <BottomSheet v-model:open="showInviteSheet" title="Invite member">
    <div class="form-field">
      <label for="invite-link">Share this link</label>
      <InputText id="invite-link" :model-value="inviteLink" readonly />
    </div>
    <div class="sheet-actions">
      <Button :label="inviteCopied ? 'Copied!' : 'Copy link'" outlined @click="copyInviteLink" />
      <Button label="Done" @click="closeInviteSheet" />
    </div>
  </BottomSheet>

  <BottomSheet v-model:open="showRemoveSheet" title="Remove member">
    <p class="confirm-text">
      Remove <strong>{{ memberToRemove ? getMemberName(memberToRemove) : '' }}</strong> from the
      household? They will lose access immediately.
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
</template>

<style scoped>
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

.members-card {
  gap: var(--space-1);
}

.invite-btn {
  width: 100%;
  margin-top: var(--space-1);
}

:deep(.invite-btn .p-button-label) {
  color: color-mix(in srgb, var(--p-primary-color), black 30%);
}

.last-admin-error {
  font-size: 0.875rem;
  color: var(--color-balance-negative);
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
</style>
