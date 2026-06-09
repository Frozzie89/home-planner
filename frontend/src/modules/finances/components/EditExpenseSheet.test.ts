import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EditExpenseSheet from './EditExpenseSheet.vue'
import type { Expense } from '@/modules/finances/types'

vi.mock('@/shared/components/BottomSheet.vue', () => ({
  default: {
    name: 'BottomSheet',
    props: ['open', 'title'],
    emits: ['update:open'],
    template: '<div v-if="open" role="dialog"><slot /></div>',
  },
}))

vi.mock('primevue/inputtext', () => ({
  default: {
    name: 'InputText',
    props: ['modelValue'],
    emits: ['update:modelValue', 'blur'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
  },
}))

vi.mock('primevue/inputnumber', () => ({
  default: {
    name: 'InputNumber',
    props: ['modelValue', 'inputId', 'mode', 'currency', 'locale', 'min', 'max', 'maxFractionDigits', 'minFractionDigits', 'suffix'],
    emits: ['update:modelValue', 'blur'],
    template: '<input :id="inputId" :value="modelValue ?? \'\'" @input="$emit(\'update:modelValue\', Number($event.target.value) || null)" @blur="$emit(\'blur\')" />',
  },
}))

vi.mock('primevue/datepicker', () => ({
  default: {
    name: 'DatePicker',
    props: ['modelValue', 'dateFormat'],
    emits: ['update:modelValue'],
    template: '<input type="date" />',
  },
}))

vi.mock('@/shared/lib/currencyHelpers', () => ({
  getCurrencyLocale: (currency: string) => (currency === 'EUR' ? 'de-DE' : 'en-US'),
}))

vi.mock('@/shared/lib/dateHelpers', () => ({
  getLocaleDateFormat: () => 'mm/dd/yy',
}))

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    household_id: 'hh-1',
    member_id: 'member-a',
    title: 'Groceries',
    amount: 4580,   // €45.80 in cents
    portion: 50,
    date: '2026-06-09 00:00:00.000Z',
    created: '2026-06-09 00:00:00.000Z',
    updated: '2026-06-09 00:00:00.000Z',
    ...overrides,
  }
}

function mountSheet(expenseOverrides: Partial<Expense> = {}, extraProps: Record<string, unknown> = {}) {
  return mount(EditExpenseSheet, {
    props: {
      open: true,
      expense: makeExpense(expenseOverrides),
      currency: 'EUR',
      ...extraProps,
    },
  })
}

describe('EditExpenseSheet', () => {
  it('pre-fills title from expense prop on open', () => {
    const wrapper = mountSheet({ title: 'Dinner' })
    const input = wrapper.find('#expense-title')
    expect((input.element as HTMLInputElement).value).toBe('Dinner')
  })

  it('pre-fills amount as float (cents / 100) on open', () => {
    const wrapper = mountSheet({ amount: 4580 })
    const amountInput = wrapper.find('#expense-amount')
    expect((amountInput.element as HTMLInputElement).value).toBe('45.8')
  })

  it('pre-fills portion from expense prop on open', async () => {
    const wrapper = mountSheet({ portion: 70 })
    // Expand more options to see portion
    await wrapper.find('.more-options-toggle').trigger('click')
    const portionInput = wrapper.find('#expense-portion')
    expect((portionInput.element as HTMLInputElement).value).toBe('70')
  })

  it('Confirm (Save Changes) button disabled when title is empty', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('')
    const btn = wrapper.find('.btn-confirm')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Confirm (Save Changes) button disabled when amount is null', async () => {
    const wrapper = mountSheet()
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', null)
    const btn = wrapper.find('.btn-confirm')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Confirm enabled when title and amount are valid', () => {
    const wrapper = mountSheet({ title: 'Groceries', amount: 4580 })
    const btn = wrapper.find('.btn-confirm')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows title error on blur when title is empty', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('')
    const titleInput = wrapper.findComponent({ name: 'InputText' })
    await titleInput.vm.$emit('blur')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Title is required')
  })

  it('shows amount error on blur when amount is null', async () => {
    const wrapper = mountSheet()
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', null)
    await amountInputNumber.vm.$emit('blur')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Amount is required')
  })

  it('emits update with integer cents in payload (45.80 → 4580)', async () => {
    const wrapper = mountSheet({ title: 'Test', amount: 100 })
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', 45.8)
    await wrapper.find('.btn-confirm').trigger('click')
    const payload = wrapper.emitted('update')?.[0]?.[0] as { amount: number }
    expect(payload.amount).toBe(4580)
  })

  it('emits update with correct title and portion', async () => {
    const wrapper = mountSheet({ title: 'Groceries', amount: 4580, portion: 60 })
    await wrapper.find('.btn-confirm').trigger('click')
    const payload = wrapper.emitted('update')?.[0]?.[0] as { title: string; portion: number }
    expect(payload.title).toBe('Groceries')
    expect(payload.portion).toBe(60)
  })

  it('Save Changes button text (not "Confirm")', () => {
    const wrapper = mountSheet()
    const btn = wrapper.find('.btn-confirm')
    expect(btn.text()).toBe('Save Changes')
  })

  it('resets to expense prop values when closed and reopened', async () => {
    const wrapper = mountSheet({ title: 'Groceries', amount: 4580 })
    // Change title
    await wrapper.find('#expense-title').setValue('Changed Title')
    // Close
    await wrapper.setProps({ open: false })
    await wrapper.vm.$nextTick()
    // Reopen
    await wrapper.setProps({ open: true })
    await wrapper.vm.$nextTick()
    // Should be pre-filled again from expense prop
    const input = wrapper.find('#expense-title')
    expect((input.element as HTMLInputElement).value).toBe('Groceries')
  })
})
