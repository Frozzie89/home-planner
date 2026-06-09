import type { Page } from '@playwright/test'

// Fake JWT: header.payload.signature
// Payload decodes to: {"id":"smoke-user-id","exp":4102444800} (exp = year 2100)
export const FAKE_TOKEN = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJpZCI6InNtb2tlLXVzZXItaWQiLCJleHAiOjQxMDI0NDQ4MDB9',
  'smoke-test-fake-signature',
].join('.')

export const MOCK_USER_ID = 'smoke-user-id'
export const MOCK_HOUSEHOLD_ID = 'smoke-household-id'
export const MOCK_MEMBER_ID = 'smoke-member-id'

const PB_URL = 'http://pb.home-planner.localhost'

// householdId routing is controlled by mockMembersApi (404 = no household), not by localStorage
export async function injectAuth(page: Page, options: { householdId?: string | null } = {}) {
  void options
  await page.addInitScript(
    ({ token, uid }) => {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token, model: { id: uid, email: 'smoke@test.local' } }),
      )
    },
    { token: FAKE_TOKEN, uid: MOCK_USER_ID },
  )
}

// Mock the members lookup that authStore.init() makes.
// `respondWithMember: true` -> returns a member record (use for /finances)
// `respondWithMember: false` -> returns 404 (use for /setup — user has no household yet)
export async function mockMembersApi(page: Page, respondWithMember: boolean) {
  await page.route(`${PB_URL}/api/collections/members/records*`, (route) => {
    if (respondWithMember) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 1,
          perPage: 1000,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: MOCK_MEMBER_ID,
              household_id: MOCK_HOUSEHOLD_ID,
              user_id: MOCK_USER_ID,
              role: 'admin',
              created: '2026-01-01 00:00:00.000Z',
              updated: '2026-01-01 00:00:00.000Z',
            },
          ],
        }),
      })
    } else {
      // 404 -> loadMembership() sets householdId = null -> router allows /setup
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404, message: "The requested resource wasn't found.", data: {} }),
      })
    }
  })
}

// Catch-all: abort any PocketBase request not explicitly mocked above.
// Aborting (rather than fulfilling with {}) makes mock gaps fail loudly in both
// CI and local dev, preventing silent fallthrough to a real running PocketBase.
export async function mockRemainingPbCalls(page: Page) {
  await page.route(`${PB_URL}/**`, (route) => route.abort())
}

// ─── Epic 3 helpers ──────────────────────────────────────────────────────────

export interface MockExpense {
  id: string
  household_id: string
  member_id: string
  title: string
  amount: number   // integer cents
  portion: number  // integer percentage
  date: string
  created: string
  updated: string
}

export async function mockExpensesApi(page: Page, expenses: MockExpense[] = []) {
  await page.route(`${PB_URL}/api/collections/expenses/records*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        perPage: 30,
        totalItems: expenses.length,
        totalPages: expenses.length === 0 ? 0 : 1,
        items: expenses,
      }),
    }),
  )
}

// Mock POST /api/collections/expenses/records (create expense).
// GET requests fall through to mockExpensesApi via route.fallback().
// options.failWithStatus: if set, POST returns that HTTP error status.
export async function mockExpensesCreateApi(
  page: Page,
  createdExpense: MockExpense,
  options: { failWithStatus?: number } = {},
) {
  await page.route(`${PB_URL}/api/collections/expenses/records*`, (route) => {
    if (route.request().method() !== 'POST') {
      route.fallback()
      return
    }
    if (options.failWithStatus) {
      route.fulfill({
        status: options.failWithStatus,
        contentType: 'application/json',
        body: JSON.stringify({ code: options.failWithStatus, message: 'Server error', data: {} }),
      })
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createdExpense),
      })
    }
  })
}

// ─── Epic 2 helpers ──────────────────────────────────────────────────────────

export const MOCK_MEMBER_ID_2 = 'smoke-member-id-2'
export const MOCK_USER_ID_2 = 'smoke-user-id-2'

// Like mockMembersApi but returns two members with expand data, suitable for
// both the auth store's getFirstListItem and the settings view's getFullList.
// currentUserRole controls the role returned for MOCK_USER_ID (the logged-in user).
export async function mockSettingsMembersApi(
  page: Page,
  options: { currentUserRole?: 'admin' | 'member' } = {},
) {
  const role = options.currentUserRole ?? 'admin'
  await page.route(`${PB_URL}/api/collections/members/records*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        perPage: 30,
        totalItems: 2,
        totalPages: 1,
        items: [
          {
            id: MOCK_MEMBER_ID,
            household_id: MOCK_HOUSEHOLD_ID,
            user_id: MOCK_USER_ID,
            role,
            display_name: '',
            expand: {
              user_id: {
                id: MOCK_USER_ID,
                name: 'Smoke User',
                username: 'smokeuser',
                email: 'smoke@test.local',
              },
            },
            created: '2026-01-01 00:00:00.000Z',
            updated: '2026-01-01 00:00:00.000Z',
          },
          {
            id: MOCK_MEMBER_ID_2,
            household_id: MOCK_HOUSEHOLD_ID,
            user_id: MOCK_USER_ID_2,
            role: 'member',
            display_name: 'Bob',
            expand: {
              user_id: {
                id: MOCK_USER_ID_2,
                name: 'Bob',
                username: 'bob',
                email: 'bob@test.local',
              },
            },
            created: '2026-01-02 00:00:00.000Z',
            updated: '2026-01-02 00:00:00.000Z',
          },
        ],
      }),
    }),
  )
}

// Mock GET /api/collections/households/records/:id — used by HouseholdSettingsView.
export async function mockHouseholdsApi(page: Page) {
  await page.route(`${PB_URL}/api/collections/households/records/${MOCK_HOUSEHOLD_ID}*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_HOUSEHOLD_ID,
        name: 'Test Household',
        currency: 'EUR',
        split_ratios: { [MOCK_MEMBER_ID]: 50, [MOCK_MEMBER_ID_2]: 50 },
        reminder_day: 'Monday',
        created: '2026-01-01 00:00:00.000Z',
        updated: '2026-01-01 00:00:00.000Z',
      }),
    }),
  )
}

// Mock PATCH /api/collections/expenses/records/:id (update expense).
// Other methods fall through via route.fallback().
export async function mockExpenseUpdateApi(
  page: Page,
  id: string,
  updatedExpense: MockExpense,
  options: { failWithStatus?: number } = {},
) {
  await page.route(`${PB_URL}/api/collections/expenses/records/${id}`, (route) => {
    if (route.request().method() !== 'PATCH') {
      route.fallback()
      return
    }
    if (options.failWithStatus) {
      route.fulfill({
        status: options.failWithStatus,
        contentType: 'application/json',
        body: JSON.stringify({ code: options.failWithStatus, message: 'Server error', data: {} }),
      })
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updatedExpense),
      })
    }
  })
}

// Mock DELETE /api/collections/expenses/records/:id.
// Other methods fall through via route.fallback().
export async function mockExpenseDeleteApi(
  page: Page,
  id: string,
  options: { failWithStatus?: number } = {},
) {
  await page.route(`${PB_URL}/api/collections/expenses/records/${id}`, (route) => {
    if (route.request().method() !== 'DELETE') {
      route.fallback()
      return
    }
    if (options.failWithStatus) {
      route.fulfill({
        status: options.failWithStatus,
        contentType: 'application/json',
        body: JSON.stringify({ code: options.failWithStatus, message: 'Server error', data: {} }),
      })
    } else {
      route.fulfill({ status: 204 })
    }
  })
}

// ─── Auth callback helpers ────────────────────────────────────────────────────

// State token shared between injectOAuthProviderSession and callback URL params.
// Must be the same string so handleCallback passes the state-mismatch guard.
export const OAUTH_TEST_STATE = 'test-state-xyz'

// Seeds sessionStorage before page load so AuthView.handleCallback finds the
// provider record when it processes ?code=...&state=... query params.
export async function injectOAuthProviderSession(page: Page, state = OAUTH_TEST_STATE) {
  await page.addInitScript(
    ({ state }) => {
      sessionStorage.setItem(
        'oauth_provider',
        JSON.stringify({ name: 'google', state, codeVerifier: 'test-verifier' }),
      )
    },
    { state },
  )
}

// Mocks POST /api/collections/users/auth-with-oauth2 — the PocketBase SDK
// processes this response and calls pb.authStore.save(token, record), which makes
// pb.authStore.isValid = true and sets pb.authStore.record.id = MOCK_USER_ID.
// Note: the SDK method is authWithOAuth2Code() but the HTTP endpoint is auth-with-oauth2 (no "-code").
export async function mockOAuth2CodeExchange(page: Page) {
  await page.route(`${PB_URL}/api/collections/users/auth-with-oauth2*`, (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: FAKE_TOKEN,
          record: { id: MOCK_USER_ID, email: 'smoke@test.local', username: 'smokeuser', name: 'Smoke User', verified: true },
        }),
      })
    } else {
      route.abort()
    }
  })
}

// Mocks GET /api/household/exists — called by AuthView when householdId is null
// to distinguish path 1 (no household -> /setup) from path 3 (rejected -> /auth).
export async function mockHouseholdExistsApi(page: Page, exists: boolean) {
  await page.route(`${PB_URL}/api/household/exists*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exists }),
    }),
  )
}

// Mocks GET /api/collections/users/auth-methods — returns a single Google OAuth2
// provider. Used by AuthView and InviteAcceptView to render sign-in buttons.
// PocketBase SDK appends ?fields=... so the wildcard suffix is required.
export async function mockAuthMethodsApi(page: Page) {
  await page.route(`${PB_URL}/api/collections/users/auth-methods*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        emailPassword: { enabled: false },
        mfa: { enabled: false },
        oauth2: {
          enabled: true,
          providers: [
            { name: 'google', displayName: 'Google', state: 'fresh-state', codeVerifier: 'fresh-verifier', authURL: 'https://accounts.google.com/o/oauth2/auth' },
          ],
        },
      }),
    }),
  )
}

// Mock GET /api/collections/members/records/:memberId — used by ProfileView's getOne.
// Registered after mockMembersApi (LIFO) so it matches the specific ID path first.
export async function mockProfileMemberApi(page: Page, role: 'admin' | 'member' = 'member') {
  await page.route(`${PB_URL}/api/collections/members/records/${MOCK_MEMBER_ID}*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_MEMBER_ID,
        household_id: MOCK_HOUSEHOLD_ID,
        user_id: MOCK_USER_ID,
        role,
        display_name: '',
        expand: {
          user_id: {
            id: MOCK_USER_ID,
            name: 'Smoke User',
            username: 'smokeuser',
            email: 'smoke@test.local',
          },
          household_id: {
            id: MOCK_HOUSEHOLD_ID,
            name: 'Test Household',
            currency: 'EUR',
            split_ratios: { [MOCK_MEMBER_ID]: 50, [MOCK_MEMBER_ID_2]: 50 },
            reminder_day: 'Monday',
          },
        },
        created: '2026-01-01 00:00:00.000Z',
        updated: '2026-01-01 00:00:00.000Z',
      }),
    }),
  )
}
