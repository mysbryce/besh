import { expect, type Page } from '@playwright/test'

export type HtmlPreviewWorkspace = {
  owner: string
  collectionName: string
  collectionId: string
  structId: string
  entryId: string
  title: string
}

export async function seedHtmlPreviewWorkspace(
  page: Page,
  origin: string,
  owner: string,
): Promise<HtmlPreviewWorkspace> {
  const headers = {
    origin,
    authorization: 'Bearer ' + owner,
  }

  const modelResponse = await page.request.post(origin + '/api/structs', {
    headers,
    data: {
      name: 'HTML review model ไทย',
      fields: [
        {
          key: 'title',
          label: 'Title',
          required: true,
          schema: { type: 'text' },
        },
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
        {
          key: 'details',
          label: 'Details',
          required: true,
          schema: {
            type: 'object',
            fields: [
              {
                key: 'sections',
                label: 'Sections',
                required: true,
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    fields: [
                      {
                        key: 'body',
                        label: 'Body',
                        required: true,
                        schema: {
                          type: 'richText',
                          schemaVersion: 2,
                          astVersion: 2,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    },
  })
  expect(modelResponse.status()).toBe(200)

  const model = await modelResponse.json()
  const collectionName = 'Private HTML articles ไทย'
  const collectionResponse = await page.request.post(
    origin + '/api/collections',
    {
      headers,
      data: {
        name: collectionName,
        structId: model.id,
        structVersion: model.version,
      },
    },
  )
  expect(collectionResponse.status()).toBe(200)

  const collection = await collectionResponse.json()
  const title = '  Preview <script>literal</script> ไทย  '
  const data = {
    title,
    body: {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'heading',
          level: 1,
          children: [{ type: 'text', text: 'Saved heading ไทย', marks: [] }],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: '<script>literal</script> & text ',
              marks: [],
            },
            {
              type: 'link',
              url: 'https://example.invalid/preview?note=a&tag=b',
              children: [{ type: 'text', text: 'Open article', marks: [] }],
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
    details: {
      sections: [
        'First nested ไทย',
        '  Second nested <p>literal</p> & ไทย  ',
      ].map((text) => ({
        body: {
          type: 'document',
          astVersion: 2,
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text, marks: [] }],
            },
          ],
        },
      })),
    },
  }
  const entries = origin + '/api/collections/' + collection.id + '/entries'
  const entryResponse = await page.request.post(entries, {
    headers,
    data: { data },
  })
  expect(entryResponse.status()).toBe(200)

  const entry = await entryResponse.json()
  const savedResponse = await page.request.get(entries + '/' + entry.id, {
    headers,
  })
  expect(savedResponse.status()).toBe(200)

  const saved = await savedResponse.json()
  expect(saved.version).toBe(1)
  expect(saved.data).toEqual(data)

  return {
    owner,
    collectionName,
    collectionId: collection.id,
    structId: model.id,
    entryId: saved.id,
    title,
  }
}
