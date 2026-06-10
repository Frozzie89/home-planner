import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AddExpenseSheet from './AddExpenseSheet.vue'

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

function mountSheet(props = {}) {
  return mount(AddExpenseSheet, {
    props: {
      open: true,
      currency: 'EUR',
      defaultPortion: 50,
      ...props,
    },
  })
}

describe('AddExpenseSheet', () => {
  it('renders form fields when open is true', () => {
    const wrapper = mountSheet()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.find('#expense-title').exists()).toBe(true)
    expect(wrapper.find('#expense-amount').exists()).toBe(true)
  })

  it('does not render form when open is false', () => {
    const wrapper = mountSheet({ open: false })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('Confirm button is disabled when title is empty', () => {
    const wrapper = mountSheet()
    const btn = wrapper.find('.btn-confirm')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Confirm button is disabled when amount is null', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('Groceries')
    const btn = wrapper.find('.btn-confirm')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Confirm button is disabled when amount is 0', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('Groceries')
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', 0)
    const btn = wrapper.find('.btn-confirm')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('Confirm button is enabled when title and amount are both valid', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('Groceries')
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', 45.8)
    const btn = wrapper.find('.btn-confirm')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows title error text on blur when title is empty', async () => {
    const wrapper = mountSheet()
    const titleInput = wrapper.findComponent({ name: 'InputText' })
    await titleInput.vm.$emit('blur')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Title is required')
  })

  it('shows amount error text on blur when amount is null', async () => {
    const wrapper = mountSheet()
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('blur')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Amount is required')
  })

  it('emits submit with correct payload when Confirm is clicked', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('Test Groceries')
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', 45.8)
    await wrapper.find('.btn-confirm').trigger('click')
    const submitted = wrapper.emitted('submit')
    expect(submitted).toBeTruthy()
    expect(submitted![0]).toBeTruthy()
  })

  it('converts float amount to integer cents in emitted payload (45.80 → 4580)', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('Test')
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', 45.8)
    await wrapper.find('.btn-confirm').trigger('click')
    const payload = wrapper.emitted('submit')?.[0]?.[0] as { amount: number }
    expect(payload.amount).toBe(4580)
  })

  it('includes defaultPortion as portion in emitted payload when More options not opened', async () => {
    const wrapper = mountSheet({ defaultPortion: 60 })
    await wrapper.find('#expense-title').setValue('Test')
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', 10)
    await wrapper.find('.btn-confirm').trigger('click')
    const payload = wrapper.emitted('submit')?.[0]?.[0] as { portion: number }
    expect(payload.portion).toBe(60)
  })

  it('formats date as YYYY-MM-DD HH:MM:SS.mmmZ in emitted payload', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('Test')
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    await amountInputNumber.vm.$emit('update:modelValue', 10)
    await wrapper.find('.btn-confirm').trigger('click')
    const payload = wrapper.emitted('submit')?.[0]?.[0] as { date: string }
    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('amount InputNumber has max prop of 999999.99', () => {
    const wrapper = mountSheet()
    const amountInputNumber = wrapper.findAllComponents({ name: 'InputNumber' })[0]!
    expect(amountInputNumber.props('max')).toBe(999999.99)
  })

  it('resets form state when open changes from true to false', async () => {
    const wrapper = mountSheet()
    await wrapper.find('#expense-title').setValue('Some title')
    await wrapper.setProps({ open: false })
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ open: true })
    await wrapper.vm.$nextTick()
    expect((wrapper.find('#expense-title').element as HTMLInputElement).value).toBe('')
  })
})
