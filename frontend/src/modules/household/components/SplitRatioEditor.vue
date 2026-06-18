<script setup lang="ts">
import { computed } from 'vue';
import InputNumber from 'primevue/inputnumber';
import type { MemberRecord } from '@/modules/household/types';
import { getMemberName } from '@/shared/lib/memberHelpers';
import UserAvatar from '@/shared/components/UserAvatar.vue';

const props = defineProps<{
  splitRatios: Record<string, number>;
  members: MemberRecord[];
  isSingleMember: boolean;
}>();

const emit = defineEmits<{
  'update:splitRatios': [value: Record<string, number>];
}>();

const splitRatioSum = computed(() =>
  Object.values(props.splitRatios).reduce((sum, v) => sum + (v ?? 0), 0)
);

const isSplitRatioValid = computed(() => splitRatioSum.value === 100);

function updateRatio(memberId: string, value: number | null) {
  emit('update:splitRatios', { ...props.splitRatios, [memberId]: value ?? 0 });
}
</script>

<template>
  <div class="pref-card">
    <p class="field-label-upper">DEFAULT SPLIT RATIO</p>
    <div v-for="member in members" :key="member.id" class="split-row">
      <div class="member-name-group">
        <UserAvatar :size="28" :user-record="member.expand?.user_id" />
        <span class="member-name">{{ getMemberName(member) }}</span>
      </div>
      <div class="split-input-group">
        <InputNumber
          :model-value="splitRatios[member.id] ?? 0"
          :disabled="isSingleMember"
          :min="0"
          :max="100"
          :max-fraction-digits="0"
          :aria-label="`${getMemberName(member)} split ratio percentage`"
          @update:model-value="updateRatio(member.id, $event)"
        />
        <span class="pct-sign">%</span>
      </div>
    </div>
    <div class="split-sum" :class="{ valid: isSplitRatioValid, invalid: !isSplitRatioValid }">
      {{ splitRatioSum }} / 100
      <span v-if="isSplitRatioValid"> ✓</span>
      <span v-else> - adjust to reach 100</span>
    </div>
  </div>
</template>

<style scoped>
.pref-card {
  background-color: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label-upper {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
}

.split-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.member-name-group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.member-name {
  font-size: 0.875rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.split-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.split-input-group :deep(.p-inputnumber-input) {
  width: 72px;
}

.pct-sign {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.split-sum {
  font-size: 0.875rem;
  font-weight: 500;
  padding-top: var(--space-1);
  border-top: 1px solid var(--p-surface-border);
}

.split-sum.valid {
  color: color-mix(in srgb, var(--color-balance-positive, #4a9068), black 30%);
}

.split-sum.invalid {
  color: color-mix(in srgb, var(--color-balance-negative, #c96148), black 30%);
}
</style>
