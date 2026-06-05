<script setup lang="ts">
import type { MemberRecord } from '@/modules/household/types'

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
  return u?.name || u?.username || u?.email || 'Unknown member'
}
</script>

<template>
  <ul class="member-list">
    <li v-for="member in props.members" :key="member.id" class="member-item">
      <div class="member-info">
        <span class="member-display-name">{{ getMemberName(member) }}</span>
        <span :class="['role-badge', member.role]">
          {{ member.role === 'admin' ? 'Admin' : 'Member' }}
        </span>
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
  color: var(--p-primary-color);
}

.role-badge.member {
  background: color-mix(in srgb, var(--color-text-secondary) 12%, transparent);
  color: var(--color-text-secondary);
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
  color: var(--p-primary-color);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}

.remove-btn {
  font-size: 0.75rem;
  min-height: 32px;
  padding: 0 var(--space-1);
  color: var(--color-balance-negative);
  background: none;
  border: 1px solid var(--color-balance-negative);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}
</style>
