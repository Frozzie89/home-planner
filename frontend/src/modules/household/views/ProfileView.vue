<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { pb } from '@/shared/lib/pocketbase'
import { useAuthStore } from '@/shared/stores/auth'
import type { MemberRecord } from '@/modules/household/types'

const authStore = useAuthStore()
const toast = useToast()

const fetchStatus = ref<'idle' | 'loading' | 'error' | 'success'>('loading')
const saveStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')

const member = ref<MemberRecord | null>(null)
const currentDisplayName = ref('')
const displayNameInput = ref('')

const fallbackName = computed(() => {
  const u = member.value?.expand?.user_id
  return u?.name || u?.username || u?.email || 'Unknown member'
})

const hasChange = computed(() => displayNameInput.value.trim() !== currentDisplayName.value)

const isSaveDisabled = computed(
  () => !hasChange.value || saveStatus.value === 'loading'
)

onMounted(async () => {
  if (!authStore.memberId) { fetchStatus.value = 'error'; return }
  try {
    const record = await pb.collection('members').getOne<MemberRecord>(
      authStore.memberId,
      { expand: 'user_id' }
    )
    member.value = record
    currentDisplayName.value = record.display_name ?? ''
    displayNameInput.value = record.display_name ?? ''
    fetchStatus.value = 'success'
  } catch {
    fetchStatus.value = 'error'
  }
})

async function save() {
  if (!authStore.memberId || isSaveDisabled.value) return
  saveStatus.value = 'loading'
  try {
    const trimmed = displayNameInput.value.trim()
    await pb.collection('members').update(authStore.memberId, { display_name: trimmed })
    currentDisplayName.value = trimmed
    displayNameInput.value = trimmed
    saveStatus.value = 'success'
    toast.add({ severity: 'success', summary: 'Display name saved', life: 3000 })
  } catch {
    saveStatus.value = 'error'
    toast.add({ severity: 'error', summary: "Couldn't save — try again", life: 3000 })
  }
}
</script>

<template>
  <Toast aria-live="polite" />
  <div class="profile-view">
    <h2 class="profile-title">My Profile</h2>

    <div v-if="fetchStatus === 'loading'" class="pref-sections">
      <Skeleton height="5rem" />
    </div>

    <div v-else-if="fetchStatus === 'error'" class="error-state">
      <p>Couldn't load your profile. Please refresh and try again.</p>
    </div>

    <form v-else class="pref-sections" @submit.prevent="save">
      <div class="pref-section">
        <p class="section-label">PROFILE</p>
        <div class="pref-card">
          <label for="display-name" class="field-label-upper">DISPLAY NAME</label>
          <InputText
            id="display-name"
            v-model="displayNameInput"
            maxlength="64"
            placeholder="Enter a display name"
            class="display-name-input"
            aria-describedby="display-name-hint"
          />
          <span id="display-name-hint" class="field-hint">
            If left empty, your name will appear as
            <strong>{{ fallbackName }}</strong>
          </span>
        </div>
      </div>

      <Button
        type="submit"
        label="Save"
        :disabled="isSaveDisabled"
        :loading="saveStatus === 'loading'"
        class="save-btn"
      />
    </form>
  </div>
</template>

<style scoped>
.profile-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.profile-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
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

.display-name-input {
  width: 100%;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.save-btn {
  width: 100%;
}

.error-state {
  color: var(--color-balance-negative);
  font-size: 0.875rem;
}

@media (min-width: 768px) {
  .profile-title {
    font-size: 1.875rem;
  }
}
</style>
