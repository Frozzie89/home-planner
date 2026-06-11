import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { reactive } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { useHouseholdStore } from './household';

const { mockUseAuthStore } = vi.hoisted(() => ({
  mockUseAuthStore: vi.fn(),
}));

vi.mock('@/shared/stores/auth', () => ({ useAuthStore: mockUseAuthStore }));

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    collection: () => ({ getOne: vi.fn() }),
  },
}));

const sharedAuthState = reactive({ isAuthenticated: true as boolean });

beforeEach(() => {
  setActivePinia(createPinia());
  sharedAuthState.isAuthenticated = true;
  mockUseAuthStore.mockReturnValue(sharedAuthState);
});

describe('useHouseholdStore', () => {
  describe('initial state', () => {
    it('has correct defaults', () => {
      const store = useHouseholdStore();
      expect(store.id).toBeNull();
      expect(store.name).toBeNull();
      expect(store.currency).toBe('EUR');
      expect(store.split_ratios).toEqual({});
      expect(store.reminder_day).toBe('Monday');
    });
  });

  describe('populate()', () => {
    it('sets all fields from a HouseholdConfig object', () => {
      const store = useHouseholdStore();
      store.populate({
        id: 'hh-1',
        name: 'The Smiths',
        currency: 'GBP',
        split_ratios: { 'member-1': 100 },
        reminder_day: 'Friday',
      });

      expect(store.id).toBe('hh-1');
      expect(store.name).toBe('The Smiths');
      expect(store.currency).toBe('GBP');
      expect(store.split_ratios).toEqual({ 'member-1': 100 });
      expect(store.reminder_day).toBe('Friday');
    });
  });

  describe('reset()', () => {
    it('returns all fields to defaults after populate', () => {
      const store = useHouseholdStore();
      store.populate({
        id: 'hh-1',
        name: 'The Smiths',
        currency: 'GBP',
        split_ratios: { 'member-1': 100 },
        reminder_day: 'Friday',
      });

      store.reset();

      expect(store.id).toBeNull();
      expect(store.name).toBeNull();
      expect(store.currency).toBe('EUR');
      expect(store.split_ratios).toEqual({});
      expect(store.reminder_day).toBe('Monday');
    });
  });

  describe('reset on logout', () => {
    it('resets store when isAuthenticated becomes false', async () => {
      const store = useHouseholdStore();
      store.populate({
        id: 'hh-1',
        name: 'The Smiths',
        currency: 'GBP',
        split_ratios: { 'member-1': 100 },
        reminder_day: 'Friday',
      });

      sharedAuthState.isAuthenticated = false;
      await flushPromises();

      expect(store.id).toBeNull();
      expect(store.name).toBeNull();
      expect(store.currency).toBe('EUR');
      expect(store.split_ratios).toEqual({});
      expect(store.reminder_day).toBe('Monday');
    });
  });
});
