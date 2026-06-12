# Architecture

This document describes the structure, conventions, and key decisions behind Home Planner. It is intended for contributors who want to understand how the codebase is organized before making changes.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 + TypeScript, Vite, Pinia, Vue Router 4, PrimeVue (Aura theme) |
| Backend | PocketBase 0.27 - embedded SQLite, REST API, OAuth2 passthrough, realtime SSE |
| Reverse proxy | Traefik v3 - hostname-based routing |
| Containerization | Docker Compose (three services: traefik, pocketbase, frontend) |

## Project structure

```
home-planner/
├── frontend/
│   └── src/
│       ├── main.ts                   # app bootstrap (Vue, PrimeVue, Router, Pinia)
│       ├── App.vue                   # root component + AppNav
│       ├── router/
│       │   └── index.ts              # route definitions + auth guard
│       ├── modules/
│       │   ├── finances/             # expense tracking, balances, settle-up
│       │   │   ├── types.ts
│       │   │   ├── components/
│       │   │   ├── stores/
│       │   │   └── views/
│       │   ├── food/                 # meal plan + grocery list (not yet implemented)
│       │   │   ├── types.ts
│       │   │   └── views/
│       │   └── household/            # settings, profiles, members, invites
│       │       ├── types.ts
│       │       ├── components/
│       │       └── views/
│       └── shared/
│           ├── types.ts              # Household, Member, Notification interfaces
│           ├── lib/
│           │   ├── pocketbase.ts     # PocketBase SDK singleton
│           │   ├── currencyHelpers.ts
│           │   ├── dateHelpers.ts
│           │   └── memberHelpers.ts
│           ├── components/           # AppNav, BottomSheet, UserAvatar
│           └── stores/
│               ├── auth.ts           # OAuth2 state, householdId, userId
│               └── household.ts      # currency, split ratios, reminder day, member list
│
├── pocketbase/
│   ├── pb_hooks/                     # PocketBase JS hooks (server-side logic)
│   └── pb_migrations/                # numbered schema migration files
│
└── docker-compose.yml
```

**Module rule:** components inside a module directory (`modules/finances/`, `modules/household/`) are private to that module and must not be imported by other modules. `shared/` components and stores are the only cross-module dependencies.

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Vue component files | PascalCase | `BalanceCard.vue` |
| Vue view files | PascalCase + `View` suffix | `FinancesView.vue` |
| Pinia store files | camelCase | `finances.ts` |
| Pinia store exports | `use` + PascalCase + `Store` | `useFinancesStore` |
| TypeScript interfaces | mirror PocketBase field names (snake_case) | `household_id: string` |
| PocketBase collections | snake_case, plural | `grocery_items` |
| PocketBase fields | snake_case, relation fields end in `_id` | `member_id` |
| Route names | kebab-case | `food-meal-plan` |
| CSS custom properties | kebab-case | `--color-balance-positive` |
| Test files | co-located, `.test.ts` suffix | `BalanceCard.test.ts` |

**TypeScript interfaces use snake_case** to mirror PocketBase's field names directly. There is no camelCase transformation layer.

```typescript
// Correct
interface Expense {
  household_id: string;
  member_id: string;
  amount: number;
}

// Wrong - do not transform field names
interface Expense {
  householdId: string;
  memberId: string;
}
```

## Data format conventions

**Currency amounts - integer cents**

All monetary amounts are stored and handled as integer cents. `4580` means €45.80.

```typescript
// Store and pass around as cents
const amount = 4580; // €45.80

// Format for display only at the UI layer
new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount / 100);
```

Never store a float like `45.80` in PocketBase or in Pinia state.

**Split ratios - integer percentages**

`60` means 60%, not `0.6`. Values must sum to 100 across all household members.

**Dates - ISO 8601 strings at rest**

PocketBase stores and returns ISO strings (`"2026-05-23T10:00:00Z"`). Convert to `Date` only at the UI layer for formatting. Never store `Date` objects in Pinia state.

## State management

Stores use Vue's Composition API style via `defineStore`:

```typescript
export const useFinancesStore = defineStore('finances', () => {
  // 1. State refs
  const expenses = ref<Expense[]>([]);
  const expenseSubmitStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');

  // 2. Computed getters
  const balance = computed(() => /* bilateral calculation */);

  // 3. Actions
  async function addExpense(payload: NewExpensePayload) { ... }

  return { expenses, expenseSubmitStatus, balance, addExpense };
});
```

**Status enums, not booleans**

Use a 4-value status enum per async action instead of `isLoading: boolean`. This allows distinguishing idle from error, which `boolean` cannot.

```typescript
// Correct
const expenseSubmitStatus = ref<'idle' | 'loading' | 'error' | 'success'>('idle');

// Wrong
const isLoading = ref(false);
```

**Optimistic UI**

Expense writes and similar user-facing actions use an optimistic pattern: update local state immediately, sync to PocketBase in the background, and silently revert on failure.

```typescript
const snapshot = [...expenses.value];          // snapshot current state
expenses.value.unshift(optimisticExpense);     // apply locally
expenseSubmitStatus.value = 'loading';
try {
  await pb.collection('expenses').create(data);
  expenseSubmitStatus.value = 'success';
} catch {
  expenses.value = snapshot;                   // revert
  expenseSubmitStatus.value = 'error';
}
```

## PocketBase patterns

**Use the singleton client**

`src/shared/lib/pocketbase.ts` exports a single `PocketBase` instance. All stores and composables import from it. Never instantiate a new `PocketBase` client elsewhere.

```typescript
// Correct
import { pb } from '@/shared/lib/pocketbase';

// Wrong - never do this
import PocketBase from 'pocketbase';
const pb = new PocketBase('...');
```

**Always filter by `household_id`**

Every collection query must include a `household_id` filter using the value from `useAuthStore().householdId`. This is the primary data isolation boundary.

```typescript
// Correct
pb.collection('expenses').getList(1, 50, {
  filter: `household_id = "${authStore.householdId}"`,
});

// Wrong - missing household scope, leaks data across households
pb.collection('expenses').getList(1, 50);
```

**Open SSE subscriptions in components, not stores**

Realtime subscriptions belong in the component that owns the view, opened in `onMounted` and closed in `onUnmounted`.

```typescript
// Correct - in the component
onMounted(() => {
  pb.collection('expenses').subscribe('*', handler);
});
onUnmounted(() => {
  pb.collection('expenses').unsubscribe();
});

// Wrong - never subscribe at store initialisation time
const store = defineStore('finances', () => {
  pb.collection('expenses').subscribe(...); // don't do this
});
```

## Authentication flow

Home Planner uses PocketBase's built-in OAuth2 passthrough. There is no custom auth server.

```
App load
  -> auth store checks pb.authStore.isValid
  -> if not valid: redirect to /auth -> external OAuth2 provider
  -> OAuth2 callback -> PocketBase validates token, creates/updates user record
  -> auth store loads household membership from members collection
  -> app navigates to home route
```

The router guard in `src/router/index.ts` handles the redirect logic. The `/invite/:token` route bypasses the guard so unauthenticated users can view an invitation before signing in.

Member roles (`member` | `admin`) are stored in the PocketBase `members` collection - not in the identity provider. This keeps all authorization logic in one place and keeps it household-scoped.

## PocketBase collections

| Collection | Purpose |
|---|---|
| `households` | One record per household; holds `name`, `currency`, `split_ratios`, `reminder_day` |
| `members` | Links a user to a household; holds `role` (`member` or `admin`) and `display_name` |
| `expenses` | One record per expense; `amount` in integer cents, `portion` as integer percentage |
| `invitations` | One-time invite tokens; `accepted` flips to `true` when a member joins |
| `notifications` | In-app notifications written by a PocketBase cron hook |
| `meals` | Planned meals - not yet active |
| `ingredients` | Ingredients per meal - not yet active |
| `grocery_items` | Grocery list items - not yet active |

Schema is managed via numbered migration files in `pocketbase/pb_migrations/`. To extend the schema, add a new numbered file - never modify a migration that has already run in production.

## Error handling conventions

| Situation | Convention |
|---|---|
| Optimistic UI revert | Silent - inline error indicator on the affected item, no toast |
| Non-blocking background error | PrimeVue `Toast` |
| Form validation error | Inline below the field on blur; never on submit; never a toast |
| Destructive action confirmation | Confirmation `BottomSheet` before proceeding |
