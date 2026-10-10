# Besh roadmap

This is the product plan. Planned features are not implementation claims.

## Active work toward 0.23.0: structured rich text

Branch `feat/structured-rich-text-0.23.0` follows delivered PR #19. The working contract preserves literal version-one paragraphs and adds formatted version two under immutable paired schema/AST versions. Version two supports nested fields, headings, five text marks, HTTPS links, ordered/bullet lists, rectangular tables, quotes/line breaks, literal code and dividers. Each current core block kind has a focused public browser save/read journey; this is not yet completed 0.23 delivery.

The latest complete core check passed types, build, whole-project formatting and all 389 backend cases/7,916 assertions in 42.63 seconds. Nested recovery and actual downloaded-backup restoration passed focused verification. Exact bounds accept 128 semantic nodes at model depth six and reject deeper placement. Rejected unsafe content preserves saved data and successful-change audit.

Focused browser repairs preserve authored mark order, empty and adjacent same-URL links, and distinct adjacent numbered lists with starts one and twenty. The latest list-boundary GREEN passed two cases in 6.9 seconds with types/build. Additional already-GREEN verification preserved an empty list in 3.8 seconds total and mixed table headers/paragraphs, links, quotes/line breaks and exact empty/CRLF/tab code in 4.0 seconds total. These verification runs did not introduce new feature REDs.

All seven dictionaries preserve 772 delivered values and align 65 additions for 837 keys without duplicates or placeholder drift. Native-history repair is reproduced by a fresh frozen install, and the source bundle retains its dependency patch. Focused browser checks cover nested ownership/bounds, link keyboard/review/save guards, plain-text paste and held saving. Seven-language/native-phone verification passed in 8.5 seconds, retaining dirty authored content/history without resource requests and saving the exact AST. A subsequent explicit collapsed-caret readiness gate passed the isolated Backspace case; the earlier missing gate was not proof of recurring ownership loss.

Source is `0.23.0-alpha.0`. Hidden nested-list markers and dim readonly Title passed narrow public RED/GREEN repairs; the final fresh browser command then passed all 65 cases in 292.68 seconds. The third complete gallery passed and was promoted with 1,261 images/45 receipts, preserving all 1,221 prior canonical metadata records. Byte-linked original review covers all 40 new images and 11 affected legacy/navigation images. Portable asset integrity and fresh notice-scope reconciliation passed; the final executable compiled after scope application passed all ten portable cases/1,080 assertions in 108.11 seconds. This is a local working-tree candidate, not a published executable. Hosted CI and source delivery remain later gates. HTML rendering and publication remain separate future work. See [detailed testing history](testing.md#structured-rich-text--active-023-work) and the [versioned contract](rich-text.md).

## Implemented in 0.22.0-alpha.0: private collections and typed entries

Branch `feat/private-content-collections-0.22.0` starts from delivered main `865c29dbd16fc193bb4fc31ffa2e7754d04b6b13`. The first public HTTP RED called `POST /api/collections` with a saved Struct ID and exact revision: expected `200`, received `404`. One case failed with five assertions in 283 milliseconds. Its narrow snapshot GREEN passed one case and 12 assertions in 287 milliseconds (`.cache/collections-http-snapshot-green.log`), retaining the reviewed definition after later Struct edits.

The typed-entry HTTP RED received `404` from `/api/collections/:id/entries`: one pass, one failure and 18 assertions in 370 milliseconds. Its create/detail GREEN passed two cases and 21 assertions in 341 milliseconds (`.cache/collections-http-entry-green.log`). All six field types preserve exact content under the frozen Struct snapshot after model revision two, including empty strings, zero, false, empty objects/lists where permitted.

Concurrent versioned entry PUTs passed their focused GREEN: three cases and 34 assertions in 427 milliseconds after the public `404` RED. Bounded entry pages then passed four cases and 58 assertions in 488 milliseconds. Versioned deletion first failed with four passes/one failure and 65 assertions in 522 milliseconds, then passed all five cases and 75 assertions in 509 milliseconds (`.cache/collections-http-delete-green.log`). Stale writes/deletes preserve data and audit; accepted deletion removes only its entry. Strict pages use canonical URL queries, stable creation-time/ID order and one deferred read snapshot.

The expanded focused HTTP file passed eight cases and 226 assertions in 800 milliseconds (`.cache/collections-http-boundaries.log`), including current owner denials, strict invalid/no-effect behavior, restart and public downloaded-backup restoration. The frozen collection and edited version-two entry survive, with migrations 25 and 26 recorded once. Existing `access.denied` audit was preserved after correcting a test expectation; production authorization was not relaxed.

The complete backend command passed all 376 cases and 7,705 assertions in 40.39 seconds, using eight regular, two native and one exclusive worker (`.cache/collections-backend-full-first.log`). Migration-history expectations now include 25 and 26. Final targeted byte/work/capacity verification then passed ten cases and 1,286 assertions in 1.83 seconds (`.cache/collections-http-budgets-final.log`), with backend production unchanged. It accepts exact 4,096-byte Unicode strings, 16,384-byte JSON and 1,024 visited values, and rejects one excess byte/value at each ceiling. Capacity coverage accepts 256 entries per collection and 1,024 across four collections, rejects excess entries and recovers one workspace slot through versioned deletion. Complete browser/gallery, final local checks and hosted delivery passed; receipts follow below.

The actual browser RED failed because **Content** navigation was missing, in 20.1 seconds. Collection creation then passed one case in 1.9 seconds (3.9 seconds Playwright, 4.87 seconds wrapper), with types and a fresh build (`.cache/collections-browser-create-green.log`). The all-six-type entry-form RED failed in 20.0 seconds because **New entry** was missing; its focused GREEN passed a 2.4-second case, followed by literal nested editing in 2.9 seconds. Catalog recovery had a real stale-alert RED, then passed a 3.1-second GREEN. Actual concurrent-update conflict preservation and existing native-phone targets also passed focused verification. Exact receipts are in [testing](testing.md#private-collection-snapshots-and-entries--active-022-work).

Entry deletion passed its focused GREEN after the missing **Delete entry** RED: one case in 4.7 seconds, 6.9 seconds Playwright, with types and a fresh build. The separate seven-language RED observed a missing Thai heading in a real dirty nested entry. Seven-language desktop/native-phone GREEN then passed one case in 6.2 seconds and 8.3 seconds Playwright, including actual creation/edit/CAS/delete and literal content preserved without model/collection/entry requests from language changes.

Original-image inspection found the expanded saved schema pushed entry actions below the initial viewport. The separate compact-model RED missed **View content model**; the presentation-only disclosure GREEN passed one case in 6.1 seconds and 8.0 seconds Playwright, with types/build and all seven translated View controls checked. Saved schema is collapsed by default, explicit View/Hide preserves content and creation review stays visible. Its two labels bring the inventory to 69 additions and 772 aligned keys; the fresh AST audit preserves all prior 703 values without duplicates or placeholder drift.

The latest complete browser command passed all 55 cases: native seven in 59.4 seconds, regular 46 in 2.4 minutes, isolated member in 21.3 seconds and isolated Vite/WebSocket in 27.1 seconds; wrapper time 255.40 seconds (`.cache/collections-browser-full.log`). Focused capture completed all 35 images in a 14.6-second case/16.3 seconds Playwright; every original passed scoped root/independent review. The mandatory complete gallery passed eight SQLite stories in 2.1 minutes and 31 regular stories in 5.0 minutes, then promoted `.preview/run-1791658276306-42dcfbe1` with 1,221 images/40 receipts. Fresh audit confirms all prior 1,186 identities/captions unchanged, all 35 new Content images present and every image/receipt matching. Final core types, all 376 backend cases/7,705 assertions in 41.67 seconds and production build passed; the core command initially stopped on two document formatting issues (`.cache/collections-core-final.log`). After correcting those documents, the separate whole-repository formatting check passed (`.cache/collections-format-final.log`). [PR #19 completed source delivery](releases.md#private-collection-delivery--0220-alpha0) with successful exact-head/main CI and matching-tree proof; its local and remote branches were removed. Immutable binding and typed entry behavior are documented in [private collections](collections.md). Existing full unencrypted backup operators retain their separate confidentiality authority. Rich text is active next work; media, shared CMS, API dependency USE, collection publication and generated runtime routes remain planned.

## Implemented foundation in 0.21.0-alpha.0: owner-only Struct drafts

Owners can define text, number, boolean, nested group, list and choice fields through **Content models**, then explicitly save bounded drafts. Migration 24 stores definitions and positive revision versions in workspace backups. Atomic updates compare the saved version, reject stale writes and audit metadata without field payloads. Unsaved transitions require a discard decision; keyboard focus and native-phone controls have their own public RED/GREEN corrections. Seven languages add 39 trusted messages, reaching 703 aligned keys with all prior 664 values preserved.

Earlier local core passed all 366 backend cases and 6,419 assertions, types, build and formatting. Footer/conflict-preserving catalog refresh and accepted **New model** status corrections passed their focused RED/GREEN checks without locale additions. The final staged browser command passed all 54 cases without retries, including the Struct journey in 10.6 seconds. It preserves literal choices and makes no Struct/source/flow/database requests from language changes.

The first gallery completed with 1,184 images/39 receipts, preserving all 1,165 prior identities/captions. Review of every new original found a stale success footer beside a conflict error, so that visual gate failed. All 21 fresh Struct originals passed independent original-detail review, including native phones and corrected conflict/reload/new-model/catalog-refresh states; affected older core/navigation originals showed no regression. The final gallery passed with 1,186 images/39 receipts and was promoted. Independent audit confirms every expected image exists and all 1,165 prior identities/captions are unchanged. PR #18 completed source delivery after all three exact-head/main CI jobs passed and reviewed/merged trees matched; its completed delivery branches were removed. The existing main-chunk size warning remains. See [Struct drafts](structs.md), [release receipt](releases.md#struct-draft-delivery--0210-alpha0) and exact [testing receipts](testing.md).

The delivered Struct slice creates no collection entries, rich text, published model schema or runtime route. Active 0.22 work now binds private collections to immutable server-read Struct snapshots and stores typed entries separately. Typed dashboard forms are the current public browser journey. Renderer configuration, safe rich-text/HTML output and canonical generated runtime routes follow separate public journeys and migration/backup gates.

## Implemented in 0.20.8-alpha.0: SQLite upload and catalog languages

SQLite upload, full read-only/no-sync guidance, loading/empty states, permission explanations, saved-copy selection, version/table/size metadata and upload/manual-refresh completion now follow all seven dashboard languages. Twenty-one additions bring each dictionary to 664 matching keys, preserving all prior values. The real native File, authored names, inspected metadata and current grants stay unchanged; language changes issue no database, source or flow requests. Manual refresh reloads the catalog and selected detail, never the original database. Local checks passed 361 backend cases, 6,368 assertions and all 53 browser cases, types, build and formatting. The complete gallery contains 1,165 images and 38 receipts with every prior identity/caption preserved. All 23 new originals, eight affected legacy originals and 14 native-width phone sections passed scoped review. PR #17 and all three exact-head/main CI jobs passed; see [release receipt](releases.md#sqlite-catalog-language-delivery--0208-alpha0). Remaining SQLite query/row-preview, API-generation, check/delete and advanced-policy translations are deferred behind the current platform foundation.

## Implemented in 0.20.7: saved-source status languages

Saved CSV/Excel status, loading, selection, read-access guidance, sheet prefixes and catalog-refresh completion now follow all seven dashboard languages. Gregorian saved times follow the selected language and browser timezone while authored names, cells and numeric counts stay literal. Real CSV/Excel imports, UTC/Bangkok dates, explicit version-two catalog refresh and reader/write-only/selected permission boundaries passed the public journey. Six messages bring each dictionary to 643 matching keys. Local checks passed all 361 backend cases, 6,368 assertions and 52 browser cases, types, build and formatting. Complete capture contains 1,142 images and 37 receipts with every prior identity/caption preserved. Scoped visual review and hosted merge checks are recorded in [testing](testing.md).

## Implemented in 0.20.5: saved-source provider and deletion languages

Public Google Sheets import, manual refresh and source deletion add 13 trusted messages across all seven languages, with 637 aligned dictionary keys. Separate public RED/GREEN journeys preserve authored data, explicit confirmation, pending controls, current-language completion and current member grants. Actual saved snapshots, provider failure, current draft/publication deletion guards, successful deletion and metadata-only audit passed. Only external Google CSV bytes are simulated; private-sheet sign-in and native-speaker review remain separate. Local checks passed 361 backend cases, 6,368 assertions, all 51 browser cases, types, build and formatting. The complete gallery contains 1,120 images and 36 receipts; all 39 new originals and eight affected legacy originals passed review, with 25 lossless phone/panel sections. Exact-head and post-merge CI remain separate gates. See [languages](localization.md) and [testing](testing.md).

Candidate `0.20.5-alpha.1` strengthens actual workspace readiness before source permission/language checks. Development startup warms the entry and Studio; its WebSocket fixture completes bounded cold compilation before issuing proofs, using the current browser session. All 51 cases passed again, including the original reload/watch and frame checks. See the observed failures and correction receipts in [testing](testing.md).

## Delivered in 0.19.0-alpha.0: portable Windows

The [Windows portable prerelease](https://github.com/mysbryce/besh/releases/tag/v0.19.0-alpha.0) is public. PR #8 merged at `8e5ef68ced9f631d6eff7b5a005180bbee8745d8` after exact-head and main CI passed all three jobs. All seven uploaded assets were downloaded and matched staged SHA-256 hashes and byte counts; the downloaded portable ZIP's 689 payload files passed inventory verification. Final packaged CLI, offline notice export and real browser setup/sign-in/save/test/publish/runtime acceptance passed three cases and 779 assertions. See [release receipt](releases.md#portable-prerelease-delivery--0190-alpha0) and [testing](testing.md).

The earlier compiled SQLite, background lifecycle, concurrent-start, private-file ACL, REST/GraphQL/WebSocket restart and optional first-use k6 journeys also passed. Default OS browser handoff, native Linux/macOS execution, broader external integration coverage, full native load-test shutdown, signing and complete notice reconciliation remain separate. Five build targets and Ubuntu/macOS instructions are documented, not native-platform verification. See [portable usage](portable.md) and [runtime notice limits](portable-runtime.md#verification-and-material-limits).

## Implemented in 0.20.2: spreadsheet API-generation languages

Spreadsheet API-generation forms add 22 trusted messages across all seven languages, with 624 aligned dictionary keys. The public RED exposed missing Thai guidance in 9.4 seconds; the focused GREEN passed in 15.5 seconds with types, formatting and fresh assets checked. Language choices preserve authored form values and typed contracts without creating an API. Explicit REST/GraphQL creation and real draft tests passed, along with dirty-draft cancellation, current-language completion after held real delivery, reader/selected-viewer denial and native 390px light/dark containment. Both generated APIs remain unpublished. Core checks passed all 361 backend cases and 6,368 assertions; all 49 staged browser cases passed. The complete gallery contains 1,081 images and 34 receipts, with all 22 new originals and eight affected legacy originals inspected. Exact-head CI remains the separate merge gate. See [languages](localization.md) and [testing](testing.md).

## Implemented in 0.20.1: uploaded replacement languages

Uploaded spreadsheet replacement forms, full compatibility warnings, confirmation and completion follow all seven dashboard languages. The public browser journey preserves selected native file bytes, authored source/data and current permissions, cancels without a write, then performs one real compatible replacement. The published REST API reads the new rows with the same graph and publication. Language changes during held response delivery keep controls disabled and complete in the current language. A real parser rejection leaves the last valid snapshot intact. Google refresh, deletion, API-generation forms and advanced protection remain separate. Core checks passed all 361 cases and 6,368 assertions; the complete gallery contains 1,059 images and 33 receipts, and all 48 staged browser cases passed. Exact-head CI remains a separate merge gate. See [languages](localization.md) and [testing](testing.md).

Browser defaults now use half the available logical CPUs capped at four after higher-worker startup and acceptance failures. Explicit `BESH_TEST_WORKERS=half`, `all` and numeric overrides remain available. Backend defaults still use half, native SQLite work stays bounded, and full browser acceptance retains isolated member-field and Vite/WebSocket phases. Routine picker screenshots move to the complete gallery while assertions and masked failure diagnostics remain. No retry, assertion or production deadline was relaxed.

## Implemented in 0.20.0: CSV languages and faster checks

Basic spreadsheet import, empty states, row counts and trusted preview type/null labels follow all seven dashboard languages. A public RED/GREEN journey imports a real CSV, preserves authored names/headers/keys/types/rows, changes language while its response is pending, and verifies allowed-reader/selected-viewer boundaries and phone containment. Language selection remains presentation-only. Provider refresh, API generation, protection, technical errors and broader date/number formatting remain separate.

At 0.20.0, backend and E2E workers used half the available logical CPUs by default, with `BESH_TEST_WORKERS` selecting `all` or a numeric override. Eight native SQLite backend files use at most two workers; the CPU-sensitive row-database file runs alone. The full browser command retains its mandatory isolated Vite/WebSocket phase. Preview capture uses the separate `BESH_PREVIEW_WORKERS` policy capped at four; higher-worker capture attempts failed, then the final four-worker recapture passed all 31 tests in 5.0 minutes, with 1,041 screenshots and 32 story receipts. No production deadline or assertion changed. Focused development checks passed real backend, browser and individual-gallery journeys with whole-project types, changed-file formatting and fresh assets. Final local core checks passed all 361 cases/6,368 assertions, build and formatting; full staged browser acceptance passed all 47 cases. [PR #10](https://github.com/mysbryce/besh/pull/10) merged after [head CI](https://github.com/mysbryce/besh/actions/runs/38040479183) and [main CI](https://github.com/mysbryce/besh/actions/runs/38040787384) passed all three jobs. See [testing](testing.md).

The source-only **0.19.1-alpha.0** documentation patch records the completed 0.19.0 delivery; neither it nor these source changes replace or relabel the published executable.

## Planned platform milestone

The requested [backend platform plan](platform-plan.md) covers a non-developer Struct/schema builder, media folders/tags and bounded image/video jobs, CMS publication, product database adapters, social authentication, payments, and measured published-backend size/performance. Owner-only saved Struct drafts and private typed collection/entry CRUD are delivered foundations; versioned rich text has local core and focused browser acceptance, with full delivery gates pending. Collections and nested Structs use dashboard configuration. Full rich text will support structured objects for client renderers and safe server HTML with reviewed per-element classes/attributes. Reference projects inform workflows without adding their frameworks or inheriting their compatibility claims.

Portable delivery and basic data-panel language slices are complete. Continue the platform foundation one public RED/GREEN journey at a time, starting with private collections and typed entry forms. Real database/provider acceptance, migration safety and current authorization remain gates.

## Implemented in 0.18.5: protocol guidance languages

GraphQL route guidance and operation heading passed a public RED/GREEN journey across all seven languages with a real draft query. WebSocket route guidance then passed its own public RED/GREEN with one native draft reply and no locale-triggered ticket or message. All 46 browser cases and the 1024-image walkthrough passed. Advanced editors and server errors remain separate.

## Implemented in 0.18.4: basic Studio languages

First-task and basic Save/Test/Publish guidance support all seven languages after separate public RED/GREEN slices. They preserve unsaved defaults, authored values and permission-limited shortcuts; actual saves, draft tests and publication still require explicit actions. All 44 browser cases and the 1008-image walkthrough passed. Protocol-specific guidance, advanced editors and other management panels remain next.

## Implemented in 0.18.3: member and role languages

- Basic member/role forms, all permission descriptions, initial API/dependency choices and confirmations support all seven languages.
- Language changes preserve authored names, credentials, grants and selected resource IDs without reading or writing team state. Built-in roles translate by their identity; custom role names remain literal.
- Explicit saves use the actual API. Canceled changes preserve stored permissions; selected navigation and owner-only administration remain enforced. Member receipts use a language-independent preview mask.
- All 42 normal browser cases and the complete 26-story, 988-state preview passed. All 27 new team originals and affected legacy/phone frames passed independent visual review after correcting a narrow Russian header.
- Studio guidance, advanced sharing/tenant editors, other management panels and technical errors remain next work. Native-speaker review remains pending. See [languages](localization.md) and [testing](testing.md).

## Implemented in 0.18.2: account and update languages

- All seven supported languages cover account/session guidance, proof choices, actions, confirmations and update settings/status labels.
- Session and release-check dates use the selected language and browser timezone with a Gregorian calendar. Exact server deadlines and stored timestamps are unchanged.
- Language selection preserves unsaved inputs and authored names/titles, performs no account/settings write or release check, and never changes owner-only update access.
- Real browser journeys and light/dark native phone previews cover these workflows. Technical server errors and other management panels still need translation; native-speaker review remains pending. See [languages](localization.md) and [testing](testing.md).
- The complete preview passed all 24 stories and captured 961 states, retaining all 937 previous identities. All 24 new Account/Updates originals passed independent visual review.

## Implemented in 0.18.1: compact navigation and controls

- Desktop sidebar and dropdown rows use 36px sizing with centered chevrons. Full authored and translated labels wrap; phone controls retain 44px targets.
- Light/dark dashboard and gallery scrollbars use narrow rounded thumbs without native arrow buttons. High-contrast mode retains operating-system controls. Keyboard selection, focus return and Radix scrolling remain available.
- Public geometry reproduced oversized controls and a member-form cascade override before correction. The two focused browser stories and all 36 normal stories passed; four-worker acceptance took 107.97 seconds. See [design](design.md) and [testing](testing.md).
- The closing-menu capture race passed its exact regression before the complete 22-story walkthrough passed. That delivery captured 937 screenshots, retaining all previous 927 identities and adding ten navigation/menu states.
- Main requires a PR. Dependency deliveries also need version/changelog updates before merging; preserve this policy and runner serialization. See [release workflow](releases.md).
- Reviewed checkout/artifact action updates were normally merged with patch release history. Exact-head checks passed; remote candidate delivery remains blocked by GitHub's reported storage quota, with separate local bundle inspection. Rerun the candidate after account/service capacity is available; no successful remote artifact is claimed.

## Implemented in 0.18: invitations and step discovery

- Owners can give existing key-only members a private, one-use link to set their own password. Links last 24 hours; existing accounts and the bootstrap owner are excluded.
- Active metadata, exact revocation and explicit reissue support uncertain delivery without recovering secrets. Invitation mode requires explicit logout of an existing browser session and ordinary sign-in afterward.
- Hash-only storage, migration 23, bounded attempts/work and post-hash transactional checks preserve current member grants and keys. Role, permission, sharing, tenant and account changes invalidate pending links; owner-key recovery clears them.
- Email delivery/verification, password recovery, new-workspace membership and product-account/session lifecycles remain planned. See [workspace invitations](workspace-invitations.md) and [testing](testing.md).
- A large categorized step picker replaces the stacked palette. Search, favorites, keyboard focus and explicit draft changes retain feature/permission guards. Desktop spacing is compact; phone targets remain usable. See [choose API steps](node-library.md).
- Main workflows support English, Thai, Mandarin Chinese, Russian, Japanese, Korean and Portuguese, with device initialization, English fallback and a persisted manual choice. Some helper text, advanced panels and technical errors still use English. See [language coverage](localization.md).
- Normal browser tests and preview stories use four workers. Shared ports/setup/clipboard/k6 retain locks; previews use isolated temporary workspaces and stable gallery ordering. All 361 backend cases, the same 34 browser cases in both modes and the 927-state walkthrough passed. Four browser workers took 107.30 seconds against 307.65 seconds serial locally. Plugin execution remains planned; the [CommonJS/ZIP proposal](plugins.md) specifies author packaging and owner upload review.

## Implemented in 0.17: member fields and easier workflows

- Owner-reviewed member profiles intersect shared and tenant field settings for protected sources and SQLite tables. Drafts use the authenticated member; bound published keys retain their original issuer.
- Seven review values, atomic complete-table saves, retained dormant choices, deleted-issuer denial and scoped cleanup. Non-owners cannot receive another issuer's bound key through replacement.
- Configured-member summaries, explicit stale/lost-save recovery and sibling review invalidation. Empty selections and inheritance reset preserve current contracts and original keys.
- Public authority, migration/restoration, native peer HTTP/WS, actual serial k6 and detached backup-corruption review passed. All 343 backend cases, 28 browser stories and the 862-state walkthrough passed. Exact evidence belongs in [testing](testing.md).

### Beginner experience and repository setup

- GitHub Sponsors funding, weekly Bun/action dependency proposals, and small pull-request/bug/feature templates are configured; hosted rendering/execution remains separate.
- Empty Studio offers a spreadsheet or blank-API path. Optional **API tools** sit below building/testing; **Review details** hides technical values while errors and current status stay visible.
- Locally served Google Sans Flex and Noto Sans Thai use distinct text weights. Real font decoding, light/dark/system appearance and native-width phone review passed; phone spacing removes redundant profile nesting.

## Implemented in 0.16.1: Windows runner Bun setup

- Job-local exact Bun installation and a regular copied `bunx.exe` avoid the reported non-admin symlink failure. All three CI jobs use the local Windows action.
- Actual Windows PowerShell checks and workflow lint passed. Both Bun setup jobs, the core check and all 25 browser stories later passed on the maintainer's GitHub runner at `b184145`. See [releases](releases.md).

## CI browser corrections in 0.16.2–0.16.3

- Actual GitHub Bun setup and core checks passed on the non-admin Windows runner. Browser failures exposed changed-origin test authentication and early result parsing.
- Built Bun-served browser stories, real-response forwarding, native same-origin SQLite uploads and awaited response delivery address those harness failures. Reduced motion speeds ordinary journeys; the builder retains normal animation. Real Vite WS/watch coverage and every existing scenario remain.
- The subsequent real run at `02d98a1` passed the core check and 24 browser stories. A builder timeout at key creation did not reproduce locally. Version 0.16.3 explicitly checks form readiness and each keyboard permission transition, preserving normal motion, runtime assertions and the original timeout.
- Local acceptance and the subsequent successful remote run at `b184145` are recorded in [testing](testing.md). The maintainer's runner passed all 325 backend cases and 25 browser stories; the browser suite took 3.7 minutes.

## Implemented in 0.16: bounded protected read graphs

- Up to four protected source/SQLite reads and three input-only conditions, with a single trusted tenant, every-path reads, all-branch authority and last-read output.
- Explicit flat reply contracts and complete raw GraphQL row validation before projection/coercion. Eligible GraphQL root execution is bounded before effects, client-code rendering and load-job creation, including variables, directives and abstract fragments.
- Reviewed beginner REST/GraphQL reply and input forms, explicit cancel/apply, structural metadata recovery and read-only boundaries. The actual five-node graph fits the phone canvas in light/dark/system appearance.
- All 325 backend cases, 25 browser stories and the 808-state walkthrough passed. Native peer and actual k6 checks cover current authority on earlier and unchosen resources. Exact image/gallery evidence belongs in [testing](testing.md).

See the [read-graph guide](protected-read-graphs.md). WebSocket graphs, joins, social effects and consistent cross-resource snapshots remain separate.

## Implemented in 0.15: tenant-specific API fields

- Owner source-profile metadata and versioned dormant maintenance passed their public RED/GREEN slices. Missing/reset inheritance and selected fields intersect the current resource-global allowlist.
- Current trusted tenant enforcement passed for original pinned source callers: restricted A denies while B retains the unchanged API, schema and artifact.
- Complete-table SQLite review, configured summaries, retained dormant/retired source keys, malformed-profile denial and original caller/current-authority checks passed their public slices. Packaged migration/current restoration, observed-reader peer HTTP/WS and native k6 proofs passed.
- Source/SQLite forms and explicit stale/lost-save recovery passed the final compatibility pair, including local global-policy invalidation and busy lazy initialization. All 312 backend cases, 24 corrected browser stories and the 775-state walkthrough passed. Original-image and gallery checks cover light/dark/system phone layouts. This is not broader product accounts, mixed graphs or multi-workspace authorization.
- Core, browser and candidate workflows use the maintainer's self-hosted Windows x64 runner, PowerShell, pinned tools and serialized runs. Check runs on repository pushes or manual requests. Complete check/browser execution later passed at `b184145`; manual candidate execution remains separate.

## Implemented in 0.14: coordinated key rollover

- Strict optional overlap of at most five minutes, immediate replacement by default, unchanged original expiry/scope/pin/issuer/tenant, and fixed server deadlines.
- Unique previous/next lineage, migration 20, current independent authority, at most two eligible credentials per chain, exact-key revocation and explicit lost-token recovery.
- Original WS ticket/connection and product-login proof boundaries, no deadline renewal on restart/restore, bounded adjacent checks and startup integrity review.
- Beginner replacement options and readable handover metadata. Native, browser and refreshed light/dark/system phone checks passed; exact evidence belongs in [testing](testing.md).

This does not add product sessions, per-member fields, public endpoints, provider support, or distributed availability.

## Implemented in 0.13: protected API field allowlists

- Resource-global allowed fields for each tenant-protected spreadsheet source and uploaded SQLite table. All includes future columns; selected can share none and new columns stay excluded.
- Current projection and business-filter gates before effects for existing releases, owner graph tests/callers, key management, rollback and k6; the private tenant predicate and privileged owner raw preview remain separate.
- Shared policy versions/CAS, retained omitted/dormant selections, safe source replacement, migration 19 default preservation, and unchanged compiler-two artifacts.
- Beginner full-name field selection, reviewed empty/widening changes, explicit stale/lost-save recovery, and per-table scope. Backend/native, complete browser checks and fresh theme/phone captures passed; exact evidence belongs in [testing](testing.md).

See [tenant rows and API fields](row-protection.md). Tenant profiles extend this rule in 0.15, bounded protected HTTP graphs in 0.16, and member profiles in 0.17 above. Product identity and public endpoint policies remain planned.

## Implemented in 0.12: typed WebSocket request/reply

- Exact generated WS and ticket routes, three-way transport indexing, compiler-two artifacts with trusted byte-exact legacy verification, and migration 18.
- Flat typed echo/row replies, dedicated current-release pins, native bearer and one-use origin-bound browser tickets, original workspace draft proof, and current issuer/tenant/policy checks.
- Process-local connection budgets, shared ticket limits, bounded message attempts/work/output, selective publication cleanup, reader cancellation, and startup/backup reconstruction.
- Beginner schema/message/reply forms, reviewed canonical REST-read conversion, explicit stale refresh, HTTP tool source separation, and actual built/dev browser transport.
- Bun 1.4.2 and SQLite `Database.run()` migration, tested backend/browser workflows, and refreshed light/dark/phone captures. Exact verification evidence belongs in [testing](testing.md).

See [WebSocket APIs](websockets.md). Events/subscriptions, WS client exports/load testing, production capacity, and the remaining platform below are separate work.

## Implemented in 0.11: protected read-only tenant rows

- Owner registry/assignments, exact original-text spreadsheet provenance, complete SQLite table policies, and private execution identity separate from request fields.
- Mandatory tenant equality before limits/projection; protected REST and narrow GraphQL row queries, live assignment/policy checkpoints, protected pins, and every non-owner's issuer/tenant inventory boundaries.
- Owner-only protected raw resources and a persistent owner-only backup restriction after first protection; bounded guarded downloads with incomplete-response detection.
- Migration 17 and legacy/current backup restoration, cross-process revocation, tenant-bound k6, raw-read/write-lock guards, beginner review/recovery forms, and full browser/capture acceptance. This narrow scope is not production certification or broader field/product/workspace isolation.

See [row protection](row-protection.md) for supported shapes, owner forms, and recovery boundaries; exact results belong in [testing](testing.md).

## Implemented in 0.10: selected API actions and dependency USE

- Selected actions on existing APIs, explicit typed USE of data/product-login dependencies, and filtered structural catalogs; no API creation or global resource administration.
- Current policy across all graph branches, transactional state changes, and asynchronous effect checkpoints. USE can expose data through APIs; field/record/tenant isolation remains separate.
- `Member.access` with a compatible `flowAccess` projection/shared version, strict owner changes, preserved defaults/old endpoint behavior, and migration-16/backup restoration.
- Issuer-bound runtime keys checking live action/API/dependencies against immutable compiled releases; mandatory current pins for selected issuance, preserved binding through rotation, fail-closed deleted issuers, independent legacy unbound keys, and cleanup after USE removal.
- Issuer-bound managed k6 keys, bounded runs, correct cancellation audit, and explicit limits on cross-process termination.

Server/native contracts, beginner browser workflows, and the corrected complete preview gallery are verified. Exact checks belong in [testing](testing.md) and [previews](preview.md). See [selected actions and USE](roles.md#selected-api-actions-and-dependency-use). Protected read-only tenant rows are implemented above; broader field/record policies and the remaining platform stay planned.

## Implemented in 0.9: selected-API reading

- Owner-managed all/selected access for viewers or custom roles with only API-read permission; existing/default members retain all access and owner scope stays immutable.
- API list filtering and direct-ID/read/export checks, including history, OpenAPI, client examples, and generated backend code; selection does not imply source/database access.
- Versioned atomic scope changes, audit/session revocation, immediate bearer policy, incompatible grant-expansion protection, and additive migration 15.
- Beginner member creation/assignment and stale-edit recovery, with an empty selection sharing no APIs.

Every accepted scope update advances its version and revokes affected browser sessions, even for the same selection; role assignment also advances that version. Lost or stale save outcomes require explicit refresh/review. This 0.9 delivery introduced read-only workspace sharing. The 0.10 extension above adds existing-API actions and issuer-bound credentials; field/record rules and tenant isolation remain separate. See [roles and sharing](roles.md#selected-api-reading) and exact verification in [testing](testing.md).

## Implemented in 0.8: generated backend and registered runtime routes

- Canonical trusted CommonJS artifacts and hashes generated for publication, actual REST method/path and GraphQL routes, and fresh compiled local activation instead of wildcard/path-to-flow dispatch.
- Preserved bounded graph engine, current credential/pin/contract/GraphQL checks, and mutable data/audit reads; fixed-size generation guards provide cross-process freshness without distributed activation claims.
- Additive migration 14, artifact/counter backup inclusion, rollback/startup reconstruction, caught-failure restoration, and fail-closed runtime recovery.
- Flow-read-authorized current-publication code inspection, copy/download, revision recovery, and clear runtime-dependent module requirements.

Failed peer reconstruction or local router restoration leaves runtime blocked until restart or a successful local publication stage. Ordinary requests retain credential/data/audit SQL; registered routing does not establish a performance improvement or distributed availability. See [published backend code](runtime-code.md) and exact evidence in [testing](testing.md). Selected reading and broader existing-API actions are implemented in 0.9/0.10; canonical tenant reads and resource-global protected API fields are implemented in 0.11/0.13. Broader isolation and the remaining platform stay planned.

## Implemented in 0.7: optional release-pinned runtime keys

- Existing/default keys follow the current publication; optional pins accept one graph revision only while it is current. No archived execution or mutable-data snapshot is introduced.
- Atomic current-publication issuance guards, dormant-key denials before effects, exact rollback reactivation, pin-preserving replacement, and managed load-test revision pins.
- Additive migration 13 and beginner key mode/status/recovery forms, including key-only management without forbidden API reads.

See [runtime keys](api-keys.md) and [testing](testing.md) for behavior and exact verification. Generated backend routing and selected-API reading are implemented above. Selected dependency USE and issuer checks are implemented in 0.10; narrow protected tenant reads are implemented in 0.11; broader field/record policies remain planned.

## Implemented in 0.6: server-side client code examples

- Eight targets: JavaScript Axios/Fetch, PHP cURL, shell cURL, Rust reqwest, Go net/http, Java HttpClient, and C++ libcurl.
- Published-source default, explicit saved draft, expected revision, typed REST/GraphQL inputs, and code-only origin/prefix overrides.
- Environment-based runtime-key placeholders, escaped source, dependency/run notes, and bounded no-redirect requests. Rendering does not execute an API, issue a key, or persist example payloads.

See [client code guide](client-code.md) for setup and [testing](testing.md) for exact native/toolchain, browser, and preview evidence. Optional release-pinned keys are implemented in 0.7.

## Implemented in 0.5: uploaded SQLite reads and feature folders

- Immutable original SQLite uploads and inspected table/column metadata, saved inside consistent control backups through migration 12.
- Separate `database-connections.read`/`database-connections.manage` grants, bounded read previews, checks, audited lifecycle changes, and deletion protection for drafts and every immutable release.
- Read-only product engines in trusted native helpers, with generated parameterized equality reads, selected fields, row limits, deadlines, concurrency/output bounds, and an SQLite allocation cap. This is not a full OS sandbox.
- Database nodes and generated REST GET/GraphQL query drafts. Live external connections, SQL writes, arbitrary SQL, synchronization, replacement, and other providers remain planned.
- Beginner upload, table/column/filter previews, generation, node forms, checks, deletion, and stale-action recovery. Later read-setting changes do not rewrite typed contracts; the guide explains regeneration or matching advanced edits.
- Seven server feature folders under `src/`, with only application wiring, startup, and shared errors at the root. One package remains; ignored runtime data is separate from tracked `src/data/` source.

See [database guide](databases.md) for supported behavior and [testing](testing.md) for local native, permission, recovery, runtime, browser, and preview evidence. This slice does not implement the remaining platform below.

## Implemented: custom workspace roles and update notices

- Owner-defined roles with 15 explicit workspace actions: 13 introduced in 0.4 plus two database-copy grants in 0.5. Member assignment remains owner-only, with versioned role edits/deletion and assigned-role deletion protection. Built-in editor/viewer behavior stays unchanged.
- Server resolution of current grants on bearer, cookie, and sign-in requests. Permission/assignment changes commit with audit and affected browser-session revocation; member keys are not rotated.
- Beginner permission descriptions and independent grants for drafts, publication, sources, product connections, runtime keys, audit, backups, migrations, and bounded load testing. Role administration and other-member session control remain owner-only.
- Additive migration 11 with role/assignment backup inclusion. Grants remain workspace-wide actions; public endpoint policy, field/record rules, and multi-workspace isolation remain planned.
- Owner-only **Updates** page with saved canonical GitHub repository/prerelease settings, manual bounded public-release checks, persistent cooldown/concurrency control, semantic-version notices, and safe cached failures. No downloads, installations, automatic version changes, private repository credentials, or compatibility/authenticity certification.

See [roles and permissions](roles.md) and [update notices](updates.md) for behavior. Verification evidence belongs in [testing](testing.md); configured actions are not claims of external provider or tenant-policy coverage.

## Implemented routes, release recovery, and release checks

- REST whole-segment path parameters, optional scalar path rules, typed references/conditions, and required OpenAPI path parameters.
- Explicit `/v1` and `/v2` paths on separate flows; no automatic compatibility policy. Same-method overlapping REST routes are rejected before publication or rollback. GraphQL remains exact-path.
- Flow-read-authorized immutable release history and definitions; publication-authorized rollback with an expected-current-publication check, dependency validation, and transactional audit. Drafts and mutable data/credentials are not restored.
- Parameter field forms for draft and load tests; server-built encoded local k6 paths. Publication and rollback are blocked while that flow has an active load test.
- Configured pinned CI checks and a manual release-candidate artifact workflow, with version/changelog/Conventional Commit policy and no automatic publication. Complete check/browser execution passed at `b184145`; manual candidate execution remains separate. See [release checks](releases.md).

See [routes and release history](api-routes.md) for product behavior and [testing](testing.md) for verification evidence. Remaining platform work below stays planned.

## Main feature: built-in k6 load testing

The current feature slice makes load testing part of the normal Besh workflow. Choose a published REST or GraphQL API, supply required fields, and start with safe small defaults. Manual installation, scripts, credential setup, and Grafana Cloud are not required; test settings are optional.

- Load-test-authorized published targets, run creation, result/history reads, and cancellation; owners have the grant by default.
- Automatic pinned official k6 provisioning, archive checksum verification, local executable caching, and optional trusted-path/cache configuration.
- Published REST contract and GraphQL schema/operation validation; automatically issued temporary operation-scoped keys with lifecycle revocation.
- One active run, one virtual user/five seconds by default, bounded ten-user/thirty-second configuration, latency/error/status goals, and aggregate summaries.
- Dashboard confirmation for repeated live writes and mutations; product OAuth/social flows excluded from automatic tests.
- SQLite run metadata/settings/results, backup inclusion, metadata-only audit lifecycle, restart interruption, and no persisted input or raw credential values.

Verification status and exact platform evidence belong in [testing](testing.md). Native download/execution must be observed separately from controlled-runner or browser tests. See [load testing](load-testing.md) for setup, use, result meaning, and limits. Long-running/scheduled tests, arbitrary external targets, custom scripts, distributed load, Grafana Cloud, and production capacity certification are outside this slice.

## Milestone 1: runnable core — implemented

- Visual flow editor: add, move, connect, configure, and remove nodes.
- First-run setup wizard with generated owner key; no manual environment setup.
- Save drafts, validate graphs, publish releases, and test responses.
- Bun + Elysia management and runtime APIs.
- SQLite persistence, role checks, audit history, migration history, and local backups.
- Tests through user-approved public HTTP, executor, and browser interfaces.
- Clear setup, contribution, security, AI, and community policies.
- Reproducible gallery of current pages, actions, error states, permissions, and phone layouts.
- Custom styled accessible controls and per-API GraphQL schemas, query/mutation execution, variables, and bounded field selection.
- Permission-issued runtime API keys for one published flow, required expiration, REST/query/mutation grants, hash-only storage, atomic replacement, and immediate revocation. Member credentials remain management-only; bound callers retain their original issuer authority.
- Beginner response/request/condition/data field forms with optional advanced JSON, generated GraphQL queries and optional schema editing, readable light/dark themes, and a mobile saved-API picker.
- CSV/Excel imports and public Google Sheets snapshots, reviewed column mapping, generated REST/typed GraphQL drafts, bounded data reads, manual snapshot replacement/refresh, and referenced-source deletion protection.

Current limits: one local workspace, literal or whole-segment parameterized REST paths, exact GraphQL paths, six node types, action roles with optional selected API actions and typed dependency USE, manual SQLite backups, read-only spreadsheet snapshots, and uploaded SQLite reads. Canonical tenant-protected reads and resource-wide allowed API fields are implemented; tenant-specific profiles are implemented in 0.15 and member profiles are implemented in 0.17 above. Broader record authorization and resource-management sharing remain planned. Google Sheets supports public exports; private OAuth, spreadsheet write-back, live external database adapters, and SQL writes remain planned. See [README](../README.md) for supported behavior and [testing](testing.md) for evidence.

## Milestone 2: identity and API contracts

- Implemented: optional REST path/query/body/response rules, server input/output checks, typed path/query conversion, recursive field/item forms and limits, generated spreadsheet contracts, and separate saved-draft/published OpenAPI 3.1.1 downloads. GraphQL retains its existing SDL contract.
- Implemented runtime-key replacement: authorized confirmation, one atomic winner, audit, unchanged name/flow/grants/exact expiration, one-time copy/save, and explicit lost-response recovery. Immediate replacement remains the default; optional overlap uses a fixed server deadline of at most five minutes and at most two eligible credentials per chain. Existing product login attempts and WS connections stay bound to their original key. General requests admitted before a cutoff may finish; explicit WS and product-login final checks still apply.
- Implemented: resource-wide field allowlists for canonical protected reads, optional release pins, and coordinated key handover. Tenant-specific profiles are implemented in 0.15; member profiles are implemented in 0.17 above. Public endpoint policy and broader record authorization remain planned. Runtime grants authorize whole operations alongside separate resource policies; overlap does not renew lifetime or expand grants.
- Implemented workspace accounts and cookie sessions: optional email/password or member/owner-key sign-in, fixed 12-hour expiry, session restoration, CSRF/origin checks, bounded persistent login throttling, own-account changes with fresh proof, metadata-only session listing, member-own/owner-all revocation, and a 20-session member limit. Bearer management clients remain compatible.
- Implemented GitHub product identity template: permission-managed encrypted OAuth connections and draft generation, REST POST or typed GraphQL login mutation, ten-minute state/proof with S256 PKCE, one-use caller/flow/revision/connection binding, and normalized identity output. Product servers retain runtime keys and separate proof, handle their own callbacks, and create their own sessions. Controlled GitHub responses test the boundary; no live OAuth app round trip has been verified.
- Planned product auth expansion: Discord, Facebook, Google, generic OIDC, product sessions/accounts, and reviewed identity linking. These do not change workspace sign-in.
- One-use invitation links onboard existing key-only members. Email delivery/verification, account recovery and cross-workspace invitations remain planned.
- Implemented: built-in roles plus owner-managed custom workspace action grants, version checks, member assignment, immediate current-grant resolution, affected session revocation, audit, selected existing-API actions, typed USE, and issuer-bound caller authority. Implemented: narrow tenant-protected resource reads. Planned: broader record/field policies, resource-management sharing, and multi-workspace isolation.
- Extend GraphQL with reviewed introspection policy, custom scalar contracts, and subscriptions alongside WebSocket work. Whole-query/mutation runtime grants and protected-row global, tenant and member field intersections are implemented; broader GraphQL field policies remain planned.
- Implemented: typed generated WebSocket request/reply, bounded connections and live revocation. Planned: lifecycle events, subscriptions, reconnect/replay, and distributed delivery.
- Implemented: safe whole-segment REST path parameters, explicit version-prefix flows, immutable release inspection, and permission-checked rollback. Same-method route overlap is rejected; draft edits and mutable dependencies stay separate from releases.
- Planned: pagination, bounded retry/error nodes, transformations, outbound HTTP, and subflows.

## Milestone 3: data and plugins

- Implemented: uploaded-copy SQLite reads. Planned: live SQLite connections/writes, PostgreSQL, MySQL/MariaDB, MongoDB, Supabase, Firebase adapters.
- Database connection testing and encrypted secret references beyond the current GitHub credential storage.
- Private Google Sheets OAuth, spreadsheet write-back, and scheduled synchronization beyond current manual public-sheet snapshots.
- Parameterized query builder and explicit transaction capabilities.
- Migration plans with dry runs, backup gates and restore verification.
- Backup scheduling, retention, encryption and off-site storage.
- Planned node plugin SDK, reviewed ZIP upload and CommonJS package pattern, with compatibility/capability review and a proven isolated worker before executable imports. No installer or uploaded-code execution is implemented. See [node plugin proposal](plugins.md).
- Isolated custom code execution with resource and network limits.
- Extension examples and adapter contract tests against real services.

## Milestone 4: AI operator

- Provider settings for Anthropic, OpenAI API, OpenRouter, Ollama and custom compatible APIs.
- Restricted Codex CLI process adapter with structured events and cancellation.
- Agent tools for flow design, testing, data inspection and permitted changes.
- Durable proposals, review, budgets, redaction, approvals and rollback.
- Provider capability checks and adversarial prompt/tool tests.

## Milestone 5: operations and releases

- Implemented: owner-only manual public GitHub release notices from a configured canonical repository URL, with versioned settings, optional prereleases, bounded checks, cached metadata, and a persistent cooldown. Live-provider evidence stays separate from controlled responses.
- Verified update artifacts, compatibility checks, backup, migration and rollback.
- Configured: Windows self-hosted push/manual validation and manual release-candidate artifacts with version/changelog/Conventional Commit checks. Core and browser jobs run sequentially with pinned Node and exact job-local Bun setup; both workflows serialize fixed-port runs. The reported non-admin Bun bootstrap failure is addressed in 0.16.1, and complete GitHub check/browser validation passed at `b184145`. Manual candidate execution and an authorized publishing pipeline remain separate. Changelog notes are written and reviewed, not generated automatically. See [releases](releases.md).
- Worker isolation, queues, horizontal scaling and production observability.
- Broader sustained/distributed load, penetration, recovery and tenant-isolation tests beyond current bounded local k6 runs.

## Completion gates

Each feature needs observable acceptance criteria, a failing test followed by a passing implementation, relevant type/build checks, updated docs, and a conventional commit. A configured provider must pass a real connection test before it is described as verified.

## Next Steps

The maintainer-approved English [product film](product-video.md) and README link reached main through [PR #13](https://github.com/mysbryce/besh/pull/13), with all three head/main CI jobs passing. The maintainer subsequently requested a GitHub attachment player directly in README; source `0.20.6-alpha.0` embeds the unchanged approved film. Keep `marketing/` local and ignored; Git receives the final MP4 under `docs/assets`. The presentation does not execute the backend or certify production capacity.

Keep the requested [platform stages and public acceptance gates](platform-plan.md) linked to each new milestone. The maintainer prioritizes consecutive platform feature deliveries before remaining database-panel localization. Owner-only Struct drafts and private collection binding with seven-language typed entry CRUD are delivered, including local checks, promoted gallery, scoped original review and exact-head/main CI. Later Struct edits must not silently alter a collection's field contract. Version-one paragraph forms and version-two formatted content/editor journeys pass focused browser/HTTP checks; the latest core passes while full browser/gallery and hosted delivery gates remain pending. Safe HTML with reviewed mappings and publication through actual generated routes remain planned. Media/CMS expansion, adapter breadth, product providers and payments remain planned until their actual acceptance gates pass.

Execute the remaining platform in this order. Finish each public-interface test and implementation before moving to the next slice. Keep completed behavior separate from configured or planned integrations.

Basic CSV import, uploaded replacement, spreadsheet API generation, public Google Sheets refresh and source deletion passed their separate public language journeys and combined local delivery checks. Saved-source refresh/deletion and development-readiness PR #14 also passed all three head/main CI jobs. The 0.20.7 source-status journey passes all seven languages with real CSV/Excel snapshots, UTC/Bangkok dates and unchanged permission boundaries. The 0.20.8 SQLite upload/catalog delivery also passed local checks and all three head/main CI jobs. Its remaining query/row-preview, API-generation, check/delete and advanced-panel translations wait behind private collection and entry foundations. Advanced protection, broader number/date formatting and native-speaker review remain separate. Preserve portable platform/browser/notice limits; native load-test shutdown needs separate evidence before any process-drain claim.

Continue database panels, backups and advanced sharing/protection languages through separate public journeys. Technical errors, remaining dynamic completion notices and native-speaker review remain separate. Basic Studio translation is complete in 0.18.4; member/role translation is complete in 0.18.3; account/session and update settings are complete in 0.18.2. Other date/number formatting remains separate. Preserve authored data, contracts, current permission checks and the compact phone-safe layout. See [language coverage](localization.md).

1. **Rich text and collection publication.** Finish hosted delivery for the formatted version-two AST/editor; complete local suites, gallery and scoped original-image review have passed. Preserve literal paragraph version one without silent conversion. Next add typed structured output and a default safe HTML renderer with owner-reviewed per-element class/attribute mappings, escaped content and allowlisted tags/attributes/URLs; never execute content or attribute expressions. Finally publish reviewed content/revisions through actual canonical generated routes with current authorization and draft isolation. Later stages remain planned and need their own public journeys. Preserve immutable server-read Struct binding, version checks and full-backup confidentiality; review migration and backup recovery before changing bound contracts.
2. **Product authorization and shared resources.** Preserve member-field intersections and the narrow workspace invitation lifecycle. Next add reviewed product accounts/sessions/linking, workspace email verification/recovery, resource-management sharing and multi-workspace isolation through separate lifecycles. Joins, social effects, public endpoints and broader WS graphs remain separate. Caller fields and static projections never establish identity or authorization.
3. **Data connections and query tools.** Extend reviewed adapter capabilities and encrypted server-held credentials to PostgreSQL and MySQL/MariaDB; add MongoDB, Supabase, and Firebase with their own transaction, identity, query, and backup semantics. Add live SQLite connection/write capabilities separately from the uploaded-copy read adapter. Ship bounded parameterized read/write forms, pagination, previews, and explicit transactions one adapter at a time. Add migration dry runs, backup gates, restoration checks, and destructive-change review before schema changes. Private Sheets OAuth, write-back, and scheduled synchronization follow their connection/permission work.
4. **Graph execution and extensions.** Add typed transformations, bounded outbound HTTP, explicit error/retry paths, and subflows with execution limits. Introduce a versioned declarative plugin manifest and SDK before uploaded code. Require a real isolated process/container, capability grants, integrity checks, and resource/network limits before enabling custom-code plugins. Verify each extension against its actual services.
5. **Product providers and AI operator.** Verify GitHub with a real OAuth app, exact product callback, and private encryption-key backup. Add Discord, Facebook, Google, and generic OIDC individually with state/PKCE, redirect validation, and safe identity linking. Implement provider settings and capability discovery for Anthropic, OpenAI API, OpenRouter, Ollama/compatible endpoints, and a separate restricted Codex CLI process adapter. Add caller-scoped typed tools, durable proposals, budgets, redaction, cancellation, approvals, and adversarial tests. Do not infer live provider success from mocks or stored configuration.
6. **Realtime events and subscriptions.** Extend basic WS request/reply with explicit event sources, authorized topics, reconnect/replay, and durable/distributed delivery only after their lifecycle is designed. Add GraphQL subscriptions as a separate transport/event-execution scope with per-event identity and permission checks. Review introspection/custom scalars alongside their schema rules. Exercise sustained access after key expiry and policy changes. WS-specific client exports and load tests remain separate from the current HTTP tools.
7. **Operations and authorized releases.** Add backup schedules/retention/encryption/off-site restore, worker isolation, queues, observability, and tested scaling. Review configured manual update notices and their live-provider evidence, set a private reporting contact, then design verified update compatibility/backup/migration/recovery. Preserve observed hosted check/browser acceptance and review release-candidate artifacts before any requested tag/publication. Keep Besh below `1.0.0` until explicit maintainer confirmation. Broaden sustained/distributed load, recovery, penetration, and tenant-isolation tests before production claims.

Every slice includes current beginner forms, light/dark/phone previews, relevant tests/type/build/format checks, updated docs, a version bump/changelog entry, and a Conventional Commit. External credentials, services, deployment settings, and live verification are supplied or configured when their slice needs them; their absence must not become an implementation claim.
