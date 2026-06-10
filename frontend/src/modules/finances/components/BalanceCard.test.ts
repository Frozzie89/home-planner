import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import BalanceCard from './BalanceCard.vue'
import type { Balance } from '@/modules/finances/types'
import type { MemberRecord } from '@/modules/household/types'

function makeMember(overrides: Partial<MemberRecord> = {}): MemberRecord {
  return {
    id: 'member-b',
    household_id: 'hh-1',
    user_id: 'user-b',
    role: 'member',
    display_name: 'Bob',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeBalance(amount: number): Balance {
  return { member_a_id: 'member-a', member_b_id: 'member-b', amount }
}

describe('BalanceCard', () => {
  it('renders positive amount in balance-positive color with + prefix', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(4580),
        otherMember: makeMember(),
        currency: 'EUR',
      },
    })

    const amountEl = wrapper.find('.balance-amount')
    expect(amountEl.classes()).toContain('state-positive')
    expect(amountEl.text()).toMatch(/^\+/)
    expect(wrapper.text()).toContain('45')
  })

  it('renders negative amount in balance-negative color with − prefix', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(-4580),
        otherMember: makeMember(),
        currency: 'EUR',
      },
    })

    const amountEl = wrapper.find('.balance-amount')
    expect(amountEl.classes()).toContain('state-negative')
    expect(amountEl.text()).toMatch(/^−/) // U+2212 minus sign
    expect(wrapper.text()).toContain('45')
  })

  it('renders zero-fresh state with neutral styling and correct text', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(0),
        otherMember: makeMember(),
        currency: 'EUR',
        settled: false,
      },
    })

    const amountEl = wrapper.find('.balance-amount')
    expect(amountEl.classes()).toContain('state-zero')
    expect(amountEl.classes()).not.toContain('state-positive')
    expect(amountEl.classes()).not.toContain('state-negative')
    expect(wrapper.find('.balance-card').classes()).not.toContain('state-settled')
    expect(wrapper.text()).toContain('No expenses logged this period')
    expect(wrapper.find('.settled-badge').exists()).toBe(false)
  })

  it('renders zero-settled state with golden wash class and "All settled." text', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(0),
        otherMember: makeMember(),
        currency: 'EUR',
        settled: true,
      },
    })

    expect(wrapper.find('.balance-card').classes()).toContain('state-settled')
    expect(wrapper.text()).toContain('All settled. Nothing owed.')
    expect(wrapper.find('.settled-badge').exists()).toBe(true)
  })

  it('sets aria-live="polite" on the amount element', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(1000),
        otherMember: makeMember(),
        currency: 'EUR',
      },
    })

    expect(wrapper.find('.balance-amount').attributes('aria-live')).toBe('polite')
  })

  it('sets aria-label with full context on the amount element for non-zero balance', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(5000),
        otherMember: makeMember({ display_name: 'Bob' }),
        currency: 'EUR',
      },
    })

    const label = wrapper.find('.balance-amount').attributes('aria-label') ?? ''
    expect(label).toContain('Current balance:')
    expect(label).toContain('Bob owes you')
  })

  it('sets aria-label with member name for zero balance', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(0),
        otherMember: makeMember({ display_name: 'Bob' }),
        currency: 'EUR',
      },
    })

    const label = wrapper.find('.balance-amount').attributes('aria-label') ?? ''
    expect(label).toContain('Balance with Bob')
  })

  it('uses getMemberName for the otherMember name display', () => {
    // display_name takes priority over expand.user_id.name
    // Use a positive balance so the name appears in the sublabel ("Bobby owes you")
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(1000),
        otherMember: makeMember({
          display_name: 'Bobby',
          expand: { user_id: { id: 'user-b', name: 'Bob Smith', email: 'b@test.com', avatar: '', username: 'bsmith' } },
        }),
        currency: 'EUR',
      },
    })

    expect(wrapper.find('.balance-sublabel').text()).toContain('Bobby')
    expect(wrapper.text()).not.toContain('Bob Smith')
  })

  it('shows "YOUR BALANCE" header when headerLabel prop is passed', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(1000),
        otherMember: makeMember({ display_name: 'Bob' }),
        currency: 'EUR',
        headerLabel: 'YOUR BALANCE',
      },
    })

    expect(wrapper.find('.balance-header-label').text()).toBe('YOUR BALANCE')
  })

  it('defaults header to "WITH [NAME]" when headerLabel is not passed', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(1000),
        otherMember: makeMember({ display_name: 'Bob' }),
        currency: 'EUR',
      },
    })

    expect(wrapper.find('.balance-header-label').text()).toBe('WITH BOB')
  })

  it('formats amount using Intl.NumberFormat with the provided currency', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(10050),
        otherMember: makeMember(),
        currency: 'EUR',
      },
    })

    // Amount is 10050 cents = €100.50; EUR symbol should be present
    const amountText = wrapper.find('.balance-amount').text()
    expect(amountText).toContain('100')
    expect(amountText).toContain('50')
  })
})

describe('animated display amount', () => {
  it('initializes displayedAmount from the initial balance prop', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(5000),
        otherMember: makeMember(),
        currency: 'EUR',
      },
    })
    // 5000 cents = 50€ — rendered amount should reflect initial prop
    expect(wrapper.find('.balance-amount').text()).toContain('50')
  })

  it('updates displayedAmount immediately when prefers-reduced-motion: reduce is active', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))

    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(5000),
        otherMember: makeMember(),
        currency: 'EUR',
      },
    })

    await wrapper.setProps({ balance: makeBalance(8000) })
    await nextTick()

    // No rAF delay — displayedAmount jumps directly to 8000 cents = 80€
    expect(wrapper.find('.balance-amount').text()).toContain('80')

    vi.unstubAllGlobals()
  })

  it('cancels any pending rAF in onBeforeUnmount', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))

    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')

    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(5000),
        otherMember: makeMember(),
        currency: 'EUR',
      },
    })

    // Trigger animation path (reduced motion is false so rAF is scheduled)
    await wrapper.setProps({ balance: makeBalance(9000) })
    await nextTick()

    wrapper.unmount()

    expect(cancelSpy).toHaveBeenCalled()

    cancelSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
