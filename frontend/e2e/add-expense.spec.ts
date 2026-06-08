import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import {
  injectAuth,
  mockRemainingPbCalls,
  mockSettingsMembersApi,
  mockHouseholdsApi,
  mockExpensesApi,
  mockExpensesCreateApi,
  MOCK_HOUSEHOLD_ID,
  MOCK_MEMBER_ID,
} from './helpers/auth'

// 3.2-E1: FAB opens AddExpenseSheet
test('FAB opens add expense sheet with title field visible', async ({ page }) => {
  await test.step('set up mocks', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await injectAuth(page)
    await mockRemainingPbCalls(page)
    await mockHouseholdsApi(page)
    await mockSettingsMembersApi(page)
    await mockExpensesApi(page, [])
  })

  await test.step('navigate to finances', async () => {
    await page.goto('/finances')
    await page.waitForLoadState('networkidle')
  })

  await test.step('tap FAB and verify sheet opens', async () => {
    await page.getByRole('button', { name: 'Add expense' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel('Title')).toBeVisible()
    await expect(page.getByLabel('Amount')).toBeVisible()
  })
})

// 3.2-E2: Submit valid expense — appears in list optimistically
test('submitting a valid expense adds it to the expense list', async ({ page }) => {
  const newExpense = {
    id: 'server-id-1',
    household_id: MOCK_HOUSEHOLD_ID,
    member_id: MOCK_MEMBER_ID,
    title: 'Test Groceries',
    amount: 5000,
    portion: 50,
    date: '2026-06-08 00:00:00.000Z',
    created: '2026-06-08 00:00:00.000Z',
    updated: '2026-06-08 00:00:00.000Z',
  }

  await test.step('set up mocks', async () => {
    await injectAuth(page)
    await mockRemainingPbCalls(page)
    await mockHouseholdsApi(page)
    await mockSettingsMembersApi(page)
    await mockExpensesApi(page, [])
    await mockExpensesCreateApi(page, newExpense)
  })

  await test.step('navigate to finances', async () => {
    await page.goto('/finances')
    await page.waitForLoadState('networkidle')
  })

  await test.step('open sheet, fill form, and submit', async () => {
    await page.getByRole('button', { name: 'Add expense' }).click()
    await page.getByLabel('Title').fill('Test Groceries')
    const amountInput = page.locator('#expense-amount')
    await amountInput.click()
    await amountInput.pressSequentially('50')
    await page.getByRole('button', { name: 'Confirm' }).click()
  })

  await test.step('verify expense appears and optimistic entry is replaced', async () => {
    await expect(page.getByText('Test Groceries')).toBeVisible()
    await expect(page.locator('.expense-item--new')).toHaveCount(0)
  })
})

// 3.2-E3: Empty title shows validation error
test('leaving title empty shows validation error and blocks submit', async ({ page }) => {
  await test.step('set up mocks', async () => {
    await injectAuth(page)
    await mockRemainingPbCalls(page)
    await mockHouseholdsApi(page)
    await mockSettingsMembersApi(page)
    await mockExpensesApi(page, [])
  })

  await test.step('navigate and open sheet', async () => {
    await page.goto('/finances')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add expense' }).click()
  })

  await test.step('blur title field without entering text', async () => {
    await page.getByLabel('Title').focus()
    await page.getByLabel('Amount').focus()
  })

  await test.step('verify error and disabled Confirm', async () => {
    await expect(page.getByText('Title is required')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })
})

// 3.2-E4: Amount 0 shows validation error
test('amount of 0 shows validation error and blocks submit', async ({ page }) => {
  await test.step('set up mocks', async () => {
    await injectAuth(page)
    await mockRemainingPbCalls(page)
    await mockHouseholdsApi(page)
    await mockSettingsMembersApi(page)
    await mockExpensesApi(page, [])
  })

  await test.step('navigate and open sheet', async () => {
    await page.goto('/finances')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add expense' }).click()
  })

  await test.step('enter title, set amount to 0, then blur', async () => {
    await page.getByLabel('Title').fill('Test')
    const amountInput = page.locator('#expense-amount')
    await amountInput.click()
    await amountInput.pressSequentially('0')
    await amountInput.blur()
  })

  await test.step('verify amount error and disabled Confirm', async () => {
    await expect(page.getByText('Amount is required')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })
})

// 3.2-E5: Failed POST reverts optimistic entry, shows inline error
test('failed POST reverts optimistic expense and shows error banner', async ({ page }) => {
  await test.step('set up mocks — POST returns 500', async () => {
    await injectAuth(page)
    await mockRemainingPbCalls(page)
    await mockHouseholdsApi(page)
    await mockSettingsMembersApi(page)
    await mockExpensesApi(page, [])
    await mockExpensesCreateApi(page, {} as never, { failWithStatus: 500 })
  })

  await test.step('navigate and submit expense', async () => {
    await page.goto('/finances')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add expense' }).click()
    await page.getByLabel('Title').fill('Will Fail')
    const amountInput = page.locator('#expense-amount')
    await amountInput.click()
    await amountInput.pressSequentially('30')
    await page.getByRole('button', { name: 'Confirm' }).click()
  })

  await test.step('verify expense removed and error banner shown', async () => {
    await expect(page.getByText("Couldn't save the expense")).toBeVisible()
    await expect(page.getByText('Nothing here yet — add your first expense')).toBeVisible()
  })
})

// 3.2-E6: WCAG 2.1 AA with form open
test('add expense sheet has no WCAG 2.1 AA violations', async ({ page }) => {
  await test.step('set up mocks', async () => {
    await injectAuth(page)
    await mockRemainingPbCalls(page)
    await mockHouseholdsApi(page)
    await mockSettingsMembersApi(page)
    await mockExpensesApi(page, [])
  })

  await test.step('navigate and open sheet', async () => {
    await page.goto('/finances')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Add expense' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  await test.step('run axe accessibility audit', async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(
      results.violations,
      results.violations.map(v => `[${v.id}] ${v.description}\n  ${v.nodes.map(n => n.html).join('\n  ')}`).join('\n'),
    ).toEqual([])
  })
})
