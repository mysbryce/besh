import type { ApiSchema, Flow } from './model'

function jsonSchema(schema: ApiSchema): Record<string, unknown> {
  const { nullable, ...result } = schema
  const output: Record<string, unknown> = {
    ...result,
    type: nullable ? [schema.type, 'null'] : schema.type,
  }
  if (schema.type === 'object' && schema.properties)
    output.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, child]) => [
        name,
        jsonSchema(child),
      ]),
    )
  if (schema.type === 'array') output.items = jsonSchema(schema.items)
  return output
}

export function flowOpenapi(
  flow: Flow,
  id: string,
  revision: number,
  source: 'draft' | 'published',
) {
  const responseSchema = flow.contract?.response
    ? jsonSchema(flow.contract.response)
    : {}
  const statuses = new Set(
    flow.nodes
      .filter((node) => node.type === 'response')
      .map((node) => node.config.status),
  )
  const failures: Record<string, string> = {
    400: 'Invalid request or request rules failed',
    401: 'Missing, expired, revoked or invalid runtime API key',
    403: 'Runtime API key does not allow this flow or REST operation',
    404: 'Published endpoint not found',
    413: 'Request body size limit exceeded',
    500: 'Response rules failed or internal execution error',
  }
  if (flow.nodes.some((node) => node.type === 'social')) {
    failures[429] = 'Product login attempt or exchange limit exceeded'
    failures[502] = 'GitHub login could not be completed'
  }
  const errorSchema = {
    type: 'object',
    properties: { error: { type: 'string' } },
    required: ['error'],
    additionalProperties: false,
  }
  const responses = Object.fromEntries(
    [...new Set([...statuses, ...Object.keys(failures).map(Number)])]
      .sort((left, right) => left - right)
      .map((status) => {
        const declared = statuses.has(status)
        const failure = failures[status]
        const schema =
          declared && failure
            ? { anyOf: [responseSchema, errorSchema] }
            : declared
              ? responseSchema
              : errorSchema
        const empty = flow.method === 'HEAD' || [204, 205, 304].includes(status)
        return [
          String(status),
          {
            description:
              declared && failure
                ? `Flow response or ${failure.toLowerCase()}`
                : declared
                  ? 'Flow response'
                  : failure,
            ...(empty ? {} : { content: { 'application/json': { schema } } }),
          },
        ]
      }),
  )
  const query = flow.contract?.query
  const parameters =
    query?.type === 'object'
      ? Object.entries(query.properties ?? {}).map(([name, schema]) => ({
          name,
          in: 'query',
          required: query.required?.includes(name) ?? false,
          ...(schema.description ? { description: schema.description } : {}),
          schema: jsonSchema(schema),
        }))
      : []
  const body = flow.contract?.body
  return {
    openapi: '3.1.1',
    info: { title: flow.name, version: String(revision) },
    'x-besh-source': source,
    'x-besh-revision': revision,
    paths: {
      [`/run${flow.path}`]: {
        [flow.method.toLowerCase()]: {
          operationId: `flow_${id}`,
          security: [{ RuntimeKey: [] }],
          ...(query ? { 'x-besh-query-schema': jsonSchema(query) } : {}),
          ...(parameters.length ? { parameters } : {}),
          ...(body
            ? {
                requestBody: {
                  required: !body.nullable,
                  content: { 'application/json': { schema: jsonSchema(body) } },
                },
              }
            : {}),
          responses,
        },
      },
    },
    components: {
      securitySchemes: {
        RuntimeKey: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Unexpired runtime API key scoped to this flow with the rest grant',
        },
      },
    },
  }
}
