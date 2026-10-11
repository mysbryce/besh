import { GraphQLError } from 'graphql'
import type { readCmsSnapshot } from './cms-snapshot'
import type { TrustedGraphqlExecution } from './graphql'
import type { Flow } from './model'

const nodeTypes: Record<string, string> = {
  paragraph: 'CmsParagraph',
  heading: 'CmsHeading',
  text: 'CmsText',
  link: 'CmsLink',
  lineBreak: 'CmsLineBreak',
  list: 'CmsList',
  listItem: 'CmsListItem',
  table: 'CmsTable',
  tableRow: 'CmsTableRow',
  tableCell: 'CmsTableCell',
  quote: 'CmsQuote',
  code: 'CmsCode',
  horizontalRule: 'CmsHorizontalRule',
}

function resolveType(value: unknown) {
  if (value === null || typeof value !== 'object') return undefined

  if (Object.hasOwn(value, 'key')) return 'CmsFieldKey'
  if (Object.hasOwn(value, 'index')) return 'CmsFieldIndex'

  const kind = (value as { type?: unknown }).type
  return typeof kind === 'string' && Object.hasOwn(nodeTypes, kind)
    ? nodeTypes[kind]
    : undefined
}

export function cmsGraphqlExecution(
  snapshot: ReturnType<typeof readCmsSnapshot>,
  definition: Flow,
): TrustedGraphqlExecution {
  const reviewed = snapshot.provenance
  const body = {
    document: snapshot.document,
    html: snapshot.html,
    provenance: {
      ...reviewed,
      collectionVersion: String(reviewed.collectionVersion),
      structVersion: String(reviewed.structVersion),
      entryVersion: String(reviewed.entryVersion),
      rendererVersion: String(reviewed.rendererVersion),
      releaseRevision: String(reviewed.releaseRevision),
      fieldPath: reviewed.fieldPath.map((segment) =>
        typeof segment === 'string'
          ? { key: segment }
          : { index: String(segment) },
      ),
    },
  }

  // Only the admitted seal is projected; authored text never becomes a resolver.
  return {
    resolveRoot(fieldName) {
      if (fieldName !== 'contentSnapshot')
        throw new GraphQLError('Unknown CMS snapshot field')

      return {
        status: 200,
        body,
        visited: definition.nodes.map((node) => node.id),
      }
    },
    resolveType,
  }
}
