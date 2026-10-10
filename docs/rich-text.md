# Structured rich text — working contract

Source `0.23.0-alpha.0` provides owner-only literal paragraph forms and a formatted editor backed by strict versioned structured content. Focused journeys and the earlier complete local core/browser checks pass. Marker/readonly-title contrast repairs passed public RED/GREEN. The complete gallery is promoted with 1,261 images/45 receipts; byte-linked original review covers all 40 new images and 11 affected legacy/navigation images. The final fresh browser command passed all 65 cases in 292.68 seconds. The compiled local candidate passed all ten portable cases/1,080 assertions in 108.11 seconds. Hosted source delivery remains pending; no new executable release is published. HTML rendering and runtime publication remain separate planned work. Detailed [test receipts](testing.md#structured-rich-text--active-023-work) distinguish verified behavior from those remaining gates.

## Bind paired versions

A rich-text Struct field declares both versions, for example `{ "type": "richText", "schemaVersion": 2, "astVersion": 2 }`. The collection copies this schema from the reviewed saved Struct revision. Its document must use the corresponding `astVersion`; mismatched, omitted or unknown versions are rejected. Later model changes do not convert an existing collection or rewrite saved content.

Version one and version two are separate immutable contracts. There is no automatic upgrade or downgrade. The existing owner-only entry routes, version checks, metadata-only audits and full-backup confidentiality boundary still apply; see [private collections](collections.md).

## Literal paragraph version one

Schema version one pairs only with AST version one. It is restricted to top-level fields. A document contains paragraphs whose children are literal text leaves:

```json
{
  "type": "document",
  "astVersion": 1,
  "children": [
    {
      "type": "paragraph",
      "children": [{ "type": "text", "text": "<strong>literal text</strong>" }]
    }
  ]
}
```

The paragraph forms add/remove paragraphs and text leaves without asking users to write JSON. Empty documents, paragraphs and text leaves are valid. Markup characters remain text; version one has no formatting marks, links, HTML renderer or hidden conversion.

## Formatted structured version two

Schema version two pairs only with AST version two and supports placement inside reviewed groups and list item schemas. A document has exact `{ type: 'document', astVersion: 2, children }` properties. Its root children may be paragraphs, headings, lists, tables, quotes, code blocks or horizontal rules. The following forms describe the saved contract; the editor's own state is not the persisted AST.

| Node             | Exact additional properties    | Allowed children or value                        |
| ---------------- | ------------------------------ | ------------------------------------------------ |
| `paragraph`      | `children`                     | Text, link or line break                         |
| `heading`        | `level`, `children`            | Level 1–6; text, link or line break              |
| `text`           | `text`, `marks`                | Literal string and allowed marks                 |
| `link`           | `url`, `children`              | Canonical HTTPS URL; text leaves only            |
| `lineBreak`      | None                           | Inline break; no children                        |
| `list`           | `ordered`, `start`, `children` | List items                                       |
| `listItem`       | `children`                     | Paragraph first; then paragraphs or nested lists |
| `table`          | `children`                     | Table rows                                       |
| `tableRow`       | `children`                     | Equal-width rows of table cells                  |
| `tableCell`      | `header`, `children`           | Boolean header flag; one or more paragraphs      |
| `quote`          | `children`                     | One or more paragraphs                           |
| `code`           | `language`, `text`             | `plaintext` or `javascript`; literal string      |
| `horizontalRule` | None                           | Root block separator; no children                |

Each node also carries its exact `type`. The five allowed text marks are `bold`, `italic`, `underline`, `strikethrough` and `code`, without duplicates. Any unique mark order is valid; the saved order must not be canonicalized during an unrelated edit. A plain leaf uses `marks: []`. An explicit line break is `{ "type": "lineBreak" }`; a separator is `{ "type": "horizontalRule" }`. Code text is never executed, and its language is metadata rather than a script permission.

Links contain literal text children and a canonical HTTPS `url`, limited to 2,048 UTF-8 bytes. Empty link children are valid in the saved contract, and distinct adjacent links remain distinct even when their URLs match. Credentials, unsafe schemes, whitespace/control characters, backslashes, their rejected escaped forms and noncanonical URL spelling are rejected. Links are stored data; saving one does not fetch its target. List starts range from 1 to 1,000,000; bullet lists use one. Distinct adjacent lists retain their boundaries and individual starts. Lists nest only inside list items, each of which starts with a paragraph. Tables, quotes, code and separators are root blocks, not arbitrary list-item or cell contents.

Tables must be nonempty and rectangular, with at most 16 rows and eight columns. Every row has the same positive number of cells. Cells hold paragraphs, not nested tables or arbitrary blocks; each cell's `header` is a boolean. These dimensions remain subject to the shared node/work/byte ceilings, so they are not a promise that every fully populated 16-by-eight table fits.

## Use the formatted editor

Choose **Formatted rich text** when defining a field, save the model, then bind a private collection to that reviewed revision. Entry forms open a labeled editor; JSON is not required. The block selector offers paragraphs, headings one through six, bullet/numbered lists, quotes and literal code. Toolbar controls apply bold, italic, underline, strikethrough or inline code. Undo/Redo retain native history, including supported imported nested-list edits. Contextual **Indent list**/**Outdent list** preserve ownership and refuse unsupported or over-budget moves rather than dropping content.

Select text and choose **Add link**, or select an existing link to edit/remove it. Enter a complete HTTPS URL without credentials, then explicitly apply or cancel the review before saving. Enter applies and Escape cancels the URL review. Stored links do not fetch their target, and clicking a link inside the editor does not navigate away.

**Insert table** creates a root-level two-by-two table with first-row headers. Select a cell to add or remove a row/column. Growth remains subject to shared budgets; removal cannot eliminate the whole table dimension. Quotes and code use supported root-block contexts. Code offers plain text or JavaScript as literal metadata, with no evaluator or highlighter. **Insert divider** adds a root separator. If a document cannot fit an insertion, its content is preserved and the warning explains what to remove.

Changing language translates controls while preserving authored names, labels, title/body text, URLs, table values and code. The focused seven-language journey retains dirty content and native history without resource requests, then verifies exact real PUT/GET content. Native 390-pixel Thai-light/Russian-dark checks cover focused touch controls, body containment and table/code regions that scroll locally. Complete gallery/original review and native-speaker acceptance are separate gates.

Save explicitly to advance the entry version; editing does not publish content. Imported empty blocks, mark order, distinct adjacent links/lists, table header flags/paragraphs and literal code remain part of the saved contract. See [private collections](collections.md) for conflicts, reload decisions and irreversible versioned deletion.

## Bound data and keep rendering separate

Both contracts reject unknown properties and unsupported nodes. Each document contains at most 128 semantic nodes, including the root. Text leaves and code strings are limited to 4,096 UTF-8 bytes. Version one has two node levels below the root; formatted version two allows semantic depth six, counting the document at depth zero. The complete entry still shares its existing 16,384-byte JSON ceiling, 1,024 raw visited-value budget and 128-item array ceiling. Ordinary entry values retain their six-level limit. Only a frozen field with schema/AST versions two admits its separately bounded JSON encoding depth of 24; that allowance does not relax the semantic node/depth checks or the entry's shared budgets.

Content does not accept raw HTML nodes, CSS classes, arbitrary attributes, executable scripts or event-handler expressions. Formatting is structured data, not trusted renderer code. A future HTML renderer must escape authored content, allowlist tags/attributes/URLs and keep owner-reviewed element mappings separate from content. Default safe rendering, per-element mappings and canonical published routes each need their own acceptance; see the [platform plan](platform-plan.md).

Saved documents remain private management content. No API dependency USE, shared CMS permission, public content route or HTML output is introduced by storing this AST. Existing authorized full-backup operators can obtain the unencrypted content under their separate backup grant; owner-only entry routes do not change that authority.
