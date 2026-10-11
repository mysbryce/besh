# Changelog

Every version change is recorded here. See [version rules](docs/releases.md). Development history below does not imply a published package, tag, or deployment.

## Unreleased

## 0.25.0-alpha.0 — 2026-10-11

### Added

- Owner-reviewed collection HTML settings with independent revisions, atomic saves, metadata audit and backup recovery.
- Labelled element classes, literal attributes and optional fixed heading identifiers in seven languages.
- Local default settings, explicit conflict reload and recovery when a save response cannot be confirmed.
- Twenty-two page/action previews for saved settings, recovery, pending saves, languages and phone layouts.

### Changed

- Preserve untouched renderer wire values during form edits and block conflicting actions while saving.
- Keep collection settings separate from private temporary HTML preview and future generated content endpoints.

## 0.24.1-alpha.0 — 2026-10-11

### Changed

- Group dashboard pages and local helpers by feature, with separate app shell, stores and shared API DTOs.
- Preserve direct imports, lazy loading, initialization, entry/assets and public behavior while updating Vite/test paths.
- Document the dashboard layout and completed private HTML source delivery.

## 0.24.0-alpha.0 — 2026-10-11

### Added

- Owner-only HTML previews for saved literal and formatted rich text, including labelled fields inside frozen collection groups and lists.
- Reviewed semantic element classes, literal titles and accessibility labels, with a fixed heading identifier for explicitly compatible clients.
- An inert isolated visual preview, escaped copyable HTML source, seven-language controls and 22 page/action previews.
- Strict renderer validation, configuration hashes, bounded HTML output and current-owner checks without saving preview settings or changing content.

### Fixed

- Require explicit entry reload after a concurrent change and block conflicting actions while HTML requests or copying remain pending.
- Keep reviewed settings and source through language changes; invalidate them after field, entry or settings changes.
- Keep HTML source readable on small light/dark screens and explain paragraph-only fields without obsolete conversion guidance.
- Keep the fixed-heading checkbox square with a large labelled hit area, and capture actual rendered iframe content after viewport readiness.
- Keep member role selection and New role unavailable until their current workspace catalogs finish loading.

### Changed

- Persistent renderer settings and generated collection endpoints remain separate upcoming milestones. This delivery previews private saved content only.

## 0.23.0-alpha.0 — 2026-10-11

### Added

- Separate versioned paragraph and formatted rich-text fields for private content models and entries, with strict structured documents and tested backup recovery.
- A native editor for headings, emphasis, HTTPS links, lists, tables, quotes, literal code and dividers, with keyboard history and plain-text paste.
- Seven-language editor controls and forty page/action previews, including compact light/dark phone layouts and pending-save states.

### Fixed

- Preserve empty paragraphs and leaves, link boundaries, mark order, separate numbered lists, literal whitespace and untouched blocks during editing.
- Reject reviewed table/list/quote/divider insertions and list movement that exceed document limits before changing content or history.
- Preserve imported list owners during outdent and Backspace. Keep structural Undo through a version-pinned native history patch that also reproduces on a fresh frozen install.
- Include dependency patches in source release candidates with verified file checksums.
- Keep numbered list owners visible beside nested lists and saved scalar values readable in light and dark content previews.
- Check the actual bounded runtime-key expiry response before capturing the expired-key preview.
- Wait for native dropdown placement and selected focus before testing keyboard access to long role names.
- Record final optimized dashboard asset sizes and hashes, verified against actual files served by the copied portable executable.

### Changed

- Keep HTML rendering, reviewed element mappings, media and canonical collection publication separate from private structured content.

## 0.22.0-alpha.0 — 2026-10-11

### Added

- Owner-managed private collections bound to an exact server-read saved content model. Later model edits leave their field contracts unchanged.
- Typed entry forms for text, numbers, booleans, groups, lists and choices, with explicit optional fields, bounded paging, versioned editing and confirmed deletion.
- Strict entry validation, atomic metadata audit, concurrent-change protection and tested migration, restart and downloaded-backup restoration.
- Seven-language content forms and 35 page/action previews for typed entries, compact model inspection, conflicts and light/dark phone controls.

### Changed

- Preserve unsaved content on conflicts and require explicit reload before retrying an edit or deletion.
- Clear resolved catalog errors after successful refresh while retaining unresolved edit conflicts.
- Collapse saved model details behind View/Hide controls while keeping the full review visible during collection creation.
- Keep full workspace backup permissions separate from owner-only content management. Shared CMS access, rich text and generated content runtime publication remain planned.

## 0.21.0-alpha.0 — 2026-10-11

### Added

- Owner-managed content model drafts with visual Text, Number, Boolean, Group, List and Choice fields, including nested groups and list item types.
- Bounded, versioned Struct management with strict validation, current owner authorization, atomic metadata audit and backup/restart recovery.
- Seven-language forms and twenty-one page/action previews covering real saves, pending delivery, catalog refresh, conflict recovery, accepted new drafts and light/dark phone controls.

### Changed

- Keep authored values intact across language changes; preserve unsaved edits on stale saves and require an explicit discard before reloading.
- Return keyboard focus after removing fields or choices and keep mobile actions at least 44 pixels with square custom checkboxes.
- Continue authorized Roadmap deliveries and delete completed delivery branches after reviewed merges and successful main CI.
- Specify web-configured CMS Structs and structured rich text with optional reviewed server HTML mappings. Content entries, rich-text editing and collection runtime publication remain planned.

## 0.20.8-alpha.0 — 2026-10-10

### Fixed

- Translate SQLite upload, saved-copy selection, loading, read-only/no-sync guidance, metadata and upload/catalog-refresh completion in all seven dashboard languages.
- Preserve the chosen file, authored names, inspected table metadata and current permissions when changing language. Refresh connections reloads saved metadata; it does not synchronize the original database.

### Changed

- Add a real native SQLite browser journey and 23 page/action previews for staged uploads, pending delivery, saved catalogs and permission boundaries.
- Wait for the complete observed source-refresh request sequence before asserting it; preserve the exact requests and existing browser budgets.
- Record completed head/main validation for the preceding saved-source status delivery.

## 0.20.7-alpha.0 — 2026-10-10

### Fixed

- Translate saved-source loading, selection, read-access guidance, rows/version/saved-time status, sheet prefixes and catalog-refresh completion in all seven dashboard languages.
- Format saved-source times in the selected language and browser timezone without changing stored dates, authored data or permissions. Refresh list remains an explicit catalog action, separate from fetching Google Sheets.

### Changed

- Add a real CSV/Excel browser journey and 22 page/action previews for source status, explicit refresh and permission boundaries.
- Record completed head/main validation for the preceding inline README video delivery.

## 0.20.6-alpha.0 — 2026-10-10

### Fixed

- Embed the approved product film in README using a GitHub video attachment, so readers can play it directly.
- Keep the original tracked MP4 and verify that the anonymous attachment download matches its complete bytes and SHA-256.

## 0.20.5-alpha.1 — 2026-10-10

### Fixed

- Wait for completed workspace sign-in before saved-source permission and language assertions, preventing initial API loading from being mistaken for a language-change request.
- Open the actual development Studio before creating short-lived WebSocket proofs, with bounded cold-compilation readiness; retain the current browser session and existing reload checks.
- Warm the dashboard entry and Studio modules during Vite startup to reduce first-load transform waterfalls.

## 0.20.5-alpha.0 — 2026-10-10

### Fixed

- Translate public Google Sheets import, manual refresh guidance, confirmations and completion across all seven dashboard languages.
- Translate source deletion actions, complete irreversible confirmations and completion without changing current draft/publication guards or member permissions.
- Preserve authored source names, URLs, columns and cells when choosing a language; refreshing and deleting remain explicit actions.

### Changed

- Add real public browser journeys and masked previews for saved-source refresh and deletion, with only the external Google CSV provider simulated.
- Record the approved film's completed README delivery and passing head/main CI.

## 0.20.4-alpha.0 — 2026-10-10

### Changed

- Link the maintainer-approved 60-second product film from the README, with its final MP4 retained in Git and editable marketing files ignored.
- Record design approval and resume the next spreadsheet-provider localization journey.

## 0.20.3-alpha.0 — 2026-10-10

### Changed

- Add a final English product-film MP4 with animated React/SVG interface demonstrations and an original instrumental score.
- Keep local Remotion tooling and editable marketing files out of Git and product dependencies; document the delivered video's provenance and decoded verification.
- Use brisk interface animation, an energetic original soundtrack and frame-synchronized interaction boops; document existing query/body/path data filters.
- Vary film compositions with centered typography, full-frame interfaces, camera detail shots, prominent results and an external phone viewport preview.
- Add brief target bounces, focus rings and connector landing pulses so each demonstrated interaction makes its affected control, node or result clear.

## 0.20.2-alpha.0 — 2026-10-10

### Fixed

- Translate spreadsheet API-generation forms, complete path/filter guidance, field choices, draft-discard confirmation and completion notices across all seven dashboard languages.
- Keep authored API names, paths, column mappings, typed REST/GraphQL contracts and current permissions unchanged when choosing a language. Creating, testing and publishing remain explicit actions.

## 0.20.1-alpha.0 — 2026-10-10

### Fixed

- Translate uploaded spreadsheet replacement forms, complete confirmation warnings and completion notices across all seven dashboard languages.
- Preserve selected files, authored data, current permissions and published API behavior while changing presentation language or canceling replacement.
- Run product SQLite preview stories in a bounded phase before other browser captures, preserving reader deadlines, all stories and the last successful gallery on failure.
- Bound product SQLite browser work and run the startup-sensitive member-field story alone. Cap the default dashboard phase at four workers after higher-worker failures; preserve explicit CPU/count overrides and the separate Vite/WebSocket phase.
- Keep routine step-picker assertions and masked failure diagnostics while capturing its complete visual inventory only in the gallery.

## 0.20.0-alpha.0 — 2026-10-10

### Added

- CPU-adaptive backend and browser workers, using half the available logical CPUs by default with explicit all/number overrides.
- Focused development checks for changed-file formatting, whole-project types, selected backend/browser tests and individual preview stories.

### Fixed

- Translate basic spreadsheet import and data previews across all seven dashboard languages while preserving authored data and current permissions.
- Allow workspace presentation language changes during pending operations, so completion uses the current language without unlocking management actions.
- Bound native SQLite test worker groups and isolate the cold Vite/WebSocket journey to preserve production deadlines under parallel test load. Keep preview capture capped at four verified workers.

## 0.19.1-alpha.0 — 2026-10-10

### Fixed

- Link the published Windows portable prerelease from the README and record verified release downloads.
- Mark portable delivery complete and retain explicit limits and the next data-source language work.

## 0.19.0-alpha.0 — 2026-10-10

### Added

- Portable Windows executable with the production dashboard and Bun runtime embedded. Double-click starts an owned background workspace and opens first-run setup.
- Explicit port/data-directory options and verified start, status, open, foreground run and stop commands. Keep workspace data beside the executable by default.
- Trusted compiled SQLite reader dispatch, offline full notice export, source/build inventories and bounded portable packaging.
- Serialized Windows artifact CI covering setup, browser publication, real SQLite, REST/GraphQL/WebSocket restart, concurrent starts and private-file permissions.
- Ubuntu and macOS source build instructions with explicit platform verification limits.
- Planned media/content/Struct tools, broader database and product-auth adapters, payment providers and measured generated-runtime budgets.

### Fixed

- Use the absolute Windows PowerShell executable and its archive module for first-use k6 extraction when Bun, Node and developer PATH entries are absent.
- Accept Bun >= 1.4.2 instead of requiring one exact version; retain a reproducible minimum-version CI baseline and record actual build provenance.
- Enforce blank lines between small logical code groups, including after context compaction, and improve portable module spacing.

## 0.18.5-alpha.0 — 2026-10-10

### Fixed

- Translate GraphQL and WebSocket route guidance and the GraphQL test heading in all seven dashboard languages.
- Keep authored schemas, queries, message fields and replies unchanged when choosing a language.
- Measure settled phone dropdowns at CSS-pixel precision while retaining their required 44px minimum.
- Keep menu preview masks outside unrelated options and use Fit View before selecting generated nodes in a narrowed canvas.

### Changed

- Add actual GraphQL and WebSocket draft-test language journeys, including explicit protocol changes and dark phone previews.

## 0.18.4-alpha.0 — 2026-10-10

### Fixed

- Translate the first API guidance, REST draft help, save/publication status and discard confirmation in all seven dashboard languages.
- Keep authored names, routes and response values unchanged when choosing a language; saving, testing and publication remain explicit actions.

### Changed

- Add real first-task and save/test/publish language journeys, with light/dark phone previews and unchanged permission boundaries.

## 0.18.3-alpha.0 — 2026-10-10

### Fixed

- Translate member forms, role assignments, permission descriptions and confirmations in all seven dashboard languages.
- Preserve authored names, credentials, API selections and dependency choices when switching languages; save and revoke actions remain explicit.
- Mask one-time member tokens in previews independently of their translated label.
- Keep long translated role headings and actions inside their phone cards.
- Mint the development WebSocket ticket after the browser interface is ready, keeping cold page loading outside its existing lifetime.
- Drain forwarded generated-backend browser requests before stopping their isolated server, releasing held responses even when a preview capture fails.

### Changed

- Add real member/role language journeys and light/dark phone previews, including selected access and owner-only boundaries.

## 0.18.2-alpha.0 — 2026-10-10

### Fixed

- Translate account, session and update settings guidance, action labels and confirmations in all seven dashboard languages.
- Format session and release-check dates in the selected language, keeping the browser timezone and Gregorian calendar.
- Keep unsaved inputs, authored names, release titles and existing permission boundaries unchanged when choosing a language.
- Wait for current global policy controls before refreshing a tenant profile in the preview walkthrough.

### Changed

- Add real account/save/revoke and update-settings language journeys, with light/dark phone previews.

## 0.18.1-alpha.0 — 2026-10-10

### Fixed

- Replace the gallery's text chevron with an aligned SVG icon.
- Reduce desktop sidebar and custom dropdown spacing while retaining full labels and 44px phone targets.
- Use rounded themed native scrollbars, preserving wheel, keyboard and system high-contrast behavior.
- Make shared dropdown sizing apply consistently to member and runtime-key forms.
- Wait for closing dropdowns to disappear before choosing a preview capture viewport.
- Preserve opaque redaction alignment when native scrollbars are captured in full-page previews.

### Changed

- Capture actual scrollbars in previews and add compact navigation/menu states.
- Document protected-main dependency updates, their patch history and the observed GitHub artifact storage-quota limitation.

## 0.18.0-alpha.0 — 2026-10-10

### Added

- Private, one-use invitation links so existing workspace members can set their own email/password sign-in.
- Owner invitation metadata, explicit reissue/revocation and a separate password setup page.
- Categorized step picker with search, persistent favorites and translated built-in descriptions.
- Device-based language selection and a custom selector for English, Thai, Mandarin Chinese, Russian, Japanese, Korean and Portuguese in the main workflows.
- Planned plugin documentation with CommonJS exports, ZIP structure and an owner upload/review pattern.

### Changed

- Use compact desktop spacing while retaining mobile touch targets and light/dark/system appearance.
- Run normal browser tests with four workers, retaining locks for shared ports, setup, clipboard and native k6 work.
- Isolate preview workspaces and run real preview stories with four workers. Serialize shared clipboard and native k6 work.

### Fixed

- Recover stalled language loading with bounded English fallback and explicit retry.
- Capture invitation links during language startup without losing the latest recipient or restoring private workspace data.
- Keep Korean phone headings at word boundaries and show import guidance after an empty spreadsheet catalog loads.

### Security

- Hash stored invitation secrets, fix expiration at 24 hours and create accounts atomically without overwriting an existing account.
- Recheck invitation eligibility after password hashing. Bound attempts and concurrent work; invalidate pending links after access changes or owner-key recovery.
- Keep invitation secrets out of URL requests, browser storage, audit records and previews. Require explicit sign-out of an existing browser session before dashboard acceptance.

## 0.17.2-alpha.0 — 2026-10-10

### Changed

- Pin GitHub Actions artifact uploads to v7.0.1. Preserve manual candidate preparation, read-only permissions, the reviewed bundle contents, and 14-day artifact retention.

## 0.17.1-alpha.0 — 2026-10-10

### Changed

- Pin GitHub Actions checkout to v7.0.1, compatible with the current Windows runner. Preserve manual and push triggers, read-only permissions, and the local Bun installer.

## 0.17.0-alpha.0 — 2026-10-09

### Added

- Owner-reviewed member field profiles for protected spreadsheet and SQLite APIs, intersecting shared and tenant settings.
- Configured-member summaries, complete table review, and explicit refresh after stale or unconfirmed saves.
- GitHub Sponsors funding, weekly dependency proposals, and pull-request, bug and feature templates.

### Changed

- Guide new users toward a spreadsheet or blank API. Keep exports and release history under optional **API tools**.
- Show plain field settings and current status first, with technical review values under **Review details**.
- Bundle Google Sans Flex and Noto Sans Thai locally, with distinct text weights and more room for phone field reviews.

### Security

- Apply member field settings to the original authenticated member or key issuer, including existing releases, key replacement, WebSocket replies and load tests.
- Reject stale role/access/assignment reviews, invalid stored profiles and removal of retained source fields. Preserve complete-table atomic saves and deleted-issuer denial.
- Prevent non-owners from receiving another issuer's bound key through replacement while retaining authorized historical cleanup.

### Fixed

- Discard an older global-policy response after a newer member or tenant save; keep sibling reviews stale until refreshed.
- Preserve explicit tenant recovery guidance after an uncertain save.

## 0.16.3-alpha.0 — 2026-10-09

### Fixed

- Wait for the API-key form to be ready before exercising its keyboard controls. Verify each permission change before creating the key.

## 0.16.2-alpha.0 — 2026-10-09

### Fixed

- Keep browser-test authentication on its original origin when forwarding real backend responses, fixing bundled Chromium sign-in failures.
- Wait for actual flow-test responses before reading dashboard results.
- Send SQLite file uploads directly to their isolated dashboard/API origin and finish delayed responses before removing test handlers.
- Resolve the development proxy's Vite executable from its installed package.

### Changed

- Run regular browser stories against built dashboard assets on Bun. Keep development proxy and ignored-document watch checks in the dedicated Vite story.
- Use supported reduced motion for regular browser stories while retaining the motion-enabled visual builder journey. Preserve all browser scenarios and serial native k6 execution.

## 0.16.1-alpha.0 — 2026-10-09

### Fixed

- Install Bun and a regular copied `bunx.exe` inside the Windows runner's job temporary directory, avoiding privileged symlink creation and changes to the user's Bun installation.

## 0.16.0-alpha.0 — 2026-10-09

### Added

- Bounded protected REST/GraphQL graphs with up to four spreadsheet/SQLite reads, three input conditions and a last-read response.
- Reviewed reply rules and GraphQL row-query forms with complete field labels and optional advanced editing.
- Explicit flat reply contracts for expanded graphs, while preserving existing single-read behavior and WebSocket limits.

### Security

- Check every branch's current resource, issuer, tenant, USE and allowed fields before effects and final replies, including changes on an earlier resource during a later read.
- Validate complete raw GraphQL row types, nullability and enums before field projection or scalar coercion.
- Bound expanded GraphQL operations to one eligible rows response key before execution, client-code generation or load-test job creation; honor variables, directives and abstract fragments.

### Fixed

- Clear the previous response when admitting a new REST/GraphQL draft test, so a rejected request does not look like an earlier successful result.
- Keep safe legacy input references and ordinary dollar-prefixed filter literals compatible.
- Let Fit View contain larger graphs on narrow phone canvases.

## 0.15.0-alpha.0 — 2026-10-09

### Added

- Tenant-specific API fields for protected spreadsheets and each uploaded SQLite table. Inherit shared fields or select a narrower set, including none.
- Owner forms with complete table review, configured tenant labels, explicit empty/widening/reset approval, and light/dark/system phone layouts.
- Migration 21 and backup-restored profiles, with shared policy/resource/tenant version checks and metadata-only audit.

### Changed

- Run core, browser and candidate workflows on the maintainer's self-hosted Windows x64 runner, with automatic pinned Node/Bun setup and serialized fixed-port jobs.
- Run checks for repository branch pushes or manual requests, with immutable commit checkout and no pull-request event on the persistent host.

### Security

- Intersect current global fields with the original trusted tenant's profile before authored projections and business filters, including existing pinned REST/GraphQL callers, tests, key replacement, k6 and WebSockets.
- Preserve dormant/retired selections and reject source replacement removing a retained key; reviewed reset activates neither protection nor a tenant.
- Fail closed for malformed profiles. Shared resource changes withhold pending reads and close affected sockets; fresh admission checks the current profile.

### Fixed

- Mark lost or stale saves and failed metadata reads unknown, preserve local choices, and require explicit refresh before another review.
- Keep independent panel closure available after confirmed saves and suppress false empty-state guidance when registry loading fails.
- Invalidate open tenant reviews after accepted or unconfirmed global saves while preserving choices; defer only an initial never-started read until pending work ends.
- Keep tenant selectors and confirmation actions inside their cards on desktop and phone, with complete labels and accessible hit targets.

## 0.14.0-alpha.0 — 2026-10-09

### Added

- Optional runtime-key handover with a fixed server deadline of up to five minutes; immediate replacement remains the default.
- Beginner replacement options, explicit overlap review, full linked-key identifiers, and one-time replacement receipts.
- Migration 20 and backup-restored rollover lineage, preserving each original expiry, grant, release pin, issuer, and tenant.

### Security

- Check both credentials independently against current authority and permit at most two eligible credentials in each rollover chain.
- Bind WebSocket tickets, active connections, and product-login completion to their original credential and acceptance window.
- Reject malformed or inconsistent lineage at startup and use bounded adjacent checks during requests; restore never renews a deadline.

### Fixed

- Require explicit inventory refresh after an unconfirmed replacement instead of displaying stale active status or retrying issuance.
- Preserve a received one-time secret when the following metadata refresh fails, and revoke only the exact reviewed key.
- Keep replacement timing and duration labels on separate readable rows on narrow screens.

## 0.13.0-alpha.0 — 2026-10-09

### Added

- Owner-managed API field allowlists for each protected spreadsheet source and SQLite table, with all/selected modes and an explicit empty selection.
- Beginner field forms, full-name review, separate empty/widening acknowledgments, and retained settings through deprotection and recovery.
- Migration 19 preserving existing all-field defaults, current field policies in backups, and unchanged compiler-two artifacts.

### Security

- Gate configured projections and business filters before effects for old releases, owner tests/callers, key management, rollback, and k6.
- Recheck current policy after asynchronous HTTP reads and close changed-policy WS connections while canceling their native readers.
- Preserve private tenant predicates, privileged owner raw data, and full backup boundaries; selected fields are never silently widened or redacted.

### Fixed

- Reject source replacement that removes retained selected keys, including dormant selections, before policy review becomes unavailable.
- Hide field-denied load targets while retaining authorized historical cleanup and cancellation.

## 0.12.0-alpha.0 — 2026-10-09

### Added

- Typed WebSocket request/reply APIs with exact generated routes, flat message/row forms, and reviewed conversion of supported REST reads.
- Dedicated release-pinned WS callers, one-use browser tickets, and saved-draft connect/send/disconnect with current workspace proof and tenant review.
- Bounded connection work, generic errors, readable replies, explicit stale-draft recovery, and native development-proxy support.
- Migration 18, compiler-two WS modules, trusted compiler-one compatibility, and tested startup/backup reconstruction.

### Security

- Recheck original credentials, grants, issuer/API/USE, tenant assignment, and resource policy before frames and final replies; close changed policy/revision connections.
- Atomically consume origin-bound tickets across peers, enforce ticket/connection quotas, reject URL query credentials, and preserve bearer precedence.
- Count malformed attempts against message limits, reject conflicting ticket helper routes at publication/startup, and cancel native readers before shutdown.
- Keep WS unavailable to HTTP examples, OpenAPI, and current k6 targets while preserving tools for a still-published REST release.

### Removed

- Local `skills-lock.json` tracking; skill installation metadata remains ignored on disk.

### Changed

- Upgrade the installed runtime and repository/CI pins to Bun 1.4.2; use SQLite `Database.run()` instead of its deprecated `exec()` alias.

## 0.11.0-alpha.0 — 2026-10-09

### Added

- Owner-approved tenant identities and versioned member assignments, with beginner review and recovery forms.
- Protected read-only spreadsheet and SQLite APIs using exact tenant predicates before business filters, limits, and returned fields.
- Protected draft tests, pinned member-linked runtime keys, and managed k6 jobs using current assigned identity.
- Migration 17 preserving legacy defaults and caller metadata, with reviewed spreadsheet reimport and tested backup restoration.

### Security

- Keep row policies outside editable graphs and reject unsupported protected branches, mixed reads, literals, and GraphQL row shapes.
- Preserve original spreadsheet cell text and use bound SQLite BINARY equality; request values cannot establish tenant identity.
- Recheck current credentials, issuer authority, assignment, and resource policy around asynchronous reads before returning rows.
- Filter tenant-bearing key/job inventory for every non-owner, preserve identity and exact expiry through replacement, and retain authorized historical cleanup.
- Restrict protected raw resources to the owner; first protection permanently reserves ordinary backup operations for the owner.
- Bound backup read chunks and check current authority during downloads; keep private SQLite operation metadata out of process arguments.
- Recheck raw-resource protection after SQLite readers and inside contended source/database deletion and draft-generation transactions.

### Fixed

- Reject incomplete backup downloads before saving or reporting success.
- Require explicit refresh after stale or unconfirmed tenant/policy saves and fence reviews to the current API, actor, and session.
- Preserve large Excel imports and relationship-selected worksheet paths while enforcing original-cell storage limits.
- Keep protected GraphQL business filters supported and mark historical jobs cleanup-only after dependency-use loss.
- Deny delegated raw reads and mutations when another process activates protection before their final authority checkpoint.
- Keep complete long tenant labels inside phone action buttons and review headings.

## 0.10.0-alpha.0 — 2026-10-09

### Added

- Selected-member editing, draft tests, publication, and rollback for existing APIs, with explicit permission to use each spreadsheet, SQLite copy, or product-login connection.
- Beginner dependency controls and filtered structural catalogs without direct data previews or global resource access.
- Runtime keys linked to the original member's current authority, mandatory release pins for selected issuance, and scoped k6 jobs with cleanup after data-use permissions are removed.
- Migration 16 preserving existing access defaults, legacy independent caller keys, and backup restoration.

### Fixed

- Require an explicit metadata refresh after an unconfirmed runtime-key issuance response, preserving form inputs without permitting an accidental second issuance.
- Keep member action buttons contained on narrow screens and distinguish independent replacement receipts from member-linked replacements.
- Bring the sharing editor into view after managing a member near the bottom of a long team list.

### Security

- Check every graph dependency before validation and execution, including unused branches, with current policy inside state changes and asynchronous effect checkpoints.
- Preserve original member, action, release pin, and exact expiration through key replacement; deleted members leave a binding that denies access.
- Hide unrelated and independent credentials/jobs from selected members, retain authorized cleanup, and record the actual manager when canceling a load test.
- Capture a saved API response inside its state transaction so a peer's later draft cannot replace the accepted response.

## 0.9.0-alpha.0 — 2026-10-09

### Added

- Owner-managed all-API or selected-API reading for compatible read-only members, including an empty selection.
- Beginner member access forms, explicit confirmation, version-conflict recovery, and immediate browser-session revocation after access changes.
- Migration 15 storing member access modes and selected API grants with backup and restart restoration.

### Security

- Filter API lists and enforce selected access for definitions, releases, OpenAPI, client examples, and generated backend code at the server.
- Keep role actions independent from API selections and reject incompatible global permissions before changing members or custom roles.
- Preserve separate published runtime credentials and avoid granting related data, account, field, or tenant access implicitly.

## 0.8.0-alpha.0 — 2026-10-09

### Added

- Generate trusted backend modules on publication and register actual REST methods/paths and GraphQL endpoints.
- Private generated-backend previews, source hashes, copy/download, and explicit stale-release recovery in API Studio.
- Migration 14 storing compiler artifacts and a publication counter, with startup and backup reconstruction.

### Changed

- Replace wildcard runtime dispatch and per-request path-to-flow database searches with immutable registered handlers.
- Rebuild routers for publication/rollback while preserving dashboard assets, current load-test targets, and shutdown.

### Security

- Stage code and compiled routes with transactional publication/audit updates; caught failures restore previous routes or block execution safely.
- Check publication generations and current credentials before effects, preserving release pins, contracts, GraphQL limits, and revocation across processes.
- Validate canonical generated source before loading, clean temporary modules, and enforce explicitly published REST methods.

## 0.7.0-alpha.0 — 2026-10-09

### Added

- Optional runtime keys restricted to one published API revision, with follow-publication behavior retained by default.
- Release choices, active/inactive guidance, and exact revision/expiration details in key issuance and replacement.
- Migration 13 preserving existing follow keys and managed k6 keys tied to their run's publication.

### Security

- Reject stale pinned-key issuance atomically and deny mismatched releases before input checks or flow effects.
- Preserve exact pins and expiration during replacement, including dormant keys, without executing archived definitions.
- Recheck requested expiration after acquiring the database write lock, so waiting cannot create an already-expired key.
- Document rollback reactivation, immediate revocation/expiration, in-flight request limits, and mutable-data boundaries.

## 0.6.0-alpha.0 — 2026-10-09

### Added

- Copyable and downloadable REST/GraphQL client examples for JavaScript Axios/Fetch, PHP cURL, shell cURL, Rust reqwest, Go net/http, Java HttpClient, and C++ libcurl.
- Published-release and saved-draft choices, request and variable forms, dependency instructions, and stale-revision recovery in the API Studio.
- Client-code HTTP endpoints and light, dark, phone, pending, error, and permission previews.

### Fixed

- Preserve UTF-8 JSON through Windows shell cURL input and Java response output in generated examples.

### Security

- Generate text without running flows or retaining example inputs. Require current flow-read permission and cookie CSRF protection.
- Validate selected revisions, typed REST inputs and GraphQL operations; escape each target language and bound input/output.
- Read runtime credentials from the caller's environment, keep member keys out of examples, and disable redirects with bounded request timeouts.

## 0.5.0-alpha.0 — 2026-10-08

### Added

- Read-only uploaded SQLite copies with inspected tables, selected columns, typed equality previews, and REST/GraphQL draft generation.
- Database flow nodes, explicit connection read/manage permissions, and original-copy inclusion in workspace backups through migration 12.
- Beginner database forms, custom controls, and page/action previews in light, dark, and phone layouts.

### Changed

- Group server modules in shallow feature folders with direct imports and shared application entrypoints.

### Fixed

- Keep source data modules trackable by limiting generated data-directory ignores to the repository root.
- Clear stale database errors after a successful explicit refresh.
- Await native database-reader cleanup before the server exits.

### Security

- Quote inspected identifiers and bind filter values; reject arbitrary SQL, filesystem paths, unsupported structures, and unsafe scalar data.
- Bound uploads, storage, schemas, rows, native SQLite allocation, reader concurrency, output, and execution time. Cancel trusted child readers on caller abort or shutdown.
- Recheck current authorization after asynchronous connection operations and protect copies referenced by drafts or any historical release.
- Document that backups contain complete unencrypted copies and optional filters do not provide record authorization.

## 0.4.0-alpha.0 — 2026-10-08

### Added

- Custom workspace roles with 13 explicit action permissions, beginner permission forms, and owner-managed member assignment.
- Manual GitHub release notices with saved public-repository settings, preview-release filtering, and an owner-only Updates page.

### Fixed

- Members without API-read permission can sign in and manage their own account without private API requests.
- Permission and CSRF denials now attribute valid cookie sessions to the signed-in member in audit history.
- Workspace navigation scrolls independently so sign-out stays reachable on short desktop and phone screens.

### Security

- Resolve current grants for bearer and cookie requests; commit role changes with audit and affected session revocation.
- Reject stale role changes and deletion of assigned roles; keep administration and update notices owner-only.
- Bound update requests, reject redirects and stale results, and persist check cooldowns across restarts. Notices do not install updates.

## 0.3.0-alpha.0 — 2026-10-08

### Added

- REST path parameters with beginner input forms, typed rules, OpenAPI path documentation, and built-in k6 support.
- Immutable release history and owner rollback that preserves saved drafts and unsaved edits.
- Read-only CI checks, version/changelog guards, and a manual release-candidate bundle with a SHA-256 inventory.

### Fixed

- Health responses now report the installed package version after each bump.

### Security

- Reject overlapping published routes, stale rollback, and publication changes during an active load test.
- Require owner authorization and CSRF protection for rollback; revalidate archived dependencies before restoring.
- Exclude private files and external directory links from release candidates; keep publication separately authorized.

## 0.2.0-alpha.0 — 2026-10-08

### Added

- Built-in k6 load testing for published REST and GraphQL APIs, with automatic local setup and optional load settings.
- Version rules and this changelog. Besh remains below `1.0.0` until the maintainer explicitly confirms release.

### Security

- Load tests use bounded local targets and temporary scoped keys, with automatic revocation, cancellation, and restart cleanup. Request values and process logs stay out of saved reports.

## 0.1.0 — 2026-10-08

Initial development version. Earlier changes shared this version; separate historical versions were not assigned.

### Added

- Local setup wizard and visual API builder with editable drafts, testing, and published releases.
- REST API rules, OpenAPI downloads, and typed GraphQL queries and mutations.
- CSV/Excel imports and public Google Sheets snapshots with beginner field forms.
- Workspace email/password or key sign-in, cookie sessions, fixed roles, audit history, migrations, and SQLite backups.
- Scoped, expiring runtime API keys with atomic replacement and immediate revocation.
- GitHub identity templates for product APIs with encrypted provider connections.
- Custom controls, light/dark/system themes, phone layouts, documentation, and a masked page/action preview gallery.
