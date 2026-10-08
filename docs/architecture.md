# Besh architecture

Goal: help teams build secure, documented APIs with a visual editor.

## Decisions

1. Use Bun and Elysia for the server. Use React, Zustand, Tailwind CSS, shadcn/ui, and React Flow for the dashboard. Keep one repository and one package manifest until independent packages are needed.
2. Keep server code in `src/`, dashboard code in `web/`, tests in `test/`, and design notes in `docs/`. Group growing server features by domain. Avoid empty abstraction layers.
3. Store flows as versioned JSON. The dashboard edits this format; the server validates and executes it. Never evaluate JavaScript from a flow.
4. Separate drafts from releases. Validate before publishing. Existing releases remain unchanged when drafts are edited. Route conflicts must fail explicitly.
5. Start with a local SQLite control database. Product database connections are separate adapters. Do not pretend SQL databases, MongoDB, Firebase, and Supabase have identical query or transaction semantics.
6. Keep management authentication separate from endpoint authentication. Every management operation checks permission on the server. Public endpoints must be an explicit choice.
7. Record state changes and their audit events together. Keep migration history. Back up before destructive changes and test restore procedures.
8. Add integrations through capability-based adapters. Unsupported features fail clearly. A provider listed in a roadmap is not a working integration.
9. Keep AI providers replaceable. Use typed tools with the caller's permissions. Models cannot grant themselves access. Codex CLI requires a separate, restricted process adapter; an HTTP provider adapter cannot substitute for it.
10. Check GitHub releases for update notices. Do not execute downloaded code or silently migrate a running installation. Pin dependencies and release artifacts.

## Runtime boundary

`Dashboard -> management API -> validate draft -> publish release -> runtime API -> flow executor`

The executor must limit graph size, steps, input size, execution time, and output size. Validate node configuration and all edges. Reject cycles until bounded loops are designed. Errors must not reveal credentials or stack traces.

Implemented nodes are request, condition, response, bounded spreadsheet reads, and GitHub social login. Optional REST contracts validate query/body input before execution and returned JSON before delivery. Later add broader transformations, database operations, general outbound HTTP, plugins, retries, subflows, and explicit error paths. A finite graph cannot promise support for every possible API.

HTTP targets: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. CONNECT and TRACE need separate threat review. OpenAPI describes HTTP operations; WebSocket messages need their own schemas and lifecycle rules.

GraphQL uses one POST endpoint per visual API at `/graphql/<path>`. Optional SDL lives inside the versioned flow definition; each root field runs the flow with arguments as input. GraphQL.js handles schema and operation validation and typed field selection. Runtime budgets include expanded fragments, depth, root calls, and output size. REST routes remain under `/run/<path>`. See [GraphQL guide](graphql.md) for supported behavior.

REST contracts live inside the versioned flow as `contract.query`, `contract.body`, and `contract.response`. They use a bounded subset of JSON Schema concepts, not a general schema evaluator. Numeric/boolean query conversion happens only for declared fields; body and response values retain their exact JSON types. Rules are checked on the server for draft tests, publication, and runtime calls. Input failures return 400 without submitted values; response mismatches return a generic 500 without partial output. GET/HEAD cannot declare a body contract. GraphQL SDL remains authoritative and cannot be combined with a REST contract.

The member-authenticated OpenAPI route selects a saved draft or published release explicitly and defaults to published. It generates OpenAPI 3.1.1 from that selected snapshot, including the actual `/run` route and runtime bearer-key requirement. Export does not include flow-node literals, source rows, or credential values. Saving a draft changes neither live validation nor published documentation. See [API rules and OpenAPI](api-contracts.md).

Checkboxes and dropdowns use local styled components built on Radix primitives. Keep labels, keyboard navigation, disabled states, and focus return intact. Browser-native form controls may exist as hidden accessibility/form plumbing; no native checkbox, radio, or select is exposed as the visual control. New radio groups must follow the same rule.

Basic response, condition, and REST request editing uses labeled field forms. Raw JSON is an optional advanced view; complex nested values are preserved. Returning from advanced request input validates the full body/query envelope before mounting the form, including text-only query values. Input strings resembling reference syntax stay literal request values. Light/dark appearance uses shared tokens, a same-origin initialization script compatible with the content security policy, and accessible custom controls; see [design system](design.md).

## Spreadsheet data boundary

Migration 7 stores CSV/Excel and public Google Sheets snapshots in the control database. Only owners/editors can access source metadata, previews, lifecycle actions, or generated drafts. Public Google exports use a restricted HTTPS URL/redirect policy and bounded requests. Upload formats, archive expansion, row counts, column counts, and normalized snapshot sizes are checked before persistence. Uploaded formulas and code are not executed.

A data node reads one source, projects approved columns, optionally applies an equality filter, and returns at most 100 rows within normal response limits. `$data` resolves its result. Generated REST and GraphQL APIs are normal drafts and use the existing validation, publication, and scoped runtime-key boundaries. Generated GraphQL is query-only and includes typed selected columns.

New generated REST drafts also include contracts derived from selected column types/nullability, the row limit, and the optional typed query filter. Existing saved flows remain compatible without a contract. A changed source snapshot must still satisfy the published response rules; refreshing data does not update release contracts. Schema validation and caller-controlled search filters do not implement field or record authorization.

Published graph definitions remain immutable, while source data is mutable: manual replacement or Google refresh changes the saved snapshot read by existing APIs. Owners/editors can perform this data change; it does not grant publication rights. Sources referenced by a draft or release cannot be deleted. Snapshot data is included in workspace backups. Database adapters and private Google OAuth remain separate planned capabilities.

## Product login boundary

Migration 9 stores GitHub OAuth app connections and short-lived login attempts. Owners alone manage provider credentials; owners/editors read metadata and generate or test drafts. Viewers have no connection access. Metadata excludes secrets, hashes, and encrypted values. Changes and audit records commit together. Referenced connections cannot be deleted, and a missing connection prevents testing or publication.

A generated draft connects request -> social -> response. The social config references `connectionId`, and `$auth` holds a bounded result. REST uses POST with BEGIN/COMPLETE actions and generated body/response rules, including nullable result fields and typed identity fields. GraphQL uses typed `LoginAction` arguments on `Mutation.login`; the server returns a static `Query.info` result without executing social login. Generated flows remain ordinary saved drafts subject to the existing validation, owner publication, immutable release, and scoped runtime-key boundaries.

The product server invokes BEGIN with a runtime key, retains the separately returned sensitive proof and expected state associated with the initiating browser, and sends only GitHub's authorization URL to that browser. GitHub redirects to the product's registered callback. The product server validates its browser/state association and invokes COMPLETE with code, state, and its saved proof through the same runtime key. Besh has no public callback or product login frontend. Runtime keys and proofs must never enter browser code, storage, or URLs.

BEGIN uses authorization-code S256 PKCE with `read:user`. State and proof are hash-stored, the PKCE verifier is encrypted, and attempts expire in ten minutes. Attempts bind the flow ID/revision, runtime key or draft-testing member, and connection version. A valid completion is consumed before the provider exchange. Reuse, a changed connection/revision, a wrong caller, expiry, or mismatched proof fails. Network access is limited to fixed GitHub token/profile endpoints with a five-second overall deadline, 64 KiB per response, four concurrent exchanges, and no arbitrary redirects. Ten pending attempts per credential/flow and a thousand total bound stored attempts. One social node per flow and one login root call per selected OAuth mutation bound execution. Provider failures return generic errors without provider tokens or payloads.

Completion returns a normalized identity containing provider, stable subject, username, and nullable name/avatar URL. Provider access tokens and client secrets remain server-side and are not returned to products. Product accounts, sessions/JWTs, email linking, and field/record authorization are separate planned work. The workspace panel continues to use email/password or member keys. Other social providers remain planned; controlled GitHub boundary tests do not prove a real OAuth app or deployed callback works.

Attempt insertion and consumption commit transactionally with `product-login.started` and `product-login.consumed` audit events. Provider exchange records `product-login.completed` or `product-login.failed`. Events identify the credential scope and flow without code, state, proof, verifier, provider tokens, or payload details.

Published flow definitions keep immutable routes, rules, and connection IDs. Credential contents remain mutable references: owner edits increment the connection version, invalidate pending attempts, and change credentials used by future live calls without republishing the graph. Review this lifecycle separately from release changes.

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

Initial single-workspace roles: owner, editor, viewer. Owner manages members, publication, backups, and settings. Editor edits and tests drafts. Viewer reads allowed resources. Add custom permissions and multi-workspace isolation with explicit tests before claiming multi-tenancy.

Workspace sign-in uses email/password or member/owner keys. The GitHub social template belongs to generated product APIs and returns provider identity to a product server; it does not authenticate the workspace panel. Discord, Facebook, Google, and generic OIDC remain planned. Product account/session creation, linking, and authorization are separate from the implemented identity exchange.

Migration 8 adds optional workspace accounts, browser sessions, and persistent login throttle state. Accounts use unique normalized email addresses and Argon2id password hashes; member keys remain valid. Login creates a random hash-stored session secret in an HttpOnly, SameSite=Strict cookie, with Secure for HTTPS origins. Sessions expire after a fixed 12 hours without renewal. A member has at most 20 active sessions; a new login evicts the oldest transactionally with an audit event. Password verification runs asynchronously with at most four concurrent login verifications. Login permits 10 invalid attempts per identity and 100 total attempts per five-minute window, with bounded persistent throttle storage.

The dashboard restores sessions after reload and keeps CSRF state in memory. Cookie-authenticated writes require the exact browser origin and a session-bound CSRF value; login also checks origin. `BESH_WEB_URL` configures the exact HTTPS origin, with HTTP permitted only for loopback development. It is required behind a reverse proxy; forwarded headers are not trusted. Existing bearer management clients remain supported without cookie CSRF headers. An explicit Authorization header takes precedence and cannot fall back to a valid cookie after an invalid bearer credential.

All roles can update only their own account with a fresh current password or their own member-key proof. Account updates keep the current cookie session and revoke the member's others; bearer-authenticated updates revoke all their sessions. Members list/revoke their own sessions; owners list/revoke all workspace sessions. Session responses expose metadata only. Removing a member cascades to its account and sessions. A changed recovery owner key revokes owner sessions but preserves the owner's password account. Backups include these account, session, and throttle states; restoring a snapshot can restore an old password or a still-unexpired revoked session. Review restored credentials and sessions before resuming service. See [workspace accounts and sessions](workspace-auth.md).

Published REST and GraphQL endpoints accept only runtime API keys. Workspace sessions and owner/member tokens authenticate management routes and role-authorized draft tests. Only owners can issue, list, and revoke runtime keys. Migration 6 adds hash-only key storage, a single published flow scope, operation grants, required expiration within 366 days, and retained revocation metadata. Issuance and revocation are transactional with their audit records.

REST keys grant `rest`; GraphQL keys grant `query`, `mutation`, or both. GraphQL authorization checks the selected operation before execution, including operation-name selection from documents containing several operations. Runtime keys cannot cross flow boundaries or access management. Expiration and revocation are checked on each request. Grants authorize whole operations; field-level and record-level authorization remain planned.

Scope follows the flow ID across republishing rather than pinning a release. An owner must review keys before publishing broader behavior. Management responses expose the immutable published endpoint metadata separately from draft settings so key issuance displays the live route even when draft paths or protocols change. Restoring a backup also restores its key state; keys revoked after the snapshot may work again and need review, revocation, or rotation.

## Agent policy

The future agent should inspect APIs, explain runs, propose flows, test drafts, and manage permitted data through typed tools. Destructive data changes, publication, plugin execution, migrations, and external transfers require scoped authorization. Persist proposals and decisions. Treat database values, plugin output, and model responses as untrusted input.

Provider targets: Anthropic, OpenAI API, OpenRouter, Ollama/OpenAI-compatible endpoints, and a local Codex CLI adapter. Discover model capabilities rather than assuming all providers support tools, JSON schemas, or streaming equally. No mandatory cloud gateway.

## Sources

- [Elysia documentation](https://elysiajs.com/essential/best-practice): server framework usage.
- [React Flow](https://reactflow.dev/learn): node editor and graph interactions.
- [shadcn/ui with Vite](https://ui.shadcn.com/docs/installation/vite): dashboard component setup.
- [Bun SQLite](https://bun.sh/docs/runtime/sqlite): local control database.

See [roadmap](roadmap.md), [glossary](../GLOSSARY.md), and [AI policy](../AI_POLICY.md).
