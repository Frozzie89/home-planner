import type { MemberRecord } from '@/modules/household/types'

export function getMemberName(member: MemberRecord): string {
  const u = member.expand?.user_id
  return member.display_name?.trim() || u?.name || u?.username || u?.email || 'Unknown member'
}
