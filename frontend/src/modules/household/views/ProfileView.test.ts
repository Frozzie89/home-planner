import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
})

const { mockGetOne, mockUpdate, mockToastAdd } = vi.hoisted(() => ({
  mockGetOne: vi.fn(),
  mockUpdate: vi.fn(),
  mockToastAdd: vi.fn(),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    collection: () => ({
      getOne: mockGetOne,
      update: mockUpdate,
    }),
  },
}))

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => ({
    memberId: 'member-test',
    householdId: 'hh-test',
    role: 'member',
    userId: 'user-test',
    isAuthenticated: true,
  }),
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
    useRoute: () => ({ path: '/profile' }),
  }
})

const MOCK_MEMBER = {
  id: 'member-test',
  household_id: 'hh-test',
  user_id: 'user-test',
  role: 'member' as const,
  display_name: 'My Display Name',
  created: '2026-01-01',
  updated: '2026-01-01',
  expand: {
    user_id: {
      id: 'user-test',
      username: 'helen_test',
      name: 'Helen',
      email: 'helen@test.com',
      avatar: '',
    },
  },
}

import ProfileView from './ProfileView.vue'

const STUBS = {
  InputText: {
    template: '<input :id="id" :value="modelValue" :maxlength="maxlength" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'id', 'maxlength', 'placeholder'],
    emits: ['update:modelValue'],
  },
  Button: {
    template: '<button type="submit" :disabled="disabled || loading">{{ label }}</button>',
    props: ['label', 'disabled', 'loading'],
  },
  Skeleton: {
    template: '<div class="skeleton-stub" />',
    props: ['height'],
  },
  Toast: {
    template: '<div />',
    props: ['ariaLive'],
  },
}

function mountView() {
  return mount(ProfileView, {
    global: {
      plugins: [createPinia()],
      stubs: STUBS,
    },
  })
}

describe('ProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows pre-filled display name from member record', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input#display-name')
    expect((input.element as HTMLInputElement).value).toBe('My Display Name')
  })

  it('save button is disabled when no change has been made', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    const wrapper = mountView()
    await flushPromises()
    const btn = wrapper.find('button[type="submit"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('save button becomes enabled after changing the input', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input#display-name')
    await input.setValue('New Name')
    const btn = wrapper.find('button[type="submit"]')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('save calls pb.collection.update with trimmed display_name', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    mockUpdate.mockResolvedValue({ ...MOCK_MEMBER, display_name: 'New Name' })
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input#display-name')
    await input.setValue('  New Name  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockUpdate).toHaveBeenCalledWith('member-test', { display_name: 'New Name' })
  })

  it('saving empty string sends { display_name: "" } (not null)', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    mockUpdate.mockResolvedValue({ ...MOCK_MEMBER, display_name: '' })
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input#display-name')
    await input.setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockUpdate).toHaveBeenCalledWith('member-test', { display_name: '' })
  })

  it('shows success toast on successful save', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    mockUpdate.mockResolvedValue({ ...MOCK_MEMBER, display_name: 'Saved Name' })
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input#display-name')
    await input.setValue('Saved Name')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Display name saved' })
    )
  })

  it('shows error toast on save failure', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    mockUpdate.mockRejectedValue(new Error('network error'))
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.find('input#display-name')
    await input.setValue('Some Name')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: "Couldn't save — try again" })
    )
  })
})
