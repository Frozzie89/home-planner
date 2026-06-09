import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ExpenseItem from './ExpenseItem.vue'
import type { Expense } from '@/modules/finances/types'

vi.mock('@/shared/lib/currencyHelpers', () => ({
  getCurrencyLocale: (currency: string) => (currency === 'EUR' ? 'de-DE' : 'en-US'),
}))

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    household_id: 'hh-1',
    member_id: 'member-a',
    title: 'Groceries',
    amount: 5000,
    portion: 50,
    date: '2026-06-09 00:00:00.000Z',
    created: '2026-06-09 00:00:00.000Z',
    updated: '2026-06-09 00:00:00.000Z',
    ...overrides,
  }
}

function mountItem(overrides: Partial<Expense> = {}, propOverrides: Record<string, unknown> = {}) {
  return mount(ExpenseItem, {
    props: {
      expense: makeExpense(overrides),
      currency: 'EUR',
      payerLabel: 'You paid',
      customPortionLabel: null,
      viewerShareCents: 2500,
      isLast: false,
      canModify: true,
      avatarStyle: { bg: '#EBF4FF', fg: '#4A7FBF' },
      ...propOverrides,
    },
  })
}

describe('ExpenseItem', () => {
  it('renders expense title and formatted amount', () => {
    const wrapper = mountItem({ title: 'Groceries', amount: 5000 })
    expect(wrapper.text()).toContain('Groceries')
    expect(wrapper.text()).toContain('50')
  })

  it('renders payer label and formatted date', () => {
    const wrapper = mountItem({}, { payerLabel: 'Bob paid' })
    expect(wrapper.text()).toContain('Bob paid')
    expect(wrapper.text()).toContain('Jun 9')
  })

  it('renders edit and delete buttons in DOM when canModify is true', () => {
    const wrapper = mountItem({}, { canModify: true })
    expect(wrapper.find('[aria-label="Edit expense"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Delete expense"]').exists()).toBe(true)
  })

  it('does not render edit and delete buttons when canModify is false', () => {
    const wrapper = mountItem({}, { canModify: false })
    expect(wrapper.find('[aria-label="Edit expense"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Delete expense"]').exists()).toBe(false)
  })

  it('emits "edit" when edit button is clicked', async () => {
    const wrapper = mountItem({}, { canModify: true })
    await wrapper.find('[aria-label="Edit expense"]').trigger('click')
    expect(wrapper.emitted('edit')).toBeTruthy()
  })

  it('emits "delete" when delete button is clicked', async () => {
    const wrapper = mountItem({}, { canModify: true })
    await wrapper.find('[aria-label="Delete expense"]').trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  it('applies expense-item--new class for optimistic entries', () => {
    const wrapper = mountItem({ id: 'optimistic-123' })
    expect(wrapper.find('.expense-item').classes()).toContain('expense-item--new')
  })

  it('applies expense-item--last class when isLast is true', () => {
    const wrapper = mountItem({}, { isLast: true })
    expect(wrapper.find('.expense-item').classes()).toContain('expense-item--last')
  })

  it('adds expense-item--active class after long press (500ms)', async () => {
    vi.useFakeTimers()
    const wrapper = mountItem({}, { canModify: true })
    await wrapper.find('.expense-item').trigger('touchstart')
    expect(wrapper.find('.expense-item').classes()).not.toContain('expense-item--active')
    vi.advanceTimersByTime(500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.expense-item').classes()).toContain('expense-item--active')
    vi.useRealTimers()
  })

  it('cancels long press on touchmove', async () => {
    vi.useFakeTimers()
    const wrapper = mountItem({}, { canModify: true })
    await wrapper.find('.expense-item').trigger('touchstart')
    await wrapper.find('.expense-item').trigger('touchmove')
    vi.advanceTimersByTime(500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.expense-item').classes()).not.toContain('expense-item--active')
    vi.useRealTimers()
  })

  it('dismisses active state on row click', async () => {
    vi.useFakeTimers()
    const wrapper = mountItem({}, { canModify: true })
    await wrapper.find('.expense-item').trigger('touchstart')
    vi.advanceTimersByTime(500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.expense-item').classes()).toContain('expense-item--active')
    await wrapper.find('.expense-item').trigger('click')
    expect(wrapper.find('.expense-item').classes()).not.toContain('expense-item--active')
    vi.useRealTimers()
  })
})
