import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { pb } from '@/shared/lib/pocketbase';
import { useAuthStore } from '@/shared/stores/auth';
import type { HouseholdConfig } from '@/modules/household/types';

export const useHouseholdStore = defineStore('household', () => {
  const id = ref<string | null>(null);
  const name = ref<string | null>(null);
  const currency = ref('EUR');
  const split_ratios = ref<Record<string, number>>({});
  const reminder_day = ref('Monday');

  const authStore = useAuthStore();

  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (!isAuth) reset();
    }
  );

  function populate(config: HouseholdConfig) {
    id.value = config.id;
    name.value = config.name;
    currency.value = config.currency;
    split_ratios.value = { ...config.split_ratios };
    reminder_day.value = config.reminder_day;
  }

  async function load(householdId: string) {
    if (id.value === householdId) return;
    const config = await pb.collection('households').getOne<HouseholdConfig>(householdId);
    populate(config);
  }

  function reset() {
    id.value = null;
    name.value = null;
    currency.value = 'EUR';
    split_ratios.value = {};
    reminder_day.value = 'Monday';
  }

  return { id, name, currency, split_ratios, reminder_day, populate, load, reset };
});
