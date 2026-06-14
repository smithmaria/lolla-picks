import { expect, test } from '@playwright/test'

/**
 * UI-only smoke tests for the Home page.
 *
 * These render the real app in a browser but deliberately never reach Supabase:
 * every interaction here hits a client-side path that returns before any network
 * call (form validation fails fast; invalid join codes are rejected locally; a
 * fresh browser has no saved rooms to fetch). No rooms/votes are created.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('renders the create and join tabs', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'create', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'join', exact: true })).toBeVisible()
  // Create form is the default view.
  await expect(page.getByRole('button', { name: 'Create room' })).toBeVisible()
})

test('shows validation errors when submitting an empty create form', async ({ page }) => {
  await page.getByRole('button', { name: 'Create room' }).click()

  await expect(page.getByText('Your name is required.')).toBeVisible()
  await expect(page.getByText('A password is required.')).toBeVisible()
  // Still on the home page — nothing was created.
  await expect(page).toHaveURL('/')
})

test('rejects a password containing spaces', async ({ page }) => {
  await page.getByPlaceholder('Name').fill('Maria')
  await page.getByPlaceholder('Password').fill('bad pass')
  await page.getByRole('button', { name: 'Create room' }).click()

  await expect(page.getByText('Password cannot contain spaces.')).toBeVisible()
})

test('requires at least one festival day', async ({ page }) => {
  await page.getByPlaceholder('Name').fill('Maria')
  await page.getByPlaceholder('Password').fill('hunter2')

  // All four days start selected; deselect them all.
  for (const day of ['Thursday', 'Friday', 'Saturday', 'Sunday']) {
    await page.getByRole('button', { name: day }).click()
  }
  await page.getByRole('button', { name: 'Create room' }).click()

  await expect(page.getByText('Select at least one day.')).toBeVisible()
})

test('rejects an invalid join code without leaving the page', async ({ page }) => {
  await page.getByRole('button', { name: 'join', exact: true }).click()

  await page.getByPlaceholder('e.g. CAMP4T').fill('abc')
  await page.getByRole('button', { name: 'Go to room' }).click()

  await expect(page.getByText('Enter the 6-character room code.')).toBeVisible()
  await expect(page).toHaveURL('/')
})
