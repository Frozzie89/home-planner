import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MemberList from './MemberList.vue'
import type { MemberRecord } from '@/modules/household/types'

const MOCK_MEMBERS: MemberRecord[] = [
  {
    id: 'member-1',
    household_id: 'hh-test',
    user_id: 'user-admin',
    role: 'admin',
    created: '2026-01-01',
    updated: '2026-01-01',
    expand: { user_id: { id: 'user-admin', name: 'Helen', email: 'helen@test.com', avatar: '' } },
  },
  {
    id: 'member-2',
    household_id: 'hh-test',
    user_id: 'user-member',
    role: 'member',
    created: '2026-01-01',
    updated: '2026-01-01',
    expand: { user_id: { id: 'user-member', name: 'Alex', email: 'alex@test.com', avatar: '' } },
  },
]

describe('MemberList', () => {
  it('renders one row per member', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    expect(wrapper.findAll('.member-item')).toHaveLength(2)
  })

  it('shows display name from expand.user_id.name', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    const names = wrapper.findAll('.member-display-name').map(el => el.text())
    expect(names).toContain('Helen')
    expect(names).toContain('Alex')
  })

  it('shows "Admin" badge for admin role', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    const badges = wrapper.findAll('.role-badge').map(el => el.text())
    expect(badges).toContain('Admin')
  })

  it('shows "Member" badge for member role', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    const badges = wrapper.findAll('.role-badge').map(el => el.text())
    expect(badges).toContain('Member')
  })

  it('does not render Remove button for member whose user_id === currentUserId', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    const buttons = wrapper.findAll('.remove-btn')
    // Only Alex (user-member) should have Remove; Helen (user-admin) should not
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.text()).toBe('Remove')
  })

  it('renders Remove button for all members other than currentUserId', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    const buttons = wrapper.findAll('.remove-btn')
    expect(buttons).toHaveLength(1)
  })

  it('emits remove event with correct member when Remove clicked', async () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    await wrapper.find('.remove-btn').trigger('click')
    const emitted = wrapper.emitted('remove')
    expect(emitted).toBeTruthy()
    expect(emitted![0]![0]).toMatchObject({ id: 'member-2', user_id: 'user-member' })
  })

  it('falls back to email when name is empty', () => {
    const membersWithNoName: MemberRecord[] = [
      {
        id: 'member-3',
        household_id: 'hh-test',
        user_id: 'user-3',
        role: 'member',
        created: '2026-01-01',
        updated: '2026-01-01',
        expand: { user_id: { id: 'user-3', name: '', email: 'noname@test.com', avatar: '' } },
      },
    ]
    const wrapper = mount(MemberList, {
      props: { members: membersWithNoName, currentUserId: 'other-user' },
    })
    expect(wrapper.find('.member-display-name').text()).toBe('noname@test.com')
  })

  it('falls back to "Member" when both name and email are empty', () => {
    const membersNoInfo: MemberRecord[] = [
      {
        id: 'member-4',
        household_id: 'hh-test',
        user_id: 'user-4',
        role: 'member',
        created: '2026-01-01',
        updated: '2026-01-01',
        expand: { user_id: { id: 'user-4', name: '', email: '', avatar: '' } },
      },
    ]
    const wrapper = mount(MemberList, {
      props: { members: membersNoInfo, currentUserId: 'other-user' },
    })
    expect(wrapper.find('.member-display-name').text()).toBe('Member')
  })

  it('falls back to "Member" when expand is undefined', () => {
    const memberNoExpand: MemberRecord[] = [
      {
        id: 'member-5',
        household_id: 'hh-test',
        user_id: 'user-5',
        role: 'member',
        created: '2026-01-01',
        updated: '2026-01-01',
      },
    ]
    const wrapper = mount(MemberList, {
      props: { members: memberNoExpand, currentUserId: 'other-user' },
    })
    expect(wrapper.find('.member-display-name').text()).toBe('Member')
  })
})
