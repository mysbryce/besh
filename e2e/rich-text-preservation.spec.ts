import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'

test.use({ locale: 'en-US' })

test('editing an article title preserves empty paragraphs and nested list ownership', async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-rich-preservation-'))
  const origin = 'http://127.0.0.1:4390'
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const server = spawn('bun', ['src/index.ts'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4390',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: origin,
      BESH_ADMIN_TOKEN: owner,
      BESH_DATABASE_PATH: join(directory, 'control.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'secrets.key'),
      BESH_RUNTIME_CODE_DIR: join(directory, 'runtime'),
    },
  })
  const stopped = new Promise<void>((done) => {
    server.once('close', () => done())
    server.once('error', () => done())
  })
  const headers = { origin, authorization: 'Bearer ' + owner }

  try {
    await expect
      .poll(async () => {
        try {
          return (await page.request.get(origin + '/health')).status()
        } catch {
          return 0
        }
      })
      .toBe(200)

    const modelResponse = await page.request.post(origin + '/api/structs', {
      headers,
      data: {
        name: 'Preservation articles',
        fields: [
          {
            key: 'body',
            label: 'Body',
            required: true,
            schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
          },
        ],
      },
    })
    expect(modelResponse.status()).toBe(200)
    const model = await modelResponse.json()
    const collectionResponse = await page.request.post(
      origin + '/api/collections',
      {
        headers,
        data: {
          name: 'Preservation articles',
          structId: model.id,
          structVersion: 1,
        },
      },
    )
    expect(collectionResponse.status()).toBe(200)
    const collection = await collectionResponse.json()
    const list = {
      type: 'list',
      ordered: false,
      start: 1,
      children: [
        {
          type: 'listItem',
          children: [
            { type: 'paragraph', children: [] },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Later paragraph', marks: [] }],
            },
          ],
        },
        {
          type: 'listItem',
          children: [
            { type: 'paragraph', children: [] },
            {
              type: 'list',
              ordered: false,
              start: 1,
              children: [
                {
                  type: 'listItem',
                  children: [
                    {
                      type: 'paragraph',
                      children: [
                        { type: 'text', text: 'Owned nested item', marks: [] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const links = {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'Before ', marks: ['italic', 'bold'] },
        { type: 'link', url: 'https://example.com/empty', children: [] },
        {
          type: 'link',
          url: 'https://example.com/guide',
          children: [{ type: 'text', text: 'Left', marks: [] }],
        },
        {
          type: 'link',
          url: 'https://example.com/guide',
          children: [{ type: 'text', text: 'Right', marks: [] }],
        },
        { type: 'text', text: ' After', marks: [] },
      ],
    }
    const firstNumberedList = {
      type: 'list',
      ordered: true,
      start: 1,
      children: [
        {
          type: 'listItem',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'First numbered item', marks: [] },
              ],
            },
          ],
        },
      ],
    }
    const restartedNumberedList = {
      type: 'list',
      ordered: true,
      start: 20,
      children: [
        {
          type: 'listItem',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Restart at twenty', marks: [] },
              ],
            },
          ],
        },
      ],
    }
    const emptyList = {
      type: 'list',
      ordered: false,
      start: 1,
      children: [],
    }
    const table = {
      type: 'table',
      children: [
        {
          type: 'tableRow',
          children: [
            {
              type: 'tableCell',
              header: true,
              children: [
                { type: 'paragraph', children: [] },
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '', marks: ['underline'] }],
                },
              ],
            },
            {
              type: 'tableCell',
              header: false,
              children: [links],
            },
          ],
        },
      ],
    }
    const quote = {
      type: 'quote',
      children: [
        { type: 'paragraph', children: [] },
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Keep', marks: [] },
            { type: 'lineBreak' },
            { type: 'text', text: ' boundaries ', marks: [] },
          ],
        },
      ],
    }
    const literalCode = {
      type: 'code',
      language: 'plaintext',
      text: 'first\r\n\r\n  last\tend',
    }
    const emptyCode = { type: 'code', language: 'javascript', text: '' }
    const divider = { type: 'horizontalRule' }
    const body = {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Original title', marks: [] }],
        },
        list,
        links,
        firstNumberedList,
        restartedNumberedList,
        emptyList,
        table,
        quote,
        literalCode,
        emptyCode,
        divider,
      ],
    }
    const entries = origin + '/api/collections/' + collection.id + '/entries'
    const entryResponse = await page.request.post(entries, {
      headers,
      data: { data: { body } },
    })
    expect(entryResponse.status()).toBe(200)
    const saved = await entryResponse.json()

    await page.goto(origin)
    await page.getByLabel('Workspace token', { exact: true }).fill(owner)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page.getByRole('button', { name: 'Content', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Choose a collection', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Preservation articles', exact: true })
      .click()
    await page.getByRole('button', { name: new RegExp(saved.id) }).click()
    await page.getByRole('button', { name: 'Edit entry', exact: true }).click()

    const editor = page.getByRole('textbox', { name: 'Body', exact: true })
    const title = editor.locator(':scope > p').first()
    await expect(title).toHaveText('Original title')
    await title.click()
    await editor.press('Home')
    await editor.press('Shift+End')
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('Original title')
    await page.keyboard.insertText('Updated title')
    await expect(title).toHaveText('Updated title')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(title).toHaveText('Original title')
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(title).toHaveText('Updated title')

    const detail = entries + '/' + saved.id
    const reply = page.waitForResponse(
      (response) =>
        response.url() === detail && response.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: 'Save entry', exact: true }).click()
    const changedResponse = await reply
    expect(changedResponse.status()).toBe(200)
    const expected = {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Updated title', marks: [] }],
        },
        list,
        links,
        firstNumberedList,
        restartedNumberedList,
        emptyList,
        table,
        quote,
        literalCode,
        emptyCode,
        divider,
      ],
    }
    expect(changedResponse.request().postDataJSON()).toEqual({
      version: 1,
      data: { body: expected },
    })
    expect((await changedResponse.json()).data).toEqual({ body: expected })
    const read = await page.request.get(detail, { headers })
    expect(read.status()).toBe(200)
    expect((await read.json()).data).toEqual({ body: expected })

    const boundedBody = {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Full document', marks: [] }],
        },
        ...Array.from({ length: 125 }, () => ({
          type: 'paragraph',
          children: [],
        })),
      ],
    }
    const boundedResponse = await page.request.post(entries, {
      headers,
      data: { data: { body: boundedBody } },
    })
    expect(boundedResponse.status()).toBe(200)
    const boundedEntry = await boundedResponse.json()
    const refreshedEntries = page.waitForResponse((response) =>
      response.url().startsWith(entries + '?'),
    )
    await page
      .getByRole('button', { name: 'Refresh entries', exact: true })
      .click()
    expect((await refreshedEntries).status()).toBe(200)
    await page
      .getByRole('button', { name: new RegExp(boundedEntry.id) })
      .click()
    await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
    await expect(editor.locator(':scope > p')).toHaveCount(126)
    await editor.locator(':scope > p').first().click()
    await page
      .getByRole('button', { name: 'Insert table', exact: true })
      .click()
    await expect(editor.locator('table')).toHaveCount(0)
    await expect(
      page.getByText(
        'This document cannot fit a table. Remove some content first.',
        { exact: true },
      ),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Insert divider', exact: true })
      .click()
    await expect(editor.locator('hr')).toHaveCount(0)
    await expect(
      page.getByText(
        'This document cannot fit a divider. Remove some content first.',
        { exact: true },
      ),
    ).toBeVisible()
    await page
      .getByRole('combobox', { name: 'Body block style', exact: true })
      .click()
    await page.getByRole('option', { name: 'Quote', exact: true }).click()
    await expect(editor.locator('blockquote')).toHaveCount(0)
    await expect(
      page.getByText(
        'This document cannot fit a quote. Remove some content first.',
        { exact: true },
      ),
    ).toBeVisible()
    await page
      .getByRole('combobox', { name: 'Body block style', exact: true })
      .click()
    await page.getByRole('option', { name: 'Bullet list', exact: true }).click()
    await expect(editor.locator('ul')).toHaveCount(0)
    await expect(
      page.getByText(
        'This document cannot fit a list. Remove some content first.',
        { exact: true },
      ),
    ).toBeVisible()
    await page
      .getByRole('combobox', { name: 'Body block style', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Numbered list', exact: true })
      .click()
    await expect(editor.locator('ol')).toHaveCount(0)
    await expect(editor.locator(':scope > p')).toHaveCount(126)
    await expect(editor.locator(':scope > p').first()).toHaveText(
      'Full document',
    )
    await expect(
      page.getByRole('button', { name: 'Save entry', exact: true }),
    ).toBeDisabled()

    const boundedTitle = editor.locator(':scope > p').first()
    await boundedTitle.click()
    await editor.press('Home')
    await editor.press('Shift+End')
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('Full document')
    await editor.pressSequentially('Updated full document')
    const updatedBoundedBody = {
      ...boundedBody,
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Updated full document', marks: [] },
          ],
        },
        ...boundedBody.children.slice(1),
      ],
    }

    const boundedDetail = entries + '/' + boundedEntry.id
    const boundedReply = page.waitForResponse(
      (response) =>
        response.url() === boundedDetail &&
        response.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: 'Save entry', exact: true }).click()
    const unchangedResponse = await boundedReply
    expect(unchangedResponse.status()).toBe(200)
    expect(unchangedResponse.request().postDataJSON()).toEqual({
      version: 1,
      data: { body: updatedBoundedBody },
    })
    expect((await unchangedResponse.json()).data).toEqual({
      body: updatedBoundedBody,
    })
  } finally {
    await page.close()
    server.kill()
    await stopped

    const target = resolve(directory)
    if (
      !target
        .toLowerCase()
        .startsWith((resolve(tmpdir()) + sep).toLowerCase()) ||
      !basename(target).startsWith('besh-rich-preservation-')
    )
      throw new Error(
        'Rich-text preservation cleanup must stay inside its temporary root',
      )

    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    })
  }
})
