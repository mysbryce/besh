import { ApiError } from '../errors'

export type SheetFetch = (
  url: string,
  options: RequestInit,
) => Promise<Response>
const byteLimit = 2 * 1024 * 1024

function sheetLink(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ApiError(400, 'Paste a standard Google Sheets share link')
  }
  const match = url.pathname.match(
    /^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,150})(?:\/(?:edit|view|preview|export))?\/?$/,
  )
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'docs.google.com' ||
    url.port ||
    url.username ||
    url.password ||
    !match
  )
    throw new ApiError(400, 'Paste a standard HTTPS Google Sheets share link')
  const hash = new URLSearchParams(url.hash.slice(1))
  const gids = [...url.searchParams.getAll('gid'), ...hash.getAll('gid')]
  const gid = gids[0] ?? '0'
  if (gids.length > 1 || !/^\d{1,10}$/.test(gid) || Number(gid) > 2_147_483_647)
    throw new ApiError(400, 'Google Sheet tab id must be a valid number')
  return {
    exportUrl: `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${Number(gid)}`,
    sourceUrl: `https://docs.google.com/spreadsheets/d/${match[1]}/edit#gid=${Number(gid)}`,
  }
}

function redirectUrl(location: string, current: string) {
  const url = new URL(location, current)
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    !(
      url.hostname === 'docs.google.com' ||
      /^doc-[a-z0-9-]+-sheets\.googleusercontent\.com$/.test(url.hostname)
    )
  )
    throw new ApiError(400, 'Google Sheets returned an unsupported redirect')
  return url.href
}

export async function fetchGoogleSheet(
  value: string,
  provider: SheetFetch = fetch,
) {
  const link = sheetLink(value)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(
        new ApiError(
          504,
          'Google Sheets timed out. Try again or upload Excel/CSV instead.',
        ),
      )
    }, 10_000)
  })
  let response: Response | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    let url = link.exportUrl
    for (let redirects = 0; ; redirects++) {
      response = await Promise.race([
        provider(url, {
          redirect: 'manual',
          credentials: 'omit',
          signal: controller.signal,
          headers: { accept: 'text/csv' },
        }),
        deadline,
      ])
      if (![301, 302, 303, 307, 308].includes(response.status)) break
      const location = response.headers.get('location')
      await Promise.race([response.body?.cancel(), deadline])
      if (!location || redirects >= 3)
        throw new ApiError(400, 'Google Sheets returned too many redirects')
      url = redirectUrl(location, url)
    }
    if (
      !response.ok ||
      !/^(text\/csv|application\/csv|text\/plain)(?:;|$)/i.test(
        response.headers.get('content-type') ?? '',
      )
    )
      throw new ApiError(
        400,
        'Google Sheet is unavailable. Share it for anyone to view, or upload Excel/CSV instead. Private Google sign-in is not connected.',
      )
    const length = Number(response.headers.get('content-length'))
    if (length > byteLimit)
      throw new ApiError(400, 'Google Sheet exceeds the 2 MiB import limit')
    if (!response.body) throw new ApiError(400, 'Google Sheet has no CSV data')
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline])
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > byteLimit)
        throw new ApiError(400, 'Google Sheet exceeds the 2 MiB import limit')
      chunks.push(chunk.value)
    }
    return { ...link, bytes: Buffer.concat(chunks) }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      502,
      'Google Sheets could not be read. Try again or upload Excel/CSV instead.',
    )
  } finally {
    clearTimeout(timer)
    controller.abort()
    if (reader) void reader.cancel().catch(() => {})
    else if (response?.body && !response.body.locked)
      void response.body.cancel().catch(() => {})
  }
}
