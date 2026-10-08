import { afterEach, expect, test } from 'bun:test'
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, type AppOptions } from '../src/app'

const owner = 'product-auth-owner-key-at-least-32-characters'
const cleanup: (() => void)[] = []

afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose()
})

function workspace(overrides: Partial<AppOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-product-auth-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    ...overrides,
  }
  const server = createApp(options)
  cleanup.push(() => {
    server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })

  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ) {
    return server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body !== undefined && !(body instanceof FormData)
            ? { 'content-type': 'application/json' }
            : {}),
        },
        body:
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body),
      }),
    )
  }

  return { request, server, options, directory }
}

const connection = {
  name: 'Product GitHub',
  provider: 'github',
  clientId: 'github-client',
  clientSecret: 'private-provider-secret',
  redirectUri: 'https://product.example/oauth/github',
}

test('owners configure encrypted product connections while editors see metadata only', async () => {
  const { request, directory } = workspace()
  expect(existsSync(join(directory, 'besh-secrets.key'))).toBe(false)
  const editor = await (
    await request('/api/members', 'POST', { name: 'Editor', role: 'editor' })
  ).json()
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Viewer', role: 'viewer' })
  ).json()
  expect(
    (await request('/api/auth-connections', 'POST', connection, editor.token))
      .status,
  ).toBe(403)
  const response = await request('/api/auth-connections', 'POST', connection)
  expect(response.status).toBe(200)
  const saved = await response.json()
  expect(saved).toMatchObject({
    name: 'Product GitHub',
    provider: 'github',
    clientId: 'github-client',
    version: 1,
  })
  expect(saved).not.toHaveProperty('clientSecret')
  expect(
    (
      await request(
        `/api/auth-connections/${saved.id}`,
        'PUT',
        {
          name: 'Unauthorized',
          clientId: connection.clientId,
          redirectUri: connection.redirectUri,
        },
        editor.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        `/api/auth-connections/${saved.id}`,
        'DELETE',
        undefined,
        editor.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request('/api/auth-connections', 'GET', undefined, viewer.token))
      .status,
  ).toBe(403)
  expect(
    await (
      await request('/api/auth-connections', 'GET', undefined, editor.token)
    ).json(),
  ).toEqual([saved])
  const updated = await (
    await request(`/api/auth-connections/${saved.id}`, 'PUT', {
      name: 'Renamed',
      clientId: connection.clientId,
      redirectUri: connection.redirectUri,
    })
  ).json()
  expect(updated.version).toBe(2)
  expect(readFileSync(join(directory, 'besh-secrets.key')).length).toBe(32)
  const backup = await (await request('/api/backups', 'POST')).json()
  const bytes = readFileSync(join(directory, 'backups', backup.id))
  expect(bytes.includes(Buffer.from(connection.clientSecret))).toBe(false)
  expect(
    JSON.stringify(await (await request('/api/audit')).json()),
  ).not.toContain(connection.clientSecret)
  expect(
    (await request(`/api/auth-connections/${saved.id}`, 'DELETE')).status,
  ).toBe(200)
})

async function generated(
  request: ReturnType<typeof workspace>['request'],
  kind = 'rest',
) {
  const saved = await (
    await request('/api/auth-connections', 'POST', connection)
  ).json()
  const response = await request(
    `/api/auth-connections/${saved.id}/generate`,
    'POST',
    {
      name: 'GitHub login',
      path: '/login/github',
      kind,
    },
  )
  expect(response.status).toBe(200)
  return { saved, flow: await response.json() }
}

async function publishKey(
  request: ReturnType<typeof workspace>['request'],
  flow: { id: string; revision: number },
  permissions = ['rest'],
) {
  expect(
    (
      await request(`/api/flows/${flow.id}/publish`, 'POST', {
        revision: flow.revision,
      })
    ).status,
  ).toBe(200)
  return (
    await (
      await request('/api/runtime-keys', 'POST', {
        name: 'Product server',
        flowId: flow.id,
        permissions,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      })
    ).json()
  ).token as string
}

test('generated drafts begin scoped GitHub login with separate server proof and S256 PKCE', async () => {
  const { request } = workspace()
  const { saved, flow } = await generated(request)
  expect(flow.publishedRevision).toBeNull()
  const editor = await (
    await request('/api/members', 'POST', { name: 'Editor', role: 'editor' })
  ).json()
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Viewer', role: 'viewer' })
  ).json()
  const generation = {
    name: 'Editor login',
    path: '/editor/github',
    kind: 'rest',
  }
  expect(
    (
      await request(
        `/api/auth-connections/${saved.id}/generate`,
        'POST',
        generation,
        viewer.token,
      )
    ).status,
  ).toBe(403)
  const editorDraft = await request(
    `/api/auth-connections/${saved.id}/generate`,
    'POST',
    generation,
    editor.token,
  )
  expect(editorDraft.status).toBe(200)
  expect((await editorDraft.json()).publishedRevision).toBeNull()
  expect(
    flow.nodes.find((node: { type: string }) => node.type === 'social').config,
  ).toEqual({ connectionId: saved.id })
  expect(
    (await request(`/api/auth-connections/${saved.id}`, 'DELETE')).status,
  ).toBe(409)
  const token = await publishKey(request, flow)
  expect(
    (await request('/run/login/github', 'POST', { action: 'BEGIN' })).status,
  ).toBe(401)
  const response = await request(
    '/run/login/github',
    'POST',
    { action: 'BEGIN' },
    token,
  )
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result.identity).toBeNull()
  expect(result.state).not.toBe(result.proof)
  const url = new URL(result.authorizationUrl)
  expect(url.origin + url.pathname).toBe(
    'https://github.com/login/oauth/authorize',
  )
  expect(url.searchParams.get('redirect_uri')).toBe(connection.redirectUri)
  expect(url.searchParams.get('state')).toBe(result.state)
  expect(url.searchParams.get('scope')).toBe('read:user')
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
  expect(result.authorizationUrl).not.toContain(result.proof)
  const spec = await (await request(`/api/flows/${flow.id}/openapi`)).json()
  expect(spec.paths['/run/login/github'].post.responses['429']).toBeDefined()
  expect(spec.paths['/run/login/github'].post.responses['502']).toBeDefined()
  expect(
    spec.paths['/run/login/github'].post.responses['200'].content[
      'application/json'
    ].schema.properties.identity.properties.subject.type,
  ).toBe('string')
})

test('completion verifies GitHub identity without exposing provider tokens or replaying attempts', async () => {
  let exchanged: URLSearchParams | undefined
  let begin: { state: string; proof: string; authorizationUrl: string }
  const { request } = workspace({
    oauthFetch: async (url, init) => {
      expect(init.redirect).toBe('error')
      if (url === 'https://github.com/login/oauth/access_token') {
        exchanged = new URLSearchParams(String(init.body))
        return Response.json({
          access_token: 'private-access-token',
          token_type: 'bearer',
        })
      }
      expect(url).toBe('https://api.github.com/user')
      expect(new Headers(init.headers).get('authorization')).toBe(
        'Bearer private-access-token',
      )
      return Response.json({
        id: 42,
        login: 'octocat',
        name: 'Octo Cat',
        avatar_url: 'https://avatars.githubusercontent.com/u/42',
      })
    },
  })
  const { saved, flow } = await generated(request)
  await request(`/api/auth-connections/${saved.id}`, 'PUT', {
    name: 'Updated without secret',
    clientId: connection.clientId,
    redirectUri: connection.redirectUri,
  })
  const token = await publishKey(request, flow)
  begin = await (
    await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
  ).json()
  const body = {
    action: 'COMPLETE',
    code: 'code-from-github',
    state: begin.state,
    proof: begin.proof,
  }
  const response = await request('/run/login/github', 'POST', body, token)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    authorizationUrl: null,
    state: null,
    proof: null,
    expiresAt: null,
    identity: {
      provider: 'github',
      subject: '42',
      username: 'octocat',
      name: 'Octo Cat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/42',
    },
  })
  expect(exchanged!.get('redirect_uri')).toBe(connection.redirectUri)
  expect(exchanged!.get('client_secret')).toBe(connection.clientSecret)
  expect(exchanged!.get('code_verifier')).toMatch(/^[\w-]{43}$/)
  expect((await request('/run/login/github', 'POST', body, token)).status).toBe(
    400,
  )
  const audit = JSON.stringify(await (await request('/api/audit')).json())
  expect(audit).toContain('product-login.completed')
  for (const secret of [
    body.code,
    begin.state,
    begin.proof,
    connection.clientSecret,
    'private-access-token',
  ])
    expect(audit).not.toContain(secret)
})

test('GraphQL login returns typed identity and rejects multiple login mutations before effects', async () => {
  let outbound = 0
  const { request } = workspace({
    oauthFetch: async (url) => {
      outbound++
      return url.endsWith('/access_token')
        ? Response.json({ access_token: 'token', token_type: 'bearer' })
        : Response.json({
            id: '42',
            login: 'octocat',
            name: null,
            avatar_url: null,
          })
    },
  })
  const { flow } = await generated(request, 'graphql')
  const token = await publishKey(request, flow, ['query', 'mutation'])
  const query = async (query: string, variables?: unknown) =>
    request('/graphql/login/github', 'POST', { query, variables }, token)
  expect(await (await query('{ info }')).json()).toEqual({
    data: { info: 'GitHub product login' },
  })
  expect(
    (await query('mutation { login(action: UNKNOWN) { state } }')).status,
  ).toBe(400)
  const rejected = await query(
    'mutation { first: login(action: BEGIN) { state } second: login(action: BEGIN) { state } }',
  )
  expect(rejected.status).toBe(400)
  const response = await query(
    'mutation { login(action: BEGIN) { authorizationUrl state proof expiresAt identity { provider subject username name avatarUrl } } }',
  )
  const result = await response.json()
  expect(result.errors).toBeUndefined()
  expect(result.data.login.state).toMatch(/^[\w-]{43}$/)
  expect(result.data.login.identity).toBeNull()
  expect(outbound).toBe(0)
  const completed = await query(
    'mutation($state: String!, $proof: String!) { login(action: COMPLETE, code: "code", state: $state, proof: $proof) { identity { provider subject username name avatarUrl } state proof } }',
    {
      state: result.data.login.state,
      proof: result.data.login.proof,
    },
  )
  expect(await completed.json()).toEqual({
    data: {
      login: {
        identity: {
          provider: 'github',
          subject: '42',
          username: 'octocat',
          name: null,
          avatarUrl: null,
        },
        state: null,
        proof: null,
      },
    },
  })
})

test('wrong proof and different runtime credentials cannot consume a rightful login attempt', async () => {
  const { request } = workspace({
    oauthFetch: async (url) =>
      url.endsWith('/access_token')
        ? Response.json({ access_token: 'token', token_type: 'bearer' })
        : Response.json({
            id: 42,
            login: 'octocat',
            name: null,
            avatar_url: null,
          }),
  })
  const { flow } = await generated(request)
  const token = await publishKey(request, flow)
  const otherToken = await publishKey(request, flow)
  const begin = await (
    await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
  ).json()
  const body = {
    action: 'COMPLETE',
    code: 'code',
    state: begin.state,
    proof: begin.proof,
  }
  expect(
    (
      await request(
        '/run/login/github',
        'POST',
        { ...body, proof: 'x'.repeat(43) },
        token,
      )
    ).status,
  ).toBe(400)
  expect(
    (await request('/run/login/github', 'POST', body, otherToken)).status,
  ).toBe(400)
  expect(
    (await request(`/api/flows/${flow.id}/test`, 'POST', { body, query: {} }))
      .status,
  ).toBe(400)
  expect((await request('/run/login/github', 'POST', body, token)).status).toBe(
    200,
  )
})

test('attempts expire absolutely and bind to draft revisions, release revisions and connection versions', async () => {
  let clock = Date.now()
  let outbound = 0
  const { request } = workspace({
    now: () => clock,
    oauthFetch: async () => {
      outbound++
      return Response.json({})
    },
  })
  const { saved, flow } = await generated(request)
  const token = await publishKey(request, flow)
  const begin = async () =>
    (
      await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
    ).json()
  const complete = async (value: { state: string; proof: string }) =>
    request(
      '/run/login/github',
      'POST',
      {
        action: 'COMPLETE',
        code: 'code',
        state: value.state,
        proof: value.proof,
      },
      token,
    )
  const expired = await begin()
  clock += 600_000
  expect((await complete(expired)).status).toBe(400)
  const draftBegin = await (
    await request(`/api/flows/${flow.id}/test`, 'POST', {
      body: { action: 'BEGIN' },
      query: {},
    })
  ).json()
  const oldRelease = await begin()
  const changed = await (
    await request(`/api/flows/${flow.id}`, 'PUT', {
      ...flow,
      name: 'Renamed login',
    })
  ).json()
  expect(
    (
      await request(`/api/flows/${flow.id}/test`, 'POST', {
        body: {
          action: 'COMPLETE',
          code: 'code',
          state: draftBegin.body.state,
          proof: draftBegin.body.proof,
        },
        query: {},
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(`/api/flows/${flow.id}/publish`, 'POST', {
        revision: changed.revision,
      })
    ).status,
  ).toBe(200)
  expect((await complete(oldRelease)).status).toBe(400)
  const oldConnection = await begin()
  expect(
    (
      await request(`/api/auth-connections/${saved.id}`, 'PUT', {
        name: connection.name,
        clientId: connection.clientId,
        redirectUri: connection.redirectUri,
      })
    ).status,
  ).toBe(200)
  expect((await complete(oldConnection)).status).toBe(400)
  expect(outbound).toBe(0)
})

test('encrypted backups require the original separate key and do not regenerate a missing key', async () => {
  const { request, directory, options } = workspace()
  const { flow } = await generated(request)
  const token = await publishKey(request, flow)
  const backup = await (await request('/api/backups', 'POST')).json()
  const restoredDir = mkdtempSync(join(tmpdir(), 'besh-oauth-restore-'))
  cleanup.push(() =>
    rmSync(restoredDir, { recursive: true, force: true, maxRetries: 5 }),
  )
  const databasePath = join(restoredDir, 'restored.sqlite')
  writeFileSync(
    databasePath,
    readFileSync(join(directory, 'backups', backup.id)),
  )
  expect(() => createApp({ ...options, databasePath })).toThrow(
    'OAuth encryption key missing',
  )
  const keyPath = join(restoredDir, 'besh-secrets.key')
  expect(existsSync(keyPath)).toBe(false)
  writeFileSync(keyPath, Buffer.alloc(32, 1))
  expect(() => createApp({ ...options, databasePath })).toThrow(
    'OAuth encryption key does not match',
  )
  writeFileSync(keyPath, readFileSync(join(directory, 'besh-secrets.key')))
  const restored = createApp({ ...options, databasePath })
  cleanup.push(() => restored.close())
  const response = await restored.app.handle(
    new Request('http://localhost/run/login/github', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'BEGIN' }),
    }),
  )
  expect(response.status).toBe(200)
})

test('invalid flow contracts, input actions and GraphQL variables never contact GitHub', async () => {
  let outbound = 0
  const { request } = workspace({
    oauthFetch: async () => {
      outbound++
      throw new Error('Never called')
    },
  })
  const { flow } = await generated(request)
  const token = await publishKey(request, flow)
  for (const body of [
    { action: 'UNKNOWN' },
    { action: 'COMPLETE' },
    { action: 'BEGIN', clientSecret: 'untrusted' },
    { action: 1 },
    { action: 'COMPLETE', code: 'x', state: 'x', proof: 'x' },
  ])
    expect(
      (await request('/run/login/github', 'POST', body, token)).status,
    ).toBe(400)
  const missing = await (
    await request('/api/flows', 'POST', {
      ...flow,
      path: '/missing',
      nodes: flow.nodes.map((node: { type: string }) =>
        node.type === 'social'
          ? { ...node, config: { connectionId: 'missing' } }
          : node,
      ),
    })
  ).json()
  expect(
    (
      await request(`/api/flows/${missing.id}/publish`, 'POST', {
        revision: missing.revision,
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(`/api/flows/${missing.id}/test`, 'POST', {
        body: { action: 'BEGIN' },
        query: {},
      })
    ).status,
  ).toBe(400)
  const gql = await generated(request, 'graphql')
  const gqlToken = await publishKey(request, gql.flow, ['mutation'])
  expect(
    (
      await request(
        '/graphql/login/github',
        'POST',
        {
          query:
            'mutation($action: LoginAction!) { login(action: $action) { state } }',
          variables: { action: 'INVALID' },
        },
        gqlToken,
      )
    ).status,
  ).toBe(400)
  expect(outbound).toBe(0)
})

test('provider failures are bounded and generic, and a consumed attempt cannot retry exchange', async () => {
  let response: () => Promise<Response> = async () => {
    throw new Error('private-provider-error private-access-token')
  }
  let calls = 0
  const { request } = workspace({
    oauthFetch: async () => {
      calls++
      return response()
    },
  })
  const { flow } = await generated(request)
  const token = await publishKey(request, flow)
  for (const provider of [
    async () => {
      throw new Error('private-provider-error private-access-token')
    },
    async () =>
      new Response('redirect', {
        status: 302,
        headers: { location: 'https://evil.example/' },
      }),
    async () =>
      new Response('private-access-token', {
        headers: { 'content-type': 'text/plain' },
      }),
    async () =>
      Response.json({
        access_token: 'bad token\r\nHeader: injected',
        token_type: 'bearer',
      }),
    async () => Response.json({ access_token: 'token', token_type: 'basic' }),
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(65_537))
            controller.close()
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
  ]) {
    response = provider
    const begin = await (
      await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
    ).json()
    const body = {
      action: 'COMPLETE',
      code: 'provider-code',
      state: begin.state,
      proof: begin.proof,
    }
    const failed = await request('/run/login/github', 'POST', body, token)
    expect(failed.status).toBe(502)
    expect(await failed.json()).toEqual({
      error: 'GitHub login could not be completed',
    })
    const called = calls
    expect(
      (await request('/run/login/github', 'POST', body, token)).status,
    ).toBe(400)
    expect(calls).toBe(called)
  }
})

test('identity responses reject untrusted subjects and nonallowlisted avatar URLs', async () => {
  let identity: unknown
  const { request } = workspace({
    oauthFetch: async (url) =>
      url.endsWith('/access_token')
        ? Response.json({ access_token: 'token', token_type: 'bearer' })
        : Response.json(identity),
  })
  const { flow } = await generated(request)
  const token = await publishKey(request, flow)
  for (const id of [0, 1.5, 'attacker', { user: 42 }]) {
    identity = { id, login: 'octocat', name: null, avatar_url: null }
    const begin = await (
      await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
    ).json()
    expect(
      (
        await request(
          '/run/login/github',
          'POST',
          {
            action: 'COMPLETE',
            code: 'code',
            state: begin.state,
            proof: begin.proof,
          },
          token,
        )
      ).status,
    ).toBe(502)
  }
  for (const avatar_url of [
    'http://avatars.githubusercontent.com/u/42',
    'https://evil.example/u/42',
    'https://avatars.githubusercontent.com@evil.example/u/42',
  ]) {
    identity = { id: 42, login: 'octocat', name: null, avatar_url }
    const begin = await (
      await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
    ).json()
    expect(
      (
        await request(
          '/run/login/github',
          'POST',
          {
            action: 'COMPLETE',
            code: 'code',
            state: begin.state,
            proof: begin.proof,
          },
          token,
        )
      ).status,
    ).toBe(502)
  }
})

test('pending login budgets expire and concurrent exchanges keep unconsumed attempts usable', async () => {
  let clock = Date.now()
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let entered = 0
  const { request } = workspace({
    now: () => clock,
    oauthFetch: async (url) => {
      if (url.endsWith('/access_token')) {
        entered++
        await gate
        return Response.json({ access_token: 'token', token_type: 'bearer' })
      }
      return Response.json({
        id: 42,
        login: 'octocat',
        name: null,
        avatar_url: null,
      })
    },
  })
  const { flow } = await generated(request)
  const token = await publishKey(request, flow)
  for (let attempt = 0; attempt < 10; attempt++)
    expect(
      (await request('/run/login/github', 'POST', { action: 'BEGIN' }, token))
        .status,
    ).toBe(200)
  expect(
    (await request('/run/login/github', 'POST', { action: 'BEGIN' }, token))
      .status,
  ).toBe(429)
  clock += 600_000
  const attempts = []
  for (let attempt = 0; attempt < 5; attempt++)
    attempts.push(
      await (
        await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
      ).json(),
    )
  const complete = (attempt: { state: string; proof: string }) =>
    request(
      '/run/login/github',
      'POST',
      {
        action: 'COMPLETE',
        code: 'code',
        state: attempt.state,
        proof: attempt.proof,
      },
      token,
    )
  const running = attempts.slice(0, 4).map(complete)
  const deadline = Date.now() + 1000
  while (entered < 4 && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 1))
  expect(entered).toBe(4)
  expect((await complete(attempts[4])).status).toBe(429)
  release!()
  expect(
    (await Promise.all(running)).map((response) => response.status),
  ).toEqual([200, 200, 200, 200])
  expect((await complete(attempts[4])).status).toBe(200)
})

test('provider timeout ends exchange and redacts failure', async () => {
  const { request } = workspace({
    oauthFetch: async () => new Promise<Response>(() => {}),
  })
  const { flow } = await generated(request)
  const token = await publishKey(request, flow)
  const begin = await (
    await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
  ).json()
  const response = await request(
    '/run/login/github',
    'POST',
    {
      action: 'COMPLETE',
      code: 'code',
      state: begin.state,
      proof: begin.proof,
    },
    token,
  )
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({
    error: 'GitHub login could not be completed',
  })
}, 10_000)

test('login attempts audit started, consumed and failed outcomes without submitted secrets', async () => {
  const { request } = workspace({
    oauthFetch: async () => {
      throw new Error('provider-private-error')
    },
  })
  const { flow } = await generated(request)
  const token = await publishKey(request, flow)
  const begin = await (
    await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
  ).json()
  const response = await request(
    '/run/login/github',
    'POST',
    {
      action: 'COMPLETE',
      code: 'private-code',
      state: begin.state,
      proof: begin.proof,
    },
    token,
  )
  expect(response.status).toBe(502)
  const audit = await (await request('/api/audit')).json()
  const events = audit.filter((event: { action: string }) =>
    event.action.startsWith('product-login.'),
  )
  expect(events.map((event: { action: string }) => event.action)).toEqual([
    'product-login.failed',
    'product-login.consumed',
    'product-login.started',
  ])
  for (const event of events) {
    expect(event.actor).toMatch(/^runtime:/)
    expect(event.resource).toBe(flow.id)
  }
  for (const secret of [
    'private-code',
    begin.state,
    begin.proof,
    'provider-private-error',
    connection.clientSecret,
  ])
    expect(JSON.stringify(audit)).not.toContain(secret)
})

test('only reached social nodes create attempts and auth results preserve existing spreadsheet data', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.append('name', 'People')
  upload.append('file', new File(['Name\nAda\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const { flow } = await generated(request)
  const responseBody = { auth: '$auth', people: '$data' }
  const draft = {
    ...flow,
    contract: { body: flow.contract.body },
    nodes: [
      flow.nodes[0],
      {
        id: 'data',
        type: 'data',
        position: { x: 200, y: 100 },
        config: { sourceId: source.id, columns: ['name'], limit: 1 },
      },
      {
        id: 'condition',
        type: 'condition',
        position: { x: 300, y: 100 },
        config: { field: 'body.action', equals: 'SKIP' },
      },
      flow.nodes[1],
      { ...flow.nodes[2], config: { status: 200, body: responseBody } },
      {
        ...flow.nodes[2],
        id: 'skip',
        config: { status: 200, body: responseBody },
      },
    ],
    edges: [
      { id: 'one', source: 'request', target: 'data' },
      { id: 'two', source: 'data', target: 'condition' },
      {
        id: 'three',
        source: 'condition',
        target: 'skip',
        sourceHandle: 'true',
      },
      {
        id: 'four',
        source: 'condition',
        target: 'social',
        sourceHandle: 'false',
      },
      { id: 'five', source: 'social', target: 'response' },
    ],
  }
  const changed = await (
    await request(`/api/flows/${flow.id}`, 'PUT', draft)
  ).json()
  const token = await publishKey(request, changed)
  expect(
    await (
      await request('/run/login/github', 'POST', { action: 'SKIP' }, token)
    ).json(),
  ).toEqual({ auth: null, people: [{ name: 'Ada' }] })
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.some(
      (event: { action: string }) => event.action === 'product-login.started',
    ),
  ).toBe(false)
  const begun = await (
    await request('/run/login/github', 'POST', { action: 'BEGIN' }, token)
  ).json()
  expect(begun.auth.state).toMatch(/^[\w-]{43}$/)
  expect(begun.people).toEqual([{ name: 'Ada' }])
})

test('workspace pending attempt budget stays bounded across many flows and clears expired attempts', async () => {
  let clock = Date.now()
  const { request } = workspace({ now: () => clock })
  const { flow } = await generated(request)
  for (let scope = 0; scope < 100; scope++) {
    const draft =
      scope === 0
        ? flow
        : await (
            await request('/api/flows', 'POST', {
              ...flow,
              path: `/login/github-${scope}`,
            })
          ).json()
    for (let pending = 0; pending < 10; pending++) {
      expect(
        (
          await request(`/api/flows/${draft.id}/test`, 'POST', {
            body: { action: 'BEGIN' },
            query: {},
          })
        ).status,
      ).toBe(200)
    }
  }
  const overflow = await (
    await request('/api/flows', 'POST', { ...flow, path: '/login/overflow' })
  ).json()
  const begin = () =>
    request(`/api/flows/${overflow.id}/test`, 'POST', {
      body: { action: 'BEGIN' },
      query: {},
    })
  expect((await begin()).status).toBe(429)
  clock += 600_000
  expect((await begin()).status).toBe(200)
}, 15_000)
