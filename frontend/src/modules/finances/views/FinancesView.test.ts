import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import FinancesView from './FinancesView.vue';
import type { Expense, Balance } from '@/modules/finances/types';

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
}));

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    collection: (name: string) => ({
      subscribe: name === 'expenses' ? mockSubscribe : vi.fn(),
      unsubscribe: name === 'expenses' ? mockUnsubscribe : vi.fn(),
    }),
  },
}));

vi.mock('@/modules/finances/stores/finances', () => ({
  useFinancesStore: vi.fn(),
}));

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    householdId: 'mock-hh-id',
    memberId: 'mock-member-id',
    isAuthenticated: true,
  })),
}));

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: vi.fn(() => ({
    currency: 'EUR',
    split_ratios: { 'mock-member-id': 50 },
  })),
}));

// Import after vi.mock so we get the mocked version
import { useFinancesStore } from '@/modules/finances/stores/finances';

function makeStoreState(bilateralBalances: Balance[] = []) {
  return {
    load: mockLoad,
    applySSEEvent: mockApplySSEEvent,
    loadStatus: 'success' as const,
    expenses: [],
    bilateralBalances,
    members: [],
    addExpenseStatus: 'idle' as const,
    updateExpenseStatus: 'idle' as const,
    deleteExpenseStatus: 'idle' as const,
    settleUp: mockSettleUp,
    isSettledPair: mockIsSettledPair,
    activeSettlements: ref([]),
  };
}

const STUBS = {
  BalanceCard: true,
  AddExpenseSheet: true,
  ExpenseList: true,
  EditExpenseSheet: true,
  BottomSheet: true,
  Skeleton: true,
  SettleCelebration: true,
};

function mountView() {
  return mount(FinancesView, {
    global: { plugins: [createPinia()], stubs: STUBS },
  });
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
};

describe('FinancesView SSE lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(useFinancesStore).mockReturnValue(
      makeStoreState() as unknown as ReturnType<typeof useFinancesStore>
    );
  });

  it('calls pb.collection("expenses").subscribe("*", ...) on mount', async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(mockSubscribe).toHaveBeenCalledWith('*', expect.any(Function), expect.any(Object));
  });

  it('subscribe options include a filter containing the household_id', async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    const opts = mockSubscribe.mock.calls[0]?.[2] as { filter?: string } | undefined;
    expect(opts?.filter).toContain('mock-hh-id');
  });

  it('calls pb.collection("expenses").unsubscribe() on unmount', async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();
    wrapper.unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('SSE create event triggers financesStore.applySSEEvent with action and record', async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    const callback = mockSubscribe.mock.calls[0]?.[1] as (event: {
      action: string;
      record: Expense;
    }) => void;
    callback({ action: 'create', record: mockExpense });

    expect(mockApplySSEEvent).toHaveBeenCalledWith('create', mockExpense);
  });

  it('SSE delete event triggers financesStore.applySSEEvent with action and record', async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    const callback = mockSubscribe.mock.calls[0]?.[1] as (event: {
      action: string;
      record: Expense;
    }) => void;
    callback({ action: 'delete', record: mockExpense });

    expect(mockApplySSEEvent).toHaveBeenCalledWith('delete', mockExpense);
  });
});

describe('FinancesView — summary banner', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('hides the banner when there is only 1 bilateral balance (2-person household)', async () => {
    vi.mocked(useFinancesStore).mockReturnValue(
      makeStoreState([
        { member_a_id: 'a', member_b_id: 'b', amount: 1000 },
      ]) as unknown as ReturnType<typeof useFinancesStore>
    );

    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.summary-banner').exists()).toBe(false);
  });

  it('shows the banner when 2+ non-zero balances and netAmount > 0', async () => {
    vi.mocked(useFinancesStore).mockReturnValue(
      makeStoreState([
        { member_a_id: 'a', member_b_id: 'b', amount: 1750 },
        { member_a_id: 'a', member_b_id: 'c', amount: -250 },
      ]) as unknown as ReturnType<typeof useFinancesStore>
    );

    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.summary-banner').exists()).toBe(true);
    expect(wrapper.find('.summary-label').text()).toBe('Overall, you are owed');
    expect(wrapper.find('.summary-amount').classes()).toContain('net-positive');
  });

  it('shows the banner when 2+ non-zero balances and netAmount < 0', async () => {
    vi.mocked(useFinancesStore).mockReturnValue(
      makeStoreState([
        { member_a_id: 'a', member_b_id: 'b', amount: -3000 },
        { member_a_id: 'a', member_b_id: 'c', amount: -500 },
      ]) as unknown as ReturnType<typeof useFinancesStore>
    );

    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.summary-banner').exists()).toBe(true);
    expect(wrapper.find('.summary-label').text()).toBe('Overall, you owe');
    expect(wrapper.find('.summary-amount').classes()).toContain('net-negative');
  });

  it('hides the banner when netAmount is zero even with multiple non-zero balances', async () => {
    vi.mocked(useFinancesStore).mockReturnValue(
      makeStoreState([
        { member_a_id: 'a', member_b_id: 'b', amount: 1000 },
        { member_a_id: 'a', member_b_id: 'c', amount: -1000 },
      ]) as unknown as ReturnType<typeof useFinancesStore>
    );

    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.summary-banner').exists()).toBe(false);
  });

  it('hides the banner when all balances are zero', async () => {
    vi.mocked(useFinancesStore).mockReturnValue(
      makeStoreState([
        { member_a_id: 'a', member_b_id: 'b', amount: 0 },
        { member_a_id: 'a', member_b_id: 'c', amount: 0 },
      ]) as unknown as ReturnType<typeof useFinancesStore>
    );

    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.summary-banner').exists()).toBe(false);
  });
});
