import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockClear, mockGetFirstListItem } = vi.hoisted(() => ({
  mockClear: vi.fn(),
  mockGetFirstListItem: vi.fn(),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    authStore: {
      isValid: false,
      record: null,
      clear: mockClear,
    },
    collection: vi.fn(() => ({
      getFirstListItem: mockGetFirstListItem,
    })),
    filter: vi.fn((expr: string) => expr),
  },
}))

import { pb } from '@/shared/lib/pocketbase'
import { useAuthStore } from './auth'

const mockAuthStore = pb.authStore as unknown as {
  isValid: boolean
  record: { id: string } | null
  clear: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockAuthStore.isValid = false
  mockAuthStore.record = null
})

describe('useAuthStore', () => {
  describe('init()', () => {
    it('populates isAuthenticated and userId when pb.authStore.isValid is true', async () => {
      mockAuthStore.isValid = true
      mockAuthStore.record = { id: 'user-123' }
      mockGetFirstListItem.mockRejectedValueOnce({ status: 404 })

      const store = useAuthStore()
      await store.init()

      expect(store.isAuthenticated).toBe(true)
      expect(store.userId).toBe('user-123')
      expect(store.initStatus).toBe('success')
    })

    it('sets householdId and role when member record exists', async () => {
      mockAuthStore.isValid = true
      mockAuthStore.record = { id: 'user-123' }
      mockGetFirstListItem.mockResolvedValueOnce({
        id: 'member-1',
        household_id: 'hh-456',
        user_id: 'user-123',
        role: 'admin',
        created: '',
        updated: '',
      })

      const store = useAuthStore()
      await store.init()

      expect(store.householdId).toBe('hh-456')
      expect(store.role).toBe('admin')
    })

    it('leaves householdId null when members query returns 404', async () => {
      mockAuthStore.isValid = true
      mockAuthStore.record = { id: 'user-123' }
      mockGetFirstListItem.mockRejectedValueOnce({ status: 404 })

      const store = useAuthStore()
      await store.init()

      expect(store.householdId).toBeNull()
      expect(store.role).toBeNull()
    })

    it('leaves isAuthenticated false when pb.authStore.isValid is false', async () => {
      mockAuthStore.isValid = false
      mockAuthStore.record = null

      const store = useAuthStore()
      await store.init()

      expect(store.isAuthenticated).toBe(false)
      expect(store.userId).toBeNull()
      expect(store.initStatus).toBe('success')
    })

    it('resets isAuthenticated and userId when loadMembership throws non-404', async () => {
      mockAuthStore.isValid = true
      mockAuthStore.record = { id: 'user-123' }
      mockGetFirstListItem.mockRejectedValueOnce({ status: 500 })

      const store = useAuthStore()
      await store.init()

      expect(store.isAuthenticated).toBe(false)
      expect(store.userId).toBeNull()
      expect(store.initStatus).toBe('error')
    })

    it('is a no-op when already loading (concurrency guard)', async () => {
      mockAuthStore.isValid = true
      mockAuthStore.record = { id: 'user-123' }
      mockGetFirstListItem.mockRejectedValueOnce({ status: 404 })

      const store = useAuthStore()
      const first = store.init()
      const second = store.init()
      await Promise.all([first, second])

      expect(mockGetFirstListItem).toHaveBeenCalledTimes(1)
    })
  })

  describe('onOAuth2Success()', () => {
    it('sets isAuthenticated and userId from pb.authStore.record', async () => {
      mockAuthStore.isValid = true
      mockAuthStore.record = { id: 'user-456' }
      mockGetFirstListItem.mockRejectedValueOnce({ status: 404 })

      const store = useAuthStore()
      await store.onOAuth2Success()

      expect(store.isAuthenticated).toBe(true)
      expect(store.userId).toBe('user-456')
    })

    it('sets householdId when member record exists', async () => {
      mockAuthStore.isValid = true
      mockAuthStore.record = { id: 'user-456' }
      mockGetFirstListItem.mockResolvedValueOnce({
        id: 'member-2',
        household_id: 'hh-789',
        user_id: 'user-456',
        role: 'member',
        created: '',
        updated: '',
      })

      const store = useAuthStore()
      await store.onOAuth2Success()

      expect(store.householdId).toBe('hh-789')
    })

    it('throws when pb.authStore is not valid after OAuth2 exchange', async () => {
      mockAuthStore.isValid = false
      mockAuthStore.record = null

      const store = useAuthStore()
      await expect(store.onOAuth2Success()).rejects.toThrow('Auth store not valid after OAuth2 exchange')
    })
  })

  describe('logout()', () => {
    it('clears all state and calls pb.authStore.clear()', () => {
      const store = useAuthStore()
      store.isAuthenticated = true as any
      store.userId = 'user-123' as any
      store.householdId = 'hh-456' as any
      store.role = 'member' as any
      store.initStatus = 'success' as any

      store.logout()

      expect(mockClear).toHaveBeenCalledOnce()
      expect(store.isAuthenticated).toBe(false)
      expect(store.userId).toBeNull()
      expect(store.householdId).toBeNull()
      expect(store.role).toBeNull()
      expect(store.initStatus).toBe('idle')
    })
  })
})
