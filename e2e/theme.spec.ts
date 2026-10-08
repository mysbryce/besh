import { expect, test, type Locator } from '@playwright/test'

async function inputBorderContrast(input: Locator) {
  return input.evaluate((element) => {
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
      const linear = channels.map((channel) => {
        const value = channel / 255
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4
      })

      return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
    }

    let surface: Element | null = element
    while (surface) {
      const color = getComputedStyle(surface).backgroundColor
      if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') break
      surface = surface.parentElement
    }

    const background = luminance(getComputedStyle(surface!).backgroundColor)
    const border = luminance(getComputedStyle(element).borderTopColor)

    return (
      (Math.max(border, background) + 0.05) /
      (Math.min(border, background) + 0.05)
    )
  })
}

test('appearance follows the system and preserves a chosen theme after reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/')

  const appearance = page.getByRole('combobox', { name: 'Appearance' })
  const input = page.locator('input[data-slot="input"]:visible').first()
  await expect(input).toBeVisible()
  await expect(appearance).toHaveJSProperty('tagName', 'BUTTON')
  await expect(appearance).toHaveText('System')
  await appearance.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(appearance).toBeFocused()

  await appearance.click()
  await page.getByRole('option', { name: 'Dark', exact: true }).click()
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(17, 21, 28)',
  )
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(232, 237, 245)')
  expect
    .soft(await inputBorderContrast(input), 'Dark input boundary contrast')
    .toBeGreaterThanOrEqual(3)
  await page.screenshot({
    path: 'test-results/theme-dark-welcome.png',
    fullPage: true,
    animations: 'disabled',
    mask: [page.getByLabel('Setup key'), page.getByLabel('Workspace token')],
    maskColor: '#3b4555',
  })

  await page.reload()
  await expect(appearance).toHaveText('Dark')
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(17, 21, 28)',
  )

  await appearance.click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(245, 245, 243)',
  )
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(245, 245, 243)',
  )
  expect
    .soft(await inputBorderContrast(input), 'Light input boundary contrast')
    .toBeGreaterThanOrEqual(3)

  await appearance.click()
  await page.getByRole('option', { name: 'System', exact: true }).click()
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(17, 21, 28)',
  )
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(245, 245, 243)',
  )
  await page.screenshot({
    path: 'test-results/theme-light-welcome.png',
    fullPage: true,
    animations: 'disabled',
    mask: [page.getByLabel('Setup key'), page.getByLabel('Workspace token')],
    maskColor: '#dfe4ec',
  })
})
