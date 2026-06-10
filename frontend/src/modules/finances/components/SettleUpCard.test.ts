import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SettleUpCard from './SettleUpCard.vue'
import type { Balance } from '@/modules/finances/types'
import type { MemberRecord } from '@/modules/household/types'

vi.mock('@/shared/lib/currencyHelpers', () => ({
  getCurrencyLocale: () => 'en-US',
}))

vi.mock('@/shared/lib/memberHelpers', () => ({
  getMemberName: (m: MemberRecord) => m.display_name || 'Bob',
}))

const BALANCE: Balance = { member_a_id: 'member-a', member_b_id: 'member-b', amount: 5000 }
const OTHER_MEMBER: MemberRecord = {
  id: 'member-b',
  household_id: 'hh-1',
  user_id: 'user-b',
  role: 'member',
  display_name: 'Bob',
  created: '',
  updated: '',
}

describe('SettleUpCard', () => {
  it('renders with role="region" and aria-label="Settle up action"', () => {
    const wrapper = mount(SettleUpCard, {
      props: { balance: BALANCE, otherMember: OTHER_MEMBER, currency: 'EUR' },
    })
    const region = wrapper.find('[role="region"]')
    expect(region.exists()).toBe(true)
    expect(region.attributes('aria-label')).toBe('Settle up action')
  })

  it('shows a "Settle up" button', () => {
    const wrapper = mount(SettleUpCard, {
      props: { balance: BALANCE, otherMember: OTHER_MEMBER, currency: 'EUR' },
    })
    expect(wrapper.find('button').text()).toBe('Settle up')
  })

  it('emits settle-up when button is clicked', async () => {
    const wrapper = mount(SettleUpCard, {
      props: { balance: BALANCE, otherMember: OTHER_MEMBER, currency: 'EUR' },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('settle-up')).toBeTruthy()
  })
})
