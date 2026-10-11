# Saved rich-text HTML preview — working contract

Version 0.24 adds an owner-only HTML preview of saved rich text. Local HTTP/browser, core, gallery and portable checks pass for literal/formatted saved fields, frozen nested selection, reviewed element settings, copied HTML and existing authority guards. Source delivery completed through [PR #21](https://github.com/mysbryce/besh/pull/21), with successful exact-head/main CI and matching trees; generated content APIs follow separately.

The preceding [structured rich-text editor](rich-text.md) completed source delivery through [PR #20](https://github.com/mysbryce/besh/pull/20). Exact-head and main CI passed all three jobs, with identical reviewed/merged trees. Its local and remote delivery branches were removed after that proof. See [current roadmap](roadmap.md) for the exact receipts and the separate 0.24 work.

## Preview saved content

Start from a clean saved entry in **Content**:

1. Open **Preview HTML** and review the saved entry revision.
2. If several saved rich-text fields exist, choose one with **Rich-text field**. Nested labels and item numbers identify the saved value; there is no path or JSON to type.
3. Choose **Generate HTML preview**, then read the inactive visual result or labelled **HTML source**.
4. Use **Copy HTML** after the source to copy that reviewed result. A successful clipboard write shows **HTML copied**; if copying fails, the labelled source remains available for manual copying.

Dirty or conflicting entries require a separate save or reload. New entries and entries without a compatible saved field do not offer this action. Generation is explicit; choosing another field clears the previous result.

## Choose HTML settings

The active 0.26 candidate adds **HTML settings** to the existing preview. **Temporary settings** remains selected on opening and keeps the original default or locally reviewed element map. Opening the preview does not fetch collection settings.

To use saved settings, choose **Review collection settings**. This explicit read verifies a separate snapshot with its independent renderer revision. It does not save settings, generate HTML or choose the reviewed mode automatically. Select **Reviewed collection settings**, then choose **Generate HTML preview**. The optional **Configured elements** disclosure shows the last reviewed values, frozen model provenance, configuration hash and any consumer contract.

The snapshot represents the last review, not a promise that another session has made no change. If its renderer revision is stale, generation returns `409`; review again explicitly before using saved settings. The dashboard keeps the old revision visible and blocks that mode until review succeeds. It does not automatically read the latest settings or fall back to Temporary. An entry-version conflict remains a separate entry reload decision.

Switching settings mode clears prior HTML and copy feedback without a request. Returning to Temporary restores the local inputs; it neither inherits the saved map nor changes the collection settings editor's dirty draft. Settings review also leaves that independent draft untouched. Global pending guards and the original owner/session, collection, entry, field and operation checks remain in force around asynchronous review, generation and clipboard feedback.

The first public browser journey passes in 4.9 seconds (`.cache/saved-renderer-preview-browser-first-green.log`). It proves explicit GET and selection, exact revision-only POST, exact HTML/hash, unchanged public snapshots and independent temporary rendering. Backend verification passes two new cases/263 assertions with the nine existing renderer cases/460 assertions, and all eight temporary-preview cases/510 assertions pass separately. The seven dictionaries align 908 keys and preserve all 901 prior values. Complete 0.26 core, browser, gallery, portable and hosted delivery gates remain pending; this focused result is not seven-language visual or native-speaker acceptance.

## Saved identity and request modes

The server reads the saved content and the collection's immutable reviewed Struct snapshot. The request identifies the current entry version; it never uploads a replacement AST or treats an unsaved editor buffer as saved content. The dashboard checks the returned saved identities and renderer hash before displaying a result. Changing the field, closing the review or changing the original entry/session identity clears the result. Pending generation retains its review and blocks other actions through the existing task guard.

The preview accepts paired schema version one/AST version one literal paragraphs and paired version two formatted documents without converting saved content. Formatted HTTP acceptance covers paragraphs, headings, links, lists, tables, quotes/line breaks, literal code and dividers. Saved selection follows the collection's frozen field schema through objects and arrays, including rich-text values directly inside an array. Only present saved values are selectable; rich-text child nodes are not additional fields.

The private management route is:

```text
POST /api/collections/:id/entries/:entryId/render-preview
```

Its strict body contains `entryVersion`, exactly one renderer selector, and exactly one field selector: a top-level `fieldKey` or a typed `fieldPath`. Temporary mode supplies `renderer` and retains the original response shape. Active 0.26 saved mode supplies only the nonnegative safe integer `rendererVersion`; its response adds that exact revision. Supplying both renderer selectors, neither selector, coercions or unknown properties is invalid. Version zero selects the virtual default only while no saved record exists; positive versions select only the exact current saved settings, never an archived revision or a silent latest-version fallback.

Paths have one to six segments: named frozen fields and nonnegative integer array indexes. Indexes in this HTTP contract start at zero; dashboard item labels start at one. The server checks every segment against the frozen schema and an own saved value. Dotted expressions, traversal inside a rich-text AST, extra properties and mismatched field types are rejected.

The original management proof and current owner are rechecked inside the acquired transaction before saved reads. Saved mode checks the current entry and renderer revisions independently in that same transaction. A stale version fails rather than silently previewing a different revision. The response identifies collection/frozen Struct revisions, the entry ID/version, selected field/path, paired rich-text versions, renderer schema/hash and rendered HTML, plus the renderer revision only in saved mode. The dashboard checks that exact selection before showing output. These identities describe a reviewed private preview, not a release pin or runtime publication.

Previewing must leave saved content, collection binding and successful-change audit unchanged. Existing authorization-denial metadata may still be recorded. No renderer settings are persisted, no entry is saved automatically and no public route is generated.

## Review element settings

The default journey needs no settings or JSON. For optional customization, open **Advanced element settings** and choose **Element**. Each choice shows a readable label and its literal semantic tag. Use **CSS classes**, **Title attribute** and **Accessibility label** to review transient values. Settings remain available when choosing another element; editing them clears prior output and requires explicit generation again.

All 25 fixed tags are supported: `p`, `h1`–`h6`, `strong`, `em`, `u`, `s`, `code`, `a`, `ul`, `ol`, `li`, `blockquote`, `pre`, `hr`, `br`, `table`, `tbody`, `tr`, `th` and `td`. Mappings cannot replace tags with arbitrary HTML, supply inline CSS, add event handlers or execute templates. The visual preview uses trusted default styles; custom classes need CSS supplied by your consuming client.

The transient configuration uses `schemaVersion: 1` and `elements`, with optional `consumerContract`. It accepts only the fixed semantic element list. Each element may contain `classes` and `attributes`:

- Up to eight class tokens per element. Each token uses 1–64 ASCII characters, begins with a letter or underscore, and otherwise uses letters, numbers, underscores or hyphens.
- Ordinary attributes are `title` and `aria-label`, each bounded to 160 UTF-8 bytes.
- At most 25 fixed element keys and four attributes per map are allowed; unknown keys are rejected.
- The complete reviewed configuration is bounded to 1,024 UTF-8 JSON bytes; emitted HTML is bounded to 256 KiB and is never truncated.

Focused public boundary checks cover these limits, rejected framework/destination settings and rendered-output overflow from genuinely saveable content. Valid saved content can exceed the HTML limit once escaped and wrapped with settings; that preview fails without changing or truncating the entry. Saved entry bounds remain 16 KiB and 1,024 raw values, with formatted rich text limited to 128 semantic nodes and depth six.

Text and quoted attribute values are escaped for their output context. The saved rich-text grammar supplies validated HTTPS links. Unknown properties, executable attributes and arbitrary destination settings are rejected. Temporary configuration remains transient; saved mode reads an existing reviewed record. Neither preview request saves settings into the entry, collection or renderer record. Empty temporary settings retain the exact default request. The dashboard binds each reply to the frozen reviewed configuration through its canonical hash and consumer contract.

### Fixed consumer identifier

For `h1`, **Use fixed heading identifier** explicitly opts into `x-data="h1"` under the `besh.fixed-heading-id.v1` consumer contract. An independently entered class such as `text-heading-1` does not require that opt-in. The contract permits this one fixed attribute value on `h1`; there is no free-form expression input.

Besh does not load Alpine.js or run the attribute. A consuming application must handle the fixed identifier through an explicitly reviewed trusted binding without evaluating authored expressions. This warning matters because [Alpine evaluates `x-data` as JavaScript](https://alpinejs.dev/directives/data), including the bare identifier `h1`. Do not automatically process this output with Alpine. The default renderer omits framework directives. The fixed contract authorizes neither arbitrary expressions nor scripts/event directives, and escaping is not a global safety guarantee for every consumer framework.

## Read the private result

The result includes labelled read-only **HTML source** and an inactive **Rendered HTML preview**. The server-produced fragment remains unchanged inside a trusted wrapper: an empty iframe sandbox, early restrictive CSP, target-only base and inert body. The visual frame is outside keyboard and assistive navigation; the labelled source remains available outside it. No script or framework runtime is loaded.

Focused browser verification clicked the saved HTTPS link and traversed the source/generation controls with the keyboard. It observed no external request attempt or popup, unchanged parent/frame URLs, a second real successful generation and unchanged saved collection, entry and audit. This evidence applies to the tested browser journey; an empty sandbox alone is not a blanket guarantee against frame navigation.

Copying uses only the already-delivered HTML snapshot. It performs no preview POST, refetch, content save or persistence, and it does not establish the latest peer/server revision or authority. Existing task guards block conflicting actions while the clipboard request is pending; original owner/session/entry and operation checks precede the write and guard feedback after it. Field/settings changes or closing/reopening the review reset copy feedback.

During 0.24 acceptance, all seven dictionaries aligned 877 keys, preserved 836 prior decoded values and replaced the one obsolete paragraph-help message, with 40 additive keys and no duplicates or placeholder drift (`.cache/html-locale-audit.json`). Separate real-browser language/phone verification passed in 9.4 seconds, with a 7.4-second test and 10.75-second wrapper (`.cache/rich-text-html-locales-green.log`). The small-screen HTML source font increased from 13 to 16 pixels after its actual phone RED. Four original phone PNGs were reviewed as readable and contained; lower Russian settings use normal vertical scrolling. Neither the AST audit nor screenshots establish native-speaker certification. The fresh full E2E command passed all 71 cases. The final complete gallery is promoted with 1,283 images/47 receipts; scoped review covers all 22 new originals and eight affected originals, with hashes linked to canonical images. The native portable suite also passed ten cases/1,103 assertions. Final core passes types, all 397 backend cases/8,426 assertions, production build and formatting; source delivery completed through PR #21 with successful exact-head/main CI and matching trees. Persisted settings were outside that delivered preview slice, and runtime publication remains planned.

## Focused evidence and current gate

The third complete browser run passed all 71 cases with an exit-zero receipt and a 233.66-second wrapper (`.cache/rich-text-html-e2e-final-3.log`). The final gallery passed eight native stories in 2.1 minutes and 38 regular stories in 5.4 minutes, 452.38 seconds wrapper. It preserves all 1,261 prior canonical metadata records and validates all 1,283 PNGs. Review of 30 originals includes all seven nonblank translated previews; this is not individual inspection of the entire gallery. Two prior complete captures were withheld for blank iframe areas before the stable frame lookup corrected localized viewport capture. The native portable suite passed ten cases/1,103 assertions in 100.41 seconds, 100.51 seconds wrapper. Final core passes types, all 397 backend cases/8,426 assertions, production build and formatting. Hosted source delivery completed through PR #21; [testing](testing.md#private-html-preview--active-024-work) retains the failed capture/browser history and exact receipts.

- The latest focused HTTP verification passed eight preview tests/510 assertions in 984 milliseconds (`.cache/rich-text-render-path-bounds-verification.log`). It covers literal and complete formatted documents, original-owner authority, transient settings/quoted escaping, rejected caller AST, nested objects/arrays, direct array items and exact one-to-six-segment path bounds without content effects. Output bounds include an actually saved 11,178-byte document whose accepted 806-byte configuration exceeds the HTML cap.
- The first two browser journeys passed together in 8.7 seconds: default saved formatted generation and labelled selection of literal/nested rich text (`.cache/rich-text-html-selection-green.log`).
- Earlier pointer/keyboard isolation verification passed one case in 5.4 seconds, with the test taking 2.8 seconds (`.cache/rich-text-html-isolation-verification.log`). It observed real pointer and keyboard behavior and no external request attempts.
- The advanced mapping RED missed **Advanced element settings**; GREEN passed all three journeys in 10.1 seconds, with a 10.79-second wrapper (`.cache/rich-text-html-mappings-green-2.log`). Real reviewed settings produced exact escaped HTML and left saved content/audit unchanged; editing settings cleared output without another POST.
- Copy GREEN passed all four journeys in 13.0 seconds, with a 14.03-second wrapper (`.cache/rich-text-html-copy-green.log`). Native clipboard bytes matched the reviewed HTML, with no extra preview POST or saved collection/entry/audit change.
- Existing guards verification passed one case in 5.5 seconds, with the test taking 3.4 seconds (`.cache/rich-text-html-guards-verification-2.log`). Its initial failure was an incorrect discard-dialog expectation corrected in the harness, not a new feature RED.
- The complete backend regression passed 397 cases/8,426 assertions in 30.13 seconds (`.cache/rich-text-html-backend-full.log`). Types, fresh build and selected formatting passed. The existing main-chunk warning remains at 534.03 kB; no complete 0.24 delivery gate is inferred from these focused browser receipts.
- Language/native-phone GREEN passed one focused case in 9.4 seconds after the phone source-font correction (`.cache/rich-text-html-locales-green.log`). Final gallery original review includes all four phone views and all seven translated rendered previews.

## Keep later stages separate

Source `0.24.0-alpha.0` completed normal delivery through [PR #21](https://github.com/mysbryce/besh/pull/21). The portable build exited zero in 3.75 seconds; notice verification found no scope additions or blockers. Its ten-case suite passed, including three real copied-executable HTML generations with unchanged saved content and audit. The artifact remains a local candidate, not a published executable. The separate dashboard-folder patch completed [PR #22](https://github.com/mysbryce/besh/pull/22).

Version `0.25.0-alpha.0` [collection HTML settings](collection-renderers.md) completed source delivery through [PR #23](https://github.com/mysbryce/besh/pull/23), with matching trees, all three exact-head/main CI jobs and verified branch cleanup. Owner-only dashboard review/edit/save has independent versioned CAS, metadata-only audit and backup/recovery checks. Complete core, all 72 browser cases, the full 1,305-image/48-receipt gallery and ten portable cases pass, with scoped gallery review of 22 new and six affected legacy originals. No new executable, tag or deployment was published. Editing collection settings does not trigger generation or change this preview's transient controls.

Active 0.26 saved-renderer selection passed the first focused HTTP/browser checks after the real missing-mode and missing-control REDs. Its local core/browser/gallery/portable acceptance passes; hosted source delivery remains pending; see [the current workflow](#choose-html-settings) and [test receipts](testing.md).

Publication needs explicit owner review, frozen content/settings revisions and actual canonical generated runtime routes with current authority, runtime keys and release isolation. None follows from this private preview. Migration/activation gates, media and shared CMS permissions remain later work. Owner-only preview does not change the existing full unencrypted backup authority described in [private collections](collections.md).
