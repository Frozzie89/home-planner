<script setup lang="ts">
import Select from 'primevue/select';
import type { MemberRecord } from '@/modules/household/types';
import SplitRatioEditor from '@/modules/household/components/SplitRatioEditor.vue';

const CURRENCY_OPTIONS = [
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'DKK', label: 'DKK — Danish Krone' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'NOK', label: 'NOK — Norwegian Krone' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'USD', label: 'USD — US Dollar' },
];

defineProps<{
  currency: string;
  splitRatios: Record<string, number>;
  members: MemberRecord[];
  isSingleMember: boolean;
}>();

defineEmits<{
  'update:currency': [value: string];
  'update:splitRatios': [value: Record<string, number>];
}>();
</script>

<template>
  <div class="pref-section">
    <p class="section-label">FINANCES</p>
    <div class="pref-card">
      <label class="field-label-upper" for="currency">DISPLAY CURRENCY</label>
      <Select
        id="currency"
        :model-value="currency"
        :options="CURRENCY_OPTIONS"
        option-label="label"
        option-value="code"
        @update:model-value="$emit('update:currency', $event)"
      />
    </div>
    <SplitRatioEditor
      :split-ratios="splitRatios"
      :members="members"
      :is-single-member="isSingleMember"
      @update:split-ratios="$emit('update:splitRatios', $event)"
    />
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
