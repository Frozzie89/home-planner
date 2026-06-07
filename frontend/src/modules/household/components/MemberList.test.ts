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
    expand: { user_id: { id: 'user-admin', username: 'helen_admin', name: 'Helen', email: 'helen@test.com', avatar: '' } },
  },
  {
    id: 'member-2',
    household_id: 'hh-test',
    user_id: 'user-member',
    role: 'member',
    created: '2026-01-01',
    updated: '2026-01-01',
    expand: { user_id: { id: 'user-member', username: 'alex_member', name: 'Alex', email: 'alex@test.com', avatar: '' } },
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

  it('does not show role badge for member-role rows', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    const badges = wrapper.findAll('.role-badge').map(el => el.text())
    expect(badges).not.toContain('Member')
    expect(badges).toHaveLength(1) // only Admin badge
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
        expand: { user_id: { id: 'user-3', username: '', name: '', email: 'noname@test.com', avatar: '' } },
      },
    ]
    const wrapper = mount(MemberList, {
      props: { members: membersWithNoName, currentUserId: 'other-user' },
    })
    expect(wrapper.find('.member-display-name').text()).toBe('noname@test.com')
  })

  it('falls back to username when name is empty but username is set', () => {
    const membersNoName: MemberRecord[] = [
      {
        id: 'member-6',
        household_id: 'hh-test',
        user_id: 'user-6',
        role: 'member',
        created: '2026-01-01',
        updated: '2026-01-01',
        expand: { user_id: { id: 'user-6', username: 'discord_user_7890', name: '', email: '', avatar: '' } },
      },
    ]
    const wrapper = mount(MemberList, {
      props: { members: membersNoName, currentUserId: 'other-user' },
    })
    expect(wrapper.find('.member-display-name').text()).toBe('discord_user_7890')
  })

  it('falls back to "Unknown member" when name, username, and email are all empty', () => {
    const membersNoInfo: MemberRecord[] = [
      {
        id: 'member-4',
        household_id: 'hh-test',
        user_id: 'user-4',
        role: 'member',
        created: '2026-01-01',
        updated: '2026-01-01',
        expand: { user_id: { id: 'user-4', username: '', name: '', email: '', avatar: '' } },
      },
    ]
    const wrapper = mount(MemberList, {
      props: { members: membersNoInfo, currentUserId: 'other-user' },
    })
    expect(wrapper.find('.member-display-name').text()).toBe('Unknown member')
  })

  it('falls back to "Unknown member" when expand is undefined', () => {
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
    expect(wrapper.find('.member-display-name').text()).toBe('Unknown member')
  })

  it('renders Promote button for member-role rows', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    // member-2 has role='member' -> should have Promote
    expect(wrapper.findAll('.promote-btn')).toHaveLength(1)
  })

  it('does NOT render Promote button for admin-role rows', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    // member-1 is admin -> no Promote button; member-2 is member -> has Promote
    const adminRow = wrapper.findAll('li').find(li => li.text().includes('Admin'))
    expect(adminRow!.find('.promote-btn').exists()).toBe(false)
    expect(wrapper.findAll('.promote-btn')).toHaveLength(1)
  })

  it('renders Demote button for admin-role rows', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    // member-1 is admin -> should have Demote
    expect(wrapper.findAll('.demote-btn')).toHaveLength(1)
  })

  it('does NOT render Demote button for member-role rows', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    // member-2 is member -> no Demote button; only member-1 (admin) has Demote
    const memberRow = wrapper.findAll('li').find(li => li.text().includes('Alex'))
    expect(memberRow!.find('.demote-btn').exists()).toBe(false)
    expect(wrapper.findAll('.demote-btn')).toHaveLength(1)
  })

  it('emits promote event with correct member when Promote clicked', async () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    await wrapper.find('.promote-btn').trigger('click')
    const emitted = wrapper.emitted('promote')
    expect(emitted).toBeTruthy()
    expect(emitted![0]![0]).toMatchObject({ id: 'member-2', role: 'member' })
  })

  it('emits demote event with correct member when Demote clicked', async () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    await wrapper.find('.demote-btn').trigger('click')
    const emitted = wrapper.emitted('demote')
    expect(emitted).toBeTruthy()
    expect(emitted![0]![0]).toMatchObject({ id: 'member-1', role: 'admin' })
  })

  it('Demote button visible on current user own admin row', () => {
    // Current user is the admin — continuity check is in HouseholdSettingsView, not MemberList
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    // member-1 has user_id='user-admin' and role='admin' -> Demote should show
    expect(wrapper.findAll('.demote-btn')).toHaveLength(1)
  })

  it('shows display_name when set, taking priority over name', () => {
    const membersWithDisplayName: MemberRecord[] = [
      {
        id: 'member-7',
        household_id: 'hh-test',
        user_id: 'user-7',
        role: 'member',
        display_name: 'My Custom Name',
        created: '2026-01-01',
        updated: '2026-01-01',
        expand: { user_id: { id: 'user-7', username: 'user7', name: 'Real Name', email: 'user7@test.com', avatar: '' } },
      },
    ]
    const wrapper = mount(MemberList, {
      props: { members: membersWithDisplayName, currentUserId: 'other-user' },
    })
    expect(wrapper.find('.member-display-name').text()).toBe('My Custom Name')
  })

  it('falls back to name when display_name is empty string', () => {
    const membersEmptyDisplayName: MemberRecord[] = [
      {
        id: 'member-8',
        household_id: 'hh-test',
        user_id: 'user-8',
        role: 'member',
        display_name: '',
        created: '2026-01-01',
        updated: '2026-01-01',
        expand: { user_id: { id: 'user-8', username: 'user8', name: 'Fallback Name', email: 'user8@test.com', avatar: '' } },
      },
    ]
    const wrapper = mount(MemberList, {
      props: { members: membersEmptyDisplayName, currentUserId: 'other-user' },
    })
    expect(wrapper.find('.member-display-name').text()).toBe('Fallback Name')
  })

  it('shows "You" badge on the current user\'s row', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    const youBadges = wrapper.findAll('.you-badge')
    expect(youBadges).toHaveLength(1)
    expect(youBadges[0]).toBeDefined()
    expect(youBadges[0]!.text()).toBe('You')
    const helenRow = wrapper.findAll('li').find(li => li.text().includes('Helen'))
    expect(helenRow).toBeDefined()
    expect(helenRow!.find('.member-info .you-badge').exists()).toBe(true)
  })

  it('does not show "You" badge on other members\' rows', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    const alexRow = wrapper.findAll('li').find(li => li.text().includes('Alex'))
    expect(alexRow).toBeDefined()
    expect(alexRow!.find('.you-badge').exists()).toBe(false)
  })

  it('shows no "You" badge when currentUserId matches no member', () => {
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'other-user' },
    })
    expect(wrapper.findAll('.you-badge')).toHaveLength(0)
  })

  it('sorts current user to top of list regardless of original order', () => {
    // MOCK_MEMBERS has Helen (admin) first, Alex (member) second
    // When currentUserId = Alex's userId (user-member), Alex should appear first
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-member' },
    })
    const rows = wrapper.findAll('.member-item')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Alex')
    expect(rows[1]!.text()).toContain('Helen')
  })

  it('keeps current user at top when already first in input', () => {
    // MOCK_MEMBERS has Helen (admin) first — sort must not displace her
    const wrapper = mount(MemberList, {
      props: { members: MOCK_MEMBERS, currentUserId: 'user-admin' },
    })
    const rows = wrapper.findAll('.member-item')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Helen')
    expect(rows[1]!.text()).toContain('Alex')
  })
})
