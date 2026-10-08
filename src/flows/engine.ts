import {
  flowSchema,
  type Flow,
  type FlowInput,
  type FlowResult,
  type FlowNode,
  type FlowContext,
} from './model'
import { checkValue, prepareInput } from './contracts'
import { ApiError } from '../errors'
import { concreteRoute } from './routes'

export function validateFlow(value: unknown) {
  assertJsonLimit(value)
  const flow = flowSchema.parse(value)
  if (flow.nodes.filter((node) => node.type === 'database').length > 4)
    throw new Error('Use at most four database nodes per flow')
  if (flow.nodes.filter((node) => node.type === 'social').length > 1)
    throw new Error('Use at most one product login node per flow')
  if (
    flow.nodes.some((node) => node.type === 'social') &&
    flow.method !== 'POST'
  )
    throw new Error('Product login APIs use POST')
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]))
  if (nodes.size !== flow.nodes.length)
    throw new Error('Node IDs must be unique')
  if (new Set(flow.edges.map((edge) => edge.id)).size !== flow.edges.length)
    throw new Error('Edge IDs must be unique')
  const roots = flow.nodes.filter((node) => node.type === 'request')
  if (roots.length !== 1) throw new Error('Use exactly one request node')
  for (const edge of flow.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target))
      throw new Error('Edge references a missing node')
    if (edge.target === roots[0].id)
      throw new Error('Request cannot have incoming edges')
  }
  for (const node of flow.nodes) {
    const outgoing = flow.edges.filter((edge) => edge.source === node.id)
    if (node.type === 'condition') {
      if (
        outgoing.length !== 2 ||
        outgoing.filter((edge) => edge.sourceHandle === 'true').length !== 1 ||
        outgoing.filter((edge) => edge.sourceHandle === 'false').length !== 1
      )
        throw new Error('Conditions need true and false connections')
      readPath({}, node.config.field)
    } else if (outgoing.length !== (node.type === 'response' ? 0 : 1))
      throw new Error('Each path must end with a response')
    if (node.type === 'response')
      resolveValue(node.config.body, { body: null, query: {} })
    if (node.type === 'data' || node.type === 'database') {
      if (new Set(node.config.columns).size !== node.config.columns.length)
        throw new Error('Choose each data column once')
      if (node.config.filter)
        resolveValue(node.config.filter.value, { body: null, query: {} })
    }
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('Cycles are not supported')
    if (visited.has(id)) return
    visiting.add(id)
    for (const edge of flow.edges.filter((item) => item.source === id))
      visit(edge.target)
    visiting.delete(id)
    visited.add(id)
  }
  visit(roots[0].id)
  if (visited.size !== nodes.size)
    throw new Error('Remove or connect unreachable nodes')
  return flow
}

export function assertJsonLimit(value: unknown) {
  function depth(item: unknown, level: number) {
    if (level > 24) throw new Error('JSON nesting limit exceeded')
    if (item && typeof item === 'object') {
      for (const child of Object.values(item)) depth(child, level + 1)
    }
  }

  depth(value, 0)
  if (new TextEncoder().encode(JSON.stringify(value)).length > 262_144)
    throw new Error('JSON size limit exceeded')
}

function readPath(input: unknown, path: string): unknown {
  const parts = path.split('.')
  if (
    !['body', 'query', 'params'].includes(parts[0]) ||
    parts.some(
      (part) =>
        !/^[a-zA-Z0-9_-]+$/.test(part) ||
        ['__proto__', 'prototype', 'constructor'].includes(part),
    )
  )
    throw new Error('Invalid input reference')
  let result = input
  for (const part of parts) {
    if (
      result === null ||
      typeof result !== 'object' ||
      !Object.hasOwn(result, part)
    )
      return null
    result = (result as Record<string, unknown>)[part]
  }
  return result
}

function resolveValue(
  value: unknown,
  input: ReturnType<typeof prepareInput>,
  data: unknown = null,
  depth = 0,
  auth: unknown = null,
): unknown {
  if (depth > 20) throw new Error('Response nesting limit exceeded')
  if (typeof value === 'string' && value.startsWith('$input.'))
    return readPath(input, value.slice(7))
  if (value === '$data') return data
  if (value === '$auth') return auth
  if (Array.isArray(value))
    return value.map((item) => resolveValue(item, input, data, depth + 1, auth))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveValue(item, input, data, depth + 1, auth),
      ]),
    )
  return value
}

export async function executeFlow(
  value: unknown,
  input: FlowInput,
  context: FlowContext = {},
): Promise<FlowResult> {
  assertJsonLimit(input)
  const flow = validateFlow(value)
  concreteRoute(flow.path, input.params)
  const prepared = prepareInput(flow.contract, input)
  let node: FlowNode | undefined = flow.nodes.find(
    (item) => item.type === 'request',
  )
  const visited: string[] = []
  let data: unknown = null
  let auth: unknown = null
  while (node && visited.length < 64) {
    visited.push(node.id)
    if (node.type === 'response') {
      const body = resolveValue(node.config.body, prepared, data, 0, auth)
      assertJsonLimit(body)
      if (flow.contract?.response) {
        try {
          checkValue(flow.contract.response, body, 'response')
        } catch {
          throw new ApiError(500, 'Response does not match response rules')
        }
      }
      return { status: node.config.status, body, visited }
    }
    if (node.type === 'social') {
      if (!context.social)
        throw new Error('Product auth connections are unavailable')
      auth = await context.social(node.config, prepared)
      assertJsonLimit(auth)
    }
    if (node.type === 'data' || node.type === 'database') {
      const configured = node.config.filter
      const resolved = configured
        ? resolveValue(configured.value, prepared, data)
        : null
      const filter =
        configured &&
        !(
          typeof configured.value === 'string' &&
          configured.value.startsWith('$input.') &&
          resolved === null
        )
          ? {
              column: configured.column,
              value: resolved as typeof configured.value,
            }
          : undefined
      if (node.type === 'database') {
        if (!context.readDatabase)
          throw new Error('Database copies are unavailable')
        data = await context.readDatabase({ ...node.config, filter })
      } else {
        if (!context.readData) throw new Error('Data sources are unavailable')
        data = context.readData({ ...node.config, filter })
      }
      assertJsonLimit(data)
    }
    const branch: string | null =
      node.type === 'condition'
        ? String(readPath(prepared, node.config.field) === node.config.equals)
        : null
    const edge: Flow['edges'][number] | undefined = flow.edges.find(
      (item) =>
        item.source === node!.id &&
        (branch === null || item.sourceHandle === branch),
    )
    node = flow.nodes.find((item) => item.id === edge?.target)
  }
  throw new Error('Flow must end with a response')
}
