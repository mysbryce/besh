import { expect, type Page } from '@playwright/test'

export async function chooseNode(page: Page, label: string) {
  const name =
    label === 'Response'
      ? 'JSON response'
      : label === 'Request'
        ? 'HTTP request'
        : label
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  const picker = page.getByRole('dialog', {
    name: 'Choose a step',
    exact: true,
  })
  await expect(picker).toBeVisible()
  await picker.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  await expect(picker).toHaveCount(0)
}
