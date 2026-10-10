import { expect, test } from 'bun:test'
import {
  json,
  withPortablePublication,
  type PortablePublicWorkspace,
} from './portable-publication-fixture'

// First-use network acceptance stays separate from offline CI.
const networkTest =
  process.env.BESH_TEST_PORTABLE_K6_NETWORK === '1' ? test : test.skip

const config = {
  vus: 1,
  durationSeconds: 1,
  p95Ms: 60_000,
  maxErrorRate: 0,
  expectedStatus: 200,
}

const requestMarker = 'Portable request must stay out of saved load history'

const flowDefinition = {
  name: 'Portable first-use load',
  method: 'POST',
  path: '/v1/PortableLoad',
  nodes: [
    { id: 'request', type: 'request', position: { x: 80, y: 100 }, config: {} },
    {
      id: 'response',
      type: 'response',
      position: { x: 400, y: 100 },
      config: { status: 200, body: { message: 'Publish' } },
    },
  ],
  edges: [{ id: 'one', source: 'request', target: 'response' }],
}

async function items(response: Response) {
  expect(response.status).toBe(200)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Public metadata collection had no body')
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > 256 * 1024)
        throw new Error('Public metadata collection exceeded its bound')
      chunks.push(part.value)
    }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (
      !Array.isArray(result) ||
      result.some(
        (item) => !item || typeof item !== 'object' || Array.isArray(item),
      )
    )
      throw new Error('Public metadata collection was not a record array')
    return result as Record<string, unknown>[]
  } catch {
    throw new Error('Public metadata collection was not bounded valid JSON')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function privateHistory(run: Record<string, unknown>, owner: string) {
  const allowed = [
    'id',
    'flowId',
    'flowName',
    'revision',
    'method',
    'path',
    'graphql',
    'config',
    'status',
    'createdAt',
    'finishedAt',
    'summary',
    'error',
    'tenantId',
    'cleanupOnly',
  ]
  expect(Object.keys(run).every((key) => allowed.includes(key))).toBe(true)
  const text = JSON.stringify(run)
  expect(!text.includes(owner) && !text.includes(requestMarker)).toBe(true)
}

async function terminal(workspace: PortablePublicWorkspace, id: string) {
  // Existing first-use bounds: 90s fetch/body, 30s extraction and a short
  // native run. This observation budget changes no product or CLI deadline.
  const deadline = Date.now() + 150_000
  while (Date.now() < deadline) {
    const response = await workspace.api(`/api/load-tests/${id}`)
    expect(response.status).toBe(200)
    const run = await json(response)
    privateHistory(run, workspace.owner)
    if (run.status !== 'running') return run
    await Bun.sleep(200)
  }
  throw new Error('Compiled first-use load test did not reach a terminal state')
}

function complete(run: Record<string, unknown>, id: string, flowId: string) {
  expect(
    run.id === id &&
      run.flowId === flowId &&
      run.flowName === flowDefinition.name &&
      run.revision === 1 &&
      run.method === 'POST' &&
      run.path === '/v1/PortableLoad' &&
      run.graphql === false &&
      run.tenantId === null,
  ).toBe(true)
  expect(run.status === 'completed' && run.error === null).toBe(true)
  expect(JSON.stringify(run.config) === JSON.stringify(config)).toBe(true)
  expect(
    typeof run.createdAt === 'string' &&
      typeof run.finishedAt === 'string' &&
      Number.isFinite(Date.parse(run.createdAt)) &&
      Date.parse(run.finishedAt) >= Date.parse(run.createdAt),
  ).toBe(true)
  const summary = run.summary
  if (!summary || typeof summary !== 'object' || Array.isArray(summary))
    throw new Error('Compiled native load test did not issue summary metrics')
  const metrics = summary as Record<string, unknown>
  const names = [
    'requests',
    'requestsPerSecond',
    'failedRequests',
    'checkRate',
    'avgMs',
    'p95Ms',
    'maxMs',
    'thresholdsPassed',
  ]
  expect(
    Object.keys(metrics).length === names.length &&
      Object.keys(metrics).every((key) => names.includes(key)),
  ).toBe(true)
  expect(
    names
      .filter((name) => name !== 'thresholdsPassed')
      .every((name) => {
        const value = metrics[name]
        return typeof value === 'number' && Number.isFinite(value) && value >= 0
      }),
  ).toBe(true)
  expect(
    typeof metrics.requests === 'number' &&
      Number.isInteger(metrics.requests) &&
      metrics.requests >= 1 &&
      typeof metrics.requestsPerSecond === 'number' &&
      metrics.requestsPerSecond > 0 &&
      metrics.failedRequests === 0 &&
      metrics.checkRate === 1 &&
      metrics.thresholdsPassed === true,
  ).toBe(true)
}

async function cleanupMetadata(
  workspace: PortablePublicWorkspace,
  flowId: string,
) {
  const keys = await items(await workspace.api('/api/runtime-keys'))
  expect(!JSON.stringify(keys).includes(workspace.owner)).toBe(true)
  expect(keys.every((key) => !('token' in key) && !('token_hash' in key))).toBe(
    true,
  )
  const managed = keys.filter(
    (key) => key.managedBy === 'load-test' && key.flowId === flowId,
  )
  expect(managed.length === 1).toBe(true)
  const key = managed[0]
  expect(
    key.releaseRevision === 1 &&
      JSON.stringify(key.permissions) === JSON.stringify(['rest']) &&
      key.tenantId === null &&
      typeof key.revokedAt === 'string' &&
      Number.isFinite(Date.parse(key.revokedAt)),
  ).toBe(true)
  return key.id
}

networkTest(
  'portable first-use network provisioning runs native k6 and retains only metrics and revoked-key metadata after restart',
  async () => {
    await withPortablePublication(async (workspace) => {
      const response = await workspace.api('/api/flows', 'POST', flowDefinition)
      expect(response.status).toBe(200)
      const created = await json(response)
      if (typeof created.id !== 'string' || !created.id)
        throw new Error(
          'Compiled management API did not return a flow identity',
        )
      const flowId = created.id
      const publication = await workspace.api(
        `/api/flows/${flowId}/publish`,
        'POST',
        { revision: 1 },
      )
      expect(publication.status).toBe(200)
      expect((await json(publication)).publishedRevision === 1).toBe(true)
      const initial = await items(await workspace.api('/api/runtime-keys'))
      expect(initial.length === 0).toBe(true)
      const body = {
        flowId,
        config,
        request: { body: { privateMarker: requestMarker }, query: {} },
      }
      const denied = await workspace.api('/api/load-tests', 'POST', body, '')
      expect(denied.status).toBe(401)
      await denied.body?.cancel()
      const started = await workspace.api('/api/load-tests', 'POST', body)
      expect(started.status).toBe(202)
      const receipt = await json(started)
      if (typeof receipt.id !== 'string' || !receipt.id)
        throw new Error('Compiled load API did not return a job identity')
      const id = receipt.id
      privateHistory(receipt, workspace.owner)
      const finished = await terminal(workspace, id)
      complete(finished, id, flowId)
      const managedId = await cleanupMetadata(workspace, flowId)
      await workspace.restart()
      const restored = await workspace.api(`/api/load-tests/${id}`)
      expect(restored.status).toBe(200)
      const history = await json(restored)
      privateHistory(history, workspace.owner)
      complete(history, id, flowId)
      expect(JSON.stringify(history) === JSON.stringify(finished)).toBe(true)
      expect((await cleanupMetadata(workspace, flowId)) === managedId).toBe(
        true,
      )
      const list = await items(await workspace.api('/api/load-tests'))
      expect(
        list.length === 1 &&
          JSON.stringify(list[0]) === JSON.stringify(finished),
      ).toBe(true)
    })
  },
  180_000,
)
