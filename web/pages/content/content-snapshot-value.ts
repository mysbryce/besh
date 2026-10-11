import type { SavedFlow } from '../../types/api'

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function keys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value)
  return (
    actual.length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  )
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)
}

function position(value: unknown) {
  return (
    record(value) &&
    keys(value, ['x', 'y']) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  )
}

export function verifyContentSnapshotFlow(
  value: unknown,
  name: string,
  path: string,
): SavedFlow | null {
  if (
    !record(value) ||
    !keys(value, [
      'id',
      'name',
      'method',
      'path',
      'nodes',
      'edges',
      'revision',
      'publishedRevision',
      'publishedEndpoint',
    ]) ||
    !identifier(value.id) ||
    value.name !== name ||
    value.path !== path ||
    value.method !== 'GET' ||
    value.revision !== 1 ||
    value.publishedRevision !== null ||
    value.publishedEndpoint !== null ||
    !Array.isArray(value.nodes) ||
    value.nodes.length !== 2 ||
    !Array.isArray(value.edges) ||
    value.edges.length !== 1
  )
    return null

  const [request, terminal] = value.nodes
  const edge = value.edges[0]
  if (
    !record(request) ||
    !record(terminal) ||
    !record(edge) ||
    !keys(request, ['id', 'type', 'position', 'config']) ||
    !keys(terminal, ['id', 'type', 'position', 'config']) ||
    !keys(edge, ['id', 'source', 'target']) ||
    !identifier(request.id) ||
    !identifier(terminal.id) ||
    request.id === terminal.id ||
    !identifier(edge.id) ||
    edge.source !== request.id ||
    edge.target !== terminal.id ||
    request.type !== 'request' ||
    terminal.type !== 'cmsSnapshotResponse' ||
    !position(request.position) ||
    !position(terminal.position) ||
    !record(request.config) ||
    !keys(request.config, []) ||
    !record(terminal.config) ||
    !keys(terminal.config, ['snapshotId', 'snapshotSha256']) ||
    !identifier(terminal.config.snapshotId) ||
    typeof terminal.config.snapshotSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(terminal.config.snapshotSha256)
  )
    return null

  return value as SavedFlow
}

export async function verifyGraphqlContentSnapshotFlow(
  value: unknown,
  name: string,
  path: string,
): Promise<SavedFlow | null> {
  if (
    !record(value) ||
    !keys(value, [
      'id',
      'name',
      'method',
      'path',
      'nodes',
      'edges',
      'graphql',
      'revision',
      'publishedRevision',
      'publishedEndpoint',
    ]) ||
    value.method !== 'POST' ||
    !record(value.graphql) ||
    !keys(value.graphql, ['schema']) ||
    typeof value.graphql.schema !== 'string' ||
    value.graphql.schema.length > 16_384
  )
    return null

  const { graphql, ...sealed } = value
  if (!verifyContentSnapshotFlow({ ...sealed, method: 'GET' }, name, path))
    return null

  // Pin the closed server contract without importing its runtime into the dashboard.
  try {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(graphql.schema as string),
    )
    const sha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    if (
      sha256 !==
      'ec57b19d96a2cdabb56b3c3450463389a261c50ac3b6294fc8fd85efc355ad45'
    )
      return null

    return value as SavedFlow
  } catch {
    return null
  }
}
