# Besh architecture

Goal: help teams build secure, documented APIs with a visual editor.

## Decisions

1. Use Bun and Elysia for the server. Use React, Zustand, Tailwind CSS, shadcn/ui, and React Flow for the dashboard. Keep one repository and one package manifest until independent packages are needed.
2. Keep server code in `src/`, dashboard code in `web/`, tests in `test/`, and design notes in `docs/`. Group server features into `auth/`, `data/`, `databases/`, `flows/`, `load-tests/`, `updates/`, and `workspace/`. Only application wiring, startup, and shared errors stay at the source root. Avoid empty abstraction layers.
3. Store flows as versioned JSON. The dashboard edits this format; the server validates and executes it. Never evaluate JavaScript from a flow.
4. Separate drafts from releases. Validate before publishing or restoring a release. Existing releases remain unchanged when drafts are edited. Same-method overlapping REST routes fail explicitly rather than relying on literal-route precedence.
5. Start with a local SQLite control database. Product database connections are separate adapters. Do not pretend SQL databases, MongoDB, Firebase, and Supabase have identical query or transaction semantics.
6. Keep management authentication separate from endpoint authentication. Every management operation checks permission on the server. Public endpoints must be an explicit choice.
7. Record state changes and their audit events together. Keep migration history. Back up before destructive changes and test restore procedures.
8. Add integrations through capability-based adapters. Unsupported features fail clearly. A provider listed in a roadmap is not a working integration.
9. Keep AI providers replaceable. Use typed tools with the caller's permissions. Models cannot grant themselves access. Codex CLI requires a separate, restricted process adapter; an HTTP provider adapter cannot substitute for it.
10. Manual owner-only checks read public GitHub release notices from a configured canonical repository URL. Do not execute application updates or silently migrate a running installation. Pin dependencies and release artifacts. Built-in load testing provisions only the explicitly selected, checksum-verified official k6 binary on first use; it does not update Besh.

## Runtime boundary

`Dashboard -> management API -> validate draft -> publish release/generated module -> registered runtime route -> bounded flow executor`

The executor must limit graph size, steps, input size, execution time, and output size. Validate node configuration and all edges. Reject cycles until bounded loops are designed. Errors must not reveal credentials or stack traces.

Implemented nodes are request, condition, response, bounded spreadsheet reads, uploaded SQLite reads, and GitHub social login. Optional REST contracts validate path/query/body input before execution and returned JSON before delivery. Later add broader transformations, live database connections and writes, general outbound HTTP, plugins, retries, subflows, and explicit error paths. A finite graph cannot promise support for every possible API.

HTTP targets: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. CONNECT and TRACE need separate threat review. OpenAPI describes HTTP operations; WebSocket messages need their own schemas and lifecycle rules.

GraphQL uses one POST endpoint per visual API at `/graphql/<path>`. Optional SDL lives inside the versioned flow definition; each root field runs the flow with arguments as input. GraphQL.js handles schema and operation validation and typed field selection. Runtime budgets include expanded fragments, depth, root calls, and output size. REST routes remain under `/run/<path>`. See [GraphQL guide](graphql.md) for supported behavior.

REST routes support safe whole-segment parameters, such as `/v1/items/:id`; GraphQL routes remain exact paths. Decode each incoming path segment once and reject unsafe or malformed values. Match the published route before checking its flow-scoped runtime key. Reject any same-method REST overlap at publication and rollback to prevent an ambiguous URL from selecting another flow. `/v1` and `/v2` are explicit paths on separate flows; there is no automatic compatibility or migration policy.

REST contracts live inside the versioned flow as `contract.params`, `contract.query`, `contract.body`, and `contract.response`. They use a bounded subset of JSON Schema concepts, not a general schema evaluator. Numeric/boolean path and query conversion happens only for declared fields; body and response values retain their exact JSON types. Path rules must declare exactly the route names, all required non-nullable scalar fields. Rules are checked on the server for draft tests, publication, and runtime calls. Input failures return 400 without submitted values; response mismatches return a generic 500 without partial output. GET/HEAD cannot declare a body contract. GraphQL SDL remains authoritative and cannot be combined with a REST contract.

Release history exposes immutable published revisions to members with `flows.read`. Rollback authorized by `flows.publish` selects a validated earlier release with an expected-current-publication check and a transactional `flow.rolled-back` event. It changes no draft and restores no mutable source snapshots or OAuth secrets. Keys retain flow scope and existing grants. Referenced dependencies must still be available. See [routes and release history](api-routes.md).

The member-authenticated OpenAPI route selects a saved draft or published release explicitly and defaults to published. It generates OpenAPI 3.1.1 from that selected snapshot, including the actual `/run` route and runtime bearer-key requirement. Export does not include flow-node literals, source rows, or credential values. Saving a draft changes neither live validation nor published documentation. See [API rules and OpenAPI](api-contracts.md).

Checkboxes and dropdowns use local styled components built on Radix primitives. Keep labels, keyboard navigation, disabled states, and focus return intact. Browser-native form controls may exist as hidden accessibility/form plumbing; no native checkbox, radio, or select is exposed as the visual control. New radio groups must follow the same rule.

Basic response, condition, and REST request editing uses labeled field forms. Raw JSON is an optional advanced view; complex nested values are preserved. Returning from advanced request input validates the full params/body/query envelope before mounting the form, including text-only parameter/query values. Input strings resembling reference syntax stay literal request values. Light/dark appearance uses shared tokens, a same-origin initialization script compatible with the content security policy, and accessible custom controls; see [design system](design.md).

## Generated runtime

Publication generates canonical trusted CommonJS code and hashes from the validated graph, then stages a fresh compiled Elysia router with actual REST method/path registrations and GraphQL POST/method-rejection routes. It replaces `/run/*` and `/graphql/*` dispatchers and per-execution path/definition lookup. The generated module captures an immutable release while the bounded graph engine, typed validation, runtime-key/pin checks, mutable data reads, and audit remain. Elysia documents [method/path route registration](https://elysiajs.com/essential/route), and Bun exposes [server handler reload](https://bun.sh/docs/runtime/http/server#serverreload); Besh's implementation/evidence is tracked separately.

Migration 14 persists artifacts and a runtime generation counter in consistent control backups. Publication/rollback stages generation, module loading, and router compilation under an immediate transaction, committing source/release selection, artifacts, generation, audit, and synchronous local activation together. Caught failures roll back state and restore the old router. Failed peer reconstruction or unrecoverable local restoration leaves runtime blocked with `503` until restart or a successful local publication stage; ordinary request retries do not repair it. Startup validates/regenerates canonical code from trusted graphs rather than executing arbitrary stored code. Temporary exclusive-create CommonJS files use `createRequire`, with file/cache cleanup.

Ordinary requests use two fixed-size generation reads to protect admission across processes; canonical URL redispatch/router refresh may add fixed-size reads. Preflight detects a changed generation and reconstructs/redispatches before parsing; a final generation/credential transaction after parsing returns `503` on change before effects. An admitted immutable-release request may finish after later publication. This is not coordinated distributed activation, uninterrupted availability, or a measured performance claim. Dashboard code exports require flow-read permission and guard the expected current publication (raw management GET may omit the revision guard) and contain configured literals/references plus runtime requirements, not automatically inserted server secrets. See [published backend code](runtime-code.md) and [testing](testing.md).

## Client-code boundary

Client examples are rendered from saved published/draft metadata, with the current publication as default and an expected source revision to reject stale generation. `flows.read` permits catalog/metadata/text generation; it does not issue caller credentials. Unsaved editor changes are excluded. The renderer validates typed REST inputs and GraphQL operations/variables without invoking the executor or any external service.

The eight fixed target templates escape language literals and shell arguments, use `BESH_RUNTIME_API_KEY` from the caller's server environment, bound request time, and disable redirects. Custom HTTP(S) base origins/prefixes only change generated URLs; they are never fetched or saved as workspace configuration. Code/input/result budgets protect rendering, and example payloads are not persisted. Saved-draft output warns that its revision must be published before runtime use. Source revision metadata does not issue or choose a runtime pin; callers select a following or pinned key separately. See [client code guide](client-code.md) and [testing](testing.md) for supported targets and observed toolchains.

## Load-test boundary

Built-in k6 load testing is a main product workflow, separate from draft testing. Members with `load-tests.run` select an immutable published REST or GraphQL endpoint, supply validated request input, and optionally change bounded load and result goals. Defaults require no manual binary installation, scripts, credential setup, or Grafana Cloud. Labeled REST input and GraphQL variable forms are the common input path; GraphQL operations start from an editable generated example. Advanced JSON configuration stays optional.

`Authorized member -> load-test management API -> published-release validation -> temporary runtime key -> native k6 child -> published runtime API -> summary/history`

`load-tests.run` authorizes target listing, starts, result/history reads, and cancellation. The server derives the target's method, route, rules, and operation grants from its published release; it accepts no arbitrary URL, script, shell command, or caller-defined headers. REST contracts and GraphQL schema/operation budgets validate input before launch. Parameterized REST input supplies decoded text values; the server validates them and encodes a concrete local route. Published product-login flows containing social nodes are excluded from automatic load testing. Publication and rollback are blocked while the same flow has an active run; mutable dependencies are not release-pinned.

Tests use a temporary, expiring, single-flow runtime key with only the needed REST/query/mutation grant. State changes and key/audit lifecycle commit transactionally; completion, failure, cancellation, and restart interruption revoke the key. Existing caller keys and grants are unaffected. This uses the runtime authentication boundary rather than bypassing it with management identity. Managed keys remain flow-scoped and pin the run's starting release revision; they cannot be replaced. Broader field/record authorization remains planned.

One active job per workspace, at most ten virtual users, at most thirty seconds of scheduled load, and a fixed 0.2-second pause bound the current feature. These limits do not isolate normal callers from resource use. Write methods and GraphQL mutations make repeated live calls; the dashboard requires confirmation, and direct permission-authorized API starts authorize the request without an extra confirmation field. Repeated live writes are not rolled back. Cancellation stops further work while in-flight requests may finish; restart interrupts unfinished jobs without resuming them.

The native child runs a server-generated k6 script, never uploaded JavaScript inside Bun. First use provisions pinned k6 2.3.0 from the official Grafana release, verifies the archive SHA-256, and caches it under `.cache/k6`. First download requires network access; cached runs can work offline. Automatic provisioning targets Windows amd64, Linux amd64/arm64, and macOS amd64/arm64; execution evidence is recorded separately in [testing](testing.md). `BESH_K6_PATH` can select an administrator-trusted existing executable, and `BESH_K6_CACHE_DIR` can relocate the cache. Neither is required for the normal workflow. A local executable override is not a member-upload capability or an isolation sandbox.

Migration 10 adds SQLite load-test history: endpoint/revision metadata, settings, status/timestamps, safe error, and aggregate result. Backups include that history. Request values, raw tokens, generated scripts, and process logs are excluded from persisted history and audit metadata. Results expose counts, throughput, failed requests, success-check rate, average/p95/max latency, and goal status. Missed goals produce a completed report with `thresholdsPassed: false`; provisioning or runner failure yields a failed job. A bounded local result does not certify production capacity or security.

See [load testing](load-testing.md) and [core API](api.md).

## Spreadsheet data boundary

Migration 7 stores CSV/Excel and public Google Sheets snapshots in the control database. `sources.read` authorizes metadata/previews; `sources.write` authorizes lifecycle changes; generation requires both `sources.read` and `flows.write`. Public Google exports use a restricted HTTPS URL/redirect policy and bounded requests. Upload formats, archive expansion, row counts, column counts, and normalized snapshot sizes are checked before persistence. Uploaded formulas and code are not executed.

A data node reads one source, projects approved columns, optionally applies an equality filter, and returns at most 100 rows within normal response limits. `$data` resolves its result. Generated REST and GraphQL APIs are normal drafts and use the existing validation, publication, and scoped runtime-key boundaries. Generated GraphQL is query-only and includes typed selected columns.

New generated REST drafts also include contracts derived from selected column types/nullability, the row limit, and the optional typed query filter. Existing saved flows remain compatible without a contract. A changed source snapshot must still satisfy the published response rules; refreshing data does not update release contracts. Schema validation and caller-controlled search filters do not implement field or record authorization.

Published graph definitions remain immutable, while source data is mutable: manual replacement or Google refresh changes the saved snapshot read by existing APIs. Members with `sources.write` can perform this data change; it does not grant publication rights. Sources referenced by a current draft or currently published API cannot be deleted. Older graph releases retain IDs rather than source snapshots; a deleted historical source can block rollback. Snapshot data is included in workspace backups. Live external database adapters and private Google OAuth remain separate planned capabilities.

## Uploaded SQLite boundary

Migration 12 stores immutable original SQLite bytes and inspected metadata in `database_connections` inside the control database. The product query engine is separate: a trusted child deserializes the bytes in read-only, strict, exact-integer mode. No server file path, raw SQL, extension, uploaded script, or live database credentials are accepted. Ordinary declared scalar columns are inspected before saving; unsupported files, schema features, mixed values, nonfinite numbers, and SQLite integer values outside JSON's safe range are rejected. Safe API keys map to original column labels.

`database-connections.read` authorizes metadata/previews; `database-connections.manage` authorizes upload/check/deletion. Owners receive both; built-in editors/viewers keep their previous grants. Draft generation also requires `flows.write`. Database nodes select inspected fields from one table, with bound optional equality values and a 1–100 row limit. A flow permits at most four database nodes; each replaces `$data`. Generated REST GET and GraphQL `rows` query drafts expose only the selected projection. Testing, publication, rollback, and execution validate dependencies. Any draft or immutable release reference blocks deletion, including old releases.

At most two helpers run per Bun process, shared across application handles. Each has a two-second deadline, a 256 KiB serialized-output bound, a 16 MiB SQLite allocation budget, disabled trusted schema, and query-only mode. Cancellation and shutdown terminate the helper. The allocation cap is not a total process memory cap, and the trusted native helper is not a full OS sandbox. Upload/schema/row limits are documented in the [database guide](databases.md).

Original bytes are preserved unchanged and included atomically in normal workspace backups; ephemeral engines need no separate backup file. Uploaded data is plaintext, including unselected tables/columns in the original copy. Product-secret encryption does not encrypt those bytes. Copies have no replacement, automatic refresh, external synchronization, or SQL writes. Runtime keys authorize whole flow operations; selected columns and caller filters do not establish field/record/tenant authorization.

## Product login boundary

Migration 9 stores GitHub OAuth app connections and short-lived login attempts. `auth-connections.manage` authorizes credential changes; `auth-connections.read` authorizes metadata. Generation additionally requires `flows.write`, while draft execution requires `flows.test`. Built-in viewers have no connection access. Metadata excludes secrets, hashes, and encrypted values. Changes and audit records commit together. Referenced connections cannot be deleted, and a missing connection prevents testing or publication.

A generated draft connects request -> social -> response. The social config references `connectionId`, and `$auth` holds a bounded result. REST uses POST with BEGIN/COMPLETE actions and generated body/response rules, including nullable result fields and typed identity fields. GraphQL uses typed `LoginAction` arguments on `Mutation.login`; the server returns a static `Query.info` result without executing social login. Generated flows remain ordinary saved drafts subject to the existing validation, permission-checked publication, immutable release, and scoped runtime-key boundaries.

The product server invokes BEGIN with a runtime key, retains the separately returned sensitive proof and expected state associated with the initiating browser, and sends only GitHub's authorization URL to that browser. GitHub redirects to the product's registered callback. The product server validates its browser/state association and invokes COMPLETE with code, state, and its saved proof through the same runtime key. Besh has no public callback or product login frontend. Runtime keys and proofs must never enter browser code, storage, or URLs.

BEGIN uses authorization-code S256 PKCE with `read:user`. State and proof are hash-stored, the PKCE verifier is encrypted, and attempts expire in ten minutes. Attempts bind the flow ID/revision, runtime key or draft-testing member, and connection version. A valid completion is consumed before the provider exchange. Reuse, a changed connection/revision, a wrong caller, expiry, or mismatched proof fails. Network access is limited to fixed GitHub token/profile endpoints with a five-second overall deadline, 64 KiB per response, four concurrent exchanges, and no arbitrary redirects. Ten pending attempts per credential/flow and a thousand total bound stored attempts. One social node per flow and one login root call per selected OAuth mutation bound execution. Provider failures return generic errors without provider tokens or payloads.

Completion returns a normalized identity containing provider, stable subject, username, and nullable name/avatar URL. Provider access tokens and client secrets remain server-side and are not returned to products. Product accounts, sessions/JWTs, email linking, and field/record authorization are separate planned work. The workspace panel continues to use email/password or member keys. Other social providers remain planned; controlled GitHub boundary tests do not prove a real OAuth app or deployed callback works.

Attempt insertion and consumption commit transactionally with `product-login.started` and `product-login.consumed` audit events. Provider exchange records `product-login.completed` or `product-login.failed`. Events identify the credential scope and flow without code, state, proof, verifier, provider tokens, or payload details.

Published flow definitions keep immutable routes, rules, and connection IDs. Credential contents remain mutable references: authorized edits increment the connection version, invalidate pending attempts, and change credentials used by future live calls without republishing the graph. Review this lifecycle separately from release changes.

Provider client secrets and PKCE verifiers are encrypted with AES-256-GCM in SQLite. A 32-byte local key is created lazily when saving the first connection, by default at `besh-secrets.key` beside the control database. `AppOptions.secretKeyPath` / `BESH_SECRET_KEY_PATH` overrides that location. Startup fails if encrypted rows exist and their key is missing; it never silently recreates the key. This is local encryption at rest, not an OS-keystore integration. SQLite backups omit the key file: keep a separate private key backup and restore it with the matching database. Existing workspace data and spreadsheet rows in those backups remain sensitive.

See [GitHub product login](product-auth.md) for app setup, server integration, backup recovery, and verification limits.

## Extensions

| Adapter     | Required boundary                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| SQL         | Prepared parameters, pools, transactions, dialect-specific migrations and backup                       |
| MongoDB     | Typed document filters, bounded queries, index management, no raw operator injection                   |
| Supabase    | Server-held secrets, RLS-aware access, explicit tenant ownership                                       |
| Firebase    | Verified identity, scoped Admin SDK operations, security rules and export strategy                     |
| Social auth | Current GitHub identity flow; other providers need state, PKCE, exact redirects and linking safeguards |
| Plugin      | Manifest, API version, integrity, capability grants, isolated runtime, resource limits                 |
| AI          | Provider configuration, redaction, tool permissions, budgets, approval and audit                       |
| WebSocket   | Origin and authentication checks, message schemas, rate limits, revocation and reconnect               |

Uploaded plugin code must run in a real process/container isolation boundary before public uploads are enabled. A JavaScript VM or Bun Worker is not a security sandbox. Declarative plugins can be introduced earlier with a constrained schema.

## Identity and roles

Single-workspace roles include immutable built-in owner/editor/viewer roles and owner-defined custom roles. Owner has all 15 workspace action grants and alone administers roles, members, and other members' sessions. Editor retains six grants for API read/write/test, source read/write, and product-connection reads. Viewer retains `flows.read`. Custom permissions are explicit with no implied dependencies; they do not establish per-resource or multi-workspace isolation.

Migration 11 adds `workspace_roles` and `member_roles`. Role CRUD is owner-only and version-checked; assigned roles cannot be deleted. Grant/assignment changes and audit/session revocations commit atomically. Authentication resolves current grants for every request, including bearer credentials; member keys are not rotated. Public member metadata includes permissions and custom-role ID/name. Own account/session actions remain available without action grants. Complete backups include role/assignment state and sensitive credential records, so `backups.manage` grants access to the whole snapshot. See [roles and permissions](roles.md).

Workspace sign-in uses email/password or member/owner keys. The GitHub social template belongs to generated product APIs and returns provider identity to a product server; it does not authenticate the workspace panel. Discord, Facebook, Google, and generic OIDC remain planned. Product account/session creation, linking, and authorization are separate from the implemented identity exchange.

Migration 8 adds optional workspace accounts, browser sessions, and persistent login throttle state. Accounts use unique normalized email addresses and Argon2id password hashes; member keys remain valid. Login creates a random hash-stored session secret in an HttpOnly, SameSite=Strict cookie, with Secure for HTTPS origins. Sessions expire after a fixed 12 hours without renewal. A member has at most 20 active sessions; a new login evicts the oldest transactionally with an audit event. Password verification runs asynchronously with at most four concurrent login verifications. Login permits 10 invalid attempts per identity and 100 total attempts per five-minute window, with bounded persistent throttle storage.

The dashboard restores sessions after reload and keeps CSRF state in memory. Cookie-authenticated writes require the exact browser origin and a session-bound CSRF value; login also checks origin. `BESH_WEB_URL` configures the exact HTTPS origin, with HTTP permitted only for loopback development. It is required behind a reverse proxy; forwarded headers are not trusted. Existing bearer management clients remain supported without cookie CSRF headers. An explicit Authorization header takes precedence and cannot fall back to a valid cookie after an invalid bearer credential.

All roles can update only their own account with a fresh current password or their own member-key proof. Account updates keep the current cookie session and revoke the member's others; bearer-authenticated updates revoke all their sessions. Members list/revoke their own sessions; owners list/revoke all workspace sessions. Session responses expose metadata only. Removing a member cascades to its account and sessions. A changed recovery owner key revokes owner sessions but preserves the owner's password account. Backups include these account, session, and throttle states; restoring a snapshot can restore an old password or a still-unexpired revoked session. Review restored credentials and sessions before resuming service. See [workspace accounts and sessions](workspace-auth.md).

Published REST and GraphQL endpoints accept only runtime API keys. Workspace sessions and owner/member tokens authenticate management routes and role-authorized draft tests. `runtime-keys.manage` authorizes issuance, listing, replacement, and revocation; owners have it by default. Migration 6 adds hash-only key storage, a single published flow scope, operation grants, required expiration within 366 days, and retained revocation metadata. Issuance and revocation are transactional with their audit records.

REST keys grant `rest`; GraphQL keys grant `query`, `mutation`, or both. GraphQL authorization checks the selected operation before execution, including operation-name selection from documents containing several operations. Runtime keys cannot cross flow boundaries or access management. Expiration and revocation are checked on each request. Grants authorize whole operations; field-level and record-level authorization remain planned.

`runtime-keys.manage`-authorized `POST /api/runtime-keys/:id/rotate` replaces an unexpired, unrevoked key atomically. It accepts no body or `{}` and rejects settings rather than allowing scope changes. Inside the transaction, it checks existence, revocation, expiration, and grant compatibility with the current published release for following keys or the immutable pinned release for pinned keys; revokes the old key; inserts a new hash-only key; and writes `runtime-key.revoked` for the old ID and `runtime-key.created` for the new ID. Failure rolls back all changes, and concurrent replacement permits one winner. The response reveals the new token once, while retaining the exact name, flow ID, grants, release pin or following mode, and expiration. It creates a new credential identity, not a longer lifetime or additional authorization.

New requests using the old key fail immediately after replacement. Authentication is checked at request entry, so in-flight requests may finish. Replacement has no overlap period; callers must be updated afterward, or key managers can manually issue another key, update callers, then revoke the original for gradual handover. A lost response must not trigger an automatic retry because the transaction may have committed without delivery of the one-time token. The dashboard requires confirmation, protects pending credential actions, and holds the returned token in memory until saving is acknowledged.

Product login attempts remain bound to their original runtime key ID. Replacement cannot complete attempts started by the old key; products start a new attempt using the new key. This slice changes neither provider support nor product-session behavior. See [runtime API keys](api-keys.md).

Migration 13 adds nullable positive-integer `release_revision`; existing keys continue following their flow. Issuance can pin only the current publication, checked atomically with key/audit insertion. Runtime routing still selects the current published endpoint, then rejects a different pin before typed inputs or flow effects. No archived graph is executed. Rollback can reactivate an unexpired, unrevoked exact pin; already authorized requests may finish. Pins cover graph definitions, not mutable source data or credentials. A publisher must still review following keys before broader behavior. Management responses expose the immutable published endpoint metadata separately from draft settings so key issuance displays the live route even when draft paths or protocols change. Restoring a backup also restores its key state; keys revoked after the snapshot may work again and need review, revocation, or rotation.

## Agent policy

The future agent should inspect APIs, explain runs, propose flows, test drafts, and manage permitted data through typed tools. Destructive data changes, publication, plugin execution, migrations, and external transfers require scoped authorization. Persist proposals and decisions. Treat database values, plugin output, and model responses as untrusted input.

Provider targets: Anthropic, OpenAI API, OpenRouter, Ollama/OpenAI-compatible endpoints, and a local Codex CLI adapter. Discover model capabilities rather than assuming all providers support tools, JSON schemas, or streaming equally. No mandatory cloud gateway.

## Release boundary

Owner-only update settings/check routes persist a canonical GitHub repository, a prerelease choice, versioned settings, and the last bounded check result. Defaults use `https://github.com/mysbryce/besh` with prereleases included. Manual checks request only the fixed official `api.github.com` release-list endpoint, with no redirects, tokens, or private-repository access. Five seconds, 64 response headers/32 KiB, and a 256 KiB decoded body bound transport; selection uses the greatest eligible semantic version among the first 20 returned releases. A persistent one-minute cooldown and active-check lease prevent repeated/concurrent fetches. Settings changes clear the result and discard an older pending response. Failures persist generic status without provider details. No custom role can delegate this owner operation. Notices do not download, install, change `package.json`, migrate data, or certify compatibility/authenticity. See [update notices](updates.md).

PR/push workflows configure Windows/Ubuntu validation with pinned Bun/actions and a separate Ubuntu Chromium story. Release policy checks package/changelog consistency, comparison-base version bumps, and Conventional Commits; `1.0.0` and higher require a maintainer-approved reviewed policy change. A manual candidate workflow repeats validation and uploads selected committed source/docs plus built dashboard assets with a SHA-256 inventory. Workflows have read-only repository permissions and create no tags, releases, deployments, or package publications. Inventory hashes do not establish signature authenticity. Hosted execution evidence and authorized publishing stay separate from configuration. See [versions and releases](releases.md).

## Sources

- [Elysia documentation](https://elysiajs.com/essential/best-practice): server framework usage.
- [React Flow](https://reactflow.dev/learn): node editor and graph interactions.
- [shadcn/ui with Vite](https://ui.shadcn.com/docs/installation/vite): dashboard component setup.
- [Bun SQLite](https://bun.sh/docs/runtime/sqlite): local control database.

See [roadmap](roadmap.md), [glossary](../GLOSSARY.md), and [AI policy](../AI_POLICY.md).
