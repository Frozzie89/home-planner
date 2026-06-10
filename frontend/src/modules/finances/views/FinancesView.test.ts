import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import FinancesView from './FinancesView.vue'
import type { Expense } from '@/modules/finances/types'

const {
  mockSubscribe,
  mockUnsubscribe,
  mockApplySSEEvent,
  mockLoad,
  mockSettleUp,
  mockIsSettledPair,
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn().mockResolvedValue(() => Promise.resolve()),
  mockUnsubscribe: vi.fn().mockResolvedValue(undefined),
  mockApplySSEEvent: vi.fn(),
  mockLoad: vi.fn(),
  mockSettleUp: vi.fn(),
  mockIsSettledPair: vi.fn().mockReturnValue(false),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    collection: (name: string) => ({
      subscribe: name === 'expenses' ? mockSubscribe : vi.fn(),
      unsubscribe: name === 'expenses' ? mockUnsubscribe : vi.fn(),
    }),
  },
}))

vi.mock('@/modules/finances/stores/finances', () => ({
  useFinancesStore: vi.fn(() => ({
    load: mockLoad,
    applySSEEvent: mockApplySSEEvent,
    loadStatus: 'success',
    expenses: [],
    bilateralBalances: [],
    members: [],
    addExpenseStatus: 'idle',
    updateExpenseStatus: 'idle',
    deleteExpenseStatus: 'idle',
    settleUp: mockSettleUp,
    isSettledPair: mockIsSettledPair,
    settledPairs: ref(new Set()),
  })),
}))

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    householdId: 'mock-hh-id',
    memberId: 'mock-member-id',
    isAuthenticated: true,
  })),
}))

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: vi.fn(() => ({
    currency: 'EUR',
    split_ratios: { 'mock-member-id': 50 },
  })),
}))

function mountView() {
  return mount(FinancesView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        BalanceCard: true,
        AddExpenseSheet: true,
        ExpenseList: true,
        EditExpenseSheet: true,
        BottomSheet: true,
        Skeleton: true,
        SettleUpCard: true,
        SettleCelebration: true,
      },
    },
  })
}

const mockExpense: Expense = {
  id: 'exp-1',
  household_id: 'hh-1',
  member_id: 'm-1',
  title: 'Groceries',
  amount: 5000,
  portion: 50,
  date: '2026-06-09 00:00:00.000Z',
  created: '',
  updated: '',
}

describe('FinancesView SSE lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('calls pb.collection("expenses").subscribe("*", ...) on mount', async () => {
    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    expect(mockSubscribe).toHaveBeenCalledWith('*', expect.any(Function), expect.any(Object))
  })

  it('subscribe options include a filter containing the household_id', async () => {
    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    const opts = mockSubscribe.mock.calls[0]?.[2] as { filter?: string } | undefined
    expect(opts?.filter).toContain('mock-hh-id')
  })

  it('calls pb.collection("expenses").unsubscribe() on unmount', async () => {
    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    wrapper.unmount()

    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('SSE create event triggers financesStore.applySSEEvent with action and record', async () => {
    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    const callback = mockSubscribe.mock.calls[0]?.[1] as (event: { action: string; record: Expense }) => void
    callback({ action: 'create', record: mockExpense })

    expect(mockApplySSEEvent).toHaveBeenCalledWith('create', mockExpense)
  })

  it('SSE delete event triggers financesStore.applySSEEvent with action and record', async () => {
    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    const callback = mockSubscribe.mock.calls[0]?.[1] as (event: { action: string; record: Expense }) => void
    callback({ action: 'delete', record: mockExpense })

    expect(mockApplySSEEvent).toHaveBeenCalledWith('delete', mockExpense)
  })
})
