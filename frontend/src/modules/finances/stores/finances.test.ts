import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useFinancesStore } from './finances'
import type { Expense } from '@/modules/finances/types'
import type { MemberRecord } from '@/modules/household/types'

const {
  mockGetFullListExpenses,
  mockGetFullListMembers,
  mockCreateFn,
  mockFilter,
  mockUseAuthStore,
  mockUseHouseholdStore,
} = vi.hoisted(() => ({
  mockGetFullListExpenses: vi.fn(),
  mockGetFullListMembers: vi.fn(),
  mockCreateFn: vi.fn(),
  mockFilter: vi.fn((expr: string, params: Record<string, unknown>) =>
    Object.entries(params).reduce((s, [k, v]) => s.replace(`{:${k}}`, String(v)), expr)
  ),
  mockUseAuthStore: vi.fn(),
  mockUseHouseholdStore: vi.fn(() => ({
    split_ratios: { 'member-a': 50, 'member-b': 50 },
    currency: 'EUR',
  })),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    filter: mockFilter,
    collection: (name: string) => ({
      getFullList:
        name === 'expenses'
          ? mockGetFullListExpenses
          : name === 'members'
            ? mockGetFullListMembers
            : vi.fn(),
      create: name === 'expenses' ? mockCreateFn : vi.fn(),
    }),
  },
}))

// Persistent reactive auth state — used by the store's isAuthenticated watcher
const sharedAuthState = reactive({
  memberId: 'member-a',
  householdId: 'hh-1',
  isAuthenticated: true as boolean,
})

vi.mock('@/shared/stores/auth', () => ({ useAuthStore: mockUseAuthStore }))

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: mockUseHouseholdStore,
}))

function makeMember(id: string, name: string): MemberRecord {
  return {
    id,
    household_id: 'hh-1',
    user_id: `user-${id}`,
    role: 'member',
    display_name: name,
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
  }
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
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  // Restore defaults after each test
  sharedAuthState.memberId = 'member-a'
  sharedAuthState.isAuthenticated = true
  mockUseAuthStore.mockReturnValue(sharedAuthState)
  mockUseHouseholdStore.mockReturnValue({
    split_ratios: { 'member-a': 50, 'member-b': 50 },
    currency: 'EUR',
  })
})

describe('bilateralBalances', () => {
  it('returns empty array when fewer than 2 members', () => {
    const store = useFinancesStore()
    store.members = [makeMember('member-a', 'Alice')]
    expect(store.bilateralBalances).toEqual([])
  })

  it('returns empty array when viewerMemberId is null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseAuthStore.mockReturnValue({ memberId: null as any, householdId: 'hh-1' })

    const store = useFinancesStore()
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')]
    expect(store.bilateralBalances).toEqual([])
  })

  it('computes positive balance when viewer paid and other owes', () => {
    const store = useFinancesStore()
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')]
    // Viewer (member-a) paid 10000 cents with 50% portion
    // remainder = trunc(10000 * 50 / 100) = 5000
    // otherRatio=50, totalOtherRatio=50 -> balance += round(5000 * 50/50) = 5000
    store.expenses = [makeExpense({ member_id: 'member-a', amount: 10000, portion: 50 })]

    expect(store.bilateralBalances).toEqual([
      { member_a_id: 'member-a', member_b_id: 'member-b', amount: 5000 },
    ])
  })

  it('computes negative balance when other paid and viewer owes', () => {
    const store = useFinancesStore()
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')]
    // Other (member-b) paid 10000 cents with 50% portion
    // remainder = 5000; viewerRatio=50, totalViewerSideRatio=50 -> balance -= 5000
    store.expenses = [makeExpense({ member_id: 'member-b', amount: 10000, portion: 50 })]

    expect(store.bilateralBalances).toEqual([
      { member_a_id: 'member-a', member_b_id: 'member-b', amount: -5000 },
    ])
  })

  it('computes net zero when expenses cancel out', () => {
    const store = useFinancesStore()
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')]
    store.expenses = [
      makeExpense({ id: 'exp-1', member_id: 'member-a', amount: 10000, portion: 50 }),
      makeExpense({ id: 'exp-2', member_id: 'member-b', amount: 10000, portion: 50 }),
    ]

    expect(store.bilateralBalances).toEqual([
      { member_a_id: 'member-a', member_b_id: 'member-b', amount: 0 },
    ])
  })

  it('correctly distributes remainder to the right bilateral pair in 3-member household', () => {
    mockUseHouseholdStore.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      split_ratios: { 'member-a': 33, 'member-b': 33, 'member-c': 34 } as any,
      currency: 'EUR',
    })

    const store = useFinancesStore()
    store.members = [
      makeMember('member-a', 'Alice'),
      makeMember('member-b', 'Bob'),
      makeMember('member-c', 'Carol'),
    ]
    // Viewer (member-a) paid 10000 cents with 33% portion
    // remainder = trunc(10000 * 67 / 100) = 6700
    // B pair: totalOtherRatio = 33+34=67; B's share: round(6700 * 33/67) = round(3300.0) = 3300
    // C pair: C's share: round(6700 * 34/67) = round(3400.0) = 3400
    store.expenses = [makeExpense({ member_id: 'member-a', amount: 10000, portion: 33 })]

    const balances = store.bilateralBalances
    const bBalance = balances.find(b => b.member_b_id === 'member-b')
    const cBalance = balances.find(b => b.member_b_id === 'member-c')

    expect(bBalance?.amount).toBe(3300)
    expect(cBalance?.amount).toBe(3400)
  })

  it('uses integer arithmetic — no float intermediates stored', () => {
    const store = useFinancesStore()
    store.members = [makeMember('member-a', 'Alice'), makeMember('member-b', 'Bob')]
    // 4580 cents (€45.80) with 0% portion -> all 4580 goes to Bob
    store.expenses = [makeExpense({ amount: 4580, portion: 0 })]

    const [balance] = store.bilateralBalances
    expect(Number.isInteger(balance!.amount)).toBe(true)
    expect(balance!.amount).toBe(4580)
  })
})

describe('load', () => {
  it('sets loadStatus to loading then success on resolve', async () => {
    const store = useFinancesStore()
    mockGetFullListExpenses.mockResolvedValueOnce([])
    mockGetFullListMembers.mockResolvedValueOnce([])

    expect(store.loadStatus).toBe('idle')
    const loadPromise = store.load()
    expect(store.loadStatus).toBe('loading')
    await loadPromise
    expect(store.loadStatus).toBe('success')
  })

  it('sets loadStatus to error on rejection', async () => {
    const store = useFinancesStore()
    mockGetFullListExpenses.mockRejectedValueOnce(new Error('Network error'))
    mockGetFullListMembers.mockResolvedValueOnce([])

    await store.load()
    expect(store.loadStatus).toBe('error')
  })

  it('does not start a second fetch if already loading', async () => {
    const store = useFinancesStore()
    let resolveFirst!: () => void
    mockGetFullListExpenses.mockReturnValueOnce(
      new Promise<Expense[]>(res => {
        resolveFirst = () => res([])
      })
    )
    mockGetFullListMembers.mockResolvedValue([])

    const first = store.load()
    store.load() // second call while loading — should be ignored
    resolveFirst()
    await first

    expect(mockGetFullListExpenses).toHaveBeenCalledTimes(1)
  })

  it('calls loadExpenses with sort but no client-side household_id filter', async () => {
    const store = useFinancesStore()
    mockGetFullListExpenses.mockResolvedValueOnce([])
    mockGetFullListMembers.mockResolvedValueOnce([])

    await store.load()

    expect(mockGetFullListExpenses).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: '-date',
      })
    )
    expect(mockGetFullListExpenses).toHaveBeenCalledWith(
      expect.not.objectContaining({ filter: expect.anything() })
    )
  })

  it('calls loadMembers with expand=user_id and no client-side household_id filter', async () => {
    const store = useFinancesStore()
    mockGetFullListExpenses.mockResolvedValueOnce([])
    mockGetFullListMembers.mockResolvedValueOnce([])

    await store.load()

    expect(mockGetFullListMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        expand: 'user_id',
      })
    )
    expect(mockGetFullListMembers).toHaveBeenCalledWith(
      expect.not.objectContaining({ filter: expect.anything() })
    )
  })
})

describe('reset on logout', () => {
  it('resets store when isAuthenticated becomes false', async () => {
    const store = useFinancesStore()
    store.expenses = [{ id: 'e1', title: 'Groceries', amount: 1000, date: '2026-01-01', portion: 50, member_id: 'member-a', household_id: 'hh-1', created: '', updated: '' }]
    store.members = [{ id: 'member-a', household_id: 'hh-1', user_id: 'user-a', role: 'admin', display_name: 'Alice', created: '', updated: '' }]
    store.loadStatus = 'success'

    sharedAuthState.isAuthenticated = false
    await flushPromises()

    expect(store.expenses).toHaveLength(0)
    expect(store.members).toHaveLength(0)
    expect(store.loadStatus).toBe('idle')
  })
})

describe('addExpense', () => {
  const payload = {
    title: 'Groceries',
    amount: 4580,
    portion: 50,
    date: '2026-06-08 00:00:00.000Z',
  }

  const serverRecord = makeExpense({
    id: 'real-id-from-server',
    title: 'Groceries',
    amount: 4580,
    portion: 50,
    date: '2026-06-08 00:00:00.000Z',
  })

  it('immediately adds optimistic expense to front of expenses array', async () => {
    const store = useFinancesStore()
    const existing = makeExpense({ id: 'existing-1' })
    store.expenses = [existing]

    // Let the create hang so we can check the optimistic state
    let resolveCreate!: (v: Expense) => void
    mockCreateFn.mockReturnValueOnce(new Promise<Expense>(res => { resolveCreate = res }))

    const addPromise = store.addExpense(payload)
    // Optimistic entry is at index 0
    expect(store.expenses).toHaveLength(2)
    expect(store.expenses[0]!.id).toMatch(/^optimistic-/)
    expect(store.expenses[0]!.title).toBe('Groceries')

    resolveCreate(serverRecord)
    await addPromise
  })

  it('sets addExpenseStatus to "loading" during write, "success" after', async () => {
    const store = useFinancesStore()
    mockCreateFn.mockResolvedValueOnce(serverRecord)

    expect(store.addExpenseStatus).toBe('idle')
    const addPromise = store.addExpense(payload)
    expect(store.addExpenseStatus).toBe('loading')
    await addPromise
    expect(store.addExpenseStatus).toBe('success')
  })

  it('replaces optimistic entry with real record on success', async () => {
    const store = useFinancesStore()
    mockCreateFn.mockResolvedValueOnce(serverRecord)

    await store.addExpense(payload)

    expect(store.expenses).toHaveLength(1)
    expect(store.expenses[0]!.id).toBe('real-id-from-server')
  })

  it('reverts expenses to snapshot and sets status to "error" on failure', async () => {
    const store = useFinancesStore()
    const existing = makeExpense({ id: 'existing-1' })
    store.expenses = [existing]
    mockCreateFn.mockRejectedValueOnce(new Error('Network error'))

    await store.addExpense(payload)

    expect(store.expenses).toHaveLength(1)
    expect(store.expenses[0]!.id).toBe('existing-1')
    expect(store.addExpenseStatus).toBe('error')
  })

  it('does nothing if householdId is null', async () => {
    mockUseAuthStore.mockReturnValue({ memberId: 'member-a', householdId: null, isAuthenticated: true })
    const store = useFinancesStore()
    store.expenses = []

    await store.addExpense(payload)

    expect(mockCreateFn).not.toHaveBeenCalled()
    expect(store.expenses).toHaveLength(0)
  })
})
