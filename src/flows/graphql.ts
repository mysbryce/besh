import {
  buildASTSchema,
  assertValidSchema,
  execute,
  parse,
  validate,
  specifiedRules,
  NoSchemaIntrospectionCustomRule,
  getOperationAST,
  GraphQLError,
  isScalarType,
  isSpecifiedScalarType,
  Kind,
  type DocumentNode,
  type SelectionSetNode,
} from 'graphql'
import { z } from 'zod'
import { assertJsonLimit, executeFlow } from './engine'
import type { Flow, FlowResult, FlowContext } from './model'
import { ApiError } from '../errors'
import type { RuntimePermission } from '../workspace/store'
import { checkMixedGraphqlRows } from './read-graph'
import { assertMixedReadOperation } from './graphql-operation'

const requestSchema = z.object({
  query: z.string().min(1).max(16_384),
  variables: z.record(z.string(), z.unknown()).nullish(),
  operationName: z.string().min(1).max(100).nullish(),
})

export function graphqlSchema(flow: Flow) {
  if (!flow.graphql) throw new Error('This API does not have a GraphQL schema')
  if (flow.method !== 'POST') throw new Error('GraphQL APIs use POST')
  const schema = buildASTSchema(
    parse(flow.graphql.schema, { maxTokens: 2_000 }),
  )
  assertValidSchema(schema)
  if (schema.getSubscriptionType())
    throw new Error('GraphQL subscriptions are not supported yet')
  if (
    Object.values(schema.getTypeMap()).some(
      (type) => isScalarType(type) && !isSpecifiedScalarType(type),
    )
  )
    throw new Error(
      'Custom GraphQL scalar implementations are not supported yet',
    )
  return schema
}

export function operationLimits(
  document: DocumentNode,
  operationName?: string | null,
  maxRoots = 16,
) {
  const operation = getOperationAST(document, operationName)
  if (!operation) throw new Error('Choose one operation with operationName')
  if (operation.operation === 'subscription')
    throw new Error('Subscriptions are not supported yet')

  const fragments = new Map(
    document.definitions
      .filter((node) => node.kind === Kind.FRAGMENT_DEFINITION)
      .map((node) => [node.name.value, node]),
  )
  let fields = 0
  let roots = 0

  function walk(selectionSet: SelectionSetNode, depth: number) {
    if (depth > 12) throw new Error('GraphQL depth limit exceeded (12)')
    for (const node of selectionSet.selections) {
      if (node.kind === Kind.FIELD) {
        fields++
        if (depth === 1) roots++
        if (roots > maxRoots && maxRoots === 1)
          throw new Error('Use one product login root per mutation')
        if (fields > 200 || roots > maxRoots)
          throw new Error(
            'GraphQL field limit exceeded (200 fields, 16 root fields)',
          )
        if (node.selectionSet) walk(node.selectionSet, depth + 1)
      } else if (node.kind === Kind.INLINE_FRAGMENT) {
        walk(node.selectionSet, depth)
      } else {
        const fragment = fragments.get(node.name.value)
        if (fragment) walk(fragment.selectionSet, depth)
      }
    }
  }

  walk(operation.selectionSet, 1)
  return fields
}

function failure(message: string): FlowResult {
  return { status: 400, body: { errors: [{ message }] }, visited: [] }
}

export async function executeGraphql(
  flow: Flow,
  value: unknown,
  permissions?: readonly RuntimePermission[],
  context: FlowContext = {},
): Promise<FlowResult> {
  try {
    assertJsonLimit(value)
  } catch {
    return failure('GraphQL input size or nesting limit exceeded')
  }
  const parsed = requestSchema.safeParse(value)
  if (!parsed.success)
    return failure(
      'Use a GraphQL query, optional variables object, and operationName',
    )
  const request = parsed.data
  const schema = graphqlSchema(flow)
  let document: DocumentNode
  let fields: number
  let operation: string
  try {
    document = parse(request.query, { maxTokens: 2_000 })
    const errors = validate(
      schema,
      document,
      [...specifiedRules, NoSchemaIntrospectionCustomRule],
      { maxErrors: 10 },
    )
    if (errors.length)
      return {
        status: 400,
        body: { errors: errors.map((error) => error.toJSON()) },
        visited: [],
      }
    const selected = getOperationAST(document, request.operationName)
    if (!selected) throw new Error('Choose one operation with operationName')
    operation = selected.operation
    fields = operationLimits(
      document,
      request.operationName,
      operation === 'mutation' &&
        flow.nodes.some((node) => node.type === 'social')
        ? 1
        : 16,
    )
    if (context.mixedProtectedRead)
      assertMixedReadOperation(
        schema,
        document,
        request.operationName,
        request.variables ?? {},
      )
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message.slice(0, 180)
        : 'Invalid GraphQL operation',
    )
  }

  if (
    permissions &&
    !permissions.some((permission) => permission === operation)
  )
    throw new ApiError(403, 'Runtime key does not allow this GraphQL operation')

  const visited: string[] = []
  let resolutions = 0
  let estimatedBytes = 0
  let invalidRows = false
  const result = await execute({
    schema,
    document,
    variableValues: request.variables,
    operationName: request.operationName,
    fieldResolver(source, args, _context, info) {
      if (++resolutions > 5_000)
        throw new GraphQLError('GraphQL resolution limit exceeded', {
          extensions: { code: 'EXECUTION_LIMIT' },
        })
      if (
        !info.path.prev &&
        (info.parentType === schema.getQueryType() ||
          info.parentType === schema.getMutationType())
      ) {
        if (
          flow.nodes.some((node) => node.type === 'social') &&
          info.operation.operation !== 'mutation'
        ) {
          if (info.fieldName === 'info') return 'GitHub product login'
          throw new GraphQLError('Product login requires a mutation')
        }
        const promise = executeFlow(
          flow,
          {
            body: args,
            query: {
              field: info.fieldName,
              operation: info.operation.operation,
            },
          },
          context,
        )
        return promise.then((run) => {
          visited.push(...run.visited)
          if (run.status >= 400)
            throw new GraphQLError(`Flow returned HTTP ${run.status}`, {
              extensions: { code: 'FLOW_ERROR', status: run.status },
            })
          if (
            context.mixedProtectedRead &&
            !checkMixedGraphqlRows(schema, run.body)
          ) {
            invalidRows = true
            throw new GraphQLError('Response does not match GraphQL row rules')
          }
          estimatedBytes += Buffer.byteLength(JSON.stringify(run.body)) * fields
          if (estimatedBytes > 262_144)
            throw new GraphQLError('GraphQL response budget exceeded', {
              extensions: { code: 'EXECUTION_LIMIT' },
            })
          return run.body
        })
      }
      return source && Object.hasOwn(source, info.fieldName)
        ? source[info.fieldName]
        : undefined
    },
  })

  if (invalidRows)
    return {
      status: 500,
      body: {
        errors: [{ message: 'Response does not match GraphQL row rules' }],
      },
      visited,
    }

  const executed = Object.hasOwn(result, 'data')
  const body = JSON.parse(
    JSON.stringify({
      ...result,
      errors: result.errors?.map((error) => ({
        ...error.toJSON(),
        message:
          executed &&
          !['FLOW_ERROR', 'EXECUTION_LIMIT'].includes(
            String(error.extensions.code),
          )
            ? 'GraphQL field could not be resolved'
            : error.message,
      })),
    }),
  )
  try {
    assertJsonLimit(body)
  } catch {
    return failure('GraphQL response size limit exceeded')
  }
  return { status: executed ? 200 : 400, body, visited }
}
