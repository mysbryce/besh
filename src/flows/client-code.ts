import { z } from 'zod'
import { ApiError } from '../errors'
import type { Flow } from './model'
import { assertJsonLimit } from './engine'
import { prepareInput } from './contracts'
import { concreteRoute } from './routes'
import { renderClientCode } from './client-code-renderers'
import { graphqlSchema, operationLimits } from './graphql'
import {
  getOperationAST,
  getVariableValues,
  NoSchemaIntrospectionCustomRule,
  parse,
  specifiedRules,
  validate,
} from 'graphql'
import {
  clientCodeTargets,
  type ClientCodeResult,
  type ClientCodeSource,
} from './client-code-model'

const textRecord = z
  .record(z.string().min(1).max(256), z.string().max(4096))
  .refine((value) => Object.keys(value).length <= 64)
export const clientCodeSchema = z
  .object({
    target: z.enum(clientCodeTargets.map((target) => target.id)),
    source: z.enum(['published', 'draft']).optional(),
    revision: z.number().int().positive().safe(),
    baseUrl: z.string().min(1).max(2048),
    request: z
      .object({
        params: textRecord.optional(),
        query: textRecord.optional(),
        body: z.unknown().optional(),
        graphql: z
          .object({
            query: z.string().min(1).max(16384),
            variables: z.record(z.string(), z.unknown()).optional(),
            operationName: z.string().min(1).max(100).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export function flowClientCode(
  flow: Flow,
  source: ClientCodeSource,
  value: z.infer<typeof clientCodeSchema>,
): ClientCodeResult {
  const target = clientCodeTargets.find((item) => item.id === value.target)!
  const request = value.request ?? {}
  try {
    assertJsonLimit(request)
  } catch {
    throw new ApiError(400, 'Example input size or nesting limit exceeded')
  }
  let base: URL
  try {
    base = new URL(value.baseUrl)
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      /[?#]/.test(value.baseUrl) ||
      /[\u0000-\u0020\u007f]/.test(value.baseUrl)
    )
      throw new Error()
  } catch {
    throw new ApiError(
      400,
      'Use an HTTP(S) base URL without credentials, query, fragment, or control characters',
    )
  }
  let route: string
  let body: string | undefined
  if (flow.graphql) {
    if (
      !request.graphql ||
      Object.hasOwn(request, 'body') ||
      Object.keys(request.query ?? {}).length ||
      Object.keys(request.params ?? {}).length
    )
      throw new ApiError(
        400,
        'Provide only GraphQL operation input for this API',
      )
    try {
      const schema = graphqlSchema(flow)
      const document = parse(request.graphql.query, { maxTokens: 2000 })
      if (
        validate(
          schema,
          document,
          [...specifiedRules, NoSchemaIntrospectionCustomRule],
          { maxErrors: 10 },
        ).length
      )
        throw new Error()
      const operation = getOperationAST(document, request.graphql.operationName)
      if (!operation || operation.operation === 'subscription')
        throw new Error()
      operationLimits(
        document,
        request.graphql.operationName,
        operation.operation === 'mutation' &&
          flow.nodes.some((node) => node.type === 'social')
          ? 1
          : 16,
      )
      if (
        getVariableValues(
          schema,
          operation.variableDefinitions ?? [],
          request.graphql.variables ?? {},
          { maxErrors: 10 },
        ).errors
      )
        throw new Error()
    } catch {
      throw new ApiError(
        400,
        'GraphQL operation or variables are invalid or exceed execution limits',
      )
    }
    route = flow.path
    body = JSON.stringify(request.graphql)
  } else {
    if (request.graphql) throw new ApiError(400, 'Use REST input for this API')
    if (['GET', 'HEAD'].includes(flow.method) && Object.hasOwn(request, 'body'))
      throw new ApiError(400, 'GET and HEAD examples cannot send a body')
    const params = request.params ?? {}
    prepareInput(flow.contract, {
      params,
      query: request.query ?? {},
      body: request.body,
    })
    route = concreteRoute(flow.path, params)
    body = Object.hasOwn(request, 'body')
      ? JSON.stringify(request.body)
      : undefined
  }
  const url = new URL(
    `${base.href.replace(/\/+$/, '')}/${flow.graphql ? 'graphql' : 'run'}${route}`,
  )
  if (!flow.graphql)
    for (const [key, item] of Object.entries(request.query ?? {}))
      url.searchParams.append(key, item)
  const code = renderClientCode(value.target, flow.method, url.href, body)
  if (Buffer.byteLength(code) > 65536)
    throw new ApiError(413, 'Code example size limit exceeded')
  return {
    target: value.target,
    source,
    revision: value.revision,
    method: flow.method,
    url: url.href,
    code,
    dependencies: target.dependencies,
    warnings:
      source === 'draft'
        ? [
            'Publish this saved revision first. The current live release may differ.',
          ]
        : [],
    filename: target.filename,
    contentType: 'text/plain',
  }
}
