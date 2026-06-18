<script setup lang="ts">
import Select from 'primevue/select';

const REMINDER_DAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

defineProps<{
  reminderDay: string;
}>();

defineEmits<{
  'update:reminderDay': [value: string];
}>();
</script>

<template>
  <div class="pref-section">
    <p class="section-label">FOOD</p>
    <div class="pref-card">
      <label class="field-label-upper" for="reminder-day">PLANNING REMINDER DAY</label>
      <Select
        id="reminder-day"
        :model-value="reminderDay"
        :options="REMINDER_DAY_OPTIONS"
        @update:model-value="$emit('update:reminderDay', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.pref-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  margin: 0;
  text-transform: uppercase;
}

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
</style>
