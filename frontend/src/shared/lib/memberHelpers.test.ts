import { describe, it, expect } from 'vitest'
import { getMemberName } from './memberHelpers'
import type { MemberRecord } from '@/modules/household/types'

function makeMember(overrides: Partial<MemberRecord> = {}): MemberRecord {
  return {
    id: 'm1',
    household_id: 'hh1',
    user_id: 'u1',
    role: 'member',
    created: '',
    updated: '',
    ...overrides,
  }
}

describe('getMemberName', () => {
  it('returns display_name when present and non-empty', () => {
    const member = makeMember({ display_name: 'Alice' })
    expect(getMemberName(member)).toBe('Alice')
  })

  it('skips whitespace-only display_name and falls through to user name', () => {
    const member = makeMember({
      display_name: '   ',
      expand: { user_id: { id: 'u1', name: 'Alice Real', username: 'alice', email: 'alice@test.com', avatar: '' } },
    })
    expect(getMemberName(member)).toBe('Alice Real')
  })

  it('returns user name when display_name absent', () => {
    const member = makeMember({
      expand: { user_id: { id: 'u1', name: 'Bob', username: 'bob', email: 'bob@test.com', avatar: '' } },
    })
    expect(getMemberName(member)).toBe('Bob')
  })

  it('returns username when name absent', () => {
    const member = makeMember({
      expand: { user_id: { id: 'u1', name: '', username: 'charlie', email: 'charlie@test.com', avatar: '' } },
    })
    expect(getMemberName(member)).toBe('charlie')
  })

  it('returns email when name and username absent', () => {
    const member = makeMember({
      expand: { user_id: { id: 'u1', name: '', username: '', email: 'dan@test.com', avatar: '' } },
    })
    expect(getMemberName(member)).toBe('dan@test.com')
  })

  it('returns "Unknown member" when all fields absent', () => {
    const member = makeMember()
    expect(getMemberName(member)).toBe('Unknown member')
  })
})
