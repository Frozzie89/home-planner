import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ExpenseList from './ExpenseList.vue'
import type { Expense } from '@/modules/finances/types'

// Stub ExpenseItem to avoid full rendering complexity
vi.mock('./ExpenseItem.vue', () => ({
  default: {
    name: 'ExpenseItem',
    props: ['expense', 'currency', 'payerLabel', 'customPortionLabel', 'viewerShareCents', 'isLast', 'canModify', 'avatarStyle'],
    emits: ['edit', 'delete'],
    template: '<div class="expense-item-stub" :data-can-modify="String(canModify)" :data-expense-id="expense.id"></div>',
  },
}))

vi.mock('primevue/skeleton', () => ({
  default: {
    name: 'Skeleton',
    props: ['height', 'borderRadius'],
    template: '<div class="skeleton-stub"></div>',
  },
}))

vi.mock('@/shared/lib/memberHelpers', () => ({
  getMemberName: (member: { display_name: string }) => member.display_name || 'Unknown',
}))

vi.mock('@/shared/lib/currencyHelpers', () => ({
  getCurrencyLocale: (currency: string) => (currency === 'EUR' ? 'de-DE' : 'en-US'),
}))

const { mockFinancesStore, mockHouseholdStore, mockAuthStore } = vi.hoisted(() => ({
  mockFinancesStore: vi.fn(),
  mockHouseholdStore: vi.fn(),
  mockAuthStore: vi.fn(),
}))

vi.mock('@/modules/finances/stores/finances', () => ({ useFinancesStore: mockFinancesStore }))
vi.mock('@/modules/household/stores/household', () => ({ useHouseholdStore: mockHouseholdStore }))
vi.mock('@/shared/stores/auth', () => ({ useAuthStore: mockAuthStore }))

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    household_id: 'hh-1',
    member_id: 'member-a',
    title: 'Groceries',
    amount: 5000,
    portion: 50,
    date: '2026-06-01 00:00:00.000Z',
    created: '2026-06-01 00:00:00.000Z',
    updated: '2026-06-01 00:00:00.000Z',
    ...overrides,
  }
}

function setupStores(options: {
  expenses?: Expense[]
  loadStatus?: string
  memberId?: string
  role?: 'admin' | 'member' | null
} = {}) {
  const { expenses = [], loadStatus = 'success', memberId = 'member-a', role = 'member' } = options
  mockFinancesStore.mockReturnValue({ expenses, loadStatus, members: [] })
  mockHouseholdStore.mockReturnValue({ currency: 'EUR', split_ratios: { 'member-a': 50, 'member-b': 50 } })
  mockAuthStore.mockReturnValue({ memberId, role })
}

describe('ExpenseList', () => {
  it('renders empty state when no expenses and loadStatus is success', () => {
    setupStores({ expenses: [], loadStatus: 'success' })
    const wrapper = mount(ExpenseList)
    expect(wrapper.text()).toContain('Nothing here yet')
  })

  it('renders skeleton when loadStatus is loading', () => {
    setupStores({ expenses: [], loadStatus: 'loading' })
    const wrapper = mount(ExpenseList)
    expect(wrapper.findAll('.skeleton-stub').length).toBeGreaterThan(0)
  })

  it('renders a month group header for each calendar month', () => {
    const expenses = [
      makeExpense({ id: 'exp-1', date: '2026-06-01 00:00:00.000Z' }),
      makeExpense({ id: 'exp-2', date: '2026-05-15 00:00:00.000Z' }),
    ]
    setupStores({ expenses, loadStatus: 'success' })
    const wrapper = mount(ExpenseList)
    expect(wrapper.findAll('.month-group').length).toBe(2)
  })

  it("passes canModify=true to ExpenseItem for viewer's own expense", () => {
    const expenses = [makeExpense({ id: 'exp-1', member_id: 'member-a' })]
    setupStores({ expenses, loadStatus: 'success', memberId: 'member-a', role: 'member' })
    const wrapper = mount(ExpenseList)
    const item = wrapper.find('.expense-item-stub')
    expect(item.attributes('data-can-modify')).toBe('true')
  })

  it("passes canModify=false to ExpenseItem for another member's expense", () => {
    const expenses = [makeExpense({ id: 'exp-1', member_id: 'member-b' })]
    setupStores({ expenses, loadStatus: 'success', memberId: 'member-a', role: 'member' })
    const wrapper = mount(ExpenseList)
    const item = wrapper.find('.expense-item-stub')
    expect(item.attributes('data-can-modify')).toBe('false')
  })

  it('passes canModify=true to ExpenseItem for admin viewing any expense', () => {
    const expenses = [makeExpense({ id: 'exp-1', member_id: 'member-b' })]
    setupStores({ expenses, loadStatus: 'success', memberId: 'member-a', role: 'admin' })
    const wrapper = mount(ExpenseList)
    const item = wrapper.find('.expense-item-stub')
    expect(item.attributes('data-can-modify')).toBe('true')
  })

  it('emits "edit" with the expense when ExpenseItem emits "edit"', async () => {
    const expense = makeExpense({ id: 'exp-1', member_id: 'member-a' })
    setupStores({ expenses: [expense], loadStatus: 'success', memberId: 'member-a' })
    const wrapper = mount(ExpenseList)
    const item = wrapper.findComponent({ name: 'ExpenseItem' })
    await item.vm.$emit('edit')
    const emitted = wrapper.emitted('edit')
    expect(emitted).toBeTruthy()
    expect((emitted![0] as Expense[])[0]).toMatchObject({ id: 'exp-1' })
  })

  it('emits "delete" with the expense when ExpenseItem emits "delete"', async () => {
    const expense = makeExpense({ id: 'exp-1', member_id: 'member-a' })
    setupStores({ expenses: [expense], loadStatus: 'success', memberId: 'member-a' })
    const wrapper = mount(ExpenseList)
    const item = wrapper.findComponent({ name: 'ExpenseItem' })
    await item.vm.$emit('delete')
    const emitted = wrapper.emitted('delete')
    expect(emitted).toBeTruthy()
    expect((emitted![0] as Expense[])[0]).toMatchObject({ id: 'exp-1' })
  })
})
