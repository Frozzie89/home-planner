import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { pb } from '@/shared/lib/pocketbase'

const {
  mockAuthWithOAuth2Code,
  mockSend,
  mockListAuthMethods,
  mockRouterReplace,
  mockLogout,
  mockOnOAuth2Success,
  mockDelete,
} = vi.hoisted(() => ({
  mockAuthWithOAuth2Code: vi.fn(),
  mockSend: vi.fn(),
  mockListAuthMethods: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockLogout: vi.fn(),
  mockOnOAuth2Success: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    authStore: { isValid: false, record: null as null | { id: string }, clear: vi.fn() },
    collection: vi.fn(() => ({
      authWithOAuth2Code: mockAuthWithOAuth2Code,
      listAuthMethods: mockListAuthMethods,
      delete: mockDelete,
    })),
    send: mockSend,
    filter: vi.fn((expr: string) => expr),
  },
}))

const mockAuthStore = {
  householdId: null as string | null,
  onOAuth2Success: mockOnOAuth2Success,
  logout: mockLogout,
  loadMembership: vi.fn(),
}

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ replace: mockRouterReplace }),
  }
})

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

import AuthView from './AuthView.vue'

function setLocation(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search, origin: 'http://localhost' },
    writable: true,
    configurable: true,
  })
}

function mountView() {
  return mount(AuthView, {
    global: {
      plugins: [createPinia()],
      stubs: { Toast: true },
    },
    attachTo: document.body,
  })
}

describe('AuthView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAuthStore.householdId = null
    mockOnOAuth2Success.mockResolvedValue(undefined)
    mockListAuthMethods.mockResolvedValue({ oauth2: { providers: [] } });
    (pb as any).authStore.record = null
    sessionStorage.clear()
    localStorage.clear()
    setLocation('')
  })

  describe('handleCallback() — post-OAuth2 path routing', () => {
    beforeEach(() => {
      setLocation('?code=abc&state=xyz')
      sessionStorage.setItem(
        'oauth_provider',
        JSON.stringify({ name: 'google', state: 'xyz', codeVerifier: 'cv' })
      )
      mockAuthWithOAuth2Code.mockResolvedValue({})
    })

    it('path 3: household exists, user not a member -> deletes user record, logout, redirect, show message', async () => {
      mockSend.mockResolvedValue({ exists: true })
      mockDelete.mockResolvedValue(undefined);
      (pb as any).authStore.record = { id: 'orphan-user-id' }

      const wrapper = mountView()
      await flushPromises()

      expect(mockDelete).toHaveBeenCalledWith('orphan-user-id')
      // delete must happen before logout (token still valid at that point)
      const deleteOrder = mockDelete.mock.invocationCallOrder[0]
      const logoutOrder = mockLogout.mock.invocationCallOrder[0]
      expect(deleteOrder).toBeLessThan(logoutOrder)
      expect(mockLogout).toHaveBeenCalledOnce()
      expect(mockRouterReplace).toHaveBeenCalledWith('/auth?error=not_registered')
      expect(wrapper.find('.auth-not-registered').exists()).toBe(true)
      expect(wrapper.text()).toContain("This account isn't linked to this household")
      expect(mockListAuthMethods).toHaveBeenCalled()
    })

    it('path 3: user record delete fails -> still logs out and redirects', async () => {
      mockSend.mockResolvedValue({ exists: true })
      mockDelete.mockRejectedValue(new Error('403 Forbidden'));
      (pb as any).authStore.record = { id: 'orphan-user-id' }

      const wrapper = mountView()
      await flushPromises()

      expect(mockLogout).toHaveBeenCalledOnce()
      expect(mockRouterReplace).toHaveBeenCalledWith('/auth?error=not_registered')
      expect(wrapper.find('.auth-not-registered').exists()).toBe(true)
    })

    it('path 3: no authStore record -> skips delete, still logs out and redirects', async () => {
      mockSend.mockResolvedValue({ exists: true })
      // pb.authStore.record remains null (set in outer beforeEach)

      mountView()
      await flushPromises()

      expect(mockDelete).not.toHaveBeenCalled()
      expect(mockLogout).toHaveBeenCalledOnce()
      expect(mockRouterReplace).toHaveBeenCalledWith('/auth?error=not_registered')
    })

    it('path 1: no household exists -> redirect to /setup, no logout', async () => {
      mockSend.mockResolvedValue({ exists: false })

      mountView()
      await flushPromises()

      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockRouterReplace).toHaveBeenCalledWith('/setup')
    })

    it('path 2: user has membership -> redirect to /finances, no existence check', async () => {
      mockAuthStore.householdId = 'hh-123'

      mountView()
      await flushPromises()

      expect(mockOnOAuth2Success).toHaveBeenCalledOnce()
      expect(mockRouterReplace).toHaveBeenCalledWith('/finances')
      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe('onMounted() — error query param handling', () => {
    it('?error=not_registered -> notRegisteredMessage shown, sign-in form rendered, loadProviders called', async () => {
      setLocation('?error=not_registered')
      mockListAuthMethods.mockResolvedValue({
        oauth2: {
          providers: [{ name: 'google', state: 's', codeVerifier: 'c', authURL: 'https://accounts.google.com?' }],
        },
      })

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.find('.auth-not-registered').exists()).toBe(true)
      expect(wrapper.text()).toContain("This account isn't linked to this household")
      expect(wrapper.find('.auth-error').exists()).toBe(false)
      expect(mockListAuthMethods).toHaveBeenCalled()
    })

    it('?error=access_denied -> error overlay shown, notRegisteredMessage empty, loadProviders not called', async () => {
      setLocation('?error=access_denied')

      const wrapper = mountView()
      await flushPromises()

      expect(wrapper.find('.auth-error').exists()).toBe(true)
      expect(wrapper.text()).toContain('Sign-in was denied by the provider')
      expect(wrapper.find('.auth-not-registered').exists()).toBe(false)
      expect(mockListAuthMethods).not.toHaveBeenCalled()
    })
  })
})
