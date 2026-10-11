import { expect, test } from 'bun:test'
import {
  json,
  withPortablePublication,
  type PortablePublicWorkspace,
} from './portable-publication-fixture'

// Install one named public tracer at a time. These tests use the executable's
// actual management API, trusted publication and network listeners. The source
// harness provisions only first-run workspace auth before artifact launch.

type Protocol = 'rest' | 'graphql' | 'websocket'

function same(left: unknown, right: unknown): boolean {
  const ordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(ordered)
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, ordered(item)]),
      )
    return value
  }
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right))
}

const fields = {
  type: 'object',
  properties: {
    message: { type: 'string', maxLength: 128 },
    accepted: { type: 'boolean' },
  },
  required: ['message', 'accepted'],
  additionalProperties: false,
}

function definition(protocol: Protocol, draft = false) {
  const body =
    protocol === 'websocket'
      ? draft
        ? { message: 'Save draft', accepted: true }
        : '$input.body'
      : protocol === 'graphql'
        ? {
            message: draft ? 'Save draft' : 'Publish',
            name: '$input.body.name',
          }
        : { message: draft ? 'Save draft' : 'Publish', name: 'Save draft' }
  return {
    name: 'Save draft',
    method: protocol === 'websocket' ? 'GET' : 'POST',
    path: '/v1/Members',
    ...(protocol === 'graphql'
      ? {
          graphql: {
            schema:
              'type Query { greet(name: String!): Greeting! } type Greeting { message: String! name: String! }',
          },
        }
      : {}),
    ...(protocol === 'websocket'
      ? {
          websocket: {
            input: fields,
            output: fields,
            allowedOrigins: ['https://product.example'],
          },
        }
      : {}),
    nodes: [
      {
        id: 'request',
        type: 'request',
        position: { x: 80, y: 100 },
        config: {},
      },
      {
        id: 'response',
        type: 'response',
        position: { x: 400, y: 100 },
        config: { status: 200, body },
      },
    ],
    edges: [{ id: 'one', source: 'request', target: 'response' }],
  }
}

async function publicObject(response: Response) {
  expect(response.status).toBe(200)
  return await json(response)
}

async function status(response: Response, expected: number) {
  expect(response.status).toBe(expected)
  await response.body?.cancel()
}

async function saved(
  workspace: PortablePublicWorkspace,
  id: string,
  protocol: Protocol,
  isDraft: boolean,
) {
  const detail = await publicObject(await workspace.api(`/api/flows/${id}`))
  const expected = definition(protocol, isDraft)
  expect(
    detail.name === expected.name &&
      detail.path === expected.path &&
      detail.method === expected.method &&
      same(detail.nodes, expected.nodes) &&
      same(detail.edges, expected.edges) &&
      same(detail.graphql, expected.graphql) &&
      same(detail.websocket, expected.websocket),
  ).toBe(true)
  expect(detail.revision === (isDraft ? 2 : 1)).toBe(true)
  if (isDraft) {
    expect(detail.publishedRevision === 1).toBe(true)
    expect(
      JSON.stringify(detail.publishedEndpoint) ===
        JSON.stringify({
          method: expected.method,
          path: expected.path,
          graphql: protocol === 'graphql',
          transport: protocol,
        }),
    ).toBe(true)
    const release = await publicObject(
      await workspace.api(`/api/flows/${id}/releases/1`),
    )
    expect(release.revision === 1 && release.current === true).toBe(true)
    expect(same(release.definition, definition(protocol))).toBe(true)
  } else expect(detail.publishedRevision === null).toBe(true)
}

const operation = {
  query:
    'query Greeting($name: String!) { greet(name: $name) { message name } }',
  variables: { name: 'Save draft' },
}

async function websocketReply(origin: string, token: string, allowed = true) {
  const NativeWebSocket = WebSocket as typeof WebSocket & {
    new (url: string, options: Bun.WebSocketOptions): WebSocket
  }
  const url = new URL('/ws/v1/Members', origin)
  url.protocol = 'ws:'
  const socket = new NativeWebSocket(url.href, {
    headers: { authorization: `Bearer ${token}` },
  })
  const closed = new Promise<void>((done) =>
    socket.addEventListener('close', () => done(), { once: true }),
  )
  const opening = new Promise<boolean>((done, fail) => {
    const timer = setTimeout(
      () => fail(new Error('Compiled WebSocket upgrade timed out')),
      5_000,
    )
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer)
        done(true)
      },
      { once: true },
    )
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        done(false)
      },
      { once: true },
    )
  })
  try {
    expect(await opening).toBe(allowed)
    if (!allowed) return
    const reply = new Promise<unknown>((done, fail) => {
      const timer = setTimeout(
        () => fail(new Error('Compiled WebSocket reply timed out')),
        5_000,
      )
      socket.addEventListener(
        'message',
        (event) => {
          clearTimeout(timer)
          try {
            const text = String(event.data)
            if (Buffer.byteLength(text) > 65_536)
              throw new Error('Reply bound exceeded')
            done(JSON.parse(text))
          } catch {
            fail(new Error('Compiled WebSocket reply was not bounded JSON'))
          }
        },
        { once: true },
      )
    })
    socket.send(
      JSON.stringify({
        id: 'portable-1',
        body: { message: 'Publish', accepted: true },
      }),
    )
    expect(
      JSON.stringify(await reply) ===
        JSON.stringify({
          id: 'portable-1',
          result: { message: 'Publish', accepted: true },
        }),
    ).toBe(true)
  } finally {
    socket.close()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        closed,
        new Promise<never>((_, fail) => {
          timer = setTimeout(
            () => fail(new Error('Owned WebSocket did not close')),
            5_000,
          )
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }
}

async function exercise(protocol: Protocol) {
  await withPortablePublication(async (workspace) => {
    const created = await publicObject(
      await workspace.api('/api/flows', 'POST', definition(protocol)),
    )
    if (typeof created.id !== 'string' || !created.id)
      throw new Error('Compiled management API did not return a flow identity')
    const id = created.id
    await saved(workspace, id, protocol, false)
    await status(
      await workspace.api(`/api/flows/${id}`, 'GET', undefined, ''),
      401,
    )
    const publication = await publicObject(
      await workspace.api(`/api/flows/${id}/publish`, 'POST', { revision: 1 }),
    )
    expect(publication.publishedRevision === 1).toBe(true)
    const permissions = [
      protocol === 'websocket'
        ? 'ws'
        : protocol === 'graphql'
          ? 'query'
          : 'rest',
    ]
    const receipt = await publicObject(
      await workspace.api('/api/runtime-keys', 'POST', {
        name: 'Portable published caller',
        flowId: id,
        permissions,
        releaseRevision: 1,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      }),
    )
    if (typeof receipt.token !== 'string' || receipt.token.length < 32)
      throw new Error('Compiled API did not issue a runtime credential')
    const token = receipt.token
    workspace.remember(token)
    receipt.token = undefined
    await status(
      await workspace.api(`/api/flows/${id}`, 'GET', undefined, token),
      401,
    )

    // The saved draft advances without replacing the trusted live release.
    await publicObject(
      await workspace.api(`/api/flows/${id}`, 'PUT', {
        ...definition(protocol, true),
        revision: 1,
      }),
    )
    const assertLive = async () => {
      await saved(workspace, id, protocol, true)
      if (protocol === 'websocket') {
        await websocketReply(workspace.origin(), workspace.owner, false)
        await websocketReply(workspace.origin(), token)
        await status(
          await workspace.api(
            `/api/flows/${id}/graphql/test`,
            'POST',
            operation,
          ),
          400,
        )
        await status(
          await workspace.api(`/api/flows/${id}/test`, 'POST', {
            body: {},
            query: {},
          }),
          400,
        )
      } else if (protocol === 'graphql') {
        const live = await publicObject(
          await workspace.api('/graphql/v1/Members', 'POST', operation, token),
        )
        expect(
          JSON.stringify(live) ===
            JSON.stringify({
              data: { greet: { message: 'Publish', name: 'Save draft' } },
            }),
        ).toBe(true)
        await status(
          await workspace.api(
            '/graphql/v1/Members',
            'POST',
            operation,
            workspace.owner,
          ),
          401,
        )
        await status(
          await workspace.api('/graphql/v1/Members', 'GET', undefined, token),
          405,
        )
        const draft = await publicObject(
          await workspace.api(
            `/api/flows/${id}/graphql/test`,
            'POST',
            operation,
          ),
        )
        expect(
          JSON.stringify(draft.body) ===
            JSON.stringify({
              data: { greet: { message: 'Save draft', name: 'Save draft' } },
            }),
        ).toBe(true)
      } else {
        const live = await publicObject(
          await workspace.api('/run/v1/Members', 'POST', {}, token),
        )
        expect(
          JSON.stringify(live) ===
            JSON.stringify({ message: 'Publish', name: 'Save draft' }),
        ).toBe(true)
        await status(
          await workspace.api('/run/v1/Members', 'POST', {}, workspace.owner),
          401,
        )
        const draft = await publicObject(
          await workspace.api(`/api/flows/${id}/test`, 'POST', {
            body: {},
            query: {},
          }),
        )
        expect(
          JSON.stringify(draft.body) ===
            JSON.stringify({ message: 'Save draft', name: 'Save draft' }),
        ).toBe(true)
      }
    }
    await assertLive()
    await workspace.restart()
    await assertLive()
  })
}

test(
  'portable REST publication survives restart with authored draft distinct from live route',
  () => exercise('rest'),
  90_000,
)

test(
  'portable GraphQL publication survives restart with actual schema execution and query scope',
  () => exercise('graphql'),
  90_000,
)

test(
  'portable WebSocket publication survives restart with pinned typed request reply',
  () => exercise('websocket'),
  90_000,
)

test(
  'portable sealed GraphQL publishes literal typed content and survives source deletion and restart',
  () =>
    withPortablePublication(async (workspace) => {
      const model = await publicObject(
        await workspace.api('/api/structs', 'POST', {
          name: 'Portable GraphQL content model',
          fields: [
            {
              key: 'body',
              label: 'Body',
              required: true,
              schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
            },
          ],
        }),
      )
      const collection = await publicObject(
        await workspace.api('/api/collections', 'POST', {
          name: 'Portable GraphQL articles',
          structId: model.id,
          structVersion: model.version,
        }),
      )
      const document = {
        type: 'document',
        astVersion: 2,
        children: [
          {
            type: 'heading',
            level: 2,
            children: [
              {
                type: 'text',
                text: '  $input.body.secret <b>ไทย</b>  ',
                marks: ['italic', 'bold'],
              },
            ],
          },
        ],
      }
      const entriesPath = '/api/collections/' + collection.id + '/entries'
      const entry = await publicObject(
        await workspace.api(entriesPath, 'POST', {
          data: { body: document },
        }),
      )
      const flow = await publicObject(
        await workspace.api(
          entriesPath + '/' + entry.id + '/snapshot-flow/graphql',
          'POST',
          {
            name: 'Portable typed content query',
            path: '/portable-sealed-graphql',
            collectionVersion: collection.version,
            entryVersion: entry.version,
            rendererVersion: 0,
            fieldPath: ['body'],
          },
        ),
      )
      expect(flow.method).toBe('POST')
      expect(flow.publishedRevision).toBeNull()
      expect(flow.graphql).toMatchObject({
        schema: expect.stringContaining('contentSnapshot: CmsContentSnapshot!'),
      })

      const published = await publicObject(
        await workspace.api('/api/flows/' + flow.id + '/publish', 'POST', {
          revision: 1,
        }),
      )
      expect(published.publishedEndpoint).toEqual({
        method: 'POST',
        path: '/portable-sealed-graphql',
        graphql: true,
        transport: 'graphql',
      })
      const code = await publicObject(
        await workspace.api('/api/flows/' + flow.id + '/backend-code'),
      )
      expect(code.compilerVersion).toBe(4)
      expect(code.code).toEqual(
        expect.stringContaining(
          "app.route('POST', '/graphql/portable-sealed-graphql'",
        ),
      )
      expect(code.code).not.toEqual(
        expect.stringContaining('$input.body.secret <b>ไทย</b>'),
      )

      const caller = await publicObject(
        await workspace.api('/api/runtime-keys', 'POST', {
          name: 'Portable sealed content reader',
          flowId: flow.id,
          releaseRevision: 1,
          permissions: ['query'],
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        }),
      )
      if (typeof caller.token !== 'string' || caller.token.length < 32)
        throw new Error(
          'Compiled sealed query did not issue a valid caller proof',
        )

      const token = caller.token
      workspace.remember(token)
      expect(caller.issuerBinding).toEqual({
        memberId: 'owner',
        action: 'runtime-keys.manage',
      })
      const operation = {
        query: `{
      contentSnapshot {
        document { type astVersion children {
          ... on CmsHeading { type level children { ... on CmsText { type text marks } } }
        } }
        html
        provenance { entryVersion rendererVersion releaseRevision }
      }
    }`,
      }
      const expected = {
        data: {
          contentSnapshot: {
            document: {
              type: 'document',
              astVersion: 2,
              children: [
                {
                  type: 'heading',
                  level: 2,
                  children: [
                    {
                      type: 'text',
                      text: '  $input.body.secret <b>ไทย</b>  ',
                      marks: ['italic', 'bold'],
                    },
                  ],
                },
              ],
            },
            html: '<h2><em><strong>  $input.body.secret &lt;b&gt;ไทย&lt;/b&gt;  </strong></em></h2>',
            provenance: {
              entryVersion: '1',
              rendererVersion: '0',
              releaseRevision: '1',
            },
          },
        },
      }
      async function live() {
        expect(
          await publicObject(
            await workspace.api(
              '/graphql/portable-sealed-graphql',
              'POST',
              operation,
              token,
            ),
          ),
        ).toEqual(expected)
        await status(
          await workspace.api(
            '/graphql/portable-sealed-graphql',
            'POST',
            operation,
            workspace.owner,
          ),
          401,
        )
        expect(
          await publicObject(
            await workspace.api('/api/flows/' + flow.id + '/backend-code'),
          ),
        ).toEqual(code)
      }

      await live()
      await status(
        await workspace.api(entriesPath + '/' + entry.id, 'DELETE', {
          version: 1,
        }),
        200,
      )
      await live()
      await workspace.restart()
      await live()
    }),
  90_000,
)
