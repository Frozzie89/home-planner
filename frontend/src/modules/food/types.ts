export interface Meal {
  id: string
  household_id: string
  day: string                // PocketBase datetime string, e.g. "2026-05-26 00:00:00.000Z"
  name: string
  created: string
  updated: string
}

export interface Ingredient {
  id: string
  meal_id: string
  name: string
  quantity: number
  unit: string               // e.g. "g", "ml", "pcs", "tbsp"
  created: string
  updated: string
}

export interface GroceryItem {
  id: string
  household_id: string
  name: string
  quantity: number | null    // null for manual adds that omit quantity
  unit: string | null        // null for manual adds that omit unit
  checked: boolean
  meal_id: string | null     // null = manual add (not from a meal)
  week_start: string         // PocketBase datetime string — the Monday/reminder_day of this week
  created: string
  updated: string
}
