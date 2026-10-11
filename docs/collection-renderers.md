# Collection HTML settings

A collection keeps two different things: authored entry content and reviewed HTML presentation settings. A renderer setting can add a CSS class or a literal title to a fixed HTML element. It cannot change the saved text, replace the collection's frozen model, execute code, or publish an API.

Source `0.25.0-alpha.0` completed delivery through [PR #23](https://github.com/mysbryce/besh/pull/23), providing owner-only dashboard review, editing, versioned save and explicit recovery. Complete local core, browser, gallery and portable gates and all three exact-head/main CI jobs pass. Active 0.26 adds explicit selection of reviewed saved settings in [private HTML preview](rich-text-html.md#choose-html-settings). Temporary settings remain the default; saving collection settings never selects them automatically. See [current work](roadmap.md) and [verification receipts](testing.md).

## Use the dashboard

Open a saved collection in **Content**, then choose **Review HTML settings**. This explicit read opens the collapsed settings section; choosing an entry, language or theme does not fetch renderer settings. Review the independent renderer revision and summary before editing. The summary shows the last reviewed settings, while the form below holds any unsaved edits.

Open **Advanced element settings**, choose a fixed **Element**, then edit **CSS classes**, **Title attribute** or **Accessibility label**. The optional fixed heading identifier requires the displayed trusted-consumer review. These shared controls also serve temporary preview; their preview help does not mean the collection settings panel renders HTML or selects a saved renderer for preview. Custom classes need CSS in your consuming client.

Choose **Save HTML settings** explicitly. Pristine settings cannot be saved from the dashboard. Accepted saving advances only the renderer revision; it does not edit entries, rebind their model or publish content. Pending review/save blocks conflicting navigation and controls under the original owner/session and collection identity.

**Use default settings** replaces only the local draft with the empty default map. It keeps the reviewed saved revision and requires a separate **Save HTML settings** action to persist the change. If edits are dirty, accepting discard replaces them; cancel changes nothing. The action is disabled when the draft already contains the exact valid default settings.

After a stale save returns `409`, the old reviewed revision and exact authored draft remain. Further edits or defaults cannot unblock saving. Choose **Reload HTML settings**, then accept discard to read and review the current server version. Cancel sends no read and preserves the draft. Pristine reload needs no discard confirmation.

If a save response cannot be confirmed, the server may already have committed it. The dashboard keeps the draft and blocks another save with an explicit warning. **Reload HTML settings** is the recovery action; no automatic retry or read occurs. Only a verified response clears that uncertainty. Definitive validation failures retain the draft for correction instead.

Unchanged settings retain their accepted wire representation: empty element objects, empty class arrays, empty attribute maps, literal empty attribute values, class order and an explicit consumer contract without `x-data` are preserved. A control edit patches only its changed property; language changes do not rebuild settings, clear dirty state or issue collection/entry/renderer reads or writes.

In the active 0.26 preview, **Review collection settings** reads a separate saved snapshot. Choose **Reviewed collection settings** in **HTML settings**, then generate explicitly. This review does not use or discard the settings editor's dirty draft, save settings, or publish content. A stale renderer revision requires reviewing again; it does not silently use the newest settings. See the [preview workflow and current gate](rich-text-html.md#choose-html-settings).

## Review one independent version

Each collection has one renderer record with its own `version`. This version is separate from the collection, frozen Struct and entry versions.

Before the first explicit save, reading returns a virtual default:

```json
{
  "schemaVersion": 1,
  "elements": {}
}
```

The surrounding response has renderer `version: 0`, a server-computed configuration hash, `consumerContract: null`, and null creation/update timestamps. Reading does not create a record, change content or emit a successful-change audit event.

A first save uses version zero and creates version one. Every accepted later save uses the current renderer version and advances it, even when settings are identical. Two saves from the same reviewed version cannot both succeed: one wins and the other receives `409`. Reload and review the current settings before trying again. There is no automatic merge or overwrite.

Collection and entry versions do not advance when renderer settings are saved. Later Struct edits do not change the renderer's collection provenance or rebind its frozen model.

## Owner-only HTTP contract

Use current workspace owner authentication for both routes:

- `GET /api/collections/:id/renderer`: read the saved settings or virtual default.
- `PUT /api/collections/:id/renderer`: explicitly save exactly `{ version, renderer }`.

For a first save:

```json
{
  "version": 0,
  "renderer": {
    "schemaVersion": 1,
    "elements": {
      "h1": {
        "classes": ["text-heading-1"],
        "attributes": { "title": "Article heading" }
      }
    }
  }
}
```

The reply identifies `collectionId`, `collectionVersion`, `structId`, `structVersion`, renderer `version`, reviewed `renderer`, `rendererSha256`, outer `consumerContract`, `createdAt` and `updatedAt`. The nested `renderer` from GET is valid PUT wire data. Omit its `consumerContract` when no fixed binding is selected; putting `consumerContract: null` inside that object is invalid. The outer response uses null to describe absence.

The hash uses normalized settings with sorted object keys and the explicit absent consumer identity. Class-array order and valid empty maps/values are preserved. This hash identifies a configuration; it is not an authorization grant, signature or publication pin.

PUT rechecks the original management proof and current owner first inside the acquired write transaction, then validates settings and compares the renderer version. The save and metadata-only `collection.renderer.saved` audit event commit together. The event identifies actor and collection without settings or entry payloads.

Missing/invalid authentication returns `401`; current non-owners return `403`. A missing collection returns `404`. Invalid bodies, unsupported settings or excess bounds return `400`. Stale or exhausted safe versions return `409`. Malformed persisted settings, hashes or metadata fail closed with `503`; GET and PUT do not expose or repair them silently. Rejected saves leave settings, frozen content and successful-change audit unchanged; authentication denials may still produce denial metadata.

## Keep settings bounded

The same strict settings validator serves temporary HTML preview and saved collection renderers. It accepts only `schemaVersion: 1`, `elements`, and the optional fixed `consumerContract`.

- Supported tags: `p`, `h1`–`h6`, `strong`, `em`, `u`, `s`, `code`, `a`, `ul`, `ol`, `li`, `blockquote`, `pre`, `hr`, `br`, `table`, `tbody`, `tr`, `th`, `td`.
- At most 25 fixed element keys. Each element contains only optional `classes` and `attributes`.
- At most eight class tokens per element. Tokens use 1–64 ASCII characters, start with a letter or underscore, and otherwise contain letters, digits, underscores or hyphens.
- Ordinary attributes are literal `title` and `aria-label`, each limited to 160 UTF-8 bytes.
- The only framework identifier is `h1` element attribute `x-data: "h1"`, requiring explicit `consumerContract: "besh.fixed-heading-id.v1"`. It permits no other expression and loads no client framework.
- The complete reviewed settings are limited to 1,024 UTF-8 JSON bytes. Versions must be nonnegative safe integers on save; persisted versions begin at one and cannot wrap past the maximum safe integer.

Arbitrary tags, AST uploads, inline CSS, event handlers, executable attributes and unknown wire properties are rejected. CSS class names need trusted CSS in the consuming client; saving names does not install styles. HTML escaping and the 256 KiB rendered-output bound remain part of the separate [preview contract](rich-text-html.md). Saving settings alone emits no HTML.

## Backups and current verification

Migration 27 adds renderer records to the control database. Ordinary full workspace backups include them. Back up before migration and preserve the existing separate OAuth encryption key when restoring encrypted product-login records. Owner-only renderer routes do not encrypt these settings or hide them from independently authorized full-backup operators; see the [collection backup boundary](collections.md#bounds-and-recovery).

Focused public HTTP verification covers exact wire/hash round trips, one winner for competing saves, strict limits, non-owner denial, unchanged frozen content, restart and restoration from an actual downloaded backup. Malformed downloaded-backup variants fail closed. A representative pre-27 fixture migrates once without persisting virtual defaults; it is not proof of running an authentic historical release binary.

The latest focused renderer receipt passes nine cases/460 assertions in 992 milliseconds (`.cache/collection-renderers-held-proof-verification.log`). It also rejects an exhausted revision without effects and rejects an old owner proof after a held request body completes across actual recovery-key rotation. That authority check does not prove a lock-acquisition race. The earlier renderer/API regression passes 34 cases/656 assertions in 2.62 seconds (`.cache/collection-renderers-migration-verification.log`).

The latest coherent browser journey passes one case in 5.7 seconds, 7.9 seconds Playwright and 8.9507078 seconds wrapper. It covers actual owner GET/PUT, stale save with canceled/accepted reload, local defaults followed by explicit save, and a real committed PUT whose browser delivery is aborted before explicit recovery. Pending-save checks preserve literal wire data. Seven-language checks preserve authored settings; native 390-pixel Thai-light and Russian-dark checks cover the settings panel. Dictionaries align 901 keys, preserving the prior 877 decoded values with no duplicate keys or placeholder drift.

Complete core passes types, all 406 backend cases/8,886 assertions, production build and formatting in a 55.7732091-second wrapper. The full E2E command passes 72 cases in 237.81 seconds browser time and 239.319376 seconds wrapper. The promoted gallery contains 1,305 PNGs and 48 complete receipts, preserving all 1,283 prior canonical metadata records, with a 447.7271883-second wrapper. Scoped original review covers the 22 new images and six affected legacy images; it is not individual review of all 1,305 images or native-speaker certification. Complete portable acceptance passes ten cases/1,118 assertions in 103.10 seconds, including actual saved settings through the copied executable. The build records 988 actual module inputs; all nine portable originals received scoped review. The clean-head source bundle contains 1,043 files and 24,226,822 bytes.

[PR #23](https://github.com/mysbryce/besh/pull/23) merged reviewed head `8ffc1b358bc495718951cb0dad33ecd2e46aa8dc` as main `d270296deced6ea0f32575993d18f46dbb31e90d`, with the same tree `8f38538a5e05c2610dc9a96d1aca6fa5d898a6a6`. [Exact-head CI 38102725938](https://github.com/mysbryce/besh/actions/runs/38102725938) and [main CI 38103040126](https://github.com/mysbryce/besh/actions/runs/38103040126) passed all three jobs. The exact local and remote delivery branches were deleted after proof. This completed source delivery does not publish a new executable, tag or deployment.

## Remaining work

Active 0.26 saved-renderer selection passed its first focused browser journey in 4.9 seconds after the missing-control RED. It proves explicit GET, custom selection, a revision-only preview POST, exact HTML/hash, unchanged public snapshots and independent temporary rendering. Focused HTTP verification passes two new cases/263 assertions alongside nine existing renderer cases/460 assertions; the separate eight temporary-preview cases/510 assertions also pass. All seven dictionaries align 908 keys and preserve all 901 prior values. Full candidate core, browser, gallery, portable and hosted delivery gates remain pending; neither dictionary alignment nor this first browser case establishes seven-language visual or native-speaker acceptance.

Publishing typed content or HTML requires explicit owner review, frozen content/settings revisions and actual canonical generated runtime routes with current authority and release isolation. Shared CMS grants, API dependency USE, media and schema migrations remain separate planned work.
