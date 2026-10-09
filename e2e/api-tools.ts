import { expect, type Page } from '@playwright/test'

export async function openApiTools(page: Page) {
  const disclosure = page.getByRole('button', {
    name: 'API tools',
    exact: true,
  })
  await expect(disclosure).toBeVisible()
  if ((await disclosure.getAttribute('aria-expanded')) === 'false') {
    await disclosure.click()
  }
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
}
