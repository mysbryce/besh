import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, type AppOptions } from '../src/app'
import { helloFlow, graphqlFlow } from './fixtures'

const owner = 'release-pin-disposable-owner-key-at-least32'
const disposals: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of disposals.splice(0).reverse()) await dispose()
})

function workspace(extra: Partial<AppOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-release-pins-'))
  const options = {
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    ...extra,
  }
  const server = createApp(options)
  disposals.push(async () => {
    if (server.app.server) await server.app.stop()
    await server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined || body instanceof FormData
            ? {}
            : { 'content-type': 'application/json' }),
        },
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
      }),
    )
  return { directory, options, server, request }
}

async function published(
  request: ReturnType<typeof workspace>['request'],
  definition = helloFlow,
) {
  const response = await request('/api/flows', 'POST', definition)
  expect(response.status).toBe(200)
  const flow = await response.json()
  expect(
    (
      await request(`/api/flows/${flow.id}/publish`, 'POST', {
        revision: flow.revision,
      })
    ).status,
  ).toBe(200)
  return flow
}

function keyInput(flowId: string, releaseRevision?: number) {
  return {
    name: 'Caller',
    flowId,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    ...(releaseRevision === undefined ? {} : { releaseRevision }),
  }
}

test('runtime key issuance rejects an expiry that passes while waiting for a database write lock', async () => {
  const { request, directory, options } = workspace()
  const flow = await published(request)
  const audit = await (await request('/api/audit')).json()
  const workerPath = join(directory, 'write-lock.ts')
  writeFileSync(
    workerPath,
    `import { Database } from 'bun:sqlite'

const database = new Database(process.argv[2])
database.exec('BEGIN IMMEDIATE')
console.log('ready')
await Bun.sleep(1600)
database.exec('COMMIT')
database.close()
`,
  )
  const child = Bun.spawn(
    [process.execPath, '--no-env-file', workerPath, options.databasePath],
    { stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' },
  )
  const reader = child.stdout.getReader()
  try {
    const ready = await reader.read()
    expect(new TextDecoder().decode(ready.value).trim()).toBe('ready')
    const response = await request('/api/runtime-keys', 'POST', {
      ...keyInput(flow.id, 1),
      expiresAt: new Date(Date.now() + 600).toISOString(),
    })
    expect(response.status).toBe(400)
    expect(await (await request('/api/runtime-keys')).json()).toEqual([])
    expect(await (await request('/api/audit')).json()).toEqual(audit)
    expect(await child.exited).toBe(0)
  } finally {
    child.kill()
    await child.exited
    await reader.cancel()
    reader.releaseLock()
  }
})

test('runtime keys optionally pin the live published revision while omitted pins remain explicit follow keys', async () => {
  const { request } = workspace()
  const flow = await published(request)
  const pinned = await request(
    '/api/runtime-keys',
    'POST',
    keyInput(flow.id, 1),
  )
  expect(pinned.status).toBe(200)
  const pin = await pinned.json()
  expect(pin.releaseRevision).toBe(1)
  const follow = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id))
  ).json()
  expect(follow.releaseRevision).toBeNull()
  expect(
    (await request('/run/hello', 'GET', undefined, pin.token)).status,
  ).toBe(200)
  const keys = await (await request('/api/runtime-keys')).json()
  expect(
    keys.map((key: { releaseRevision: number | null }) => key.releaseRevision),
  ).toEqual([null, 1])
  expect(JSON.stringify(keys)).not.toContain(pin.token)
})

test('pinned REST keys become dormant before input validation and rollback reactivates the exact revision', async () => {
  const { request } = workspace()
  const definition = { ...helloFlow, path: '/v1/users/:id' }
  const flow = await published(request, definition)
  const pin = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id, 1))
  ).json()
  const follow = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id))
  ).json()
  const changed = {
    ...definition,
    contract: {
      query: {
        type: 'object',
        properties: { count: { type: 'integer' } },
        required: ['count'],
      },
    },
    nodes: [
      definition.nodes[0],
      {
        ...definition.nodes[1],
        config: { status: 200, body: { message: 'release two' } },
      },
    ],
  }
  await request(`/api/flows/${flow.id}`, 'PUT', { ...changed, revision: 1 })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  expect(
    (
      await request(
        '/run/v1/users/%E6%9D%B1%E4%BA%AC',
        'GET',
        undefined,
        pin.token,
      )
    ).status,
  ).toBe(403)
  expect(
    await (
      await request('/run/v1/users/id?count=2', 'GET', undefined, follow.token)
    ).json(),
  ).toEqual({ message: 'release two' })
  expect(
    (await request('/run/v1/users/id', 'GET', undefined, follow.token)).status,
  ).toBe(400)
  expect(
    (
      await request(`/api/flows/${flow.id}/rollback`, 'POST', {
        revision: 1,
        publishedRevision: 2,
      })
    ).status,
  ).toBe(200)
  expect(
    await (
      await request('/run/v1/users/id', 'GET', undefined, pin.token)
    ).json(),
  ).toEqual({ message: 'Hello, Besh!' })
  expect(
    (await request('/run/v1/users/id', 'GET', undefined, follow.token)).status,
  ).toBe(200)
})

test('invalid and stale pins cannot create credentials or creation audits, including concurrent publication', async () => {
  const { request, options } = workspace()
  const flow = await published(request)
  const before = await (await request('/api/audit')).json()
  for (const releaseRevision of [
    null,
    '1',
    true,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    expect(
      (
        await request('/api/runtime-keys', 'POST', {
          ...keyInput(flow.id),
          releaseRevision,
        })
      ).status,
    ).toBe(400)
  expect(
    (await request('/api/runtime-keys', 'POST', keyInput(flow.id, 2))).status,
  ).toBe(409)
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
  expect(await (await request('/api/audit')).json()).toEqual(before)
  const draft = await (
    await request('/api/flows', 'POST', { ...helloFlow, path: '/unpublished' })
  ).json()
  expect(
    (await request('/api/runtime-keys', 'POST', keyInput(draft.id, 1))).status,
  ).toBe(409)
  expect(
    (await request('/api/runtime-keys', 'POST', keyInput(draft.id))).status,
  ).toBe(400)
  await request(`/api/flows/${flow.id}`, 'PUT', { ...helloFlow, revision: 1 })
  const peer = createApp(options)
  disposals.push(async () => {
    await peer.close()
  })
  const responses = await Promise.all([
    request('/api/runtime-keys', 'POST', keyInput(flow.id, 1)),
    peer.app.handle(
      new Request(`http://localhost/api/flows/${flow.id}/publish`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${owner}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ revision: 2 }),
      }),
    ),
  ])
  expect(responses[1].status).toBe(200)
  expect([200, 409]).toContain(responses[0].status)
  if (responses[0].status === 200) {
    const key = await responses[0].json()
    expect(key.releaseRevision).toBe(1)
    expect(
      (await request('/run/hello', 'GET', undefined, key.token)).status,
    ).toBe(403)
  }
  const events = await (await request('/api/audit')).json()
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'runtime-key.created',
    ),
  ).toHaveLength(responses[0].status === 200 ? 1 : 0)
  expect(
    (await request('/api/runtime-keys', 'POST', keyInput(flow.id, 1))).status,
  ).toBe(409)
})

test('GraphQL pins block changed schemas before validation and preserve query and mutation grants after rollback', async () => {
  const { request } = workspace()
  const flow = await published(request, graphqlFlow)
  const query = await (
    await request('/api/runtime-keys', 'POST', {
      ...keyInput(flow.id, 1),
      permissions: ['query'],
    })
  ).json()
  const mutation = await (
    await request('/api/runtime-keys', 'POST', {
      ...keyInput(flow.id, 1),
      permissions: ['mutation'],
    })
  ).json()
  await request(`/api/flows/${flow.id}`, 'PUT', { ...graphqlFlow, revision: 1 })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  for (const key of [query, mutation])
    expect(
      (
        await request(
          '/graphql/hello',
          'POST',
          { query: '{ missing }' },
          key.token,
        )
      ).status,
    ).toBe(403)
  await request(`/api/flows/${flow.id}/rollback`, 'POST', {
    revision: 1,
    publishedRevision: 2,
  })
  for (const [key, allowed] of [
    [query, 'query'],
    [mutation, 'mutation'],
  ] as const) {
    for (const operation of ['query', 'mutation']) {
      const response = await request(
        '/graphql/hello',
        'POST',
        {
          query: `${operation}($name:String!) { greet(name:$name) { name } }`,
          variables: { name: 'Ada' },
        },
        key.token,
      )
      expect(response.status).toBe(operation === allowed ? 200 : 403)
      if (operation === allowed)
        expect(await response.json()).toEqual({
          data: { greet: { name: 'Ada' } },
        })
    }
  }
})

test('dormant pinned replacement uses its immutable release protocol and preserves expiry with one atomic winner', async () => {
  const { request, options } = workspace()
  const flow = await published(request)
  const pin = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id, 1))
  ).json()
  const follow = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id))
  ).json()
  await request(`/api/flows/${flow.id}`, 'PUT', { ...graphqlFlow, revision: 1 })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  expect(
    (await request(`/api/runtime-keys/${follow.id}/rotate`, 'POST')).status,
  ).toBe(409)
  expect(
    (
      await request(`/api/runtime-keys/${pin.id}/rotate`, 'POST', {
        releaseRevision: 2,
      })
    ).status,
  ).toBe(400)
  const peer = createApp(options)
  disposals.push(async () => {
    await peer.close()
  })
  const responses = await Promise.all([
    request(`/api/runtime-keys/${pin.id}/rotate`, 'POST'),
    peer.app.handle(
      new Request(`http://localhost/api/runtime-keys/${pin.id}/rotate`, {
        method: 'POST',
        headers: { authorization: `Bearer ${owner}` },
      }),
    ),
  ])
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 409,
  ])
  const replacement = await responses
    .find((response) => response.status === 200)!
    .json()
  expect(replacement).toMatchObject({
    name: pin.name,
    flowId: pin.flowId,
    releaseRevision: 1,
    permissions: ['rest'],
    expiresAt: pin.expiresAt,
  })
  expect(
    (
      await request(
        '/graphql/hello',
        'POST',
        { query: '{ missing }' },
        replacement.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        '/graphql/hello',
        'POST',
        { query: '{ missing }' },
        pin.token,
      )
    ).status,
  ).toBe(401)
  await request(`/api/flows/${flow.id}/rollback`, 'POST', {
    revision: 1,
    publishedRevision: 2,
  })
  expect(
    (await request('/run/hello', 'GET', undefined, replacement.token)).status,
  ).toBe(200)
  expect(
    (await request('/run/hello', 'GET', undefined, pin.token)).status,
  ).toBe(401)
  expect(
    (await request('/run/hello', 'GET', undefined, follow.token)).status,
  ).toBe(200)
  const events = await (await request('/api/audit')).json()
  expect(
    events.filter(
      (event: { action: string; resource: string }) =>
        event.action === 'runtime-key.revoked' && event.resource === pin.id,
    ),
  ).toHaveLength(1)
  expect(
    events.filter(
      (event: { action: string; resource: string }) =>
        event.action === 'runtime-key.created' &&
        event.resource === replacement.id,
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(events)).not.toContain(replacement.token)
})

test('rollback never revives an expired or revoked pin and neither can be replaced', async () => {
  const { request } = workspace()
  const flow = await published(request)
  const expiration = new Date(Date.now() + 2000).toISOString()
  const issued = await request('/api/runtime-keys', 'POST', {
    ...keyInput(flow.id, 1),
    expiresAt: expiration,
  })
  expect(issued.status).toBe(200)
  const expiring = await issued.json()
  const revoked = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id, 1))
  ).json()
  expect(
    (await request('/run/hello', 'GET', undefined, expiring.token)).status,
  ).toBe(200)
  await request(`/api/runtime-keys/${revoked.id}`, 'DELETE')
  await request(`/api/flows/${flow.id}`, 'PUT', { ...helloFlow, revision: 1 })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  await Bun.sleep(Math.max(0, Date.parse(expiration) - Date.now()) + 25)
  await request(`/api/flows/${flow.id}/rollback`, 'POST', {
    revision: 1,
    publishedRevision: 2,
  })
  for (const key of [expiring, revoked]) {
    expect(
      (await request('/run/hello', 'GET', undefined, key.token)).status,
    ).toBe(401)
    expect(
      (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')).status,
    ).toBe(409)
  }
})

test('managed load-test keys pin their job publication and remain nonreplaceable until terminal revocation', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  let enter!: () => void
  const entered = new Promise<void>((resolve) => {
    enter = resolve
  })
  let actualStatus = 0
  const { request, server } = workspace({
    k6Runner: async (input) => {
      const response = await fetch(input.url, {
        headers: { authorization: `Bearer ${input.token}` },
      })
      actualStatus = response.status
      await response.text()
      enter()
      await pending
      return {
        requests: 1,
        requestsPerSecond: 1,
        failedRequests: 0,
        checkRate: 1,
        avgMs: 1,
        p95Ms: 1,
        maxMs: 1,
        thresholdsPassed: true,
      }
    },
  })
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  try {
    const flow = await published(request)
    await request(`/api/flows/${flow.id}`, 'PUT', { ...helloFlow, revision: 1 })
    await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
    const response = await request('/api/load-tests', 'POST', {
      flowId: flow.id,
    })
    expect(response.status).toBe(202)
    const run = await response.json()
    await entered
    expect(actualStatus).toBe(200)
    const key = (await (await request('/api/runtime-keys')).json())[0]
    expect(key).toMatchObject({
      managedBy: 'load-test',
      releaseRevision: 2,
      revokedAt: null,
    })
    expect(run.revision).toBe(2)
    expect(
      (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')).status,
    ).toBe(409)
    expect(
      (
        await request(`/api/flows/${flow.id}/rollback`, 'POST', {
          revision: 1,
          publishedRevision: 2,
        })
      ).status,
    ).toBe(409)
    finish()
    for (let attempt = 0; attempt < 100; attempt++) {
      const current = await (await request(`/api/load-tests/${run.id}`)).json()
      if (current.status !== 'running') break
      await Bun.sleep(5)
    }
    expect(
      (await (await request(`/api/load-tests/${run.id}`)).json()).status,
    ).toBe('completed')
    const ended = (await (await request('/api/runtime-keys')).json())[0]
    expect(ended.releaseRevision).toBe(2)
    expect(ended.revokedAt).toBeString()
  } finally {
    finish()
  }
})

test('OAuth attempts retain original pin revision and key identity across dormancy rollback and replacement', async () => {
  let outbound = 0
  const { request } = workspace({
    oauthFetch: async (url) => {
      outbound++
      return url.endsWith('/access_token')
        ? Response.json({
            access_token: 'private-provider-token',
            token_type: 'bearer',
          })
        : Response.json({
            id: '42',
            login: 'octocat',
            name: null,
            avatar_url: null,
          })
    },
  })
  const connection = await (
    await request('/api/auth-connections', 'POST', {
      name: 'GitHub product',
      provider: 'github',
      clientId: 'client',
      clientSecret: 'private-client-secret',
      redirectUri: 'https://product.example/callback',
    })
  ).json()
  const flow = await (
    await request(`/api/auth-connections/${connection.id}/generate`, 'POST', {
      name: 'Pinned login',
      path: '/login/github',
      kind: 'rest',
    })
  ).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const key = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id, 1))
  ).json()
  const begin = await (
    await request('/run/login/github', 'POST', { action: 'BEGIN' }, key.token)
  ).json()
  const complete = {
    action: 'COMPLETE',
    code: 'private-code',
    state: begin.state,
    proof: begin.proof,
  }
  await request(`/api/flows/${flow.id}`, 'PUT', {
    ...flow,
    name: 'New release',
    revision: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  expect(
    (await request('/run/login/github', 'POST', complete, key.token)).status,
  ).toBe(403)
  expect(
    (await request('/run/login/github', 'POST', { action: 'BEGIN' }, key.token))
      .status,
  ).toBe(403)
  expect(outbound).toBe(0)
  expect(
    (await (await request('/api/audit')).json()).filter(
      (event: { action: string }) => event.action === 'product-login.consumed',
    ),
  ).toHaveLength(0)
  await request(`/api/flows/${flow.id}/rollback`, 'POST', {
    revision: 1,
    publishedRevision: 2,
  })
  expect(
    (await request('/run/login/github', 'POST', complete, key.token)).status,
  ).toBe(200)
  expect(outbound).toBe(2)
  const second = await (
    await request('/run/login/github', 'POST', { action: 'BEGIN' }, key.token)
  ).json()
  const replacement = await (
    await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')
  ).json()
  expect(replacement.releaseRevision).toBe(1)
  const secondComplete = {
    ...complete,
    state: second.state,
    proof: second.proof,
  }
  expect(
    (await request('/run/login/github', 'POST', secondComplete, key.token))
      .status,
  ).toBe(401)
  expect(
    (
      await request(
        '/run/login/github',
        'POST',
        secondComplete,
        replacement.token,
      )
    ).status,
  ).toBe(400)
  expect(outbound).toBe(2)
  const audit = JSON.stringify(await (await request('/api/audit')).json())
  for (const secret of [
    key.token,
    replacement.token,
    begin.state,
    begin.proof,
    complete.code,
    'private-provider-token',
    'private-client-secret',
  ])
    expect(audit).not.toContain(secret)
})

test('restart and downloaded backup restoration preserve active dormant follow and replaced key state', async () => {
  const { request, options, server, directory } = workspace()
  const flow = await published(request)
  const pin = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id, 1))
  ).json()
  const follow = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id))
  ).json()
  const changed = {
    ...helloFlow,
    nodes: [
      helloFlow.nodes[0],
      {
        ...helloFlow.nodes[1],
        config: { status: 200, body: { message: 'release two' } },
      },
    ],
  }
  await request(`/api/flows/${flow.id}`, 'PUT', { ...changed, revision: 1 })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  const current = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id, 2))
  ).json()
  const replacement = await (
    await request(`/api/runtime-keys/${pin.id}/rotate`, 'POST')
  ).json()
  const metadata = await (await request('/api/runtime-keys')).json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const downloaded = await request(`/api/backups/${backup.id}`)
  expect(downloaded.status).toBe(200)
  const restoredPath = join(directory, 'restored.sqlite')
  writeFileSync(restoredPath, new Uint8Array(await downloaded.arrayBuffer()))
  await server.close()
  const restarted = createApp(options)
  const restored = createApp({ ...options, databasePath: restoredPath })
  disposals.push(async () => {
    await restarted.close()
    await restored.close()
  })
  const call = (
    instance: typeof server,
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ) =>
    instance.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  for (const instance of [restarted, restored]) {
    expect(await (await call(instance, '/api/runtime-keys')).json()).toEqual(
      metadata,
    )
    expect(
      (await call(instance, '/run/hello', 'GET', undefined, pin.token)).status,
    ).toBe(401)
    expect(
      (await call(instance, '/run/hello', 'GET', undefined, replacement.token))
        .status,
    ).toBe(403)
    for (const key of [current, follow])
      expect(
        await (
          await call(instance, '/run/hello', 'GET', undefined, key.token)
        ).json(),
      ).toEqual({ message: 'release two' })
  }
  expect(
    (
      await call(restored, `/api/flows/${flow.id}/rollback`, 'POST', {
        revision: 1,
        publishedRevision: 2,
      })
    ).status,
  ).toBe(200)
  expect(
    (await call(restored, '/run/hello', 'GET', undefined, replacement.token))
      .status,
  ).toBe(200)
  expect(
    (await call(restored, '/run/hello', 'GET', undefined, current.token))
      .status,
  ).toBe(403)
  expect(
    (await call(restarted, '/run/hello', 'GET', undefined, replacement.token))
      .status,
  ).toBe(403)
})

test('pinning the graph does not freeze mutable spreadsheet snapshots', async () => {
  const { request } = workspace()
  const form = (text: string) => {
    const value = new FormData()
    value.append('name', 'Mutable rows')
    value.append('file', new File([text], 'rows.csv'))
    return value
  }
  const source = await (
    await request('/api/data-sources/import', 'POST', form('name\nAda'))
  ).json()
  const generated = await request(
    `/api/data-sources/${source.id}/api`,
    'POST',
    {
      version: 1,
      name: 'Rows',
      path: '/rows',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const key = await (
    await request('/api/runtime-keys', 'POST', keyInput(flow.id, 1))
  ).json()
  expect(
    await (await request('/run/rows', 'GET', undefined, key.token)).json(),
  ).toEqual([{ name: 'Ada' }])
  const replacement = form('name\nGrace')
  replacement.append('version', '1')
  expect(
    (await request(`/api/data-sources/${source.id}/import`, 'PUT', replacement))
      .status,
  ).toBe(200)
  expect(
    await (await request('/run/rows', 'GET', undefined, key.token)).json(),
  ).toEqual([{ name: 'Grace' }])
})

test('pin issuance uses explicit current key-management grants and owner cookies require CSRF', async () => {
  const { request, server } = workspace()
  const flow = await published(request)
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Key manager',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const manager = await (
    await request('/api/members', 'POST', {
      name: 'Manager',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Viewer', role: 'viewer' })
  ).json()
  const input = keyInput(flow.id, 1)
  expect(
    (await request('/api/flows', 'GET', undefined, manager.token)).status,
  ).toBe(403)
  expect(
    (await request('/api/runtime-keys', 'POST', input, manager.token)).status,
  ).toBe(200)
  expect(
    (await request('/api/runtime-keys', 'POST', input, viewer.token)).status,
  ).toBe(403)
  for (const settings of [
    { releaseRevision: '1' },
    { releaseRevision: null },
    { releaseRevision: 1, headers: { authorization: 'secret' } },
  ])
    expect(
      (
        await request(
          '/api/runtime-keys',
          'POST',
          { ...input, ...settings },
          manager.token,
        )
      ).status,
    ).toBe(400)
  await request(`/api/roles/${role.id}`, 'PUT', {
    name: role.name,
    permissions: [],
    version: role.version,
  })
  expect(
    (await request('/api/runtime-keys', 'POST', input, manager.token)).status,
  ).toBe(403)
  const login = await server.app.handle(
    new Request('http://localhost/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: owner }),
    }),
  )
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const session = await login.json()
  const cookieRequest = (csrf?: string) =>
    server.app.handle(
      new Request('http://localhost/api/runtime-keys', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          cookie,
          'content-type': 'application/json',
          ...(csrf ? { 'x-besh-csrf': csrf } : {}),
        },
        body: JSON.stringify(input),
      }),
    )
  expect((await cookieRequest()).status).toBe(403)
  const issued = await cookieRequest(session.csrfToken)
  expect(issued.status).toBe(200)
  expect((await issued.json()).releaseRevision).toBe(1)
})
