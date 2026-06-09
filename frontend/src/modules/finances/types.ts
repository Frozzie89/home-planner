export interface Expense {
  id: string
  household_id: string
  member_id: string
  title: string
  amount: number             // integer cents, e.g. 4580 = €45.80
  portion: number            // integer percentage, e.g. 60 = 60%
  date: string               // PocketBase datetime string, e.g. "2026-05-25 00:00:00.000Z"
  created: string
  updated: string
}

export interface Balance {
  member_a_id: string        // the "from" member (viewer's perspective)
  member_b_id: string        // the "to" member
  amount: number             // integer cents; positive = member_a is owed; negative = member_a owes
}

export interface SettleUpPayload {
  member_a_id: string
  member_b_id: string
}

export interface NewExpensePayload {
  title: string
  amount: number   // integer cents, e.g. 4580 = €45.80
  date: string     // ISO date string, e.g. "2026-06-08 00:00:00.000Z"
  portion: number  // integer percentage of viewer's share, e.g. 50 = 50%
}

export interface UpdateExpensePayload {
  title: string
  amount: number   // integer cents, e.g. 4580 = €45.80
  date: string     // PocketBase datetime string, e.g. "2026-06-09 00:00:00.000Z"
  portion: number  // integer percentage, e.g. 50 = 50%
}
