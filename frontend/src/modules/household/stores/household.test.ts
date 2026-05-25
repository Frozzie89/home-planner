import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHouseholdStore } from './household'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useHouseholdStore', () => {
  describe('initial state', () => {
    it('has correct defaults', () => {
      const store = useHouseholdStore()
      expect(store.id).toBeNull()
      expect(store.name).toBeNull()
      expect(store.currency).toBe('EUR')
      expect(store.split_ratios).toEqual({})
      expect(store.reminder_day).toBe('Monday')
    })
  })

  describe('populate()', () => {
    it('sets all fields from a HouseholdConfig object', () => {
      const store = useHouseholdStore()
      store.populate({
        id: 'hh-1',
        name: 'The Smiths',
        currency: 'GBP',
        split_ratios: { 'member-1': 100 },
        reminder_day: 'Friday',
      })

      expect(store.id).toBe('hh-1')
      expect(store.name).toBe('The Smiths')
      expect(store.currency).toBe('GBP')
      expect(store.split_ratios).toEqual({ 'member-1': 100 })
      expect(store.reminder_day).toBe('Friday')
    })
  })

  describe('reset()', () => {
    it('returns all fields to defaults after populate', () => {
      const store = useHouseholdStore()
      store.populate({
        id: 'hh-1',
        name: 'The Smiths',
        currency: 'GBP',
        split_ratios: { 'member-1': 100 },
        reminder_day: 'Friday',
      })

      store.reset()

      expect(store.id).toBeNull()
      expect(store.name).toBeNull()
      expect(store.currency).toBe('EUR')
      expect(store.split_ratios).toEqual({})
      expect(store.reminder_day).toBe('Monday')
    })
  })
})
