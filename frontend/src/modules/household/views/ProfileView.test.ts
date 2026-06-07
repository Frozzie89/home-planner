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

const { mockGetOne, mockUpdate, mockToastAdd, mockLogout, mockRouterPush, mockAuthSave, mockSend, mockLoadMembership } = vi.hoisted(() => ({
  mockGetOne: vi.fn(),
  mockUpdate: vi.fn(),
  mockToastAdd: vi.fn(),
  mockLogout: vi.fn(),
  mockRouterPush: vi.fn(),
  mockAuthSave: vi.fn(),
  mockSend: vi.fn(),
  mockLoadMembership: vi.fn(),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    collection: () => ({
      getOne: mockGetOne,
      update: mockUpdate,
    }),
    authStore: {
      token: 'mock-token',
      save: mockAuthSave,
    },
    send: mockSend,
  },
}))

const mockAuthStoreState = {
  memberId: 'member-test',
  householdId: 'hh-test',
  role: 'member' as string,
  userId: 'user-test',
  isAuthenticated: true,
  logout: mockLogout,
  loadMembership: mockLoadMembership,
}

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => mockAuthStoreState,
}))

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: () => ({
    name: 'Test Household',
  }),
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: mockRouterPush, back: vi.fn() }),
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
    template: '<button :type="type || \'button\'" :disabled="disabled || loading" @click="$emit(\'click\', $event)">{{ label }}</button>',
    props: ['label', 'disabled', 'loading', 'type', 'severity', 'outlined'],
    emits: ['click'],
  },
  Skeleton: {
    template: '<div class="skeleton-stub" />',
    props: ['height'],
  },
  Toast: {
    template: '<div />',
    props: ['ariaLive'],
  },
  UserAvatar: {
    template: '<div class="user-avatar-stub" />',
    props: ['size'],
  },
  BottomSheet: {
    template: '<div v-if="open" data-testid="bottom-sheet"><slot /></div>',
    props: ['open', 'title'],
    emits: ['update:open'],
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
    mockAuthStoreState.role = 'member'
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

  it('"Sign out" button is visible after successful load', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    const wrapper = mountView()
    await flushPromises()
    const buttons = wrapper.findAll('button')
    const signOutBtn = buttons.find(b => b.text() === 'Sign out')
    expect(signOutBtn).toBeDefined()
    expect(signOutBtn!.exists()).toBe(true)
  })

  it('clicking "Sign out" calls authStore.logout() and router.push("/auth")', async () => {
    mockGetOne.mockResolvedValue(MOCK_MEMBER)
    const wrapper = mountView()
    await flushPromises()
    const buttons = wrapper.findAll('button')
    const signOutBtn = buttons.find(b => b.text() === 'Sign out')
    expect(signOutBtn).toBeDefined()
    await signOutBtn!.trigger('click')
    expect(mockLogout).toHaveBeenCalledOnce()
    expect(mockRouterPush).toHaveBeenCalledWith('/auth')
  })

  describe('leave household', () => {
    it('"Leave household" button renders when role is member', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      const wrapper = mountView()
      await flushPromises()
      const buttons = wrapper.findAll('button')
      const leaveBtn = buttons.find(b => b.text() === 'Leave household')
      expect(leaveBtn).toBeDefined()
      expect(leaveBtn!.exists()).toBe(true)
    })

    it('"Leave household" button is absent when role is admin', async () => {
      mockAuthStoreState.role = 'admin'
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      const wrapper = mountView()
      await flushPromises()
      const buttons = wrapper.findAll('button')
      const leaveBtn = buttons.find(b => b.text() === 'Leave household')
      expect(leaveBtn).toBeUndefined()
    })

    it('clicking "Leave household" button opens the confirmation BottomSheet', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(false)
      const buttons = wrapper.findAll('button')
      const leaveBtn = buttons.find(b => b.text() === 'Leave household')
      await leaveBtn!.trigger('click')
      expect(wrapper.find('[data-testid="bottom-sheet"]').exists()).toBe(true)
    })

    it('confirming leave calls pb.send, authStore.logout, then router.push("/auth")', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      mockSend.mockResolvedValue({ message: 'Left household' })
      mockRouterPush.mockResolvedValue(undefined)
      const wrapper = mountView()
      await flushPromises()

      const leaveBtn = wrapper.findAll('button').find(b => b.text() === 'Leave household')
      await leaveBtn!.trigger('click')
      await wrapper.vm.$nextTick()

      const confirmBtn = wrapper.findAll('button').find(b => b.text() === 'Leave')
      await confirmBtn!.trigger('click')
      await flushPromises()

      expect(mockSend).toHaveBeenCalledWith('/api/household/leave', { method: 'POST' })
      expect(mockLogout).toHaveBeenCalledOnce()
      expect(mockLoadMembership).not.toHaveBeenCalled()
      expect(mockRouterPush).toHaveBeenCalledWith('/auth')
    })

    it('leave confirmation dialog contains re-invite warning', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      const wrapper = mountView()
      await flushPromises()

      const leaveBtn = wrapper.findAll('button').find(b => b.text() === 'Leave household')
      await leaveBtn!.trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="bottom-sheet"]').text()).toContain(
        "Once you leave, you'll need a new invitation to rejoin."
      )
    })

    it('shows error toast when leave API call fails', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      mockSend.mockRejectedValue(new Error('Server error'))
      const wrapper = mountView()
      await flushPromises()

      const leaveBtn = wrapper.findAll('button').find(b => b.text() === 'Leave household')
      await leaveBtn!.trigger('click')
      await wrapper.vm.$nextTick()

      const confirmBtn = wrapper.findAll('button').find(b => b.text() === 'Leave')
      await confirmBtn!.trigger('click')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: "Couldn't leave — try again" })
      )
    })
  })

  describe('avatar upload', () => {
    it('avatar change button is visible after successful load', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      const wrapper = mountView()
      await flushPromises()
      expect(wrapper.find('[aria-label="Change profile picture"]').exists()).toBe(true)
    })

    it('uploading a file calls pb.collection("users").update with userId and FormData', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      const updatedRecord = { id: 'user-test', avatar: 'new-photo.jpg' }
      mockUpdate.mockResolvedValue(updatedRecord)
      const wrapper = mountView()
      await flushPromises()

      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')
      await flushPromises()

      expect(mockUpdate).toHaveBeenCalledWith('user-test', expect.any(FormData))
    })

    it('calls pb.authStore.save with token and updated record on success', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      const updatedRecord = { id: 'user-test', avatar: 'new-photo.jpg' }
      mockUpdate.mockResolvedValue(updatedRecord)
      const wrapper = mountView()
      await flushPromises()

      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')
      await flushPromises()

      expect(mockAuthSave).toHaveBeenCalledWith('mock-token', updatedRecord)
    })

    it('shows success toast after avatar upload', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      mockUpdate.mockResolvedValue({ id: 'user-test', avatar: 'new-photo.jpg' })
      const wrapper = mountView()
      await flushPromises()

      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Profile picture updated' })
      )
    })

    it('shows error toast when avatar upload fails', async () => {
      mockGetOne.mockResolvedValue(MOCK_MEMBER)
      mockUpdate.mockRejectedValue(new Error('upload failed'))
      const wrapper = mountView()
      await flushPromises()

      // Reset mock so only the avatar upload call counts
      mockUpdate.mockRejectedValue(new Error('upload failed'))

      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')
      await flushPromises()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: "Couldn't update picture — try again" })
      )
    })
  })
})
