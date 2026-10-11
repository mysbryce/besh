// One closed output contract preserves both rich-text versions without conversion.
export const cmsGraphqlSchema = `type Query {
  contentSnapshot: CmsContentSnapshot!
}

type CmsContentSnapshot {
  document: CmsDocument!
  html: String!
  provenance: CmsProvenance!
}

type CmsDocument {
  type: String!
  astVersion: Int!
  children: [CmsBlock!]!
}

union CmsBlock = CmsParagraph | CmsHeading | CmsList | CmsTable | CmsQuote | CmsCode | CmsHorizontalRule
union CmsInline = CmsText | CmsLink | CmsLineBreak
union CmsListItemBlock = CmsParagraph | CmsList

type CmsParagraph {
  type: String!
  children: [CmsInline!]!
}

type CmsHeading {
  type: String!
  level: Int!
  children: [CmsInline!]!
}

type CmsText {
  type: String!
  text: String!
  marks: [CmsTextMark!]
}

enum CmsTextMark {
  bold
  italic
  underline
  strikethrough
  code
}

type CmsLink {
  type: String!
  url: String!
  children: [CmsText!]!
}

type CmsLineBreak {
  type: String!
}

type CmsList {
  type: String!
  ordered: Boolean!
  start: Int!
  children: [CmsListItem!]!
}

type CmsListItem {
  type: String!
  children: [CmsListItemBlock!]!
}

type CmsTable {
  type: String!
  children: [CmsTableRow!]!
}

type CmsTableRow {
  type: String!
  children: [CmsTableCell!]!
}

type CmsTableCell {
  type: String!
  header: Boolean!
  children: [CmsParagraph!]!
}

type CmsQuote {
  type: String!
  children: [CmsParagraph!]!
}

type CmsCode {
  type: String!
  language: CmsCodeLanguage!
  text: String!
}

enum CmsCodeLanguage {
  plaintext
  javascript
}

type CmsHorizontalRule {
  type: String!
}

type CmsProvenance {
  collectionId: String!
  collectionVersion: String!
  structId: String!
  structVersion: String!
  entryId: String!
  entryVersion: String!
  fieldKey: String!
  fieldPath: [CmsFieldPathSegment!]!
  schemaVersion: Int!
  astVersion: Int!
  rendererSchemaVersion: Int!
  rendererSha256: String!
  rendererVersion: String!
  consumerContract: String
  flowId: String!
  releaseRevision: String!
  snapshotId: String!
  snapshotSha256: String!
}

union CmsFieldPathSegment = CmsFieldKey | CmsFieldIndex

type CmsFieldKey {
  key: String!
}

type CmsFieldIndex {
  index: String!
}
`
