import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { renderPreview } from '../scripts/preview-report'

let server: Server
let origin: string

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

test.beforeAll(async () => {
  const image = readFileSync('docs/assets/besh-banner.png')
  const html = renderPreview(
    Array.from({ length: 24 }, (_, index) => ({
      page: `Page ${String(index + 1).padStart(2, '0')}`,
      title: 'Gallery fixture',
      detail: 'Static gallery control fixture, not an API execution.',
      image: 'images/example.png',
    })),
  )
  server = createServer((request, response) => {
    if (request.url === '/images/example.png') {
      response.writeHead(200, { 'content-type': 'image/png' })
      response.end(image)
      return
    }
    if (request.url !== '/') {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(html)
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing gallery listener')
  origin = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
  await new Promise<void>((done, fail) =>
    server.close((error) => (error ? fail(error) : done())),
  )
})

test('compact gallery filter retains scrolling and keyboard selection on phones', async ({
  page,
}, info) => {
  await page.goto(origin)
  const control = page.getByRole('combobox', { name: 'Filter by page' })
  await control.click()
  expect((await control.boundingBox())!.height).toBeLessThanOrEqual(36)
  expect(
    (await page
      .getByRole('option', { name: 'All pages', exact: true })
      .boundingBox())!.height,
  ).toBeLessThanOrEqual(36)

  for (const theme of ['Light', 'Dark']) {
    await page.keyboard.press('Escape')
    await page
      .getByRole('button', { name: `${theme} theme`, exact: true })
      .click()
    await control.click()
    await page.screenshot({
      path: info.outputPath(`${theme.toLowerCase()}-desktop-menu.png`),
      animations: 'disabled',
    })
    await page.getByRole('listbox').hover()
    await page.mouse.wheel(0, 700)
    await expect
      .poll(() =>
        page.getByRole('listbox').evaluate((element) => element.scrollTop),
      )
      .toBeGreaterThan(0)
    await page.screenshot({
      path: info.outputPath(
        `${theme.toLowerCase()}-desktop-menu-scrolling.png`,
      ),
      animations: 'disabled',
    })
    await control.focus()
    await page.keyboard.press('End')
    await expect(
      page.getByRole('option', { name: 'Page 24', exact: true }),
    ).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(control).toHaveText('Page 24')
    await expect(control).toBeFocused()
    await expect(page.locator('article:visible')).toHaveCount(1)
    await control.click()
  }

  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  for (const theme of ['Light', 'Dark']) {
    await page
      .getByRole('button', { name: `${theme} theme`, exact: true })
      .click()
    await control.click()
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(
      (await page
        .getByRole('option', { name: 'All pages', exact: true })
        .boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: info.outputPath(`${theme.toLowerCase()}-phone-menu.png`),
      animations: 'disabled',
    })
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await expect(control).toHaveText('All pages')
    await expect(control).toBeFocused()
    await expect(page.locator('article:visible')).toHaveCount(24)
  }
})
