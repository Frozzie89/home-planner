import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { mockSend, mockListAuthMethods } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockListAuthMethods: vi.fn(),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    send: mockSend,
    collection: (_name: string) => ({
      listAuthMethods: mockListAuthMethods,
    }),
  },
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ params: { token: 'test-token-abc123' } }),
  }
})

import InviteAcceptView from './InviteAcceptView.vue'

const MOCK_PROVIDERS = [
  {
    name: 'discord',
    state: 'state-abc',
    codeVerifier: 'verifier-abc',
    authURL: 'https://discord.com/oauth2/authorize?',
  },
]

function mountView() {
  return mount(InviteAcceptView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
    attachTo: document.body,
  })
}

describe('InviteAcceptView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    mockListAuthMethods.mockResolvedValue({ oauth2: { providers: [...MOCK_PROVIDERS] } })
  })

  it('shows "Checking your invitation…" while validating', () => {
    mockSend.mockReturnValue(new Promise(() => {}))
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Checking your invitation')
  })

  it('shows household name and sign-in button when token is valid', async () => {
    mockSend.mockResolvedValue({ householdName: 'The Jolys' })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('The Jolys')
    expect(wrapper.text()).toContain('Sign in with Discord to join')
  })

  it('shows invalid error when token is invalid or already used', async () => {
    mockSend.mockRejectedValue({ status: 404 })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('This invitation link is invalid or has already been used')
    expect(wrapper.find('.invite-home-link').exists()).toBe(true)
  })

  it('writes pending_invite_token to localStorage on sign-in click', async () => {
    mockSend.mockResolvedValue({ householdName: 'The Jolys' })
    // prevent full redirect in test
    const assignSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      origin: 'http://localhost:5173',
    } as Location)
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '', origin: 'http://localhost:5173' },
    })

    const wrapper = mountView()
    await flushPromises()

    const btn = wrapper.find('.auth-provider-btn')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    expect(localStorage.getItem('pending_invite_token')).toBe('test-token-abc123')
    assignSpy.mockRestore()
  })

  it('shows error message when loadProviders fails', async () => {
    mockSend.mockResolvedValue({ householdName: 'The Jolys' })
    mockListAuthMethods.mockRejectedValue(new Error('network error'))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Unable to load sign-in options')
    expect(wrapper.find('.auth-provider-btn').exists()).toBe(false)
  })

  it('stores oauth provider in sessionStorage on sign-in click', async () => {
    mockSend.mockResolvedValue({ householdName: 'The Jolys' })
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '', origin: 'http://localhost:5173' },
    })

    const wrapper = mountView()
    await flushPromises()

    const btn = wrapper.find('.auth-provider-btn')
    await btn.trigger('click')

    const stored = JSON.parse(sessionStorage.getItem('oauth_provider') || '{}')
    expect(stored.name).toBe('discord')
    expect(stored.state).toBe('state-abc')
  })
})
