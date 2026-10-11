import { expect, type Request } from '@playwright/test'
import { openApiTools } from './api-tools'
import { contentSnapshotClientCodePreviews } from './content-snapshot-client-code-preview'
import { signInPreview } from './preview-fixture'
import { htmlPreviewOrigin, test } from './rich-text-html-fixture'

test.use({ baseURL: htmlPreviewOrigin, locale: 'en-US' })

test.describe.configure({ lock: ['port-4395', 'clipboard'] })

test('owner generates a useful sealed GraphQL client example without invoking the API', async ({
  page,
  htmlWorkspace,
}) => {
  const headers = {
    origin: htmlPreviewOrigin,
    authorization: 'Bearer ' + htmlWorkspace.owner,
  }
  const path = '/browser-content-client-graphql'
  const creation = await page.request.post(
    htmlPreviewOrigin +
      '/api/collections/' +
      htmlWorkspace.collectionId +
      '/entries/' +
      htmlWorkspace.entryId +
      '/snapshot-flow/graphql',
    {
      headers,
      data: {
        name: 'Browser Content GraphQL client example',
        path,
        collectionVersion: 1,
        entryVersion: 1,
        rendererVersion: 0,
        fieldPath: ['body'],
      },
    },
  )
  expect(creation.status()).toBe(200)

  const flow = await creation.json()
  const flowPath = '/api/flows/' + flow.id
  const publication = await page.request.post(
    htmlPreviewOrigin + flowPath + '/publish',
    { headers, data: { revision: 1 } },
  )
  expect(publication.status()).toBe(200)

  await signInPreview(page, htmlWorkspace.owner)
  await page.locator('.api-list button').filter({ hasText: flow.name }).click()
  await expect(page.locator('.flow-card.cmsSnapshotResponse')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Fixed GraphQL schema', exact: true }),
  ).toHaveValue(flow.graphql.schema)

  const forbidden: string[] = []
  const onRequest = (request: Request) => {
    const url = new URL(request.url())
    if (
      /^\/(run|graphql)\//.test(url.pathname) ||
      /\/(?:test|graphql-test|openapi|backend-code|releases(?:\/\d+)?|rollback)$/.test(
        url.pathname,
      ) ||
      url.pathname.startsWith('/api/runtime-keys') ||
      url.pathname.startsWith('/api/collections/')
    )
      forbidden.push(request.method() + ' ' + url.pathname)
  }
  page.on('request', onRequest)

  try {
    // First new public behavior: sealed owners can open client examples.
    await expect(
      page.getByRole('button', { name: 'API tools', exact: true }),
    ).toBeEnabled()
    await openApiTools(page)
    await expect(
      page.getByRole('button', { name: 'Download OpenAPI', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Generated backend', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Release history', exact: true }),
    ).toHaveCount(0)

    const metadataReply = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === flowPath + '/client-code' &&
        response.request().method() === 'GET',
    )
    await page
      .getByRole('button', { name: 'Use this API', exact: true })
      .click()
    const metadataResponse = await metadataReply
    expect(metadataResponse.status()).toBe(200)

    const metadata = await metadataResponse.json()
    expect(metadata).toMatchObject({
      source: 'published',
      revision: 1,
      method: 'POST',
      path,
      graphql: { schema: flow.graphql.schema },
    })
    expect(JSON.stringify(metadata)).not.toContain('Saved heading ไทย')
    expect(JSON.stringify(metadata)).not.toContain(htmlWorkspace.owner)

    const panel = page.getByRole('region', {
      name: 'Use this API',
      exact: true,
    })
    await expect(
      panel.getByText('Published release · revision 1', { exact: true }),
    ).toBeVisible()
    await expect(
      panel.getByRole('combobox', { name: 'Example source', exact: true }),
    ).toHaveText('Published release')
    const operation = panel.getByLabel('Client GraphQL operation')
    await expect(operation).toHaveValue(/query ContentSnapshot/)
    await expect(operation).toHaveValue(/contentSnapshot/)
    await expect(operation).toHaveValue(/\.\.\. on CmsHeading/)
    await expect(operation).toHaveValue(/\.\.\. on CmsParagraph/)
    await expect(operation).toHaveValue(/\.\.\. on CmsText \{ text \}/)
    await expect(operation).toHaveValue(/html/)
    await expect(operation).toHaveValue(/entryVersion/)
    await expect(operation).toHaveValue(/rendererVersion/)
    await expect(operation).toHaveValue(/releaseRevision/)
    const query = await operation.inputValue()
    expect(query).not.toContain('Saved heading ไทย')
    expect(query).not.toContain(htmlWorkspace.owner)

    const generationReply = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === flowPath + '/client-code' &&
        response.request().method() === 'POST',
    )
    await panel
      .getByRole('button', { name: 'Generate example', exact: true })
      .click()
    const generationResponse = await generationReply
    expect(generationResponse.status()).toBe(200)
    expect(generationResponse.request().postDataJSON()).toMatchObject({
      target: 'javascript-fetch',
      source: 'published',
      revision: 1,
      request: { graphql: { query, variables: {} } },
    })

    const code = panel.getByLabel('Generated client code')
    await expect(code).toContainText('BESH_RUNTIME_API_KEY')
    await expect(code).toContainText('/graphql' + path)
    await expect(code).toContainText('CmsHeading')
    await expect(code).toContainText('CmsParagraph')
    await expect(code).toContainText('CmsText')
    await expect(code).not.toContainText('Saved heading ไทย')
    await expect(code).not.toContainText(htmlWorkspace.owner)
    await expect(
      panel.getByText(
        'Content calls require an owner-issued query runtime key for this API pinned to its current release.',
        { exact: true },
      ),
    ).toBeVisible()

    for (const name of ['Save draft', 'Add step', 'Test flow']) {
      await expect(
        page.getByRole('button', { name, exact: true }),
      ).toBeDisabled()
    }
    await expect(
      page.getByRole('textbox', { name: 'Fixed GraphQL schema', exact: true }),
    ).toHaveAttribute('readonly', '')
    expect(forbidden).toEqual([])
  } finally {
    page.off('request', onRequest)
  }
})

test('owner generates a sealed REST GET client example without a body or API invocation', async ({
  page,
  htmlWorkspace,
}) => {
  const headers = {
    origin: htmlPreviewOrigin,
    authorization: 'Bearer ' + htmlWorkspace.owner,
  }
  const path = '/browser-content-client-rest'
  const creation = await page.request.post(
    htmlPreviewOrigin +
      '/api/collections/' +
      htmlWorkspace.collectionId +
      '/entries/' +
      htmlWorkspace.entryId +
      '/snapshot-flow',
    {
      headers,
      data: {
        name: 'Browser Content REST client example',
        path,
        collectionVersion: 1,
        entryVersion: 1,
        rendererVersion: 0,
        fieldPath: ['body'],
      },
    },
  )
  expect(creation.status()).toBe(200)

  const flow = await creation.json()
  const flowPath = '/api/flows/' + flow.id
  const publication = await page.request.post(
    htmlPreviewOrigin + flowPath + '/publish',
    { headers, data: { revision: 1 } },
  )
  expect(publication.status()).toBe(200)

  await signInPreview(page, htmlWorkspace.owner)
  await page.locator('.api-list button').filter({ hasText: flow.name }).click()
  await expect(page.locator('.flow-card.cmsSnapshotResponse')).toBeVisible()

  const forbidden: string[] = []
  const onRequest = (request: Request) => {
    const url = new URL(request.url())
    if (
      /^\/(run|graphql)\//.test(url.pathname) ||
      /\/(?:test|graphql-test|openapi|backend-code|releases(?:\/\d+)?|rollback)$/.test(
        url.pathname,
      ) ||
      url.pathname.startsWith('/api/runtime-keys') ||
      url.pathname.startsWith('/api/collections/')
    )
      forbidden.push(request.method() + ' ' + url.pathname)
  }
  page.on('request', onRequest)

  try {
    await openApiTools(page)
    const metadataReply = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === flowPath + '/client-code' &&
        response.request().method() === 'GET',
    )
    await page
      .getByRole('button', { name: 'Use this API', exact: true })
      .click()
    const metadataResponse = await metadataReply
    expect(metadataResponse.status()).toBe(200)

    const metadata = await metadataResponse.json()
    expect(metadata).toMatchObject({
      source: 'published',
      revision: 1,
      method: 'GET',
      path,
      graphql: null,
      contract: null,
    })
    expect(JSON.stringify(metadata)).not.toContain('Saved heading ไทย')
    expect(JSON.stringify(metadata)).not.toContain(htmlWorkspace.owner)

    const panel = page.getByRole('region', {
      name: 'Use this API',
      exact: true,
    })
    await expect(
      panel.getByText('Published release · revision 1', { exact: true }),
    ).toBeVisible()
    await expect(panel.getByLabel('Client GraphQL operation')).toHaveCount(0)
    await expect(panel.getByLabel('Body value 1', { exact: true })).toHaveCount(
      0,
    )

    const generationReply = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === flowPath + '/client-code' &&
        response.request().method() === 'POST',
    )
    await panel
      .getByRole('button', { name: 'Generate example', exact: true })
      .click()
    const generationResponse = await generationReply
    expect(generationResponse.status()).toBe(200)

    const submitted = generationResponse.request().postDataJSON()
    expect(submitted).toMatchObject({
      target: 'javascript-fetch',
      source: 'published',
      revision: 1,
      request: { params: {}, query: {} },
    })
    expect(Object.hasOwn(submitted.request, 'body')).toBe(false)
    expect(Object.hasOwn(submitted.request, 'graphql')).toBe(false)

    const generated = await generationResponse.json()
    expect(generated).toMatchObject({
      method: 'GET',
      url: htmlPreviewOrigin + '/run' + path,
    })
    const code = panel.getByLabel('Generated client code')
    await expect(code).toContainText('BESH_RUNTIME_API_KEY')
    await expect(code).toContainText('/run' + path)
    await expect(code).not.toContainText('Saved heading ไทย')
    await expect(code).not.toContainText(htmlWorkspace.owner)
    await expect(
      panel.getByText(
        'Content calls require an owner-issued rest runtime key for this API pinned to its current release.',
        { exact: true },
      ),
    ).toBeVisible()

    for (const name of ['Save draft', 'Add step', 'Test flow']) {
      await expect(
        page.getByRole('button', { name, exact: true }),
      ).toBeDisabled()
    }
    for (const name of [
      'Download OpenAPI',
      'Generated backend',
      'Release history',
    ]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
        0,
      )
    }
    expect(forbidden).toEqual([])
  } finally {
    page.off('request', onRequest)
  }
})

test('owner copies and downloads all eight sealed Content client targets without API invocation', async ({
  page,
  htmlWorkspace,
}) => {
  await contentSnapshotClientCodePreviews({
    page,
    owner: htmlWorkspace.owner,
    apiOrigin: htmlPreviewOrigin,
    workspace: htmlWorkspace,
    capture: async () => {},
  })
})
