// Install as scripts/portable-browser-fixture.ts. Compile only for the owned
// artifact test. This fixture receives a genuine browser URL, calls normal
// public setup, and delivers its receipt through private parent-owned HTTP.
// It prints nothing and writes no URL, setup challenge or owner credential.

async function boundedJSON(
  response: Response,
): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Missing fixture HTTP body')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 16 * 1024) throw new Error('Fixture HTTP bound exceeded')
      chunks.push(chunk.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function main() {
  const callbackValue = process.env.BESH_TEST_BROWSER_CALLBACK
  const proof = process.env.BESH_TEST_BROWSER_NONCE
  if (!callbackValue || !proof || process.argv.length !== 3) {
    process.exitCode = 1
    return
  }
  const callback = new URL(callbackValue)
  if (
    callback.protocol !== 'http:' ||
    callback.hostname !== '127.0.0.1' ||
    callback.pathname !== '/browser' ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash
  ) {
    process.exitCode = 1
    return
  }

  let report: Record<string, unknown> = { ok: false }
  try {
    const target = new URL(process.argv[2])
    if (
      target.protocol !== 'http:' ||
      target.hostname !== '127.0.0.1' ||
      target.pathname !== '/' ||
      target.username ||
      target.password ||
      target.hash
    )
      throw new Error('Untrusted fixture browser target')
    const setupKey = target.searchParams.get('setup')
    let ownerToken: string | undefined
    if (setupKey) {
      const response = await fetch(new URL('/setup', target.origin), {
        method: 'POST',
        headers: {
          origin: target.origin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Portable browser workspace',
          key: setupKey,
        }),
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      })
      if (response.status !== 200) throw new Error('Public setup failed')
      const receipt = await boundedJSON(response)
      if (typeof receipt.token !== 'string' || receipt.token.length < 32)
        throw new Error('Public setup receipt was invalid')
      ownerToken = receipt.token
    }
    const status = await fetch(new URL('/setup/status', target.origin), {
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    })
    if (status.status !== 200 || (await boundedJSON(status)).required !== false)
      throw new Error('Workspace was not configured')
    report = {
      ok: true,
      origin: target.origin,
      setupChallengePresent: Boolean(setupKey),
      ...(setupKey ? { setupChallenge: setupKey } : {}),
      ...(ownerToken ? { ownerToken } : {}),
    }
  } catch {
    // Do not return caught exceptions: HTTP errors can contain the setup URL.
    process.exitCode = 1
  }

  const delivery = await fetch(callback, {
    method: 'POST',
    headers: {
      'x-besh-browser-fixture': proof,
      'content-type': 'application/json',
    },
    body: JSON.stringify(report),
    redirect: 'manual',
    signal: AbortSignal.timeout(5_000),
  })
  await delivery.body?.cancel()
  if (delivery.status !== 204) process.exitCode = 1
}

await main().catch(() => {
  process.exitCode = 1
})
export {}
