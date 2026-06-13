<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import { pb } from '@/shared/lib/pocketbase';
import { useAuthStore } from '@/shared/stores/auth';
import BottomSheet from '@/shared/components/BottomSheet.vue';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const showDeleteHouseholdSheet = ref(false);
const deleteHouseholdStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');

function closeDeleteHouseholdSheet() {
  showDeleteHouseholdSheet.value = false;
  deleteHouseholdStatus.value = 'idle';
}

async function handleDeleteHouseholdConfirm() {
  if (deleteHouseholdStatus.value === 'loading') return;
  deleteHouseholdStatus.value = 'loading';
  try {
    await pb.send('/api/household', { method: 'DELETE' });
    closeDeleteHouseholdSheet();
    await authStore.loadMembership();
    await router.push('/setup');
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't delete household - try again", life: 5000 });
    deleteHouseholdStatus.value = 'error';
  }
}
</script>

<template>
  <div class="pref-section">
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
        @click="showDeleteHouseholdSheet = true"
      />
    </div>
  </div>

  <BottomSheet v-model:open="showDeleteHouseholdSheet" title="Delete Household">
    <p class="confirm-text">
      <strong>This action is permanent and cannot be undone.</strong>
    </p>
    <p class="confirm-text">
      All expenses, meal plans, grocery lists, invitations, and member data for this household will
      be permanently deleted. There is no recovery.
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

.danger-section {
  color: var(--color-balance-negative);
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid color-mix(in srgb, var(--color-balance-negative) 30%, transparent);
  border-radius: 10px;
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
