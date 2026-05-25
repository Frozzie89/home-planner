import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
})

const { mockCreate, mockUpdate, mockRouterPush } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    collection: (_name: string) => ({
      create: mockCreate,
      update: mockUpdate,
    }),
  },
}))

const mockAuthStore = {
  userId: 'user-123',
  householdId: null as string | null,
  role: null as string | null,
  isAuthenticated: true,
}

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}))

const mockHouseholdPopulate = vi.fn()

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: () => ({
    populate: mockHouseholdPopulate,
    reset: vi.fn(),
    id: null,
    name: null,
    currency: 'EUR',
    split_ratios: {},
    reminder_day: 'Monday',
  }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: mockRouterPush }),
  }
})

import HouseholdSetupView from './HouseholdSetupView.vue'

function mountView() {
  return mount(HouseholdSetupView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        InputText: {
          template: '<input :id="id" :value="modelValue" :class="$attrs.class" v-bind="$attrs" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
          props: ['modelValue', 'id'],
          emits: ['update:modelValue', 'blur'],
          inheritAttrs: false,
        },
        Select: {
          template: '<select :id="id"><option v-for="o in options" :key="o.code" :value="o.code">{{ o.label }}</option></select>',
          props: ['modelValue', 'id', 'options', 'optionLabel', 'optionValue'],
          emits: ['update:modelValue'],
        },
        Button: {
          template: '<button :disabled="disabled || loading" @click="$emit(\'click\')">{{ label }}</button>',
          props: ['label', 'disabled', 'loading'],
          emits: ['click'],
        },
      },
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockAuthStore.householdId = null
  mockAuthStore.role = null
})

describe('HouseholdSetupView', () => {
  describe('initial render', () => {
    it('renders the household name input field', () => {
      const wrapper = mountView()
      expect(wrapper.find('#household-name').exists()).toBe(true)
    })

    it('renders the currency selector', () => {
      const wrapper = mountView()
      expect(wrapper.find('#currency').exists()).toBe(true)
    })

    it('renders the Create Household button', () => {
      const wrapper = mountView()
      const btn = wrapper.find('button')
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toContain('Create Household')
    })

    it('Create Household button is disabled when Name is empty', () => {
      const wrapper = mountView()
      const btn = wrapper.find('button')
      expect(btn.attributes('disabled')).toBeDefined()
    })
  })

  describe('name validation', () => {
    it('shows nameError after blur on empty name field', async () => {
      const wrapper = mountView()
      const input = wrapper.find('#household-name')
      await input.trigger('blur')
      expect(wrapper.find('.field-error').exists()).toBe(true)
      expect(wrapper.find('.field-error').text()).toBe('Household name is required')
    })

    it('button is enabled when Name has content', async () => {
      const wrapper = mountView()
      const input = wrapper.find('#household-name')
      await input.setValue('The Joneses')
      const btn = wrapper.find('button')
      expect(btn.attributes('disabled')).toBeUndefined()
    })

    it('button remains disabled when Name is empty', async () => {
      const wrapper = mountView()
      const btn = wrapper.find('button')
      expect(btn.attributes('disabled')).toBeDefined()
    })
  })

  describe('form submission', () => {
    beforeEach(() => {
      mockCreate
        .mockResolvedValueOnce({
          id: 'hh-1',
          name: 'The Smiths',
          currency: 'EUR',
          split_ratios: {},
          reminder_day: 'Monday',
        })
        .mockResolvedValueOnce({
          id: 'member-1',
          household_id: 'hh-1',
          user_id: 'user-123',
          role: 'admin',
        })
      mockUpdate.mockResolvedValueOnce({})
      mockRouterPush.mockResolvedValueOnce(undefined)
    })

    it('calls pb.collection("households").create with name and currency on submit', async () => {
      const wrapper = mountView()
      await wrapper.find('#household-name').setValue('The Smiths')
      await wrapper.find('button').trigger('click')
      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled())

      expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
        name: 'The Smiths',
        currency: 'EUR',
        split_ratios: {},
        reminder_day: 'Monday',
      }))
    })

    it('calls pb.collection("members").create after household is created', async () => {
      const wrapper = mountView()
      await wrapper.find('#household-name').setValue('The Smiths')
      await wrapper.find('button').trigger('click')
      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2))

      expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
        household_id: 'hh-1',
        user_id: 'user-123',
        role: 'admin',
      }))
    })

    it('updates authStore.householdId and authStore.role after success', async () => {
      const wrapper = mountView()
      await wrapper.find('#household-name').setValue('The Smiths')
      await wrapper.find('button').trigger('click')
      await vi.waitFor(() => expect(mockRouterPush).toHaveBeenCalled())

      expect(mockAuthStore.householdId).toBe('hh-1')
      expect(mockAuthStore.role).toBe('admin')
    })

    it('calls householdStore.populate with correct data after success', async () => {
      const wrapper = mountView()
      await wrapper.find('#household-name').setValue('The Smiths')
      await wrapper.find('button').trigger('click')
      await vi.waitFor(() => expect(mockHouseholdPopulate).toHaveBeenCalled())

      expect(mockHouseholdPopulate).toHaveBeenCalledWith({
        id: 'hh-1',
        name: 'The Smiths',
        currency: 'EUR',
        split_ratios: { 'member-1': 100 },
        reminder_day: 'Monday',
      })
    })

    it('calls router.push("/finances") after success', async () => {
      const wrapper = mountView()
      await wrapper.find('#household-name').setValue('The Smiths')
      await wrapper.find('button').trigger('click')
      await vi.waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/finances'))
    })
  })

  describe('error state', () => {
    it('shows inline error when PocketBase throws on submit', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error'))

      const wrapper = mountView()
      await wrapper.find('#household-name').setValue('The Smiths')
      await wrapper.find('button').trigger('click')
      await vi.waitFor(() => expect(wrapper.find('.submit-error').exists()).toBe(true))

      expect(wrapper.find('.submit-error').text()).toContain('Something went wrong')
      expect(mockRouterPush).not.toHaveBeenCalled()
    })
  })
})
