# Besh roadmap

This is the product plan. Planned features are not implementation claims.

## Implemented in 0.10: selected API actions and dependency USE

- Selected actions on existing APIs, explicit typed USE of data/product-login dependencies, and filtered structural catalogs; no API creation or global resource administration.
- Current policy across all graph branches, transactional state changes, and asynchronous effect checkpoints. USE can expose data through APIs; field/record/tenant isolation remains separate.
- `Member.access` with a compatible `flowAccess` projection/shared version, strict owner changes, preserved defaults/old endpoint behavior, and migration-16/backup restoration.
- Issuer-bound runtime keys checking live action/API/dependencies against immutable compiled releases; mandatory current pins for selected issuance, preserved binding through rotation, fail-closed deleted issuers, independent legacy unbound keys, and cleanup after USE removal.
- Issuer-bound managed k6 keys, bounded runs, correct cancellation audit, and explicit limits on cross-process termination.

Server/native contracts, beginner browser workflows, and the corrected complete preview gallery are verified. Exact checks belong in [testing](testing.md) and [previews](preview.md). See [selected actions and USE](roles.md#selected-api-actions-and-dependency-use). Protected read-only tenant rows are next; tenant/field/record policies and the remaining platform stay planned.

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

Failed peer reconstruction or local router restoration leaves runtime blocked until restart or a successful local publication stage. Ordinary requests retain credential/data/audit SQL; registered routing does not establish a performance improvement or distributed availability. See [published backend code](runtime-code.md) and exact evidence in [testing](testing.md). Selected reading and broader existing-API actions are implemented in 0.9/0.10; field/record/tenant isolation and the remaining platform stay planned.

## Implemented in 0.7: optional release-pinned runtime keys

- Existing/default keys follow the current publication; optional pins accept one graph revision only while it is current. No archived execution or mutable-data snapshot is introduced.
- Atomic current-publication issuance guards, dormant-key denials before effects, exact rollback reactivation, pin-preserving replacement, and managed load-test revision pins.
- Additive migration 13 and beginner key mode/status/recovery forms, including key-only management without forbidden API reads.

See [runtime keys](api-keys.md) and [testing](testing.md) for behavior and exact verification. Generated backend routing and selected-API reading are implemented above. Selected dependency USE and issuer checks are implemented in 0.10; trusted tenant/field/record policies remain planned.

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
- Configured pinned CI checks and a manual release-candidate artifact workflow, with version/changelog/Conventional Commit policy and no automatic publication. Hosted execution remains unverified until observed; see [release checks](releases.md).

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
- Permission-issued runtime API keys for one published flow, required expiration, REST/query/mutation grants, hash-only storage, atomic replacement, and immediate revocation; member identity stays at the management boundary.
- Beginner response/request/condition/data field forms with optional advanced JSON, generated GraphQL queries and optional schema editing, readable light/dark themes, and a mobile saved-API picker.
- CSV/Excel imports and public Google Sheets snapshots, reviewed column mapping, generated REST/typed GraphQL drafts, bounded data reads, manual snapshot replacement/refresh, and referenced-source deletion protection.

Current limits: one local workspace, literal or whole-segment parameterized REST paths, exact GraphQL paths, six node types, action roles with optional selected API actions and typed dependency USE, manual SQLite backups, read-only spreadsheet snapshots, and uploaded SQLite reads. Protected row/field authorization and broader resource-management sharing remain planned. Google Sheets supports public exports; private OAuth, spreadsheet write-back, live external database adapters, and SQL writes remain planned. See [README](../README.md) for supported behavior and [testing](testing.md) for evidence.

## Milestone 2: identity and API contracts

- Implemented: optional REST path/query/body/response rules, server input/output checks, typed path/query conversion, recursive field/item forms and limits, generated spreadsheet contracts, and separate saved-draft/published OpenAPI 3.1.1 downloads. GraphQL retains its existing SDL contract.
- Implemented runtime-key replacement: authorized member confirmation, atomic old-key revocation/new-key issuance with audit events, unchanged name/flow/grants/exact expiration, one-time copy/save, current-release compatibility checks, one concurrent winner, and lost-response recovery guidance. New old-key requests fail immediately; authenticated in-flight requests may finish. Existing product login attempts stay bound to the old key. No grace period, lifetime renewal, or new grants are added.
- Planned: public endpoint policy, field-level and record-level authorization, coordinated key rollover with a grace period. Optional release pins are implemented in 0.7. Current runtime grants still authorize whole operations; gradual handover currently uses manual create/update-caller/revoke steps.
- Implemented workspace accounts and cookie sessions: optional email/password or member/owner-key sign-in, fixed 12-hour expiry, session restoration, CSRF/origin checks, bounded persistent login throttling, own-account changes with fresh proof, metadata-only session listing, member-own/owner-all revocation, and a 20-session member limit. Bearer management clients remain compatible.
- Implemented GitHub product identity template: permission-managed encrypted OAuth connections and draft generation, REST POST or typed GraphQL login mutation, ten-minute state/proof with S256 PKCE, one-use caller/flow/revision/connection binding, and normalized identity output. Product servers retain runtime keys and separate proof, handle their own callbacks, and create their own sessions. Controlled GitHub responses test the boundary; no live OAuth app round trip has been verified.
- Planned product auth expansion: Discord, Facebook, Google, generic OIDC, product sessions/accounts, and reviewed identity linking. These do not change workspace sign-in.
- Planned workspace invites and account recovery.
- Implemented: built-in roles plus owner-managed custom workspace action grants, version checks, member assignment, immediate current-grant resolution, affected session revocation, audit, selected existing-API actions, typed USE, and issuer-bound caller authority. Planned: protected rows/fields, broader resource-management sharing, and multi-workspace isolation.
- Extend GraphQL with reviewed introspection policy, custom scalar contracts, and subscriptions alongside WebSocket work. Whole-query/mutation runtime grants are implemented; field-level grants remain planned.
- WebSocket flows, lifecycle events, subscriptions, quotas and revocation.
- Implemented: safe whole-segment REST path parameters, explicit version-prefix flows, immutable release inspection, and permission-checked rollback. Same-method route overlap is rejected; draft edits and mutable dependencies stay separate from releases.
- Planned: pagination, bounded retry/error nodes, transformations, outbound HTTP, and subflows.

## Milestone 3: data and plugins

- Implemented: uploaded-copy SQLite reads. Planned: live SQLite connections/writes, PostgreSQL, MySQL/MariaDB, MongoDB, Supabase, Firebase adapters.
- Database connection testing and encrypted secret references beyond the current GitHub credential storage.
- Private Google Sheets OAuth, spreadsheet write-back, and scheduled synchronization beyond current manual public-sheet snapshots.
- Parameterized query builder and explicit transaction capabilities.
- Migration plans with dry runs, backup gates and restore verification.
- Backup scheduling, retention, encryption and off-site storage.
- Plugin SDK, manifest upload, compatibility checks and permission review.
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
- Configured: PR/push validation and manual release-candidate artifacts with version/changelog/Conventional Commit checks. No automatic tagging, deployment, package publishing, or GitHub release. Hosted runs and an authorized publishing pipeline remain planned; changelog notes are written and reviewed, not generated automatically.
- Worker isolation, queues, horizontal scaling and production observability.
- Broader sustained/distributed load, penetration, recovery and tenant-isolation tests beyond current bounded local k6 runs.

## Completion gates

Each feature needs observable acceptance criteria, a failing test followed by a passing implementation, relevant type/build checks, updated docs, and a conventional commit. A configured provider must pass a real connection test before it is described as verified.

## Next Steps

Execute the remaining platform in this order. Finish each public-interface test and implementation before moving to the next slice. Keep completed behavior separate from configured or planned integrations.

1. **Protected read-only tenant rows.** Implement the [planned row-protection design](row-protection.md): owner-approved immutable text identities, live assignments, resource-owned policies outside graphs, preserved raw spreadsheet provenance, mandatory exact adapter predicates before limits/projection, protected pins, and inventory/rotation restrictions for every non-owner. Start with request → one protected read → response data; reject mixed/branch/social/literal shapes. Protected full resource access becomes owner-only, and first protection permanently restricts ordinary backup operations to owners. Legacy normalized snapshots require reviewed reimport; physical older-database restoration remains owner-controlled outside the monotonic guarantee. Verify migration, stale/lost responses, async policy changes, backup/restart, and beginner forms before broadening this scope.
2. **Field and product authorization.** Extend the verified protected-read scope only with explicit policies for mixed resources and social effects. Caller headers/query/body and static projections never establish tenant identity or authorization. Add enforceable field rules, public endpoint policy, and multi-workspace isolation separately. Exercise denials at the server before exposing product data. Add invitations/recovery, reviewed product accounts/sessions/linking, and coordinated key rollover only with a clear lifecycle. Keep whole-operation runtime grants honest until these checks exist.
3. **Data connections and query tools.** Extend reviewed adapter capabilities and encrypted server-held credentials to PostgreSQL and MySQL/MariaDB; add MongoDB, Supabase, and Firebase with their own transaction, identity, query, and backup semantics. Add live SQLite connection/write capabilities separately from the uploaded-copy read adapter. Ship bounded parameterized read/write forms, pagination, previews, and explicit transactions one adapter at a time. Add migration dry runs, backup gates, restoration checks, and destructive-change review before schema changes. Private Sheets OAuth, write-back, and scheduled synchronization follow their connection/permission work.
4. **Graph execution and extensions.** Add typed transformations, bounded outbound HTTP, explicit error/retry paths, and subflows with execution limits. Introduce a versioned declarative plugin manifest and SDK before uploaded code. Require a real isolated process/container, capability grants, integrity checks, and resource/network limits before enabling custom-code plugins. Verify each extension against its actual services.
5. **Product providers and AI operator.** Verify GitHub with a real OAuth app, exact product callback, and private encryption-key backup. Add Discord, Facebook, Google, and generic OIDC individually with state/PKCE, redirect validation, and safe identity linking. Implement provider settings and capability discovery for Anthropic, OpenAI API, OpenRouter, Ollama/compatible endpoints, and a separate restricted Codex CLI process adapter. Add caller-scoped typed tools, durable proposals, budgets, redaction, cancellation, approvals, and adversarial tests. Do not infer live provider success from mocks or stored configuration.
6. **Realtime APIs.** Build authenticated WebSocket lifecycle and GraphQL subscriptions, message schemas, quotas, revocation, disconnect/reconnect, and backpressure. Review introspection/custom scalars alongside their schema and permission rules. Exercise long-lived access after key expiry and permission changes.
7. **Operations and authorized releases.** Add backup schedules/retention/encryption/off-site restore, worker isolation, queues, observability, and tested scaling. Review configured manual update notices and their live-provider evidence, set a private reporting contact, then design verified update compatibility/backup/migration/recovery. Observe hosted checks and review release-candidate artifacts before any requested tag/publication. Keep Besh below `1.0.0` until explicit maintainer confirmation. Broaden sustained/distributed load, recovery, penetration, and tenant-isolation tests before production claims.

Every slice includes current beginner forms, light/dark/phone previews, relevant tests/type/build/format checks, updated docs, a version bump/changelog entry, and a Conventional Commit. External credentials, services, deployment settings, and live verification are supplied or configured when their slice needs them; their absence must not become an implementation claim.
