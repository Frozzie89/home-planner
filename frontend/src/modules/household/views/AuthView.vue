<template>
  <div class="auth-view">
    <div v-if="callbackStatus === 'loading'" class="auth-loading">
      <span>Completing sign-in…</span>
    </div>

    <div v-else-if="callbackStatus === 'error'" class="auth-error">
      <p>{{ errorMessage }}</p>
      <button @click="resetToSignIn">Try again</button>
    </div>

    <div v-else class="auth-signin">
      <h1>Home Planner</h1>
      <div v-if="providersStatus === 'loading'">
        <span>Loading…</span>
      </div>
      <div v-else-if="providersStatus === 'error'" class="auth-error">
        <p>{{ errorMessage }}</p>
      </div>
      <div v-else-if="providers.length === 0">
        <p>No sign-in providers are configured on this instance. If you manage this server, enable at least one OAuth2 provider in the PocketBase admin panel under Settings → Auth providers.</p>
      </div>
      <div v-else>
        <button
          v-for="provider in providers"
          :key="provider.name"
          @click="startOAuth(provider)"
          class="auth-provider-btn"
        >
          Sign in with {{ capitalise(provider.name) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { pb } from '@/shared/lib/pocketbase'
import { useAuthStore } from '@/shared/stores/auth'

interface OAuth2Provider {
  name: string
  state: string
  codeVerifier: string
  authURL: string
}

const router = useRouter()
const authStore = useAuthStore()

const callbackStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
const providersStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')
const providers = ref<OAuth2Provider[]>([])
const errorMessage = ref('')

function capitalise(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function resetToSignIn() {
  callbackStatus.value = 'idle'
  errorMessage.value = ''
  loadProviders()
}

async function loadProviders() {
  providersStatus.value = 'loading'
  try {
    const authMethods = await pb.collection('users').listAuthMethods()
    providers.value = authMethods.oauth2.providers
    providersStatus.value = 'success'
  } catch (e: any) {
    if (e?.status === 0 || e?.isAbort) {
      providersStatus.value = 'error'
      errorMessage.value = 'Cannot reach the authentication server. Check that PocketBase is running and reachable.'
    } else {
      providersStatus.value = 'error'
      errorMessage.value = `Sign-in unavailable (${e?.status ?? 'unknown error'}). Check the PocketBase admin panel.`
    }
  }
}

async function startOAuth(provider: OAuth2Provider) {
  const redirectUrl = `${window.location.origin}/auth`
  try {
    sessionStorage.setItem(
      'oauth_provider',
      JSON.stringify({ name: provider.name, state: provider.state, codeVerifier: provider.codeVerifier })
    )
  } catch {
    callbackStatus.value = 'error'
    errorMessage.value = 'Sign-in is unavailable in this browser context. Please try a regular (non-private) window.'
    return
  }
  window.location.href = `${provider.authURL}${encodeURIComponent(redirectUrl)}`
}

async function handleCallback(code: string, state: string) {
  callbackStatus.value = 'loading'
  try {
    const saved = JSON.parse(sessionStorage.getItem('oauth_provider') || '{}')
    if (saved.state !== state) {
      callbackStatus.value = 'error'
      errorMessage.value = 'Authentication failed — please try again.'
      return
    }

    const redirectUrl = `${window.location.origin}/auth`
    await pb.collection('users').authWithOAuth2Code(saved.name, code, saved.codeVerifier, redirectUrl)
    sessionStorage.removeItem('oauth_provider')

    await authStore.onOAuth2Success()
    callbackStatus.value = 'success'

    if (authStore.householdId) {
      router.replace('/finances')
    } else {
      router.replace('/setup')
    }
  } catch {
    callbackStatus.value = 'error'
    errorMessage.value = 'Sign-in failed. Please try again.'
  }
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) {
    callbackStatus.value = 'error'
    errorMessage.value = 'Sign-in was denied by the provider. Please try again.'
    return
  }

  if (code && state) {
    await handleCallback(code, state)
    return
  }

  if (code || state) {
    callbackStatus.value = 'error'
    errorMessage.value = 'Incomplete sign-in response. Please try again.'
    return
  }

  await loadProviders()
})
</script>
