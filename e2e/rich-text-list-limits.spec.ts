import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'

test.use({ locale: 'en-US' })

const originalTitle = {
  type: 'paragraph',
  children: [{ type: 'text', text: 'Original title', marks: [] }],
}
const updatedTitle = {
  type: 'paragraph',
  children: [{ type: 'text', text: 'Updated title', marks: [] }],
}
const flatList = {
  type: 'list',
  ordered: false,
  start: 1,
  children: [
    {
      type: 'listItem',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'First item', marks: [] }],
        },
      ],
    },
    {
      type: 'listItem',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Second item', marks: [] }],
        },
      ],
    },
  ],
}
const nestedList = {
  type: 'list',
  ordered: false,
  start: 1,
  children: [
    {
      type: 'listItem',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Outer owner', marks: [] }],
        },
        flatList,
      ],
    },
  ],
}
const emptyParagraphs = Array.from({ length: 118 }, () => ({
  type: 'paragraph',
  children: [],
}))

// Root 1 + list 1 + two items/paragraphs/texts 6 + title 2 + empty paragraphs 118.
const fixtures = [
  {
    name: 'node limit',
    list: flatList,
    trailing: emptyParagraphs,
    items: ':scope > ul > li',
    nestedLists: 0,
  },
  {
    name: 'depth limit',
    list: nestedList,
    trailing: [],
    items: 'ul ul > li',
    nestedLists: 1,
  },
]

for (const fixture of fixtures) {
  test(`refused list indentation at the ${fixture.name} preserves saved ownership and clean state`, async ({
    page,
  }) => {
    const prefix = 'besh-rich-list-limits-'
    const directory = mkdtempSync(join(tmpdir(), prefix))
    const origin = 'http://127.0.0.1:4394'
    const owner = crypto.randomUUID() + crypto.randomUUID()
    const headers = { origin, authorization: 'Bearer ' + owner }
    const errors: string[] = []
    const body = {
      type: 'document',
      astVersion: 2,
      children: [originalTitle, fixture.list, ...fixture.trailing],
    }

    page.on('pageerror', (error) => errors.push(error.message))

    const server = spawn('bun', ['src/index.ts'], {
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: '4394',
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
          name: 'Bounded articles',
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
            name: 'Bounded articles',
            structId: model.id,
            structVersion: 1,
          },
        },
      )
      expect(collectionResponse.status()).toBe(200)
      const collection = await collectionResponse.json()
      const entries = origin + '/api/collections/' + collection.id + '/entries'
      const savedResponse = await page.request.post(entries, {
        headers,
        data: { data: { body } },
      })
      expect(savedResponse.status()).toBe(200)
      const saved = await savedResponse.json()
      expect(saved.data).toEqual({ body })

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
        .getByRole('option', { name: 'Bounded articles', exact: true })
        .click()
      await page.getByRole('button', { name: new RegExp(saved.id) }).click()
      await page
        .getByRole('button', { name: 'Edit entry', exact: true })
        .click()

      const editor = page.getByRole('textbox', { name: 'Body', exact: true })
      const items = editor.locator(fixture.items)
      const save = page.getByRole('button', { name: 'Save entry', exact: true })
      const undo = page.getByRole('button', { name: 'Undo', exact: true })

      await expect(items).toHaveText(['First item', 'Second item'])
      await expect(editor.locator('ul ul')).toHaveCount(fixture.nestedLists)
      await expect(save).toBeDisabled()
      await expect(undo).toBeDisabled()
      await items.last().click()
      await expect(
        page.getByRole('button', { name: 'Indent list', exact: true }),
      ).toBeEnabled()
      await page
        .getByRole('button', { name: 'Indent list', exact: true })
        .click()

      await expect(
        page.getByText('This list item cannot be nested further.', {
          exact: true,
        }),
      ).toBeVisible()
      await expect(items).toHaveText(['First item', 'Second item'])
      await expect(editor.locator('ul ul')).toHaveCount(fixture.nestedLists)
      await expect(editor.locator('ul ul ul')).toHaveCount(0)
      await expect(save).toBeDisabled()
      await expect(undo).toBeDisabled()

      const title = editor.locator(':scope > p').first()
      await title.click()
      await editor.press('Home')
      await editor.press('Shift+End')
      await expect
        .poll(() => page.evaluate(() => window.getSelection()?.toString()))
        .toBe('Original title')
      await page.keyboard.insertText('Updated title')
      await expect(title).toHaveText('Updated title')
      await expect(save).toBeEnabled()

      const detail = entries + '/' + saved.id
      const reply = page.waitForResponse(
        (response) =>
          response.url() === detail && response.request().method() === 'PUT',
      )
      await save.click()

      const changed = await reply
      const expected = {
        type: 'document',
        astVersion: 2,
        children: [updatedTitle, fixture.list, ...fixture.trailing],
      }
      expect(changed.status()).toBe(200)
      expect(changed.request().postDataJSON()).toEqual({
        version: 1,
        data: { body: expected },
      })
      expect((await changed.json()).data).toEqual({ body: expected })

      const read = await page.request.get(detail, { headers })
      expect(read.status()).toBe(200)
      expect((await read.json()).data).toEqual({ body: expected })
      expect(errors).toEqual([])
    } finally {
      await page.close()
      server.kill()
      await stopped

      const target = resolve(directory)
      const parent = resolve(tmpdir()) + sep
      if (
        !target.toLowerCase().startsWith(parent.toLowerCase()) ||
        !basename(target).startsWith(prefix)
      ) {
        throw new Error(
          'Rich-text list-limit cleanup must stay inside its temporary root',
        )
      }

      rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      })
    }
  })
}
