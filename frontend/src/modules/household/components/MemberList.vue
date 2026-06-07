<script setup lang="ts">
import { computed } from 'vue'
import type { MemberRecord } from '@/modules/household/types'
import UserAvatar from '@/shared/components/UserAvatar.vue'

const props = defineProps<{
  members: MemberRecord[]
  currentUserId: string
}>()

const emit = defineEmits<{
  remove: [member: MemberRecord]
  promote: [member: MemberRecord]
  demote: [member: MemberRecord]
}>()

function getMemberName(member: MemberRecord): string {
  const u = member.expand?.user_id
  return member.display_name?.trim() || u?.name || u?.username || u?.email || 'Unknown member'
}

const sortedMembers = computed(() =>
  [...props.members].sort((a, b) =>
    a.user_id === props.currentUserId ? -1 : b.user_id === props.currentUserId ? 1 : 0
  )
)
</script>

<template>
  <ul class="member-list">
    <li v-for="member in sortedMembers" :key="member.id" class="member-item">
      <div class="member-info">
        <UserAvatar :size="28" :user-record="member.expand?.user_id" />
        <span class="member-display-name">{{ getMemberName(member) }}</span>
        <span v-if="member.role === 'admin'" class="role-badge admin">Admin</span>
        <span v-if="member.user_id === props.currentUserId" class="you-badge">You</span>
      </div>
      <div class="member-actions">
        <button
          v-if="member.role === 'member'"
          class="promote-btn action-btn"
          :aria-label="`Promote ${getMemberName(member)} to Admin`"
          @click="emit('promote', member)"
        >
          Promote
        </button>
        <button
          v-if="member.role === 'admin'"
          class="demote-btn action-btn"
          :aria-label="`Demote ${getMemberName(member)} to Member`"
          @click="emit('demote', member)"
        >
          Demote
        </button>
        <button
          v-if="member.user_id !== props.currentUserId"
          class="remove-btn"
          :aria-label="`Remove ${getMemberName(member)}`"
          @click="emit('remove', member)"
        >
          Remove
        </button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.member-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: var(--space-1) 0;
}

.member-info {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.member-display-name {
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

.role-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.role-badge.admin {
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
  color: color-mix(in srgb, var(--p-primary-color), black 50%);
}

.you-badge {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 12px;
  font-weight: 500;
  background: color-mix(in srgb, var(--p-accent) 15%, transparent);
  color: color-mix(in srgb, var(--p-accent), black 50%);
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  font-size: 0.75rem;
  min-height: 32px;
  padding: 0 var(--space-1);
  background: none;
  border: 1px solid var(--p-primary-color);
  color: color-mix(in srgb, var(--p-primary-color), black 30%);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}

.remove-btn {
  font-size: 0.75rem;
  min-height: 32px;
  padding: 0 var(--space-1);
  color: color-mix(in srgb, var(--color-balance-negative, #c96148), black 30%);
  background: none;
  border: 1px solid var(--color-balance-negative);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}
</style>
