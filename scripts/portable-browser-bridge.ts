// Compile only for the owned artifact browser journey. This executable forwards
// the genuine browser handoff to its authenticated parent. It never calls setup,
// creates a session, prints a URL or writes per-run credentials.

async function main() {
  const value = process.env.BESH_TEST_UI_BROWSER_CALLBACK
  const nonce = process.env.BESH_TEST_UI_BROWSER_NONCE
  if (!value || !nonce || process.argv.length !== 3) throw new Error()

  const callback = new URL(value)
  const target = new URL(process.argv[2])
  if (
    callback.protocol !== 'http:' ||
    callback.hostname !== '127.0.0.1' ||
    !callback.port ||
    callback.pathname !== '/browser' ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash ||
    target.protocol !== 'http:' ||
    target.hostname !== '127.0.0.1' ||
    !target.port ||
    target.pathname !== '/' ||
    target.username ||
    target.password ||
    target.hash ||
    target.href.length > 4096 ||
    [...target.searchParams.keys()].length !== 1 ||
    !target.searchParams.get('setup')
  )
    throw new Error()

  const delivered = await fetch(callback, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-besh-ui-browser-fixture': nonce,
    },
    body: JSON.stringify({ url: target.href }),
    redirect: 'manual',
    signal: AbortSignal.timeout(5_000),
  })
  await delivered.body?.cancel()
  if (delivered.status !== 204) throw new Error()
}

await main().catch(() => {
  // Exceptions from URL parsing or fetch may contain the private setup URL.
  process.exitCode = 1
})
export {}
