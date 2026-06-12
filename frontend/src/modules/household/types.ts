// Derived from shared Member + PocketBase expand for display purposes
export interface MemberRecord {
  id: string;
  household_id: string;
  user_id: string;
  role: 'member' | 'admin';
  display_name?: string;
  created: string;
  updated: string;
  expand?: {
    user_id?: {
      id: string;
      username?: string;
      name: string;
      email: string;
      avatar: string;
    };
    household_id?: HouseholdConfig;
  };
}

// Subset of Household used by useHouseholdStore - the operational config
export interface HouseholdConfig {
  id: string;
  name: string;
  currency: string; // ISO 4217
  split_ratios: Record<string, number>;
  reminder_day: string;
}
