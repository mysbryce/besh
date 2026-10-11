# Structured rich text — working contract

Delivered source `0.23.0-alpha.0` provides owner-only literal paragraph forms and a formatted editor backed by strict versioned structured content. Local backend/browser/gallery/portable gates and hosted source delivery passed. Detailed [test receipts](testing.md#structured-rich-text--active-023-work) retain the complete verification history; source delivery does not replace the published portable Windows 0.19 release.

[PR #20](https://github.com/mysbryce/besh/pull/20) merged reviewed head `a78f6186d18f16bfe0777fef0eb45ed4cb2d2989` as main `d33c6bcfb43d72e6912f8de80649c5d572c4c909`, with the same tree `4d8bb1ec2392773a50af4e1ec687991268e50ce6`. [Exact-head CI 38088957758](https://github.com/mysbryce/besh/actions/runs/38088957758) and [main CI 38089328043](https://github.com/mysbryce/besh/actions/runs/38089328043) passed all three jobs. The local and remote delivery branches were deleted after that proof. Historical receipts remain in the [0.23 release record](releases.md#structured-rich-text-delivery--0230-alpha0).

[Owner-only saved HTML preview](rich-text-html.md) completed `0.24.0-alpha.0` source delivery through [PR #21](https://github.com/mysbryce/besh/pull/21). Reviewed head `7e21db11c92d302642ceab2a891d130050ad7007` merged as main `5a7274479049f744b592f3a2dcb71ab83567a103`, with matching tree `099a117ec2bd732f88f422b07e30659c789d26d6`. All three [exact-head CI](https://github.com/mysbryce/besh/actions/runs/38096289936) and [main CI](https://github.com/mysbryce/besh/actions/runs/38096648897) jobs passed; both delivery branches were removed after proof. The earlier three-case/88-assertion backend receipt and missing-button browser RED remain historical evidence in [testing](testing.md#private-html-preview--active-024-work), alongside complete local acceptance and hosted delivery. See the [0.24 release record](releases.md#private-html-delivery--0240-alpha0).

The dashboard-folder patch completed `0.24.1-alpha.0` source delivery through [PR #22](https://github.com/mysbryce/besh/pull/22). Version `0.25.0-alpha.0` [collection HTML settings](collection-renderers.md) completed [PR #23](https://github.com/mysbryce/besh/pull/23), providing owner-only review/edit/save with an independent revision. Both deliveries have matching-tree and exact-head/main CI proof and verified branch cleanup. Complete 0.25 core, all 72 browser cases, the 1,305-image/48-receipt gallery and ten portable cases pass; scoped gallery original review covers 22 new and six affected legacy images. Source delivery does not publish a new executable, tag or deployment. Active 0.26 [saved-settings preview selection](rich-text-html.md#choose-html-settings) passes its first focused browser journey; local core/browser/gallery/portable gates pass; hosted source delivery remains pending. Canonical runtime publication remains planned. See the [current roadmap](roadmap.md).

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

The paragraph forms add/remove paragraphs and text leaves without asking users to write JSON. Empty documents, paragraphs and text leaves are valid. Markup characters remain text; version one carries no formatting marks, links, renderer settings or hidden conversion. The separate explicit HTML preview can render its saved literal paragraphs safely.

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

Content does not accept raw HTML nodes, CSS classes, arbitrary attributes, executable scripts or event-handler expressions. Formatting is structured data, not trusted renderer code. Delivered [private HTML preview](rich-text-html.md) escapes authored content and validates fixed tags, attributes and HTTPS links, keeping transient element settings separate from entry data. Delivered [collection HTML settings](collection-renderers.md) persist a separately reviewed renderer without rewriting the AST or changing the frozen collection model. The active 0.26 preview can explicitly use a reviewed saved revision while retaining independent temporary settings; its full delivery is pending. Canonical published routes remain planned; see the [platform plan](platform-plan.md).

Saved documents remain private management content. No API dependency USE, shared CMS permission, public content route or HTML output is introduced by storing this AST. Existing authorized full-backup operators can obtain the unencrypted content under their separate backup grant; owner-only entry routes do not change that authority.
