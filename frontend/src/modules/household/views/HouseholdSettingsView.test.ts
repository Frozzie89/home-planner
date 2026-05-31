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

const { mockGetOne, mockGetFullList, mockUpdate, mockToastAdd, mockPopulate, mockRouterBack, mockRouterPush } = vi.hoisted(() => ({
  mockGetOne: vi.fn(),
  mockGetFullList: vi.fn(),
  mockUpdate: vi.fn(),
  mockToastAdd: vi.fn(),
  mockPopulate: vi.fn(),
  mockRouterBack: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    collection: (name: string) => ({
      getOne: name === 'households' ? mockGetOne : vi.fn(),
      getFullList: name === 'members' ? mockGetFullList : vi.fn(),
      update: name === 'households' ? mockUpdate : vi.fn(),
    }),
  },
}))

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => ({
    householdId: 'hh-test',
    role: 'admin',
    userId: 'user-test',
    isAuthenticated: true,
  }),
}))

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: () => ({
    populate: mockPopulate,
    id: 'hh-test',
    name: 'Test Household',
    currency: 'EUR',
    split_ratios: {},
    reminder_day: 'Monday',
  }),
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ back: mockRouterBack, push: mockRouterPush }),
    useRoute: () => ({ path: '/settings' }),
  }
})

import HouseholdSettingsView from './HouseholdSettingsView.vue'

const MOCK_HOUSEHOLD = {
  id: 'hh-test',
  name: 'Test Household',
  currency: 'EUR',
  split_ratios: { 'member-1': 60, 'member-2': 40 },
  reminder_day: 'Monday',
  created: '',
  updated: '',
}

const MOCK_MEMBERS = [
  {
    id: 'member-1',
    household_id: 'hh-test',
    role: 'admin' as const,
    user_id: 'user-1',
    created: '',
    updated: '',
    expand: { user_id: { id: 'user-1', name: 'Helen', email: 'helen@test.com', avatar: '' } },
  },
  {
    id: 'member-2',
    household_id: 'hh-test',
    role: 'member' as const,
    user_id: 'user-2',
    created: '',
    updated: '',
    expand: { user_id: { id: 'user-2', name: 'Alex', email: 'alex@test.com', avatar: '' } },
  },
]

function mountView() {
  return mount(HouseholdSettingsView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        InputText: {
          template: '<input :id="id" :value="modelValue" :class="$attrs.class" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
          props: ['modelValue', 'id', 'maxlength'],
          emits: ['update:modelValue', 'blur'],
          inheritAttrs: false,
        },
        InputNumber: {
          template: '<input type="number" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
          props: ['modelValue', 'disabled', 'min', 'max', 'suffix'],
          emits: ['update:modelValue'],
        },
        Select: {
          template: '<select :id="id" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in normalizedOptions" :key="typeof o === \'string\' ? o : o.code" :value="typeof o === \'string\' ? o : o[optionValue || \'value\']">{{ typeof o === \'string\' ? o : o[optionLabel || \'label\'] }}</option></select>',
          props: ['modelValue', 'id', 'options', 'optionLabel', 'optionValue'],
          emits: ['update:modelValue'],
          computed: {
            normalizedOptions() { return (this as any).options || [] },
          },
        },
        Button: {
          template: '<button :disabled="disabled || loading" @click="$emit(\'click\')">{{ label }}</button>',
          props: ['label', 'disabled', 'loading'],
          emits: ['click'],
        },
        Skeleton: {
          template: '<div class="skeleton-stub" />',
        },
        Toast: {
          template: '<div />',
        },
      },
    },
  })
}

describe('HouseholdSettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetOne.mockResolvedValue({ ...MOCK_HOUSEHOLD })
    mockGetFullList.mockResolvedValue([...MOCK_MEMBERS])
    mockUpdate.mockResolvedValue({ ...MOCK_HOUSEHOLD })
    mockToastAdd.mockReset()
    mockPopulate.mockReset()
    mockRouterBack.mockReset()
    mockRouterPush.mockReset()
  })

  it('renders loading skeletons before fetch completes', () => {
    mockGetOne.mockReturnValue(new Promise(() => {}))
    const wrapper = mountView()
    expect(wrapper.findAll('.skeleton-stub').length).toBeGreaterThan(0)
  })

  it('renders 3 section labels after fetch: HOUSEHOLD, FINANCES, FOOD', async () => {
    const wrapper = mountView()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('HOUSEHOLD')
    expect(text).toContain('FINANCES')
    expect(text).toContain('FOOD')
  })

  it('pre-fills household name input from fetched data', async () => {
    const wrapper = mountView()
    await flushPromises()
    const nameInput = wrapper.find('#household-name')
    expect(nameInput.exists()).toBe(true)
    expect((nameInput.element as HTMLInputElement).value).toBe('Test Household')
  })

  it('Save button is disabled on initial render (no changes yet)', async () => {
    const wrapper = mountView()
    await flushPromises()
    const btn = wrapper.find('button[disabled]')
    // The Save button is the last button; it should be disabled because no changes
    expect(wrapper.text()).toContain('Save Changes')
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Changes'))
    expect(saveBtn?.attributes('disabled')).toBeDefined()
  })

  it('Save button is enabled after changing household name', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('#household-name').setValue('New Name')
    await wrapper.vm.$nextTick()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Changes'))
    expect(saveBtn?.attributes('disabled')).toBeUndefined()
  })

  it('Save button is disabled when split ratio sum ≠ 100', async () => {
    mockGetOne.mockResolvedValue({
      ...MOCK_HOUSEHOLD,
      split_ratios: { 'member-1': 70, 'member-2': 40 },
    })
    const wrapper = mountView()
    await flushPromises()
    // Sum is 110; even after changing name, Save should be disabled
    await wrapper.find('#household-name').setValue('New Name')
    await wrapper.vm.$nextTick()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Changes'))
    expect(saveBtn?.attributes('disabled')).toBeDefined()
  })

  it('2-member auto-adjust: changing member-1 ratio via input event auto-updates member-2 to maintain 100', async () => {
    const wrapper = mountView()
    await flushPromises()
    const numberInputs = wrapper.findAll('input[type="number"]')
    // First InputNumber is member-1, second is member-2
    await numberInputs[0]!.setValue(70)
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as any
    expect(vm.splitRatioForm['member-2']).toBe(30)
  })

  it('calls pb.collection("households").update() with correct payload on save', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('#household-name').setValue('Updated Name')
    await wrapper.vm.$nextTick()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Changes'))
    await saveBtn!.trigger('click')
    await flushPromises()
    expect(mockUpdate).toHaveBeenCalledWith('hh-test', expect.objectContaining({
      name: 'Updated Name',
      currency: 'EUR',
      reminder_day: 'Monday',
    }))
  })

  it('calls householdStore.populate() after successful save', async () => {
    mockUpdate.mockResolvedValue({ ...MOCK_HOUSEHOLD, name: 'Updated Name' })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('#household-name').setValue('Updated Name')
    await wrapper.vm.$nextTick()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Changes'))
    await saveBtn!.trigger('click')
    await flushPromises()
    expect(mockPopulate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'hh-test',
      name: 'Updated Name',
    }))
  })

  it('shows success Toast on save success', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('#household-name').setValue('Updated Name')
    await wrapper.vm.$nextTick()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Changes'))
    await saveBtn!.trigger('click')
    await flushPromises()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'success',
      summary: 'Household preferences saved',
    }))
  })

  it('shows error Toast on save failure and preserves form state', async () => {
    mockUpdate.mockRejectedValue(new Error('Network error'))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('#household-name').setValue('Updated Name')
    await wrapper.vm.$nextTick()
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Changes'))
    await saveBtn!.trigger('click')
    await flushPromises()
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error',
      summary: "Couldn't save — try again",
    }))
    // Form state preserved — name still shows the updated value
    const nameInput = wrapper.find('#household-name')
    expect((nameInput.element as HTMLInputElement).value).toBe('Updated Name')
  })

  it('shows household name inline error on blur when empty', async () => {
    const wrapper = mountView()
    await flushPromises()
    const nameInput = wrapper.find('#household-name')
    await nameInput.setValue('')
    await nameInput.trigger('blur')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Household name is required')
  })

  it('shows error state with retry button when fetch fails', async () => {
    mockGetOne.mockRejectedValue(new Error('Network error'))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain("Couldn't load settings")
    expect(wrapper.find('.retry-btn').exists()).toBe(true)
  })
})
