import { expect, test } from 'bun:test'
import { chromium, expect as browserExpect, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

// The copied artifact owns setup, authentication, data and generated
// routes. The separately compiled bridge only delivers its genuine launch URL.
// Installed Playwright belongs to this parent, not the executable installation.

function browserCallback() {
  const nonce = crypto.randomUUID() + crypto.randomUUID()
  let delivered = ''
  let origin = ''
  let accepted = false
  let waiter: ((value: string) => void) | undefined
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: 8 * 1024,
    async fetch(request) {
      if (
        request.method !== 'POST' ||
        new URL(request.url).pathname !== '/browser' ||
        request.headers.has('origin') ||
        request.headers.get('x-besh-ui-browser-fixture') !== nonce
      )
        return new Response(null, { status: 403 })
      if (accepted) return new Response(null, { status: 409 })
      try {
        const body: unknown = await request.json()
        if (
          !body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).length !== 1 ||
          !('url' in body) ||
          typeof body.url !== 'string' ||
          body.url.length > 4096
        )
          return new Response(null, { status: 400 })
        const url = new URL(body.url)
        if (
          url.protocol !== 'http:' ||
          url.hostname !== '127.0.0.1' ||
          !url.port ||
          url.pathname !== '/' ||
          url.username ||
          url.password ||
          url.hash ||
          [...url.searchParams.keys()].length !== 1 ||
          !url.searchParams.get('setup')
        )
          return new Response(null, { status: 400 })
        accepted = true
        origin = url.origin
        if (waiter) {
          const receive = waiter
          waiter = undefined
          receive(url.href)
        } else delivered = url.href
        return new Response(null, { status: 204 })
      } catch {
        return new Response(null, { status: 400 })
      }
    },
  })
  return {
    url: new URL('/browser', server.url).href,
    nonce,
    origin: () => origin,
    next() {
      if (delivered) {
        const value = delivered
        delivered = ''
        return Promise.resolve(value)
      }
      return new Promise<string>((done, fail) => {
        const timer = setTimeout(() => {
          waiter = undefined
          fail(new Error('Owned browser bridge did not deliver its handoff'))
        }, 12_000)
        waiter = (value) => {
          clearTimeout(timer)
          done(value)
        }
      })
    },
    async close() {
      delivered = ''
      waiter = undefined
      await server.stop(true)
    },
  }
}

async function command(
  executable: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  uncertain: () => void,
) {
  const child = spawn(executable, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return await new Promise<{
    code: number | null
    output: string
    errorOutput: string
  }>((done, fail) => {
    let output = ''
    let errorOutput = ''
    let bytes = 0
    let settled = false
    const reject = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      output = ''
      errorOutput = ''
      uncertain()
      child.unref()
      child.stdout.destroy()
      child.stderr.destroy()
      fail(new Error('Owned portable CLI exit could not be confirmed'))
    }
    const timer = setTimeout(reject, 12_000)
    const record = (chunk: Buffer, stderr: boolean) => {
      if (settled) return
      bytes += chunk.byteLength
      if (bytes > 64 * 1024) return reject()
      if (stderr) errorOutput += chunk.toString('utf8')
      else output += chunk.toString('utf8')
    }
    child.stdout.on('data', (chunk: Buffer) => record(chunk, false))
    child.stderr.on('data', (chunk: Buffer) => record(chunk, true))
    child.once('error', reject)
    child.once('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      done({ code, output, errorOutput })
    })
  })
}

function publicOrigin(output: string) {
  const match = /^Besh API ready at (http:\/\/127\.0\.0\.1:\d+)\/?$/u.exec(
    output.trim(),
  )
  if (!match)
    throw new Error('Portable launcher did not report its public origin')
  return new URL(match[1]).origin
}

function stoppedStatus(output: string) {
  try {
    const value: unknown = JSON.parse(output.trim())
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false
    return (
      Object.keys(value).length === 1 &&
      'state' in value &&
      value.state === 'stopped'
    )
  } catch {
    return false
  }
}

async function ceased(origin: string) {
  const deadline = Date.now() + 6_000
  while (Date.now() < deadline) {
    const signal = AbortSignal.timeout(1_000)
    try {
      const response = await fetch(new URL('/health', origin), {
        redirect: 'manual',
        signal,
      })
      await response.body?.cancel()
    } catch {
      if (!signal.aborted) return
    }
    await Bun.sleep(100)
  }
  throw new Error('Portable public HTTP did not cease after owned stop')
}

async function boundedBody(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Public artifact response had no body')
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      bytes += item.value.byteLength
      if (bytes > 64 * 1024)
        throw new Error('Public artifact response exceeded its bound')
      chunks.push(item.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function appearance(page: Page, name: 'Light' | 'Dark') {
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).click()
  await page.getByRole('option', { name, exact: true }).click()
  await browserExpect(page.locator('html')).toHaveAttribute(
    'data-theme',
    name.toLowerCase(),
  )
}

test('copied executable renders real setup, signs in and publishes a callable REST API through its own dashboard', async () => {
  if (
    process.platform !== 'win32' ||
    !Bun.semver.satisfies(Bun.version, '>=1.4.2')
  )
    throw new Error(
      'This artifact browser journey requires Windows and Bun >= 1.4.2',
    )
  if (process.env.DEBUG || process.env.PWDEBUG)
    throw new Error(
      'Disable browser debug logging for this private handoff journey',
    )
  const artifact = process.env.BESH_TEST_PORTABLE_EXE
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!artifact || !systemRoot)
    throw new Error('Supply the artifact and Windows system root')
  const prefix = join(resolve(tmpdir()), 'besh-portable-browser-ui-')
  const directory = await mkdtemp(prefix)
  const installation = join(directory, 'executable folder ภาษาไทย')
  const cwd = join(directory, 'unrelated working folder ภาษาไทย')
  const data = join(installation, 'besh-data')
  const previews = resolve(
    import.meta.dir,
    '../.preview',
    `portable-browser-ui-${crypto.randomUUID()}`,
  )
  const captures: { file: string; title: string; width: number }[] = []
  let owner = ''
  let runtime = ''
  let setupURL = ''
  let challenge = ''
  let knownOrigin = ''
  let mayHaveStarted = false
  let confirmedStopped = false
  let cliExitUncertain = false
  let callback: ReturnType<typeof browserCallback> | undefined
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  const executable = join(installation, 'besh.exe')
  const env: NodeJS.ProcessEnv = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    PATH: join(systemRoot, 'System32'),
    TEMP: directory,
    TMP: directory,
    BESH_WEB_URL: 'must-not-be-an-origin',
    BESH_ADMIN_TOKEN: 'must-not-bypass-real-first-run',
  }
  const run = (args: string[]) =>
    command(executable, args, cwd, env, () => {
      cliExitUncertain = true
    })
  const safeCLI = (value: { output: string; errorOutput: string }) => {
    expect(value.errorOutput.length === 0).toBe(true)
    expect(
      [value.output, value.errorOutput].every(
        (text) =>
          !text.includes('setup=') &&
          (!challenge || !text.includes(challenge)) &&
          (!owner || !text.includes(owner)) &&
          (!runtime || !text.includes(runtime)),
      ),
    ).toBe(true)
  }
  try {
    await Promise.all([
      mkdir(installation),
      mkdir(cwd),
      mkdir(previews, { recursive: true }),
    ])
    await copyFile(resolve(artifact), executable)
    await chmod(executable, 0o700)
    const compiledBridge = join(directory, 'compiled-browser-bridge.exe')
    const bridge = join(directory, 'owned UI browser bridge ภาษาไทย.exe')
    const build = await Bun.build({
      entrypoints: [join(import.meta.dir, 'portable-browser-bridge.ts')],
      target: 'bun',
      env: 'disable',
      compile: {
        target: 'bun-windows-x64',
        outfile: compiledBridge,
        autoloadDotenv: false,
        autoloadBunfig: false,
        autoloadTsconfig: false,
        autoloadPackageJson: false,
      },
    })
    expect(build.success).toBe(true)
    await copyFile(compiledBridge, bridge)
    await chmod(bridge, 0o700)
    await writeFile(
      join(cwd, '.env'),
      'BESH_ADMIN_TOKEN=must-not-configure-workspace\n',
    )
    await writeFile(join(cwd, 'bunfig.toml'), 'invalid = [\n')
    callback = browserCallback()
    env.BESH_TEST_UI_BROWSER_CALLBACK = callback.url
    env.BESH_TEST_UI_BROWSER_NONCE = callback.nonce
    mayHaveStarted = true
    const launch = await run(['--port', '0', '--browser', bridge])
    expect(launch.code).toBe(0)
    knownOrigin = publicOrigin(launch.output)
    setupURL = await callback.next()
    const target = new URL(setupURL)
    expect(target.origin === knownOrigin).toBe(true)
    challenge = target.searchParams.get('setup') ?? ''
    expect(Boolean(challenge)).toBe(true)
    safeCLI(launch)

    const inventory = JSON.parse(
      await readFile(resolve(artifact) + '.dashboard.json', 'utf8'),
    ) as {
      assets: { path: string; bytes: number; sha256: string }[]
    }
    expect(inventory.assets.length > 0).toBe(true)
    for (const asset of inventory.assets) {
      const response = await fetch(
        new URL(asset.path === 'index.html' ? '/' : asset.path, knownOrigin),
        {
          redirect: 'manual',
          signal: AbortSignal.timeout(3_000),
        },
      )
      expect(response.status).toBe(200)

      const bytes = new Uint8Array(await response.arrayBuffer())
      const digest = createHash('sha256').update(bytes).digest('hex')
      expect(bytes.byteLength === asset.bytes && digest === asset.sha256).toBe(
        true,
      )
    }

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      reducedMotion: 'reduce',
      colorScheme: 'light',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    page.setDefaultNavigationTimeout(12_000)
    let pageErrors = 0
    let networkErrors = 0
    let policyViolations = 0
    page.on('pageerror', () => {
      pageErrors += 1
    })
    page.on('requestfailed', () => {
      networkErrors += 1
    })
    await page.exposeFunction('recordArtifactCSPViolation', () => {
      policyViolations += 1
    })
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', () => {
        const report = Reflect.get(window, 'recordArtifactCSPViolation')
        void report()
      })
    })
    // No tracing, HAR, video or exception text is retained. A goto failure can
    // contain the setup URL, so the entire browser journey has a fixed catch.
    const navigation = await page.goto(setupURL)
    setupURL = ''
    const policy = navigation?.headers()['content-security-policy'] ?? ''
    expect(
      policy.includes("default-src 'self'") && !policy.includes('unsafe-eval'),
    ).toBe(true)
    await browserExpect(
      page.getByLabel('Workspace name', { exact: true }),
    ).toBeVisible()
    await browserExpect.poll(() => new URL(page.url()).search.length).toBe(0)
    expect(new URL(page.url()).hash.length === 0).toBe(true)
    await appearance(page, 'Light')

    const capture = async (file: string, title: string, fullPage = true) => {
      const url = new URL(page.url())
      expect(url.origin === knownOrigin && !url.search && !url.hash).toBe(true)
      if (fullPage)
        await page.evaluate(() => {
          window.scrollTo({ top: 0, behavior: 'instant' })
        })
      await page.screenshot({
        path: join(previews, file),
        fullPage,
        animations: 'disabled',
        style: fullPage
          ? 'html { scrollbar-gutter: stable !important; scroll-behavior: auto !important }'
          : undefined,
        maskColor: '#101820',
        mask: [
          page.locator('[data-private="true"]'),
          page.locator('input[type="password"]'),
          page.getByLabel('New API key', { exact: true }),
          page.getByLabel('Your owner key', { exact: true }),
          page.getByLabel('Workspace token', { exact: true }),
        ],
      })
      captures.push({ file, title, width: page.viewportSize()!.width })
    }
    await page
      .getByLabel('Workspace name', { exact: true })
      .fill('Portable browser workspace')
    await capture('01-first-run-light.png', 'Real compiled first-run wizard')
    const setup = page.waitForResponse(
      (response) =>
        response.url() === `${knownOrigin}/setup` &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Create workspace', exact: true })
      .click()
    expect((await setup).status()).toBe(200)
    await browserExpect(
      page.getByLabel('Your owner key', { exact: true }),
    ).toBeVisible()
    owner = await page
      .getByLabel('Your owner key', { exact: true })
      .inputValue()
    expect(owner.length >= 32).toBe(true)
    await capture(
      '02-owner-receipt-masked.png',
      'Genuine owner receipt with opaque key mask',
    )
    await page
      .getByRole('checkbox', { name: 'I saved my owner key', exact: true })
      .check()
    const login = page.waitForResponse(
      (response) =>
        response.url() === `${knownOrigin}/auth/login` &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Enter studio', exact: true })
      .click()
    const authenticated = await login
    expect(authenticated.status()).toBe(200)
    expect(
      (await authenticated.request().allHeaders()).origin === knownOrigin,
    ).toBe(true)
    await browserExpect(page.getByTestId('flow-canvas')).toBeVisible()
    const cookie = (await context.cookies()).find(
      (value) => value.name === 'besh_session',
    )
    expect(Boolean(cookie?.httpOnly && cookie.sameSite === 'Strict')).toBe(true)

    await page
      .getByLabel('API name', { exact: true })
      .fill('Portable browser greeting')
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/v1/portable-browser')
    await browserExpect(
      page.getByRole('combobox', { name: 'HTTP method', exact: true }),
    ).toContainText('GET')
    const saved = page.waitForResponse(
      (response) =>
        response.url() === `${knownOrigin}/api/flows` &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    const savedResponse = await saved
    expect(savedResponse.status()).toBe(200)
    const flow = await savedResponse.json()
    if (typeof flow.id !== 'string' || !flow.id)
      throw new Error('Draft did not return a public API ID')
    const tested = page.waitForResponse(
      (response) =>
        response.url() === `${knownOrigin}/api/flows/${flow.id}/test` &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    const testedResponse = await tested
    expect(testedResponse.status()).toBe(200)
    const result = await testedResponse.json()
    expect(
      result.status === 200 && result.body?.message === 'Hello, Besh!',
    ).toBe(true)
    await browserExpect(page.getByTestId('test-result')).toContainText(
      'Hello, Besh!',
    )
    const published = page.waitForResponse(
      (response) =>
        response.url() === `${knownOrigin}/api/flows/${flow.id}/publish` &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    const publishedResponse = await published
    expect(publishedResponse.status()).toBe(200)
    const release = await publishedResponse.json()
    expect(release.id === flow.id && release.publishedRevision === 1).toBe(true)

    const fonts = await page.evaluate(async () => {
      const latin = await document.fonts.load(
        '500 14px "Google Sans Flex"',
        'Portable browser',
      )
      const thai = await document.fonts.load(
        '500 14px "Noto Sans Thai"',
        'ภาษาไทย',
      )
      await document.fonts.ready
      return (
        latin.length > 0 &&
        thai.length > 0 &&
        [...latin, ...thai].every((font) => font.status === 'loaded')
      )
    })
    expect(fonts).toBe(true)
    await capture(
      '03-studio-light.png',
      'Saved and tested compiled dashboard in Light appearance',
    )
    await appearance(page, 'Dark')
    await capture('04-studio-dark.png', 'Same published API in Dark appearance')
    await page.setViewportSize({ width: 390, height: 844 })
    await appearance(page, 'Light')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      '05-studio-phone-light.png',
      'Native 390-pixel compiled dashboard in Light appearance',
    )
    await appearance(page, 'Dark')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      '06-studio-phone-dark.png',
      'Native 390-pixel compiled dashboard in Dark appearance',
    )
    await page.setViewportSize({ width: 1440, height: 900 })
    await appearance(page, 'Light')

    const contentHeaders = {
      origin: knownOrigin,
      authorization: 'Bearer ' + owner,
    }
    const contentModelResponse = await page.request.post(
      knownOrigin + '/api/structs',
      {
        headers: contentHeaders,
        data: {
          name: 'Portable HTML model ไทย',
          fields: [
            {
              key: 'body',
              label: 'Body',
              required: true,
              schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
            },
            {
              key: 'summary',
              label: 'Summary',
              required: true,
              schema: { type: 'richText', schemaVersion: 1, astVersion: 1 },
            },
          ],
        },
      },
    )
    expect(contentModelResponse.status()).toBe(200)

    const contentModel = await contentModelResponse.json()
    const contentCollectionName = 'Portable HTML articles ไทย'
    const contentCollectionResponse = await page.request.post(
      knownOrigin + '/api/collections',
      {
        headers: contentHeaders,
        data: {
          name: contentCollectionName,
          structId: contentModel.id,
          structVersion: contentModel.version,
        },
      },
    )
    expect(contentCollectionResponse.status()).toBe(200)

    const contentCollection = await contentCollectionResponse.json()
    const contentData = {
      body: {
        type: 'document',
        astVersion: 2,
        children: [
          {
            type: 'heading',
            level: 1,
            children: [
              { type: 'text', text: 'Portable heading ไทย', marks: [] },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: '<script>literal</script> & ไทย',
                marks: [],
              },
            ],
          },
        ],
      },
      summary: {
        type: 'document',
        astVersion: 1,
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: '  Summary <em>literal</em> & ไทย  ' },
            ],
          },
        ],
      },
    }
    const contentEntriesPath =
      knownOrigin + '/api/collections/' + contentCollection.id + '/entries'
    const contentEntryResponse = await page.request.post(contentEntriesPath, {
      headers: contentHeaders,
      data: { data: contentData },
    })
    expect(contentEntryResponse.status()).toBe(200)

    const contentEntry = await contentEntryResponse.json()
    const contentEntryPath = contentEntriesPath + '/' + contentEntry.id
    const savedContentResponse = await page.request.get(contentEntryPath, {
      headers: contentHeaders,
    })
    expect(savedContentResponse.status()).toBe(200)

    const savedContent = await savedContentResponse.json()
    expect(savedContent.version).toBe(1)
    expect(savedContent.data).toEqual(contentData)

    const contentPaths = [
      knownOrigin + '/api/collections/' + contentCollection.id,
      contentEntryPath,
      knownOrigin + '/api/audit',
    ]
    const contentBefore: unknown[] = []

    for (const path of contentPaths) {
      const response = await page.request.get(path, { headers: contentHeaders })
      expect(response.status()).toBe(200)
      contentBefore.push(await response.json())
    }

    await page.getByRole('button', { name: 'Content', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Choose a collection', exact: true })
      .click()
    await page
      .getByRole('option', { name: contentCollectionName, exact: true })
      .click()
    await page
      .locator('.content-entry-row')
      .filter({ hasText: contentEntry.id })
      .click()
    await browserExpect(
      page.getByRole('heading', { name: 'Saved entry', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Preview HTML', exact: true })
      .click()

    const htmlReview = page.getByRole('region', {
      name: 'Private HTML preview',
      exact: true,
    })
    const generateHTML = htmlReview.getByRole('button', {
      name: 'Generate HTML preview',
      exact: true,
    })
    const htmlSource = htmlReview.getByRole('textbox', {
      name: 'HTML source',
      exact: true,
    })
    const htmlField = htmlReview.getByRole('combobox', {
      name: 'Rich-text field',
      exact: true,
    })
    const htmlPreviewPath = contentEntryPath + '/render-preview'
    const htmlIdentity = {
      collectionId: contentCollection.id,
      collectionVersion: contentCollection.version,
      structId: contentModel.id,
      structVersion: contentModel.version,
      entryId: savedContent.id,
      entryVersion: savedContent.version,
      rendererSchemaVersion: 1,
      consumerContract: null,
    }
    const formattedHTML =
      '<h1>Portable heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; ไทย</p>'
    const formattedReply = page.waitForResponse(
      (response) =>
        response.url() === htmlPreviewPath &&
        response.request().method() === 'POST',
    )

    await generateHTML.click()

    const formattedResponse = await formattedReply
    expect(formattedResponse.status()).toBe(200)
    expect(formattedResponse.request().postDataJSON()).toEqual({
      entryVersion: 1,
      fieldKey: 'body',
      renderer: { schemaVersion: 1, elements: {} },
    })
    expect(await formattedResponse.json()).toMatchObject({
      ...htmlIdentity,
      fieldKey: 'body',
      schemaVersion: 2,
      astVersion: 2,
      html: formattedHTML,
    })
    await browserExpect(htmlSource).toHaveValue(formattedHTML)
    await browserExpect(htmlSource).toHaveAttribute('readonly', '')
    await browserExpect(
      htmlReview.locator('iframe[title="Rendered HTML preview"]'),
    ).toHaveAttribute('sandbox', '')

    await htmlField.click()
    await page.getByRole('option', { name: 'Summary', exact: true }).click()
    await browserExpect(htmlSource).toHaveCount(0)

    const literalHTML =
      '<p>  Summary &lt;em&gt;literal&lt;/em&gt; &amp; ไทย  </p>'
    const literalReply = page.waitForResponse(
      (response) =>
        response.url() === htmlPreviewPath &&
        response.request().method() === 'POST',
    )

    await generateHTML.click()

    const literalResponse = await literalReply
    expect(literalResponse.status()).toBe(200)
    expect(literalResponse.request().postDataJSON()).toEqual({
      entryVersion: 1,
      fieldKey: 'summary',
      renderer: { schemaVersion: 1, elements: {} },
    })
    expect(await literalResponse.json()).toMatchObject({
      ...htmlIdentity,
      fieldKey: 'summary',
      schemaVersion: 1,
      astVersion: 1,
      html: literalHTML,
    })
    await browserExpect(htmlSource).toHaveValue(literalHTML)

    await htmlField.click()
    await page.getByRole('option', { name: 'Body', exact: true }).click()
    await browserExpect(htmlSource).toHaveCount(0)
    await htmlReview
      .getByRole('button', { name: 'Advanced element settings', exact: true })
      .click()
    await htmlReview
      .getByRole('combobox', { name: 'Element', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Heading 1 (h1)', exact: true })
      .click()
    await htmlReview
      .getByLabel('CSS classes', { exact: true })
      .fill('portable-heading')
    await htmlReview
      .getByLabel('Title attribute', { exact: true })
      .fill('Portable "ไทย" & <saved>')

    const mappedHTML =
      '<h1 class="portable-heading" title="Portable &quot;ไทย&quot; &amp; &lt;saved&gt;">Portable heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; ไทย</p>'
    const mappedReply = page.waitForResponse(
      (response) =>
        response.url() === htmlPreviewPath &&
        response.request().method() === 'POST',
    )

    await generateHTML.click()

    const mappedResponse = await mappedReply
    expect(mappedResponse.status()).toBe(200)
    expect(mappedResponse.request().postDataJSON()).toEqual({
      entryVersion: 1,
      fieldKey: 'body',
      renderer: {
        schemaVersion: 1,
        elements: {
          h1: {
            classes: ['portable-heading'],
            attributes: { title: 'Portable "ไทย" & <saved>' },
          },
        },
      },
    })
    expect(await mappedResponse.json()).toMatchObject({
      ...htmlIdentity,
      fieldKey: 'body',
      schemaVersion: 2,
      astVersion: 2,
      html: mappedHTML,
    })
    await browserExpect(htmlSource).toHaveValue(mappedHTML)
    const renderedContent = htmlReview.locator('iframe')
    await browserExpect(
      renderedContent.contentFrame().locator('h1'),
    ).toHaveText('Portable heading ไทย')
    await browserExpect(renderedContent.contentFrame().locator('p')).toHaveText(
      '<script>literal</script> & ไทย',
    )
    await renderedContent.scrollIntoViewIfNeeded()
    await browserExpect(renderedContent).toBeInViewport()

    await capture(
      '08-private-html-review.png',
      'Compiled saved HTML with reviewed transient heading settings',
      false,
    )

    const contentAfter: unknown[] = []

    for (const path of contentPaths) {
      const response = await page.request.get(path, { headers: contentHeaders })
      expect(response.status()).toBe(200)
      contentAfter.push(await response.json())
    }

    expect(contentAfter).toEqual(contentBefore)
    await htmlReview
      .getByRole('button', { name: 'Close HTML preview', exact: true })
      .click()

    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    await page
      .getByLabel('Key name', { exact: true })
      .fill('Portable browser caller')
    await page
      .getByRole('combobox', { name: 'Published API', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Portable browser greeting', exact: true })
      .click()
    await page
      .getByRole('combobox', { name: 'Release access', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Only this release', exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'REST requests', exact: true })
      .check()
    await page
      .getByRole('button', { name: 'Create API key', exact: true })
      .click()
    await browserExpect(
      page.getByRole('dialog', {
        name: 'Create release-pinned API key',
        exact: true,
      }),
    ).toBeVisible()
    const issued = page.waitForResponse(
      (response) =>
        response.url() === `${knownOrigin}/api/runtime-keys` &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Create pinned key', exact: true })
      .click()
    const issuedResponse = await issued
    expect(issuedResponse.status()).toBe(200)
    const key = await issuedResponse.json()
    if (typeof key.token !== 'string' || key.token.length < 32)
      throw new Error('API key did not return its one-use receipt')
    runtime = key.token
    key.token = undefined
    safeCLI(launch)
    expect(
      key.flowId === flow.id &&
        key.releaseRevision === 1 &&
        Array.isArray(key.permissions) &&
        key.permissions.length === 1 &&
        key.permissions[0] === 'rest',
    ).toBe(true)
    await browserExpect(
      page.getByLabel('New API key', { exact: true }),
    ).toBeVisible()
    expect(
      (await page.getByLabel('New API key', { exact: true }).inputValue()) ===
        runtime,
    ).toBe(true)
    const endpoint = await page
      .getByLabel('Published endpoint URL', { exact: true })
      .inputValue()
    expect(endpoint === `${knownOrigin}/run/v1/portable-browser`).toBe(true)
    await capture(
      '07-runtime-receipt-masked.png',
      'Published pinned caller receipt with opaque API key mask',
    )
    await page
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    await browserExpect(
      page.getByLabel('New API key', { exact: true }),
    ).toHaveCount(0)
    const live = await fetch(endpoint, {
      headers: { authorization: `Bearer ${runtime}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(3_000),
    })
    expect(live.status).toBe(200)
    const body = await boundedBody(live)
    expect(
      JSON.stringify(body) === JSON.stringify({ message: 'Hello, Besh!' }),
    ).toBe(true)
    for (const path of [
      '/src/app.ts',
      '/besh-data/besh.sqlite',
      '/.besh-instance/ready.json',
      '/besh-secrets.key',
    ]) {
      const privatePath = await fetch(new URL(path, knownOrigin), {
        redirect: 'manual',
        signal: AbortSignal.timeout(3_000),
      })
      expect(privatePath.status).toBe(404)
      await privatePath.body?.cancel()
    }
    expect(
      pageErrors === 0 && networkErrors === 0 && policyViolations === 0,
    ).toBe(true)
    expect(captures.length).toBe(8)
    await writeFile(
      join(previews, 'manifest.json'),
      JSON.stringify({ captures }, null, 2) + '\n',
    )
    await context.close()
    await browser.close()
    browser = undefined
    const stop = await run(['stop', '--data-dir', data])
    expect(stop.code).toBe(0)
    safeCLI(stop)
    expect(stoppedStatus(stop.output)).toBe(true)
    await ceased(knownOrigin)
    confirmedStopped = true
  } catch {
    // Never surface Playwright errors, assertion values, request/response
    // bodies or private browser URLs from this credential-bearing journey.
    throw new Error('Compiled dashboard browser journey failed')
  } finally {
    await browser?.close().catch(() => {})
    knownOrigin ||= callback?.origin() ?? ''
    if (mayHaveStarted && !confirmedStopped) {
      try {
        const stop = await run(['stop', '--data-dir', data])
        safeCLI(stop)
        if (stop.code === 0 && stoppedStatus(stop.output) && knownOrigin) {
          await ceased(knownOrigin)
          confirmedStopped = true
        }
      } catch {
        confirmedStopped = false
      }
    }
    if (confirmedStopped) {
      try {
        await ceased(knownOrigin)
      } catch {
        confirmedStopped = false
      }
    }
    owner = ''
    runtime = ''
    setupURL = ''
    challenge = ''
    delete env.BESH_TEST_UI_BROWSER_NONCE
    await callback?.close()
    // Unknown CLI ownership or a listener that still answers means retain its
    // workspace. Do not inspect private records, kill a PID or delete live data.
    if ((!mayHaveStarted || confirmedStopped) && !cliExitUncertain) {
      const target = resolve(directory)
      if (
        !target.startsWith(prefix) ||
        !target.startsWith(resolve(tmpdir()) + sep)
      )
        throw new Error('Artifact browser cleanup escaped its temporary root')
      await rm(target, {
        recursive: true,
        force: true,
        maxRetries: 4,
        retryDelay: 100,
      })
    }
  }
}, 120_000)
