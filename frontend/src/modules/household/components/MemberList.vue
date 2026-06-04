<script setup lang="ts">
import type { MemberRecord } from '@/modules/household/types'

const props = defineProps<{
  members: MemberRecord[]
  currentUserId: string
}>()

const emit = defineEmits<{
  remove: [member: MemberRecord]
}>()

function getMemberName(member: MemberRecord): string {
  return member.expand?.user_id?.name || member.expand?.user_id?.email || 'Member'
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
      <button
        v-if="member.user_id !== props.currentUserId"
        class="remove-btn"
        :aria-label="`Remove ${getMemberName(member)}`"
        @click="emit('remove', member)"
      >
        Remove
      </button>
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
  background: var(--p-surface-100, #f3f4f6);
  color: var(--color-text-secondary);
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
