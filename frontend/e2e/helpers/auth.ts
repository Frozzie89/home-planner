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
// `respondWithMember: true` → returns a member record (use for /finances)
// `respondWithMember: false` → returns 404 (use for /setup — user has no household yet)
export async function mockMembersApi(page: Page, respondWithMember: boolean) {
  await page.route(`${PB_URL}/api/collections/members/records*`, (route) => {
    if (respondWithMember) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 1,
          perPage: 1,
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
      // 404 → loadMembership() sets householdId = null → router allows /setup
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404, message: "The requested resource wasn't found.", data: {} }),
      })
    }
  })
}

// Catch-all for any remaining PocketBase calls (prevents unhandled network errors in console)
export async function mockRemainingPbCalls(page: Page) {
  await page.route(`${PB_URL}/**`, (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
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
