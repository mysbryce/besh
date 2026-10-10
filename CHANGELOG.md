# Changelog

Every version change is recorded here. See [version rules](docs/releases.md). Development history below does not imply a published package, tag, or deployment.

## Unreleased

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
