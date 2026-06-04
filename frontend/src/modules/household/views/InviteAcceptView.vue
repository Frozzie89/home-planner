<template>
  <div class="invite-view">
    <div v-if="viewState === 'validating'" class="invite-validating">
      <span>Checking your invitation…</span>
    </div>

    <div v-else-if="viewState === 'valid'" class="invite-valid">
      <h1>You're invited!</h1>
      <p class="invite-household">Join <strong>{{ householdName }}</strong></p>
      <button
        v-for="provider in providers"
        :key="provider.name"
        class="auth-provider-btn"
        @click="signIn(provider)"
      >
        Sign in with {{ capitalise(provider.name) }} to join
      </button>
      <div v-if="providers.length === 0 && providersStatus === 'success'" class="invite-error">
        <p>No sign-in providers are available. Please contact the household admin.</p>
      </div>
    </div>

    <div v-else-if="viewState === 'invalid'" class="invite-invalid">
      <p class="invite-error-msg">This invitation link is invalid or has already been used.</p>
      <a href="/" class="invite-home-link">Back to home</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { pb } from '@/shared/lib/pocketbase'

interface OAuth2Provider {
  name: string
  state: string
  codeVerifier: string
  authURL: string
}

const route = useRoute()

const viewState = ref<'validating' | 'valid' | 'invalid'>('validating')
const householdName = ref('')
const providers = ref<OAuth2Provider[]>([])
const providersStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

function capitalise(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

async function loadProviders() {
  providersStatus.value = 'loading'
  try {
    const authMethods = await pb.collection('users').listAuthMethods()
    providers.value = authMethods.oauth2.providers
    providersStatus.value = 'success'
  } catch {
    providersStatus.value = 'error'
  }
}

async function validateToken(token: string) {
  try {
    const result = await pb.send('/api/invite/' + token, { method: 'GET' }) as { householdName: string }
    householdName.value = result.householdName
    viewState.value = 'valid'
    await loadProviders()
  } catch {
    viewState.value = 'invalid'
  }
}

function signIn(provider: OAuth2Provider) {
  const token = route.params['token'] as string
  try {
    localStorage.setItem('pending_invite_token', token)
    sessionStorage.setItem(
      'oauth_provider',
      JSON.stringify({ name: provider.name, state: provider.state, codeVerifier: provider.codeVerifier })
    )
  } catch {
    // storage unavailable — proceed anyway, invite acceptance will fail gracefully
  }
  const redirectUrl = `${window.location.origin}/auth`
  window.location.href = `${provider.authURL}${encodeURIComponent(redirectUrl)}`
}

onMounted(async () => {
  const token = route.params['token'] as string
  if (!token) {
    viewState.value = 'invalid'
    return
  }
  await validateToken(token)
})
</script>

<style scoped>
.invite-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: var(--space-4);
  text-align: center;
}

.invite-valid h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--space-2);
  color: var(--color-text-primary);
}

.invite-household {
  font-size: 1rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-4);
}

.auth-provider-btn {
  display: block;
  width: 100%;
  max-width: 320px;
  margin: 0 auto var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--p-primary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  min-height: 44px;
}

.auth-provider-btn:hover {
  opacity: 0.9;
}

.invite-validating {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.invite-error-msg {
  color: var(--color-balance-negative);
  font-size: 0.875rem;
  margin-bottom: var(--space-2);
}

.invite-home-link {
  color: var(--p-primary-color);
  font-size: 0.875rem;
  text-decoration: underline;
}
</style>
