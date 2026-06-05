// Derived from shared Member + PocketBase expand for display purposes
export interface MemberRecord {
  id: string
  household_id: string
  user_id: string
  role: 'member' | 'admin'
  created: string
  updated: string
  expand?: {
    user_id?: {
      id: string
      username?: string
      name: string
      email: string
      avatar: string
    }
  }
}

// Subset of Household used by useHouseholdStore — the operational config
export interface HouseholdConfig {
  id: string
  name: string
  currency: string           // ISO 4217
  split_ratios: Record<string, number>
  reminder_day: string
}
