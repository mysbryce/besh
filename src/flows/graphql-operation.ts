import {
  getOperationAST,
  getVariableValues,
  getDirectiveValues,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  isAbstractType,
  Kind,
  type DocumentNode,
  type GraphQLSchema,
  type SelectionSetNode,
} from 'graphql'

/** Count executions after normal document validation, before any resolver runs. */
export function assertMixedReadOperation(
  schema: GraphQLSchema,
  document: DocumentNode,
  operationName?: string | null,
  inputs: Record<string, unknown> = {},
) {
  const operation = getOperationAST(document, operationName)
  if (!operation) throw new Error('Choose one operation with operationName')
  const variables = getVariableValues(
    schema,
    operation.variableDefinitions ?? [],
    inputs,
    { maxErrors: 10 },
  )
  if (variables.errors)
    throw new Error('GraphQL variables do not match the operation')
  const queryType = schema.getQueryType()
  if (operation.operation !== 'query' || !queryType)
    throw new Error('Mixed protected reads require a query')
  const fragments = new Map(
    document.definitions
      .filter((node) => node.kind === Kind.FRAGMENT_DEFINITION)
      .map((node) => [node.name.value, node]),
  )
  const visited = new Set<string>()
  const keys = new Set<string>()
  function included(node: Parameters<typeof getDirectiveValues>[1]) {
    return (
      getDirectiveValues(GraphQLSkipDirective, node, variables.variableValues)
        ?.if !== true &&
      getDirectiveValues(
        GraphQLIncludeDirective,
        node,
        variables.variableValues,
      )?.if !== false
    )
  }
  function matches(name?: string) {
    if (!name) return true
    const type = schema.getType(name)
    return (
      type === queryType ||
      Boolean(
        type && isAbstractType(type) && schema.isSubType(type, queryType!),
      )
    )
  }
  function collect(selection: SelectionSetNode) {
    for (const node of selection.selections) {
      if (!included(node)) continue
      if (node.kind === Kind.FIELD) {
        if (node.name.value === 'rows')
          keys.add(node.alias?.value ?? node.name.value)
      } else if (node.kind === Kind.INLINE_FRAGMENT) {
        if (matches(node.typeCondition?.name.value)) collect(node.selectionSet)
      } else {
        const fragment = fragments.get(node.name.value)
        if (
          !fragment ||
          visited.has(node.name.value) ||
          !matches(fragment.typeCondition.name.value)
        )
          continue
        visited.add(node.name.value)
        collect(fragment.selectionSet)
      }
    }
  }
  collect(operation.selectionSet)
  if (keys.size > 1)
    throw new Error(
      'Use at most one active rows response key for a mixed protected read graph',
    )
}
