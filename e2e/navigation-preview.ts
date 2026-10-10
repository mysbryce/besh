import { expect, type Locator, type Page } from '@playwright/test'

type Capture = (
  group: string,
  title: string,
  detail: string,
  options?: { fullPage?: boolean; region?: 'listbox' },
) => Promise<void>

async function compact(control: Locator) {
  const bounds = await control.boundingBox()
  expect(bounds).not.toBeNull()
  expect(Math.round(bounds!.height * 100) / 100).toBeLessThanOrEqual(36)
}

async function phoneTarget(control: Locator) {
  await expect(control).toHaveCSS('min-height', '44px')
  const bounds = await control.boundingBox()
  expect(bounds).not.toBeNull()
  // Chromium's border coordinates can differ by a fraction of a CSS pixel.
  expect(Math.round(bounds!.height * 100) / 100).toBeGreaterThanOrEqual(44)
}

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const menu = page.getByRole('listbox')
  const bounds = await menu.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  )
  expect(Math.round(bounds!.y * 100) / 100).toBeGreaterThanOrEqual(0)
  expect(
    Math.round((bounds!.y + bounds!.height) * 100) / 100,
  ).toBeLessThanOrEqual(page.viewportSize()!.height)
}

export async function navigationPreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: {
  page: Page
  owner: string
  apiOrigin: string
  capture: Capture
}) {
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()

  const longRole =
    'Z Inventory availability and reserved stock for international storefronts'
  const longRoleLabel = `${longRole} · custom role`
  for (let index = 1; index <= 12; index++) {
    const response = await page.request.post(`${apiOrigin}/api/roles`, {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        name: index === 12 ? longRole : `Review role ${index}`,
        permissions: ['flows.read'],
      },
    })
    expect(response.status()).toBe(200)
  }

  await page.goto(apiOrigin)
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  const navigation = page.getByRole('navigation', {
    name: 'Workspace navigation',
  })
  await expect(navigation).toBeVisible()
  await compact(
    navigation.getByRole('button', { name: 'API Studio', exact: true }),
  )
  const appearance = page.locator('#appearance')
  await compact(appearance)
  await appearance.click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  await capture(
    'Navigation',
    'Compact light workspace navigation',
    'Desktop navigation uses compact rows with readable labels and an anchored sign-out action.',
    { fullPage: false },
  )
  await appearance.click()
  await compact(page.getByRole('option', { name: 'Light', exact: true }))
  await contained(page)
  await capture(
    'Navigation',
    'Compact light appearance menu',
    'The custom dropdown aligns its chevron and keeps selection and keyboard focus visible.',
    { fullPage: false },
  )
  await page.keyboard.press('Escape')
  await expect(appearance).toBeFocused()

  await appearance.click()
  await page.getByRole('option', { name: 'Dark', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 720 })
  await capture(
    'Navigation',
    'Compact dark sidebar with scrollable sections',
    'Short desktop navigation rows and themed native scrolling keep the independent sidebar usable on shorter screens.',
    { fullPage: false },
  )
  await navigation.getByRole('button', { name: 'Members', exact: true }).click()
  const role = page.getByRole('combobox', { name: 'Member role', exact: true })
  await expect(role).toBeEnabled()
  await compact(role)
  await role.click()
  await compact(
    page.getByRole('option', { name: 'Editor · build and test', exact: true }),
  )
  await contained(page)
  await capture(
    'Navigation',
    'Compact dark role menu with many choices',
    'Actual owner-created roles exercise the dropdown scroll controls without changing a member.',
    { fullPage: false, region: 'listbox' },
  )
  await page.getByRole('listbox').hover()
  await page.mouse.wheel(0, 600)
  await page.keyboard.press('End')
  await expect(
    page.getByRole('option', { name: longRoleLabel, exact: true }),
  ).toBeInViewport()
  await capture(
    'Navigation',
    'Complete long role label at the end of a menu',
    'Keyboard and wheel navigation reach the final role; its full label wraps instead of clipping.',
    { fullPage: false, region: 'listbox' },
  )
  await page.keyboard.press('Enter')
  await expect(role).toHaveText(longRoleLabel)
  await expect(role).toBeFocused()
  await navigation
    .getByRole('button', { name: 'API Studio', exact: true })
    .click()

  const language = page.locator('#language')
  await language.click()
  await page.getByRole('option', { name: 'Русский', exact: true }).click()
  await language.click()
  await contained(page)
  await capture(
    'Navigation',
    'Compact Russian navigation and language choices',
    'Long translated navigation labels remain readable alongside the seven language choices.',
    { fullPage: false },
  )
  await page.getByRole('option', { name: 'English', exact: true }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  for (const theme of ['Light', 'Dark']) {
    await appearance.click()
    await page.getByRole('option', { name: theme, exact: true }).click()
    await appearance.click()
    const option = page.getByRole('option', { name: theme, exact: true })
    await expect(page.getByRole('listbox')).toHaveCSS('opacity', '1')
    await phoneTarget(appearance)
    await phoneTarget(option)
    await contained(page)
    await capture(
      'Navigation',
      `Phone ${theme.toLowerCase()} appearance menu`,
      'Phone controls retain 44px targets, visible selection and contained labels.',
      { fullPage: false },
    )
    await page.keyboard.press('Escape')
  }
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Members', exact: true })
    .click()
  await role.click()
  await page.keyboard.press('End')
  await expect(
    page.getByRole('option', { name: longRoleLabel, exact: true }),
  ).toBeInViewport()
  await contained(page)
  await capture(
    'Navigation',
    'Phone long role choice without clipping',
    'The full authored role name remains within its custom menu on a native 390px phone.',
    { fullPage: false, region: 'listbox' },
  )
  await page.keyboard.press('Escape')
  await language.click()
  await page.getByRole('option', { name: 'Русский', exact: true }).click()
  await language.click()
  await contained(page)
  await capture(
    'Navigation',
    'Phone Russian language menu',
    'Translated header controls and all language choices stay contained on a phone.',
    { fullPage: false },
  )
  await page.keyboard.press('Escape')
}
