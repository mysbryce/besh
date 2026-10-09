import { expect, test, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

type Receipt = { ticket: string; path: string; protocol: string }

async function exchange(page: Page, receipt: Receipt, id: string) {
  return page.evaluate(
    async ({ receipt, id }) => {
      const url = new URL(receipt.path, location.origin)
      url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      return new Promise<{
        opened: boolean
        matched?: boolean
        protocol?: string
      }>((resolve) => {
        const socket = new WebSocket(url, [
          receipt.protocol,
          `besh.ticket.${receipt.ticket}`,
        ])
        const timer = setTimeout(() => {
          socket.close()
          resolve({ opened: false })
        }, 5000)
        socket.addEventListener(
          'open',
          () => {
            socket.send(
              JSON.stringify({ id, body: { message: 'Proxy ไทย 🙂' } }),
            )
          },
          { once: true },
        )
        socket.addEventListener(
          'message',
          (event) => {
            clearTimeout(timer)
            let reply:
              { id?: string; result?: { message?: string } } | undefined
            try {
              reply = JSON.parse(String(event.data))
            } catch {}
            const matched =
              reply?.id === id && reply.result?.message === 'Proxy ไทย 🙂'
            const protocol = socket.protocol
            socket.close()
            resolve({ opened: true, matched, protocol })
          },
          { once: true },
        )
        socket.addEventListener(
          'error',
          () => {
            clearTimeout(timer)
            socket.close()
            resolve({ opened: false })
          },
          { once: true },
        )
      })
    },
    { receipt, id },
  )
}

test('development proxies carry actual published and original-cookie draft WebSocket frames', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-websocket-proxy-'))
  const owner = randomUUID() + randomUUID()
  const webOrigin = 'http://127.0.0.1:5187'
  const children: ReturnType<typeof spawn>[] = []
  function start(command: string, args: string[], env: NodeJS.ProcessEnv) {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    children.push(child)
    return child
  }
  try {
    const api = start('bun', ['src/index.ts'], {
      PORT: '0',
      BESH_HOST: '127.0.0.1',
      BESH_ADMIN_TOKEN: owner,
      BESH_WEB_URL: webOrigin,
      BESH_DATABASE_PATH: join(directory, 'control.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'secrets.key'),
      BESH_RUNTIME_CODE_DIR: join(directory, 'generated'),
    })
    const origin = await new Promise<string>((resolve, reject) => {
      let output = ''
      const timer = setTimeout(
        () => reject(new Error('Native proxy API did not start')),
        10_000,
      )
      api.stdout!.on('data', (chunk) => {
        output += String(chunk)
        const match = output.match(
          /Besh API ready at (http:\/\/127\.0\.0\.1:\d+)/,
        )
        if (match) {
          clearTimeout(timer)
          resolve(match[1]!)
        }
      })
      api.once('error', () => {
        clearTimeout(timer)
        reject(new Error('Native proxy API launch failed'))
      })
    })
    start(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--port', '5187'],
      {
        BESH_API_URL: origin,
      },
    )
    await expect
      .poll(async () => {
        try {
          return (await page.request.get(webOrigin + '/health')).status()
        } catch {
          return 0
        }
      })
      .toBe(200)
    const call = (path: string, body: unknown, token = owner) =>
      page.request.post(origin + path, {
        headers: { authorization: `Bearer ${token}` },
        data: body,
      })
    const fields = {
      type: 'object',
      properties: { message: { type: 'string', maxLength: 128 } },
      required: ['message'],
      additionalProperties: false,
    }
    const created = await call('/api/flows', {
      name: 'Browser development proxy',
      method: 'GET',
      path: '/browser-proxy',
      websocket: { input: fields, output: fields, allowedOrigins: [webOrigin] },
      nodes: [
        {
          id: 'receive',
          type: 'request',
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: 'reply',
          type: 'response',
          position: { x: 160, y: 0 },
          config: { status: 200, body: '$input.body' },
        },
      ],
      edges: [{ id: 'next', source: 'receive', target: 'reply' }],
    })
    expect(created.status()).toBe(200)
    const flow = await created.json()
    expect(
      (await call(`/api/flows/${flow.id}/publish`, { revision: 1 })).status(),
    ).toBe(200)
    const issued = await call('/api/runtime-keys', {
      name: 'Proxy product server',
      flowId: flow.id,
      permissions: ['ws'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(issued.status()).toBe(200)
    const key = await issued.json()
    const minted = await call(
      '/ws/browser-proxy/ticket',
      { revision: 1, origin: webOrigin },
      key.token,
    )
    expect(minted.status()).toBe(200)
    await page.goto(webOrigin)
    expect(await exchange(page, await minted.json(), 'published')).toEqual({
      opened: true,
      matched: true,
      protocol: 'besh.ws.v1',
    })
    const draft = await page.evaluate(
      async ({ owner, flowId }) => {
        const login = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: owner }),
        })
        if (login.status !== 200) return null
        const session = await login.json()
        const response = await fetch(`/api/flows/${flowId}/ws/test-ticket`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-besh-csrf': session.csrfToken,
          },
          body: JSON.stringify({ revision: 1 }),
        })
        return response.status === 200 ? response.json() : null
      },
      { owner, flowId: flow.id },
    )
    expect(Boolean(draft?.ticket)).toBe(true)
    expect(await exchange(page, draft, 'draft')).toEqual({
      opened: true,
      matched: true,
      protocol: 'besh.ws.v1',
    })
  } finally {
    await page.close()
    for (const child of children.reverse()) {
      if (child.exitCode !== null || child.signalCode !== null) continue
      const stopped = new Promise<void>((resolve) =>
        child.once('exit', () => resolve()),
      )
      child.kill()
      await stopped
    }
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  }
})
