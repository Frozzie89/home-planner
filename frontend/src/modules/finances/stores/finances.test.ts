import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { reactive } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { useFinancesStore } from './finances';
import type { Expense } from '@/modules/finances/types';
import type { MemberRecord } from '@/modules/household/types';

const {
  mockGetFullListExpenses,
  mockGetFullListMembers,
  mockGetFullListSettlements,
  mockCreateFn,
  mockSettlementsCreateFn,
  mockUpdateFn,
  mockDeleteFn,
  mockFilter,
  mockUseAuthStore,
  mockUseHouseholdStore,
} = vi.hoisted(() => ({
  mockGetFullListExpenses: vi.fn(),
  mockGetFullListMembers: vi.fn(),
  mockGetFullListSettlements: vi.fn(),
  mockCreateFn: vi.fn(),
  mockSettlementsCreateFn: vi.fn(),
  mockUpdateFn: vi.fn(),
  mockDeleteFn: vi.fn(),
  mockFilter: vi.fn((expr: string, params: Record<string, unknown>) =>
    Object.entries(params).reduce((s, [k, v]) => s.replace(`{:${k}}`, String(v)), expr)
  ),
  mockUseAuthStore: vi.fn(),
  mockUseHouseholdStore: vi.fn(() => ({
    split_ratios: { 'member-a': 50, 'member-b': 50 },
    currency: 'EUR',
  })),
}));

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    filter: mockFilter,
    collection: (name: string) => ({
      getFullList:
        name === 'expenses'
          ? mockGetFullListExpenses
          : name === 'members'
            ? mockGetFullListMembers
            : name === 'settlements'
              ? mockGetFullListSettlements
              : vi.fn(),
      create:
        name === 'expenses'
          ? mockCreateFn
          : name === 'settlements'
            ? mockSettlementsCreateFn
            : vi.fn(),
      update: name === 'expenses' ? mockUpdateFn : vi.fn(),
      delete: name === 'expenses' ? mockDeleteFn : vi.fn(),
    }),
  },
}));

// Persistent reactive auth state - used by the store's isAuthenticated watcher
const sharedAuthState = reactive({
  memberId: 'member-a',
  householdId: 'hh-1',
  isAuthenticated: true as boolean,
});

vi.mock('@/shared/stores/auth', () => ({ useAuthStore: mockUseAuthStore }));

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: mockUseHouseholdStore,
}));

function makeMember(id: string, name: string): MemberRecord {
  return {
    id,
    household_id: 'hh-1',
    user_id: `user-${id}`,
    role: 'member',
    display_name: name,
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    household_id: 'hh-1',
    member_id: 'member-a',
    title: 'Groceries',
    amount: 10000,
    portion: 50,
    date: '2026-06-01 00:00:00.000Z',
    created: '2026-06-01 00:00:00.000Z',
    updated: '2026-06-01 00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  // Default: no settlements - ensures all existing load tests pass without individual setup
  mockGetFullListSettlements.mockResolvedValue([]);
  // Restore defaults after each test
  sharedAuthState.memberId = 'member-a';
  sharedAuthState.isAuthenticated = true;
  mockUseAuthStore.mockReturnValue(sharedAuthState);
  mockUseHouseholdStore.mockReturnValue({
    split_ratios: { 'member-a': 50, 'member-b': 50 },
    currency: 'EUR',
  });
});

describe('bilateralBalances', () => {
  it('returns empty array when fewer than 2 members', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice')];
    expect(store.bilateralBalances).toEqual([]);
  });

  it('returns empty array when viewerMemberId is null', () => {
    mockUseAuthStore.mockReturnValue({ memberId: null as any, householdId: 'hh-1' });

    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    expect(store.bilateralBalances).toEqual([]);
  });

  it('computes positive balance when viewer paid and other owes', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    // Viewer (member-a) paid 10000 cents with 50% portion
    // remainder = trunc(10000 * 50 / 100) = 5000
    // otherRatio=50, totalOtherRatio=50 -> balance += round(5000 * 50/50) = 5000
    store.expenses = [makeExpense({ member_id: 'member-a', amount: 10000, portion: 50 })];

    expect(store.bilateralBalances).toEqual([
      { member_a_id: 'member-a', member_b_id: 'member-b', amount: 5000 },
    ]);
  });

  it('computes negative balance when other paid and viewer owes', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    // Other (member-b) paid 10000 cents with 50% portion
    // remainder = 5000; viewerRatio=50, totalViewerSideRatio=50 -> balance -= 5000
    store.expenses = [makeExpense({ member_id: 'member-b', amount: 10000, portion: 50 })];

    expect(store.bilateralBalances).toEqual([
      { member_a_id: 'member-a', member_b_id: 'member-b', amount: -5000 },
    ]);
  });

  it('computes net zero when expenses cancel out', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    store.expenses = [
      makeExpense({ id: 'exp-1', member_id: 'member-a', amount: 10000, portion: 50 }),
      makeExpense({ id: 'exp-2', member_id: 'member-b', amount: 10000, portion: 50 }),
    ];

    expect(store.bilateralBalances).toEqual([
      { member_a_id: 'member-a', member_b_id: 'member-b', amount: 0 },
    ]);
  });

  it('correctly distributes remainder to the right bilateral pair in 3-member household', () => {
    mockUseHouseholdStore.mockReturnValue({
      split_ratios: { 'member-a': 33, 'member-b': 33, 'member-c': 34 } as any,
      currency: 'EUR',
    });

    const store = useFinancesStore();
    store.members = [
      makeMember('member-a', 'Alice'),
      makeMember('member-b', 'Bob'),
      makeMember('member-c', 'Carol'),
    ];
    // Viewer (member-a) paid 10000 cents with 33% portion
    // remainder = trunc(10000 * 67 / 100) = 6700
    // B pair: totalOtherRatio = 33+34=67; B's share: round(6700 * 33/67) = round(3300.0) = 3300
    // C pair: C's share: round(6700 * 34/67) = round(3400.0) = 3400
    store.expenses = [makeExpense({ member_id: 'member-a', amount: 10000, portion: 33 })];

    const balances = store.bilateralBalances;
    const bBalance = balances.find((b) => b.member_b_id === 'member-b');
    const cBalance = balances.find((b) => b.member_b_id === 'member-c');

    expect(bBalance?.amount).toBe(3300);
    expect(cBalance?.amount).toBe(3400);
  });

  it('uses integer arithmetic - no float intermediates stored', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    // 4580 cents (€45.80) with 0% portion -> all 4580 goes to Bob
    store.expenses = [makeExpense({ amount: 4580, portion: 0 })];

    const [balance] = store.bilateralBalances;
    expect(Number.isInteger(balance!.amount)).toBe(true);
    expect(balance!.amount).toBe(4580);
  });
});

describe('load', () => {
  it('sets loadStatus to loading then success on resolve', async () => {
    const store = useFinancesStore();
    mockGetFullListExpenses.mockResolvedValueOnce([]);
    mockGetFullListMembers.mockResolvedValueOnce([]);

    expect(store.loadStatus).toBe('idle');
    const loadPromise = store.load();
    expect(store.loadStatus).toBe('loading');
    await loadPromise;
    expect(store.loadStatus).toBe('success');
  });

  it('sets loadStatus to error on rejection', async () => {
    const store = useFinancesStore();
    mockGetFullListExpenses.mockRejectedValueOnce(new Error('Network error'));
    mockGetFullListMembers.mockResolvedValueOnce([]);

    await store.load();
    expect(store.loadStatus).toBe('error');
  });

  it('does not start a second fetch if already loading', async () => {
    const store = useFinancesStore();
    let resolveFirst!: () => void;
    mockGetFullListExpenses.mockReturnValueOnce(
      new Promise<Expense[]>((res) => {
        resolveFirst = () => res([]);
      })
    );
    mockGetFullListMembers.mockResolvedValue([]);

    const first = store.load();
    store.load(); // second call while loading - should be ignored
    resolveFirst();
    await first;

    expect(mockGetFullListExpenses).toHaveBeenCalledTimes(1);
  });

  it('calls loadExpenses with sort but no client-side household_id filter', async () => {
    const store = useFinancesStore();
    mockGetFullListExpenses.mockResolvedValueOnce([]);
    mockGetFullListMembers.mockResolvedValueOnce([]);

    await store.load();

    expect(mockGetFullListExpenses).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: '-date',
      })
    );
    expect(mockGetFullListExpenses).toHaveBeenCalledWith(
      expect.not.objectContaining({ filter: expect.anything() })
    );
  });

  it('calls loadMembers with expand=user_id and no client-side household_id filter', async () => {
    const store = useFinancesStore();
    mockGetFullListExpenses.mockResolvedValueOnce([]);
    mockGetFullListMembers.mockResolvedValueOnce([]);

    await store.load();

    expect(mockGetFullListMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        expand: 'user_id',
      })
    );
    expect(mockGetFullListMembers).toHaveBeenCalledWith(
      expect.not.objectContaining({ filter: expect.anything() })
    );
  });
});

describe('reset on logout', () => {
  it('resets store when isAuthenticated becomes false', async () => {
    const store = useFinancesStore();
    store.expenses = [
      {
        id: 'e1',
        title: 'Groceries',
        amount: 1000,
        date: '2026-01-01',
        portion: 50,
        member_id: 'member-a',
        household_id: 'hh-1',
        created: '',
        updated: '',
      },
    ];
    store.members = [
      {
        id: 'member-a',
        household_id: 'hh-1',
        user_id: 'user-a',
        role: 'admin',
        display_name: 'Alice',
        created: '',
        updated: '',
      },
    ];
    store.loadStatus = 'success';

    sharedAuthState.isAuthenticated = false;
    await flushPromises();

    expect(store.expenses).toHaveLength(0);
    expect(store.members).toHaveLength(0);
    expect(store.loadStatus).toBe('idle');
  });
});

describe('addExpense', () => {
  const payload = {
    title: 'Groceries',
    amount: 4580,
    portion: 50,
    date: '2026-06-08 00:00:00.000Z',
  };

  const serverRecord = makeExpense({
    id: 'real-id-from-server',
    title: 'Groceries',
    amount: 4580,
    portion: 50,
    date: '2026-06-08 00:00:00.000Z',
  });

  it('immediately adds optimistic expense to front of expenses array', async () => {
    const store = useFinancesStore();
    store.loadStatus = 'success';
    const existing = makeExpense({ id: 'existing-1' });
    store.expenses = [existing];

    // Let the create hang so we can check the optimistic state
    let resolveCreate!: (v: Expense) => void;
    mockCreateFn.mockReturnValueOnce(
      new Promise<Expense>((res) => {
        resolveCreate = res;
      })
    );

    const addPromise = store.addExpense(payload);
    // Optimistic entry is at index 0
    expect(store.expenses).toHaveLength(2);
    expect(store.expenses[0]!.id).toMatch(/^optimistic-/);
    expect(store.expenses[0]!.title).toBe('Groceries');

    resolveCreate(serverRecord);
    await addPromise;
  });

  it('sets addExpenseStatus to "loading" during write, "success" after', async () => {
    const store = useFinancesStore();
    store.loadStatus = 'success';
    mockCreateFn.mockResolvedValueOnce(serverRecord);

    expect(store.addExpenseStatus).toBe('idle');
    const addPromise = store.addExpense(payload);
    expect(store.addExpenseStatus).toBe('loading');
    await addPromise;
    expect(store.addExpenseStatus).toBe('success');
  });

  it('replaces optimistic entry with real record on success', async () => {
    const store = useFinancesStore();
    store.loadStatus = 'success';
    mockCreateFn.mockResolvedValueOnce(serverRecord);

    await store.addExpense(payload);

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.id).toBe('real-id-from-server');
  });

  it('deduplicates when SSE echo arrives before POST response (SSE-before-POST race)', async () => {
    const store = useFinancesStore();
    store.loadStatus = 'success';

    let resolveCreate!: (v: Expense) => void;
    mockCreateFn.mockReturnValueOnce(
      new Promise<Expense>((res) => {
        resolveCreate = res;
      })
    );

    const addPromise = store.addExpense(payload);

    // SSE echo arrives while optimistic entry is still in the list
    store.applySSEEvent('create', serverRecord);

    // At this point: optimistic entry + SSE-added real record = 2 entries
    expect(store.expenses).toHaveLength(2);

    // POST response arrives - should collapse to exactly 1 entry
    resolveCreate(serverRecord);
    await addPromise;

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.id).toBe('real-id-from-server');
  });

  it('reverts expenses to snapshot and sets status to "error" on failure', async () => {
    const store = useFinancesStore();
    store.loadStatus = 'success';
    const existing = makeExpense({ id: 'existing-1' });
    store.expenses = [existing];
    mockCreateFn.mockRejectedValueOnce(new Error('Network error'));

    await store.addExpense(payload);

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.id).toBe('existing-1');
    expect(store.addExpenseStatus).toBe('error');
  });

  it('does nothing if householdId is null', async () => {
    mockUseAuthStore.mockReturnValue({
      memberId: 'member-a',
      householdId: null,
      isAuthenticated: true,
    });
    const store = useFinancesStore();
    store.expenses = [];

    await store.addExpense(payload);

    expect(mockCreateFn).not.toHaveBeenCalled();
    expect(store.expenses).toHaveLength(0);
  });
});

describe('updateExpense', () => {
  const updatePayload = {
    title: 'Updated Groceries',
    amount: 6000,
    portion: 60,
    date: '2026-06-09 00:00:00.000Z',
  };

  const serverRecord = makeExpense({
    id: 'exp-1',
    title: 'Updated Groceries',
    amount: 6000,
    portion: 60,
    date: '2026-06-09 00:00:00.000Z',
  });

  it('immediately updates the matching expense optimistically', async () => {
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1', title: 'Groceries' })];

    let resolveUpdate!: (v: Expense) => void;
    mockUpdateFn.mockReturnValueOnce(
      new Promise<Expense>((res) => {
        resolveUpdate = res;
      })
    );

    const updatePromise = store.updateExpense('exp-1', updatePayload);
    expect(store.expenses[0]!.title).toBe('Updated Groceries');

    resolveUpdate(serverRecord);
    await updatePromise;
  });

  it('sets updateExpenseStatus to "loading" then "success"', async () => {
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1' })];
    mockUpdateFn.mockResolvedValueOnce(serverRecord);

    expect(store.updateExpenseStatus).toBe('idle');
    const updatePromise = store.updateExpense('exp-1', updatePayload);
    expect(store.updateExpenseStatus).toBe('loading');
    await updatePromise;
    expect(store.updateExpenseStatus).toBe('success');
  });

  it('replaces optimistic entry with server record on success', async () => {
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1', title: 'Groceries' })];
    mockUpdateFn.mockResolvedValueOnce(serverRecord);

    await store.updateExpense('exp-1', updatePayload);

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.title).toBe('Updated Groceries');
    expect(store.expenses[0]!.amount).toBe(6000);
  });

  it('reverts expenses to snapshot and sets status to "error" on failure', async () => {
    const store = useFinancesStore();
    const original = makeExpense({ id: 'exp-1', title: 'Groceries' });
    store.expenses = [original];
    mockUpdateFn.mockRejectedValueOnce(new Error('Network error'));

    await store.updateExpense('exp-1', updatePayload);

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.title).toBe('Groceries');
    expect(store.updateExpenseStatus).toBe('error');
  });

  it('does nothing if householdId is null', async () => {
    mockUseAuthStore.mockReturnValue({
      memberId: 'member-a',
      householdId: null,
      isAuthenticated: true,
    });
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1' })];

    await store.updateExpense('exp-1', updatePayload);

    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it('does nothing if expense id not found in list', async () => {
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1' })];

    await store.updateExpense('nonexistent-id', updatePayload);

    expect(mockUpdateFn).not.toHaveBeenCalled();
    expect(store.updateExpenseStatus).toBe('error');
  });
});

describe('applySSEEvent', () => {
  const EXPENSE_A: Expense = {
    id: 'exp-a',
    household_id: 'hh-1',
    member_id: 'member-a',
    title: 'Groceries',
    amount: 5000,
    portion: 50,
    date: '2026-06-09 00:00:00.000Z',
    created: '2026-06-09T00:00:00Z',
    updated: '2026-06-09T00:00:00Z',
  };
  const EXPENSE_B: Expense = {
    id: 'exp-b',
    household_id: 'hh-1',
    member_id: 'member-b',
    title: 'Dinner',
    amount: 3000,
    portion: 50,
    date: '2026-06-08 00:00:00.000Z',
    created: '2026-06-08T00:00:00Z',
    updated: '2026-06-08T00:00:00Z',
  };

  it('create action adds a new record to the array and sorts by date', () => {
    const store = useFinancesStore();
    store.expenses = [EXPENSE_B];

    store.applySSEEvent('create', EXPENSE_A);

    expect(store.expenses).toHaveLength(2);
    expect(store.expenses[0]!.id).toBe('exp-a'); // newer date first
    expect(store.expenses[1]!.id).toBe('exp-b');
  });

  it('create action with existing id replaces the record (upsert - handles own write SSE echo)', () => {
    const store = useFinancesStore();
    store.expenses = [EXPENSE_A];

    const updated: Expense = { ...EXPENSE_A, amount: 9999 };
    store.applySSEEvent('create', updated);

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.amount).toBe(9999);
  });

  it('update action replaces the matching record by id', () => {
    const store = useFinancesStore();
    store.expenses = [EXPENSE_A, EXPENSE_B];

    const updated: Expense = { ...EXPENSE_A, title: 'Supermarket', amount: 7500 };
    store.applySSEEvent('update', updated);

    expect(store.expenses).toHaveLength(2);
    const found = store.expenses.find((e) => e.id === 'exp-a');
    expect(found!.title).toBe('Supermarket');
    expect(found!.amount).toBe(7500);
  });

  it('update action is a no-op when id is not found', () => {
    const store = useFinancesStore();
    store.expenses = [EXPENSE_A];

    const ghost: Expense = { ...EXPENSE_B, id: 'nonexistent' };
    store.applySSEEvent('update', ghost);

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.id).toBe('exp-a');
  });

  it('delete action removes the matching record by id', () => {
    const store = useFinancesStore();
    store.expenses = [EXPENSE_A, EXPENSE_B];

    store.applySSEEvent('delete', EXPENSE_A);

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.id).toBe('exp-b');
  });

  it('delete action is a no-op when id is not found', () => {
    const store = useFinancesStore();
    store.expenses = [EXPENSE_A];

    const ghost: Expense = { ...EXPENSE_B, id: 'nonexistent' };
    store.applySSEEvent('delete', ghost);

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.id).toBe('exp-a');
  });

  it('all actions maintain descending date sort order', () => {
    const EXPENSE_OLD: Expense = {
      id: 'exp-old',
      household_id: 'hh-1',
      member_id: 'member-a',
      title: 'Old',
      amount: 1000,
      portion: 50,
      date: '2026-06-01 00:00:00.000Z',
      created: '2026-06-01T00:00:00Z',
      updated: '2026-06-01T00:00:00Z',
    };
    const EXPENSE_NEW: Expense = {
      id: 'exp-new',
      household_id: 'hh-1',
      member_id: 'member-b',
      title: 'New',
      amount: 2000,
      portion: 50,
      date: '2026-06-10 00:00:00.000Z',
      created: '2026-06-10T00:00:00Z',
      updated: '2026-06-10T00:00:00Z',
    };

    const store = useFinancesStore();
    store.expenses = [EXPENSE_OLD];

    store.applySSEEvent('create', EXPENSE_NEW);

    expect(store.expenses[0]!.id).toBe('exp-new');
    expect(store.expenses[1]!.id).toBe('exp-old');
  });
});

describe('settleUp and isSettledPair', () => {
  const PRE_SETTLEMENT_EXPENSE: Expense = {
    id: 'exp-pre',
    household_id: 'hh-1',
    member_id: 'member-b',
    title: 'Dinner',
    amount: 8000,
    portion: 50,
    date: '2026-06-09 00:00:00.000Z',
    created: '2026-06-09 10:00:00.000Z',
    updated: '2026-06-09 10:00:00.000Z',
  };

  it('isSettledPair returns false when no settlements exist', () => {
    const store = useFinancesStore();
    expect(store.isSettledPair('member-b')).toBe(false);
  });

  it('settleUp adds an optimistic settlement and isSettledPair returns true when balance is 0', async () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    store.expenses = []; // zero balance -> isSettledPair returns true after settle
    mockSettlementsCreateFn.mockResolvedValueOnce({
      id: 'real-settlement-id',
      household_id: 'hh-1',
      member_a_id: 'member-a',
      member_b_id: 'member-b',
      settled_at: '2026-06-13 10:00:00.000Z',
      created: '2026-06-13 10:00:00.000Z',
      updated: '2026-06-13 10:00:00.000Z',
    });

    // settleUp is called without await in FinancesView - test the optimistic path
    const settlePromise = store.settleUp({ member_a_id: 'member-a', member_b_id: 'member-b' });
    // Optimistic: settlement is added immediately
    expect(store.isSettledPair('member-b')).toBe(true);

    await settlePromise;
    // Real record replaces optimistic - still settled
    expect(store.isSettledPair('member-b')).toBe(true);
    expect(store.activeSettlements[0]!.id).toBe('real-settlement-id');
  });

  it('bilateralBalances excludes pre-settlement expenses', async () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    store.expenses = [PRE_SETTLEMENT_EXPENSE];

    // Without settlement: balance is -4000 (Bob paid €80, viewer owes €40)
    expect(store.bilateralBalances[0]!.amount).not.toBe(0);

    // Inject a settlement after the pre-settlement expense
    store.activeSettlements = [
      {
        id: 's-1',
        household_id: 'hh-1',
        member_a_id: 'member-a',
        member_b_id: 'member-b',
        settled_at: '2026-06-09 11:00:00.000Z', // after the expense's created
        created: '2026-06-09 11:00:00.000Z',
        updated: '2026-06-09 11:00:00.000Z',
      },
    ];

    // Pre-settlement expense is now excluded -> balance = 0
    expect(store.bilateralBalances[0]!.amount).toBe(0);
    expect(store.isSettledPair('member-b')).toBe(true);
  });

  it('excludes pre-settlement expenses with ISO T-separator created (addExpense optimistic format)', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    // Optimistic expense: addExpense sets created via new Date().toISOString() - T separator
    store.expenses = [
      {
        ...PRE_SETTLEMENT_EXPENSE,
        created: '2026-06-09T10:00:00.000Z', // T separator - the regression case
      },
    ];
    store.activeSettlements = [
      {
        id: 's-1',
        household_id: 'hh-1',
        member_a_id: 'member-a',
        member_b_id: 'member-b',
        settled_at: '2026-06-09 11:00:00.000Z', // space separator, after the expense
        created: '2026-06-09 11:00:00.000Z',
        updated: '2026-06-09 11:00:00.000Z',
      },
    ];

    // The expense must be excluded even though its created uses T-separator format
    expect(store.bilateralBalances[0]!.amount).toBe(0);
  });

  it('includes expenses with absent created - sentinel puts them past any settlement cutoff (AC2: date must never be used)', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    store.expenses = [
      {
        ...PRE_SETTLEMENT_EXPENSE,
        created: undefined, // absent - sentinel '9999-12-31...' is used instead
        date: '2026-06-09 00:00:00.000Z', // must NOT be used as fallback per AC2
      },
    ];
    store.activeSettlements = [
      {
        id: 's-1',
        household_id: 'hh-1',
        member_a_id: 'member-a',
        member_b_id: 'member-b',
        settled_at: '2026-06-09 11:00:00.000Z',
        created: '2026-06-09 11:00:00.000Z',
        updated: '2026-06-09 11:00:00.000Z',
      },
    ];

    // Sentinel '9999-12-31...' is after any cutoff, so expense IS included
    expect(store.bilateralBalances[0]!.amount).not.toBe(0);
  });

  it('isSettledPair returns false when post-settlement expense creates non-zero balance', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    store.activeSettlements = [
      {
        id: 's-1',
        household_id: 'hh-1',
        member_a_id: 'member-a',
        member_b_id: 'member-b',
        settled_at: '2026-06-09 11:00:00.000Z',
        created: '2026-06-09 11:00:00.000Z',
        updated: '2026-06-09 11:00:00.000Z',
      },
    ];
    // New expense AFTER settlement date
    store.expenses = [
      makeExpense({
        member_id: 'member-b',
        amount: 8000,
        portion: 50,
        created: '2026-06-10 10:00:00.000Z',
      }),
    ];

    // Balance is non-zero because post-settlement expense exists
    expect(store.bilateralBalances[0]!.amount).not.toBe(0);
    expect(store.isSettledPair('member-b')).toBe(false);
  });

  it('settleUp reverts optimistic record on API failure', async () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    store.expenses = [];
    mockSettlementsCreateFn.mockRejectedValueOnce(new Error('Network error'));

    const settlePromise = store.settleUp({ member_a_id: 'member-a', member_b_id: 'member-b' });
    expect(store.activeSettlements).toHaveLength(1); // optimistic

    await settlePromise;
    expect(store.activeSettlements).toHaveLength(0); // reverted
    expect(store.isSettledPair('member-b')).toBe(false);
  });

  it('reset clears activeSettlements', async () => {
    const store = useFinancesStore();
    store.activeSettlements = [
      {
        id: 's-1',
        household_id: 'hh-1',
        member_a_id: 'member-a',
        member_b_id: 'member-b',
        settled_at: '2026-06-09 11:00:00.000Z',
        created: '2026-06-09 11:00:00.000Z',
        updated: '2026-06-09 11:00:00.000Z',
      },
    ];
    store.reset();
    expect(store.activeSettlements).toHaveLength(0);
  });

  it('uses the latest settlement when multiple exist for the same pair', () => {
    const store = useFinancesStore();
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')];
    // Two settlements: one old, one recent
    store.activeSettlements = [
      {
        id: 's-old',
        household_id: 'hh-1',
        member_a_id: 'member-a',
        member_b_id: 'member-b',
        settled_at: '2026-06-01 00:00:00.000Z',
        created: '2026-06-01 00:00:00.000Z',
        updated: '2026-06-01 00:00:00.000Z',
      },
      {
        id: 's-new',
        household_id: 'hh-1',
        member_a_id: 'member-a',
        member_b_id: 'member-b',
        settled_at: '2026-06-10 00:00:00.000Z',
        created: '2026-06-10 00:00:00.000Z',
        updated: '2026-06-10 00:00:00.000Z',
      },
    ];
    // Expense between old and new settlement - should be EXCLUDED (predates latest)
    store.expenses = [
      makeExpense({
        member_id: 'member-b',
        amount: 8000,
        portion: 50,
        created: '2026-06-05 00:00:00.000Z',
      }),
    ];

    expect(store.bilateralBalances[0]!.amount).toBe(0);
  });
});

describe('bilateralBalances - join-date filter', () => {
  it('excludes expenses created before the other member joined', () => {
    const store = useFinancesStore();
    // member-b joined AFTER the expense was created
    store.members = [
      makeMember('member-a', 'Alice'), // joined '2026-01-01T00:00:00Z'
      { ...makeMember('member-b', 'Bob'), created: '2026-06-15T00:00:00Z' },
    ];
    // Expense created on 2026-06-01 - before member-b's join date
    store.expenses = [
      makeExpense({
        member_id: 'member-a',
        amount: 10000,
        portion: 50,
        created: '2026-06-01 00:00:00.000Z',
      }),
    ];

    expect(store.bilateralBalances[0]!.amount).toBe(0);
  });

  it('excludes expenses created before the viewer joined', () => {
    const store = useFinancesStore();
    // viewer (member-a) joined late - after the expense
    store.members = [
      { ...makeMember('member-a', 'Alice'), created: '2026-06-15T00:00:00Z' },
      makeMember('member-b', 'Bob'), // joined '2026-01-01T00:00:00Z'
    ];
    store.expenses = [
      makeExpense({
        member_id: 'member-b',
        amount: 10000,
        portion: 50,
        created: '2026-06-01 00:00:00.000Z',
      }),
    ];

    expect(store.bilateralBalances[0]!.amount).toBe(0);
  });

  it('includes expenses created after both members joined', () => {
    const store = useFinancesStore();
    store.members = [
      { ...makeMember('member-a', 'Alice'), created: '2026-01-01T00:00:00Z' },
      { ...makeMember('member-b', 'Bob'), created: '2026-01-02T00:00:00Z' },
    ];
    // Expense created well after both join dates
    store.expenses = [
      makeExpense({
        member_id: 'member-a',
        amount: 10000,
        portion: 50,
        created: '2026-06-01 00:00:00.000Z',
      }),
    ];

    expect(store.bilateralBalances[0]!.amount).toBe(5000);
  });
});

describe('deleteExpense', () => {
  it('immediately removes the expense optimistically', async () => {
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1' }), makeExpense({ id: 'exp-2' })];

    let resolveDelete!: () => void;
    mockDeleteFn.mockReturnValueOnce(
      new Promise<void>((res) => {
        resolveDelete = res;
      })
    );

    const deletePromise = store.deleteExpense('exp-1');
    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.id).toBe('exp-2');

    resolveDelete();
    await deletePromise;
  });

  it('sets deleteExpenseStatus to "loading" then "success"', async () => {
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1' })];
    mockDeleteFn.mockResolvedValueOnce(undefined);

    expect(store.deleteExpenseStatus).toBe('idle');
    const deletePromise = store.deleteExpense('exp-1');
    expect(store.deleteExpenseStatus).toBe('loading');
    await deletePromise;
    expect(store.deleteExpenseStatus).toBe('success');
  });

  it('reverts expenses to snapshot and sets status to "error" on failure', async () => {
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1' })];
    mockDeleteFn.mockRejectedValueOnce(new Error('Network error'));

    await store.deleteExpense('exp-1');

    expect(store.expenses).toHaveLength(1);
    expect(store.expenses[0]!.id).toBe('exp-1');
    expect(store.deleteExpenseStatus).toBe('error');
  });

  it('does nothing if householdId is null', async () => {
    mockUseAuthStore.mockReturnValue({
      memberId: 'member-a',
      householdId: null,
      isAuthenticated: true,
    });
    const store = useFinancesStore();
    store.expenses = [makeExpense({ id: 'exp-1' })];

    await store.deleteExpense('exp-1');

    expect(mockDeleteFn).not.toHaveBeenCalled();
    expect(store.expenses).toHaveLength(1);
  });
});
