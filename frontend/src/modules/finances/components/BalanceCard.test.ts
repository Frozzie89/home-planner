import { describe, it, expect, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import BalanceCard from './BalanceCard.vue';
import type { Balance } from '@/modules/finances/types';
import type { MemberRecord } from '@/modules/household/types';

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
  };
}

function makeBalance(amount: number): Balance {
  return { member_a_id: 'member-a', member_b_id: 'member-b', amount };
}

describe('BalanceCard — slim card states', () => {
  it('renders positive amount with amt-positive class and Settle up button', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(4580), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-amt').classes()).toContain('amt-positive');
    expect(wrapper.find('.slim-amt').classes()).not.toContain('amt-negative');
    expect(wrapper.find('.btn-settle').exists()).toBe(true);
    expect(wrapper.find('.settled-check').exists()).toBe(false);
  });

  it('renders positive amount with + sign', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(4580), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-amt').text()).toMatch(/^\+/);
  });

  it('renders negative amount with amt-negative class and Settle up button', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(-4580), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-amt').classes()).toContain('amt-negative');
    expect(wrapper.find('.slim-amt').classes()).not.toContain('amt-positive');
    expect(wrapper.find('.btn-settle').exists()).toBe(true);
    expect(wrapper.find('.settled-check').exists()).toBe(false);
  });

  it('renders negative amount with − prefix', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(-4580), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-amt').text()).toMatch(/^−/); // U+2212 minus sign
  });

  it('renders zero amount with amt-zero class, ✓ badge, no Settle up button', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(0), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-amt').classes()).toContain('amt-zero');
    expect(wrapper.find('.settled-check').exists()).toBe(true);
    expect(wrapper.find('.btn-settle').exists()).toBe(false);
  });

  it('applies state-nonzero class on card when amount is non-zero', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(1000), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-card').classes()).toContain('state-nonzero');
    expect(wrapper.find('.slim-card').classes()).not.toContain('state-zero');
  });

  it('applies state-zero class on card when amount is zero', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(0), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-card').classes()).toContain('state-zero');
    expect(wrapper.find('.slim-card').classes()).not.toContain('state-nonzero');
  });

  it('shows "X owes you" direction text for positive balance', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(1000),
        otherMember: makeMember({ display_name: 'Bob' }),
        currency: 'EUR',
      },
    });

    expect(wrapper.find('.slim-dir').text()).toBe('Bob owes you');
  });

  it('shows "You owe X" direction text for negative balance', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(-1000),
        otherMember: makeMember({ display_name: 'Bob' }),
        currency: 'EUR',
      },
    });

    expect(wrapper.find('.slim-dir').text()).toBe('You owe Bob');
  });

  it('shows "All settled" direction text for zero balance', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(0),
        otherMember: makeMember({ display_name: 'Bob' }),
        currency: 'EUR',
      },
    });

    expect(wrapper.find('.slim-dir').text()).toBe('All settled');
  });

  it('renders member name in slim-name', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(1000),
        otherMember: makeMember({ display_name: 'Alice' }),
        currency: 'EUR',
      },
    });

    expect(wrapper.find('.slim-name').text()).toBe('Alice');
  });

  it('uses getMemberName — display_name takes priority', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(1000),
        otherMember: makeMember({
          display_name: 'Bobby',
          expand: {
            user_id: {
              id: 'user-b',
              name: 'Bob Smith',
              email: 'b@test.com',
              avatar: '',
              username: 'bsmith',
            },
          },
        }),
        currency: 'EUR',
      },
    });

    expect(wrapper.find('.slim-name').text()).toBe('Bobby');
    expect(wrapper.text()).not.toContain('Bob Smith');
  });

  it('emits settle-up when Settle up button is clicked', async () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(5000), otherMember: makeMember(), currency: 'EUR' },
    });

    await wrapper.find('.btn-settle').trigger('click');
    expect(wrapper.emitted('settle-up')).toBeTruthy();
  });

  it('sets aria-live="polite" on the amount element', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(1000), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-amt').attributes('aria-live')).toBe('polite');
  });

  it('sets aria-label on amount element with formatted value', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(5000), otherMember: makeMember(), currency: 'EUR' },
    });

    const label = wrapper.find('.slim-amt').attributes('aria-label') ?? '';
    expect(label).toContain('50');
  });

  it('sets role="region" and aria-label on the card root', () => {
    const wrapper = mount(BalanceCard, {
      props: {
        balance: makeBalance(1000),
        otherMember: makeMember({ display_name: 'Bob' }),
        currency: 'EUR',
      },
    });

    expect(wrapper.find('.slim-card').attributes('role')).toBe('region');
    expect(wrapper.find('.slim-card').attributes('aria-label')).toContain('Bob');
  });

  it('formats amount using Intl.NumberFormat with the provided currency', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(10050), otherMember: makeMember(), currency: 'EUR' },
    });

    const amountText = wrapper.find('.slim-amt').text();
    expect(amountText).toContain('100');
    expect(amountText).toContain('50');
  });
});

describe('BalanceCard — animated display amount', () => {
  it('initializes displayedAmount from the initial balance prop', () => {
    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(5000), otherMember: makeMember(), currency: 'EUR' },
    });

    expect(wrapper.find('.slim-amt').text()).toContain('50');
  });

  it('updates displayedAmount immediately when prefers-reduced-motion: reduce is active', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(5000), otherMember: makeMember(), currency: 'EUR' },
    });

    await wrapper.setProps({ balance: makeBalance(8000) });
    await nextTick();

    expect(wrapper.find('.slim-amt').text()).toContain('80');

    vi.unstubAllGlobals();
  });

  it('cancels any pending rAF in onBeforeUnmount', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const wrapper = mount(BalanceCard, {
      props: { balance: makeBalance(5000), otherMember: makeMember(), currency: 'EUR' },
    });

    await wrapper.setProps({ balance: makeBalance(9000) });
    await nextTick();

    wrapper.unmount();

    expect(cancelSpy).toHaveBeenCalled();

    cancelSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
