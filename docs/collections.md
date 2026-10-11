# Private collections and typed entries

Owners can create private collections from saved [Structs](structs.md), then create, review, edit and delete typed entries through dashboard forms. Each collection keeps its reviewed model snapshot; later model edits do not alter its content contract. This `0.22.0-alpha.0` foundation passed local backend, complete browser/gallery, types/build/formatting and all three exact-head/main CI jobs. [PR #19 completed source delivery](releases.md#private-collection-delivery--0220-alpha0). See [check history](testing.md#private-collection-snapshots-and-entries--active-022-work).

## Bind a collection to a saved Struct

Create a collection with exactly `{ name, structId, structVersion }`. The name is trimmed and uses 1–80 characters. The server reads that exact current saved Struct revision inside the write transaction and copies its ID, version, name and fields into the collection. Callers cannot supply a replacement schema. A stale reviewed revision returns `409`; a missing Struct returns `404`.

The copied definition is immutable in this slice. Later Struct edits do not change the collection or its validation rules. Collection detail returns the complete `struct` snapshot; the collection catalog returns `structId` and `structVersion` instead. Collection version starts at one. Collection rename, schema rebinding and collection deletion are not provided yet.

## Typed entry content

An entry stores a plain JSON object as `data`. Its keys and nested values must match the bound Struct exactly. Unknown keys and reserved prototype names are rejected. The supported field types are:

| Struct type | Accepted entry value                                        |
| ----------- | ----------------------------------------------------------- |
| `text`      | String                                                      |
| `number`    | Finite JSON number                                          |
| `boolean`   | `true` or `false`                                           |
| `object`    | Object matching its nested fields                           |
| `array`     | List whose items match the configured item type             |
| `select`    | Exact configured option value, not its display label        |
| `richText`  | Structured document matching its paired schema/AST versions |

Required means the field must be present. An optional field may be absent; a present `null` is invalid for every current type. Empty text, `0`, `false`, `{}` and `[]` are preserved when the schema permits them. An empty group still needs any required nested fields. Values are not coerced, trimmed or translated.

Create with exactly `{ data }`. Update with exactly `{ version, data }`, supplying the complete replacement object rather than a partial patch. Omitting an optional field in an accepted update removes that value. Entry responses contain `id`, `collectionId`, `version`, `data`, `createdAt` and `updatedAt`.

## Review versions before changing data

In **Content**, create a named collection by choosing a saved **Content model** and reviewing its revision. Open **New entry** to fill the bound model's labeled controls. Optional fields have explicit inclusion controls; groups and lists use nested forms and item actions. **Create entry** saves a new record; **Edit entry** and **Save entry** replace its complete content. Authored labels, keys, option values and text stay literal. Plain text containing HTML markup is content, not a rich-text or HTML renderer configuration.

The saved collection's model is collapsed by default so entry actions remain near the top. Choose **View content model** to inspect its frozen fields, then **Hide content model** to return to the compact view. This disclosure does not change content or its binding. The model review remains fully visible while creating an unsaved collection.

**Refresh entries** reloads the catalog, not an unsaved editor. After a stale save, the local draft, conflict notice and reviewed version remain visible; saving stays blocked until explicit recovery. **Reload entry** requires accepting discard before replacing unsaved edits with the current server entry. Canceling reload or navigation preserves the draft. A successful refresh after an ordinary catalog load failure clears that catalog error without pretending to resolve a conflicting edit.

Every entry starts at version one. An update requires its current positive safe-integer version and advances it on acceptance. Two edits using the same version cannot both win: one commits and the stale edit returns `409` without changing content or successful-change audit.

The dashboard **Delete entry** action asks for explicit confirmation, including loss of saved content and unsaved edits. Canceling leaves the entry unchanged. Delete requires exactly `{ version }`. A stale version returns `409` and preserves the entry; reload the current version before confirming again. An accepted delete returns `{ "ok": true }`, removes only that entry and leaves its collection intact. Missing entries, including an entry requested through another collection, return `404`. Deletion does not erase an already downloaded backup.

Writes recheck the original management proof and current owner first inside the acquired transaction. Successful `collection.created`, `entry.created`, `entry.updated` and `entry.deleted` events commit with their state change. These events record the resource ID, not field definitions or entry payloads.

## Browse bounded pages

`GET /api/collections/:id/entries` returns `{ entries, total, offset, limit }`. The default is `offset=0&limit=20`; limit may be 1–25 and offset must be a nonnegative safe integer. Values use canonical decimal spelling, so signs, spaces, fractions and leading zeros are invalid. Duplicate or unknown query parameters return `400`.

Entries are ordered by creation timestamp, then ID. Each page reads its collection snapshot, total and rows within one deferred database read transaction. Separate page requests are not a frozen multi-request snapshot: intervening inserts or deletes can change subsequent pages.

## Bounds and recovery

The workspace permits 128 collections, 256 entries per collection and 1,024 entries overall. Entry JSON is limited to 16,384 UTF-8 bytes; each string to 4,096 UTF-8 bytes; each array to 128 items. Ordinary raw values start at root depth zero, allow depth at most six and share a 1,024-value budget. Formatted rich text has a separate schema-guided encoding allowance, semantic depth and node limits; see [rich-text bounds](rich-text.md#bound-data-and-keep-rendering-separate). The copied Struct retains its existing field, choice, schema-depth and node bounds. Invalid content returns `400`; capacity or stale versions return `409`. Malformed persisted snapshots or entries fail closed with `503` rather than returning unvalidated content.

Migrations 25 and 26 add collection snapshots and entries to Besh's control database. Existing full workspace backups include both. Focused HTTP checks verify the exact frozen collection and an edited version-two entry survive restart and restoration from an actual public backup download, with each migration recorded once. Back up before migration or future bound-schema changes. These focused checks do not replace the complete delivery gate.

Direct collection and entry management is owner-only. Existing backup permission is a separate confidentiality boundary: a trusted custom role with `backups.manage` can still obtain the full unencrypted workspace backup until the existing first-tenant-protection rule permanently restricts ordinary backups to owners. Owner-only entry routes do not encrypt content or hide it from those authorized backup operators. Protect backup files and keep the existing separate OAuth encryption key when restoring encrypted product-login records.

## Delivered foundations and current work

Sixty-nine trusted keys bring each dictionary to 772 entries, preserving all prior 703 values. Seven-language browser checks preserve content without language-triggered model/collection/entry requests; the compact-model disclosure passed its separate RED/GREEN. The complete browser command passed all 55 cases. All 35 collection originals passed scoped review. The complete gallery was promoted with 1,221 images and 40 receipts, preserving every prior 1,186 identity/caption. Final local checks and exact-head/main CI passed; the completed delivery branch was removed after matching-tree proof. Native-speaker certification is not claimed.

[Versioned rich text](rich-text.md) completed source delivery through [PR #20](https://github.com/mysbryce/besh/pull/20), with matching reviewed/merged trees and all three exact-head/main CI jobs passing. Literal paragraph forms and the formatted editor preserve headings, marks, HTTPS links, nested lists, rectangular tables, quotes, line breaks, literal code and separators under the frozen collection contract. Exact source identities and prior local receipts remain in the [0.23 release record](releases.md#structured-rich-text-delivery--0230-alpha0).

[Saved HTML preview](rich-text-html.md) completed `0.24.0-alpha.0` source delivery through [PR #21](https://github.com/mysbryce/besh/pull/21), after local gates, matching trees and all three exact-head/main CI jobs passed. It renders one reviewed saved field with escaped HTML and transient element settings. [PR #22](https://github.com/mysbryce/besh/pull/22) completed the `0.24.1-alpha.0` dashboard-folder delivery under the same hosted gates; see the [delivered roadmap](roadmap.md). These source deliveries do not publish a new executable release.

Delivered `0.25.0-alpha.0` [collection HTML settings](collection-renderers.md) add owner-only dashboard review and editing with an independent saved revision, hash and audit. Explicit save, stale-conflict reload, local defaults, unconfirmed-save recovery, pending-save wire preservation and seven-language/native-phone behavior pass the focused browser journey. Complete core passes 406 backend cases/8,886 assertions with types/build/formatting; all 72 browser cases, the full 1,305-image/48-receipt gallery and ten portable cases/1,118 assertions pass. Scoped gallery original review covers 22 new and six affected legacy images. [PR #23](https://github.com/mysbryce/besh/pull/23) completed source delivery with matching trees, all three exact-head/main CI jobs and verified branch cleanup. No new public executable, tag or deployment follows. Saving settings does not change content, automatically select them for preview, or publish a runtime route.

Active 0.26 [saved-settings preview](rich-text-html.md#choose-html-settings) passes its first focused public browser journey. From a clean saved entry, explicitly review the collection settings, choose the reviewed mode, then generate. Temporary settings remain the default and independent of the collection settings editor's dirty draft. Entry and renderer versions are checked separately; a stale reviewed renderer requires another explicit review. This read-only workflow creates no content, settings or publication effects. Complete 0.26 delivery gates remain pending.

## Remaining work

Complete the active saved-renderer preview candidate's verification and source delivery gates. Publication through actual canonical generated routes, shared CMS access, API dependency USE, runtime reads and media remain planned. Future publication must preserve reviewed content/settings revisions, current authorization and draft/release separation; see the [platform plan](platform-plan.md).
