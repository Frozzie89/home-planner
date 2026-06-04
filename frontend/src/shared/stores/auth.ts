import { ref } from 'vue'
import { defineStore } from 'pinia'
import { pb } from '@/shared/lib/pocketbase'
import type { Member } from '@/shared/types'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const userId = ref<string | null>(null)
  const householdId = ref<string | null>(null)
  const role = ref<'member' | 'admin' | null>(null)
  const initStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle')

  let _initPromise: Promise<void> | null = null

  async function init(): Promise<void> {
    if (initStatus.value === 'success') return
    if (_initPromise) return _initPromise

    _initPromise = (async () => {
      initStatus.value = 'loading'
      try {
        if (pb.authStore.isValid && pb.authStore.record) {
          isAuthenticated.value = true
          userId.value = pb.authStore.record.id
          await loadMembership()
        }
        initStatus.value = 'success'
      } catch {
        isAuthenticated.value = false
        userId.value = null
        initStatus.value = 'error'
      }
    })()

    try {
      await _initPromise
    } finally {
      _initPromise = null
    }
  }

  async function loadMembership() {
    if (!userId.value) return
    try {
      const member = await pb.collection('members').getFirstListItem<Member>(
        pb.filter('user_id = {:uid}', { uid: userId.value })
      )
      householdId.value = member.household_id
      role.value = member.role
    } catch (e: any) {
      // 404 = no member record = no household yet (new user or removed from household)
      if (e?.status === 404) {
        householdId.value = null
        role.value = null
      } else {
        throw e
      }
    }
  }

  async function onOAuth2Success() {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      throw new Error('Auth store not valid after OAuth2 exchange')
    }
    isAuthenticated.value = true
    userId.value = pb.authStore.record.id
    await loadMembership()
    initStatus.value = 'success'
  }

  function logout() {
    pb.authStore.clear()
    isAuthenticated.value = false
    userId.value = null
    householdId.value = null
    role.value = null
    initStatus.value = 'idle'
  }

  return { isAuthenticated, userId, householdId, role, initStatus, init, onOAuth2Success, loadMembership, logout }
})
