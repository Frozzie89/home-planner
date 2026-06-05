<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { useRouter } from 'vue-router'
import { pb } from '@/shared/lib/pocketbase'
import { useAuthStore } from '@/shared/stores/auth'
import UserAvatar from '@/shared/components/UserAvatar.vue'
import type { MemberRecord } from '@/modules/household/types'

const authStore = useAuthStore()
const toast = useToast()
const router = useRouter()

const fetchStatus = ref<'idle' | 'loading' | 'error' | 'success'>('loading')
const saveStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
const avatarUploadStatus = ref<'idle' | 'loading'>('idle')

const member = ref<MemberRecord | null>(null)
const currentDisplayName = ref('')
const displayNameInput = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

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

function handleLogout() {
  authStore.logout()
  router.push('/auth')
}

async function handleAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !authStore.userId) return
  avatarUploadStatus.value = 'loading'
  try {
    const formData = new FormData()
    formData.append('avatar', file)
    const updated = await pb.collection('users').update(authStore.userId, formData)
    pb.authStore.save(pb.authStore.token, updated)
    toast.add({ severity: 'success', summary: 'Profile picture updated', life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: "Couldn't update picture — try again", life: 3000 })
  } finally {
    avatarUploadStatus.value = 'idle'
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

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
        <div class="pref-card avatar-card">
          <label for="avatar-upload" class="field-label-upper">PROFILE PICTURE</label>
          <button
            id="avatar-upload"
            type="button"
            class="avatar-btn"
            :disabled="avatarUploadStatus === 'loading'"
            aria-label="Change profile picture"
            @click="fileInputRef?.click()"
          >
            <UserAvatar :size="72" />
            <span class="avatar-overlay" :class="{ 'is-loading': avatarUploadStatus === 'loading' }" aria-hidden="true">
              <i :class="avatarUploadStatus === 'loading' ? 'pi pi-spin pi-spinner' : 'pi pi-camera'" />
            </span>
          </button>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="sr-only"
            @change="handleAvatarChange"
          />
        </div>
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
        label="Sign out"
        severity="secondary"
        outlined
        class="sign-out-btn"
        @click="handleLogout"
      />

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

.avatar-btn {
  align-self: center;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  /* match the avatar size exactly so the overlay clips correctly */
  width: 72px;
  height: 72px;
}

.avatar-btn:disabled {
  cursor: wait;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.25rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.avatar-btn:hover .avatar-overlay,
.avatar-btn:focus-visible .avatar-overlay,
.avatar-overlay.is-loading {
  opacity: 1;
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

.save-btn,
.sign-out-btn {
  width: 100%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
