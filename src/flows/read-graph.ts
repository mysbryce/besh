import type { Flow, FlowNode } from './model'
import {
  buildSchema,
  isListType,
  isNonNullType,
  isObjectType,
  isLeafType,
  isEnumType,
  type GraphQLSchema,
} from 'graphql'

export type ReadNode = Extract<FlowNode, { type: 'data' | 'database' }>
export type ReadGraph = {
  supported: boolean
  mixed: boolean
  reads: ReadNode[]
  terminalReads: ReadNode[]
}

function inputPath(value: string) {
  const parts = value.split('.')
  return (
    ['body', 'query', 'params'].includes(parts[0]!) &&
    parts.every(
      (part) =>
        /^[a-zA-Z0-9_-]+$/.test(part) &&
        !['__proto__', 'prototype', 'constructor'].includes(part),
    )
  )
}

/** Analyze all paths, including branches the current input will not take. */
export function readGraph(flow: Flow): ReadGraph {
  const reads = flow.nodes.filter(
    (node): node is ReadNode =>
      node.type === 'data' || node.type === 'database',
  )
  const conditions = flow.nodes.filter((node) => node.type === 'condition')
  const mixed = reads.length > 1 || conditions.length > 0
  const failed = { supported: false, mixed, reads, terminalReads: [] }
  if (reads.length < 1 || reads.length > 4 || conditions.length > 3)
    return failed
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]))
  const requests = flow.nodes.filter((node) => node.type === 'request')
  const responses = flow.nodes.filter((node) => node.type === 'response')
  if (
    nodes.size !== flow.nodes.length ||
    requests.length !== 1 ||
    responses.length !== 1 ||
    flow.nodes.some((node) => node.type === 'social') ||
    responses[0]!.config.status !== 200 ||
    responses[0]!.config.body !== '$data'
  )
    return failed
  const outgoing = new Map(
    flow.nodes.map((node) => [
      node.id,
      flow.edges.filter((edge) => edge.source === node.id),
    ]),
  )
  if (
    flow.edges.some(
      (edge) =>
        !nodes.has(edge.source) ||
        !nodes.has(edge.target) ||
        edge.target === requests[0]!.id,
    )
  )
    return failed
  for (const node of flow.nodes) {
    const edges = outgoing.get(node.id)!
    if (node.type === 'condition') {
      if (
        !inputPath(node.config.field) ||
        edges.length !== 2 ||
        edges.filter((edge) => edge.sourceHandle === 'true').length !== 1 ||
        edges.filter((edge) => edge.sourceHandle === 'false').length !== 1
      )
        return failed
    } else if (
      edges.length !== (node.type === 'response' ? 0 : 1) ||
      edges.some((edge) => edge.sourceHandle)
    )
      return failed
    if (
      (node.type === 'data' || node.type === 'database') &&
      typeof node.config.filter?.value === 'string' &&
      ((mixed && ['$data', '$auth'].includes(node.config.filter.value)) ||
        (node.config.filter.value.startsWith('$input.') &&
          !inputPath(node.config.filter.value.slice(7))))
    )
      return failed
  }
  const reached = new Set<string>()
  const stack = new Set<string>()
  const done = new Set<string>()
  const terminal = new Set<string>()
  let supported = true
  function walk(id: string, last: string | null) {
    if (stack.has(id)) {
      supported = false
      return
    }
    const state = JSON.stringify([id, last])
    if (done.has(state)) return
    const node = nodes.get(id)!
    reached.add(id)
    if (node.type === 'data' || node.type === 'database') last = id
    if (node.type === 'response') {
      if (last === null) supported = false
      else terminal.add(last)
    }
    stack.add(id)
    for (const edge of outgoing.get(id)!) walk(edge.target, last)
    stack.delete(id)
    done.add(state)
  }
  walk(requests[0]!.id, null)
  const terminalReads = reads.filter((node) => terminal.has(node.id))
  if (reached.size !== nodes.size) supported = false
  if (supported && mixed && !flow.graphql) {
    const response = flow.contract?.response
    if (
      !response ||
      response.type !== 'array' ||
      response.nullable ||
      response.maxItems === undefined ||
      response.maxItems > 100 ||
      response.items.type !== 'object' ||
      response.items.nullable ||
      response.items.additionalProperties !== false
    )
      supported = false
    else {
      const properties = response.items.properties ?? {}
      const keys = Object.keys(properties).sort()
      supported =
        keys.length > 0 &&
        Object.values(properties).every(
          (field) => !['array', 'object'].includes(field.type),
        ) &&
        JSON.stringify([...(response.items.required ?? [])].sort()) ===
          JSON.stringify(keys) &&
        terminalReads.every(
          (node) =>
            JSON.stringify([...node.config.columns].sort()) ===
            JSON.stringify(keys),
        )
    }
  }
  return { supported, mixed, reads, terminalReads }
}

export function mixedReadGraph(flow: Flow) {
  return !flow.websocket && readGraph(flow).mixed
}

function rowType(schema: GraphQLSchema) {
  const fields = schema.getQueryType()?.getFields()
  if (
    schema.getMutationType() ||
    !fields ||
    Object.keys(fields).length !== 1 ||
    !fields.rows
  )
    return null
  const rows = isNonNullType(fields.rows.type)
    ? fields.rows.type.ofType
    : fields.rows.type
  if (!isListType(rows)) return null
  const row = isNonNullType(rows.ofType) ? rows.ofType.ofType : rows.ofType
  if (
    !isObjectType(row) ||
    Object.values(row.getFields()).some(
      (field) =>
        field.args.length > 0 ||
        !isLeafType(isNonNullType(field.type) ? field.type.ofType : field.type),
    )
  )
    return null
  return row
}

export function mixedGraphqlShape(
  flow: Flow,
  schema = buildSchema(flow.graphql!.schema),
) {
  const graph = readGraph(flow)
  const row = rowType(schema)
  if (!row || !graph.supported) return false
  const keys = Object.keys(row.getFields()).sort()
  return graph.terminalReads.every(
    (node) =>
      JSON.stringify([...node.config.columns].sort()) === JSON.stringify(keys),
  )
}

export function checkMixedGraphqlRows(schema: GraphQLSchema, value: unknown) {
  const row = rowType(schema)
  if (!row || !Array.isArray(value) || value.length > 100) return false
  const fields = row.getFields()
  const keys = Object.keys(fields).sort()
  return value.every((item: unknown) => {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(keys)
    )
      return false
    return Object.entries(fields).every(([key, field]) => {
      const actual = (item as Record<string, unknown>)[key]
      if (actual === null) return !isNonNullType(field.type)
      const type = isNonNullType(field.type) ? field.type.ofType : field.type
      if (!isLeafType(type)) return false
      if (isEnumType(type))
        return (
          typeof actual === 'string' &&
          type.getValues().some((entry) => entry.name === actual)
        )
      if (type.name === 'String' || type.name === 'ID')
        return typeof actual === 'string'
      if (type.name === 'Boolean') return typeof actual === 'boolean'
      if (type.name === 'Float')
        return typeof actual === 'number' && Number.isFinite(actual)
      if (type.name === 'Int')
        return (
          typeof actual === 'number' &&
          Number.isInteger(actual) &&
          actual >= -2147483648 &&
          actual <= 2147483647
        )
      return false
    })
  })
}
