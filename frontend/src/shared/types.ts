export interface Household {
  id: string
  name: string
  currency: string           // ISO 4217, e.g. "EUR"
  split_ratios: Record<string, number>  // { memberId: integerPercentage }
  reminder_day: string       // "Monday" through "Sunday"
  created: string            // ISO 8601
  updated: string            // ISO 8601
}

export interface Member {
  id: string
  household_id: string
  user_id: string
  role: 'member' | 'admin'
  created: string
  updated: string
}

export interface Notification {
  id: string
  household_id: string
  type: string               // e.g. "meal_reminder"
  read: boolean
  created: string
  updated: string
}
