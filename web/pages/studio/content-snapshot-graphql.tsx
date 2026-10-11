import { Textarea } from '../../components/ui/textarea'
import { useTranslation } from '../../i18n'

export const contentSnapshotQuery = `query ContentSnapshot {
  contentSnapshot {
    document {
      type
      astVersion
      children {
        __typename
        ... on CmsHeading {
          level
          children {
            ... on CmsText { text }
          }
        }
        ... on CmsParagraph {
          children {
            ... on CmsText { text }
          }
        }
      }
    }
    html
    provenance {
      entryVersion
      rendererVersion
      releaseRevision
    }
  }
}`

export function ContentSnapshotGraphql({ schema }: { schema: string }) {
  const { t } = useTranslation()

  return (
    <section className="graphql-schema form-stack">
      <p>
        {t(
          'GraphQL uses a fixed read-only schema. Create and publish explicitly before calling it.',
        )}
      </p>
      <label htmlFor="content-snapshot-graphql-schema">
        {t('Fixed GraphQL schema')}
      </label>
      <Textarea
        id="content-snapshot-graphql-schema"
        aria-label={t('Fixed GraphQL schema')}
        className="code-input max-h-64"
        rows={7}
        spellCheck={false}
        readOnly
        value={schema}
      />
      <p>
        {t(
          'Select the document, HTML and provenance fields you need. Queries do not read newer source content.',
        )}
      </p>
      <label htmlFor="content-snapshot-graphql-query">
        {t('Example GraphQL query')}
      </label>
      <Textarea
        id="content-snapshot-graphql-query"
        aria-label={t('Example GraphQL query')}
        className="code-input max-h-64"
        rows={9}
        spellCheck={false}
        readOnly
        value={contentSnapshotQuery}
      />
    </section>
  )
}
