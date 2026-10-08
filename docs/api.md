# Core API

Management routes accept a workspace session cookie or `Authorization: Bearer <workspace-token>`. Cookie-authenticated writes require the exact browser `Origin` and `X-Besh-CSRF`; bearer management clients remain compatible without these headers. An explicit Authorization header takes precedence over cookies and never falls back after an invalid credential. Send JSON for request bodies except multipart uploads. Responses use JSON except backup downloads. Error responses have `{ "error": "message" }`.

GraphQL runtime endpoints use the GraphQL `data`/`errors` envelope. See [GraphQL guide](graphql.md).

Management action permissions and API/dependency access are resolved from current server state on every request. Built-in action permissions are preserved; custom roles grant explicit actions. Eligible members can narrow existing-API actions with selected access and typed dependency USE. Only owners administer members, roles, sharing, and other members' sessions. Runtime API keys remain separate; issuer-bound keys additionally depend on current member authority. See [roles and permissions](roles.md).

## Tenant row protection

Implemented in 0.11. These routes implement the current contract. Tenant registry and row-policy management are owner-only; ordinary management cookies/CSRF rules still apply.

| Method  | Path                                       | Body / result                                                                                      |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| GET     | `/api/tenants`                             | Registry array including exact owner-only identity values                                          |
| POST    | `/api/tenants`                             | Exact `{ label, value }`; immutable value, initially active/version 1                              |
| PUT     | `/api/tenants/:id`                         | Exact `{ label, state: 'active'                                                                    | 'retired', version }`; value cannot change        |
| PUT     | `/api/members/:id/tenant`                  | Exact `{ tenantId: string                                                                          | null, version }`; owner assignment immutable null |
| GET     | `/api/tenant-context`                      | Any authenticated member's `{ assignment, tenant: { id, label, state }                             | null, backupsOwnerOnly }`; no exact value         |
| GET/PUT | `/api/data-sources/:id/row-policy`         | Owner; source policy and original-text eligibility                                                 |
| GET/PUT | `/api/database-connections/:id/row-policy` | Owner; copy policy and complete table mappings                                                     |
| GET     | `/api/flows/:id/row-access`                | Authorized API action/scope/USE; `{ source, revision, required, supported }`, no graph/data/schema |

Tenant values preserve case/spaces, reject controls and ill-formed text, and have limits of 128 Unicode code points/512 UTF-8 bytes. The registry permits 256 entries; duplicate exact values return `409`. Labels are trimmed and limited to 80 characters. Positive safe numeric versions are required; stale updates return `409`. Every accepted assignment update advances its version, audits, and revokes affected cookies. Retirement revokes assigned members' cookies and denies their subsequent protected calls. Member creation accepts optional nullable `tenantId` atomically.

Source policy GET returns `{ mode, version, resourceVersion, column: string | null, provenance: { status: 'available' | 'requires-reimport', textColumns: string[] } }`. SQLite GET returns `{ mode, version, resourceVersion, tables: [{ table, column: string | null, textColumns: string[] }] }`. PUT is an exact union: `{ mode: 'unprotected', version, resourceVersion }`, or tenant mode with source `column` / SQLite `tables: [{ table, column }]`. SQLite mappings must cover every inspected table exactly once. Both reviewed versions guard the transaction (`409` stale); invalid mappings return `400`. Missing source provenance needs reviewed reimport/refresh (`409`); unsuitable original identity cells return `400`. Each accepted policy update increments its version and audits.

Row-access accepts only an optional single `source=draft|published` (default published); duplicates/unknown parameters return `400`, and an unpublished selected source returns `404`. Draft metadata needs API read/write/test/publish; published metadata needs API read/key management/load testing. This permits authorized no-read operators to review protection without fetching private flow metadata.

Protected draft tests, key issuance, and load-test starts accept a separate optional top-level `tenantId` for an owner to review. Every non-owner derives current assignment; supplying a selector returns `400`. It is not flow input or a GraphQL variable. An explicit owner selector on an unprotected draft test, key issuance, or load-test start also returns `400`; it cannot pretend to protect an ordinary API. Keys and jobs include required nullable `tenantId`, never the exact identity value; historical inaccessible-to-execution entries may include `cleanupOnly: true`. Protected keys require a current pin and every non-owner's live issuer/action binding. Protected raw resource access is owner-only. Raw SQLite previews/checks recheck original management proof, current grant, and live protection after asynchronous child reads; newly hidden resources return `404` without rows/check metadata or a successful-check audit. Source/copy deletion and API generation repeat fresh proof/grant/raw-policy checks first inside the acquired IMMEDIATE transaction, before mutation/template/flow creation; a newly protected hidden resource returns `404` without that mutation or its audit. First protection permanently makes all ordinary backup routes owner-only. See [setup, graph limits, inventory, and recovery](row-protection.md).

## Setup

| Method | Path            | Behavior                                                                          |
| ------ | --------------- | --------------------------------------------------------------------------------- |
| GET    | `/health`       | Health and application version                                                    |
| GET    | `/setup/status` | Whether setup is needed and workspace name                                        |
| POST   | `/setup`        | `{ "key": "server-setup-key", "name": "My workspace" }`; returns owner token once |

Setup needs the challenge from the local server terminal. It returns `409` once an owner exists. Changing the environment setup key does not reopen an existing workspace.

The setup API also accepts optional `email` and `password` together to create the owner's account. The browser wizard creates the owner key first; add an account afterwards under **Account & sessions**. Passwords contain 12 to 128 exact characters. Emails are validated, trimmed, lowercased, limited to 254 characters, and unique across the workspace.

## Workspace authentication

| Method | Path                | Body / behavior                                                                                                                                                    |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/auth/login`       | `{ "token": "<member-key>" }` or `{ "email": "owner@example.com", "password": "<password>" }`; requires exact `Origin`, creates a session cookie                   |
| GET    | `/auth/session`     | Restores a valid cookie session; does not renew its expiration                                                                                                     |
| POST   | `/auth/logout`      | Valid cookie, exact `Origin`, and `X-Besh-CSRF`; revokes that session and clears the cookie                                                                        |
| GET    | `/api/account`      | Any member; own `{ "email": null }` or configured email                                                                                                            |
| PUT    | `/api/account`      | Any member; own `{ "email": "owner@example.com", "password": "<new-password>", "currentPassword": "<current-password>" }`, or `token` instead of `currentPassword` |
| GET    | `/api/sessions`     | Member's active sessions; owners receive all workspace sessions, with metadata only                                                                                |
| DELETE | `/api/sessions/:id` | Own session or any session for an owner; returns `{ "ok": true }`                                                                                                  |

Login and restoration return `{ "member": { "id": "...", "name": "...", "role": "viewer", "permissions": ["flows.read"], "flowAccess": { "mode": "all", "flowIds": [], "version": 1 }, "access": { "mode": "all", "flowIds": [], "dependencyUse": { "sources": [], "databaseConnections": [], "authConnections": [] }, "version": 1 }, "tenantAssignment": { "tenantId": null, "version": 1 } }, "csrfToken": "...", "sessionId": "...", "expiresAt": "..." }`. Every public member includes current `permissions`, `access`, the compatible `flowAccess` projection, and `tenantAssignment: { tenantId: string | null, version: number }`; custom members also include `roleId` and `roleName`. The secret appears only in the `besh_session` HttpOnly, SameSite=Strict cookie, with Secure on HTTPS. Session expiration is fixed at 12 hours. Each member has at most 20 active sessions; the next successful login evicts the oldest transactionally and records an audit event.

Session metadata contains `id`, `memberId`, `memberName`, `createdAt`, `expiresAt`, `lastSeenAt`, and `current`. It excludes secrets, hashes, and payloads. Expired sessions are omitted. An unknown session ID returns `404`; revoking another member's session without owner permission returns `403`, with the selected-mode policy below hiding foreign session IDs as `404`. Revoking the current session ends subsequent management access through that cookie.

Updating an account requires a current password or that same member's valid key in the request body, including for bearer clients. The update retains the current cookie session and revokes the member's others. A bearer-authenticated update has no current cookie session and revokes all that member's sessions. Duplicate email returns `409`; invalid proof returns `403`. The member key is unchanged.

Browser login requires the configured `BESH_WEB_URL` origin, or the request URL's exact origin when unset. Use HTTPS outside loopback; HTTP is allowed only for `localhost`, `127.0.0.1`, and `[::1]`. Reverse proxies must configure the public origin; forwarded headers are not trusted. Login limits persist across restarts: 10 invalid attempts per identity in five minutes, 100 total attempts in five minutes, and four concurrent verifications. A successful login clears its identity limit; exceeded limits return `429`. See [workspace accounts and sessions](workspace-auth.md).

## Workspace

| Method | Path                                | Permission / body                                                                       |
| ------ | ----------------------------------- | --------------------------------------------------------------------------------------- |
| GET    | `/api/me`                           | Any member; identity and current permissions                                            |
| GET    | `/api/flows`                        | `flows.read`; drafts/revisions filtered by current API scope                            |
| GET    | `/api/flows/:id`                    | `flows.read`                                                                            |
| GET    | `/api/flows/:id/releases`           | `flows.read`; immutable revisions and current selection                                 |
| GET    | `/api/flows/:id/releases/:revision` | `flows.read`; selected definition and current flag                                      |
| GET    | `/api/flows/:id/openapi`            | `flows.read`; `source=draft` or `source=published` (default)                            |
| GET    | `/api/flows/:id/backend-code`       | `flows.read`; current module, optional expected `revision`                              |
| POST   | `/api/flows`                        | `flows.write`; all-mode only; flow definition                                           |
| PUT    | `/api/flows/:id`                    | `flows.write`; flow definition plus current `revision`                                  |
| POST   | `/api/flows/:id/test`               | `flows.test`; `{ "body": {}, "query": {}, "params": {} }`                               |
| POST   | `/api/flows/:id/graphql/test`       | `flows.test`; GraphQL `{ "query": "...", "variables": {}, "operationName": "..." }`     |
| POST   | `/api/flows/:id/publish`            | `flows.publish`; `{ "revision": 1 }`                                                    |
| POST   | `/api/flows/:id/rollback`           | `flows.publish`; `{ "revision": 1, "publishedRevision": 3 }`; selects 1 if 3 is current |
| GET    | `/api/members`                      | Owner; member metadata without credential hashes or tokens                              |
| POST   | `/api/members`                      | Owner; name and `viewer`, `editor`, or `custom` role; custom requires `roleId`          |
| PUT    | `/api/members/:id/role`             | Owner; `{ "role": "viewer" }` or `{ "role": "custom", "roleId": "..." }`                |
| PUT    | `/api/members/:id/flow-access`      | Owner; exact scope and expected version; see selected-API reading                       |
| PUT    | `/api/members/:id/access`           | Owner; exact API/dependency access and expected shared version                          |
| DELETE | `/api/members/:id`                  | Owner; cannot remove bootstrap owner                                                    |
| GET    | `/api/runtime-keys`                 | `runtime-keys.manage`; metadata including revoked keys                                  |
| POST   | `/api/runtime-keys`                 | `runtime-keys.manage`; name, flow ID, grants, expiration; token once                    |
| POST   | `/api/runtime-keys/:id/rotate`      | `runtime-keys.manage`; identical scope/expiration replacement; token once               |
| DELETE | `/api/runtime-keys/:id`             | `runtime-keys.manage`; revocation with retained metadata                                |
| GET    | `/api/audit`                        | `audit.read`; latest 200 events, newest first                                           |
| GET    | `/api/migrations`                   | `migrations.read`; control schema versions in applied order                             |
| GET    | `/api/backups`                      | `backups.manage`; owner-only permanently after first tenant protection                  |
| POST   | `/api/backups`                      | `backups.manage`; full snapshot, owner-only after first protection                      |
| GET    | `/api/backups/:id`                  | `backups.manage`; complete SQLite download, owner-only after first protection           |

Drafts may be incomplete. Publishing and testing require one request node, reachable nodes, valid edges, and a response at every terminal path. Conditions require exactly one `true` and one `false` edge. Cycles are rejected.

Release-list entries contain `revision`, `createdAt`, `endpoint: { method, path, graphql }`, and `current`. Release detail contains `revision`, `createdAt`, the saved `definition`, and `current`. Unknown flows or releases return `404`. Releases are created by publication, not every draft save.

Rollback accepts exactly the two positive integer fields shown above. It changes only the published selection and returns the updated flow metadata; the draft revision and definition stay intact. The server validates the target graph, current dependencies, route availability, and expected current publication before committing with `flow.rolled-back`. Selecting the already current release, a stale publication, or a conflicting route returns `409`. Publication and rollback also return `409` while this flow has an active load test. Runtime keys keep their flow scope and grants; referenced spreadsheet/OAuth data is not rolled back. See [routes and release history](api-routes.md).

Member creation also accepts optional `email` and `password` together, using the same account rules as setup. It still returns a member key once. Custom creation accepts `{ "name": "Data reviewer", "role": "custom", "roleId": "<role-id>" }`, validating and assigning the role atomically. Member metadata includes ID, name, role, current permissions, and custom-role ID/name where applicable; members read their own email through `/api/account`. No invitation email is sent. Removing a member cascades to its account and sessions. Owners cannot reassign or remove the bootstrap owner or assign anyone the owner role.

## Custom roles

| Method | Path               | Permission / body                                                           |
| ------ | ------------------ | --------------------------------------------------------------------------- |
| GET    | `/api/permissions` | Any member; catalog array `{ id, label, description, group }`               |
| GET    | `/api/roles`       | Owner; custom role metadata array                                           |
| POST   | `/api/roles`       | Owner; `{ "name": "Data reviewer", "permissions": ["sources.read"] }`       |
| PUT    | `/api/roles/:id`   | Owner; exact `{ "name": "Data reviewer", "permissions": [], "version": 1 }` |
| DELETE | `/api/roles/:id`   | Owner; exact `{ "version": 1 }`; assigned role returns `409`                |

Custom role metadata contains `id`, `name`, `permissions`, `version`, `createdAt`, and `updatedAt`. Creation starts at version 1. Names are trimmed, 1 to 80 characters, control-free, unique under SQLite NOCASE (ASCII case-insensitive), and cannot use a built-in role name. Permissions contain zero to 15 unique supported IDs, with no implied dependencies. Updates/deletion require the positive safe-integer version reviewed by the caller; stale versions return `409`. Unknown roles return `404`.

Member role assignment accepts exactly `{ "role": "editor" }`, `{ "role": "viewer" }`, or `{ "role": "custom", "roleId": "..." }`. Permission changes and assignments commit with `role.updated` or `member.role.updated` and affected `session.revoked` events. Role creation/deletion record `role.created`/`role.deleted`. Changing grants revokes sessions for members assigned to that role; assignment changes revoke the member's sessions. Member keys remain valid but resolve current grants on their next request. Renaming a role does not add privileges. Migration 11 adds `workspace_roles` and `member_roles` without changing existing built-in assignments. See [permission catalog and boundaries](roles.md).

## Selected-API reading

Required member metadata includes `flowAccess: { mode: "all" | "selected", flowIds: string[], version: number }`. Existing members and new members without an explicit choice default to `all` with version 1; the owner remains immutable all-access. All mode returns an empty `flowIds` array, while selected IDs are sorted. Roles still determine permitted actions.

Owner-only `PUT /api/members/:id/flow-access` accepts exactly `{ "mode": "all", "version": 1 }` or `{ "mode": "selected", "flowIds": ["<flow-id>"], "version": 1 }`. The expected version must be a positive safe-integer JSON number. Selected IDs must be unique existing strings of 1 to 80 characters, at most 256; an empty array shares no APIs. Malformed bodies return `400`; missing members or selected APIs return `404`; stale versions and owner-scope edits return `409`. `POST /api/members` can also include initial `flowAccess: { "mode": "all" }` or `{ "mode": "selected", "flowIds": [...] }`, without a version, assigning the scope atomically with member creation.

Selected scope is valid for viewers or custom roles using only the six API actions listed below, including an empty custom role. It never grants a missing action. Editors and roles with global resource/audit/backup/migration grants are incompatible. Incompatible creation returns `400`; incompatible role assignment or an assigned custom-role expansion returns `409` before changes.

Every accepted scope PUT, including an identical scope, increments its version and commits `member.flow-access.updated` with affected `session.revoked` events. Role assignment retains a compatible scope and increments its version; compatible custom-role permission edits do not increment scope version but apply existing grant-change cookie revocation. Bearer keys remain unchanged and resolve current policy on the next request. Already authorized in-flight reads may finish.

API lists are filtered. Every API-ID read/export route requires both `flows.read` and scope: missing action returns `403`; an inaccessible or unknown ID returns `404` before malformed request/query validation. This covers saved drafts, release history/detail, OpenAPI, client metadata/generation, and generated backend code. Selected members retain their own account/session actions; foreign/missing session IDs both return `404`. Global workspace action routes remain denied. Migration 15 adds `member_flow_access`/`member_flow_grants`; migration 16 extends this with USE and issuer bindings. Rows/fields and tenant authorization remain separate. See [roles and sharing](roles.md#selected-api-reading) and exact verification in [testing](testing.md).

## Selected API actions and dependency USE

Implemented in 0.10, required member metadata is `access: { mode, flowIds, dependencyUse: { sources: string[], databaseConnections: string[], authConnections: string[] }, version }`. `flowAccess` remains its compatible API-scope projection with the same version. Returned ID lists are sorted; all mode has no selected USE entries. Existing members retain their API scope and start with empty USE lists.

Owner-only `PUT /api/members/:id/access` accepts exactly `{ "mode": "all", "version": 1 }` or `{ "mode": "selected", "flowIds": [], "dependencyUse": { "sources": [], "databaseConnections": [], "authConnections": [] }, "version": 1 }`. Version is a positive safe-integer JSON number. Each ID array has at most 256 unique existing IDs of 1 to 80 characters. Creation can provide `access` without `version`; it cannot provide both `access` and `flowAccess`. Legacy selected-to-selected `/flow-access` updates preserve existing USE grants; switching to all clears them. Access updates share the version/audit/session boundary; the new endpoint records `member.access.updated`.

Selected eligibility permits role permissions contained in `flows.read`, `flows.write`, `flows.test`, `flows.publish`, `runtime-keys.manage`, and `load-tests.run`. It does not permit creating APIs, generating new APIs from resources, or global resource administration. Existing-API save/test/publish/rollback checks the action, selected API, and every referenced dependency, including untaken branches. Current checks run at transaction boundaries and before/after asynchronous data/provider work and final results. Management USE denials hide the dependency as `404`; bound runtime issuer denials return `403`. A failed final check returns no private result, but cannot undo effects already performed.

Selected publication/rollback without `flows.read` returns only `{ id, revision, publishedRevision, publishedEndpoint: { method, path, graphql } }`, excluding draft names, nodes, literals, contracts, and schema. Selected members with API reading and all-mode members keep the existing full response. Rollback requires USE for its immutable target graph, not the current edited draft. A stale expected pin returns `409` before inspecting a newer publication's dependencies.

The structural dependency catalog has list arrays and single-ID detail objects:

| GET family                                     | Detail fields                                          |
| ---------------------------------------------- | ------------------------------------------------------ |
| `/api/dependencies/sources[/:id]`              | `id`, `name`, `version`, `columns`                     |
| `/api/dependencies/database-connections[/:id]` | `id`, `name`, `version`, `tables: [{ name, columns }]` |
| `/api/dependencies/auth-connections[/:id]`     | `id`, `name`, `version`, `provider`                    |

Selected members need a relevant operational action (write/test/publish/key management/load testing) and the matching typed USE grant; API reading alone does not grant catalog access. All-mode members need the corresponding existing source/database/auth read permission. Inaccessible/missing detail IDs return `404`. Catalogs exclude rows, row counts, original bytes, remote URLs, provider settings/secrets, and credentials. Referenced resources cannot be deleted while USE is granted (`409`). USE can expose data through authored APIs; it is not row/column/tenant isolation.

Migration 16 adds typed USE state and paired issuer columns. Runtime key metadata adds nullable `issuerBinding: { memberId, action: "runtime-keys.manage" | "load-tests.run" } | null`. Selected caller issuance requires an explicit current `releaseRevision` (`400` if omitted) and derives the binding on the server. Unauthorized/deleted issuers deny calls with `403`; replacement requires current issuer authority (`409` when blocked) and preserves issuer/action/pin/exact expiry even for an owner. Legacy null bindings retain unprotected behavior; live resource protection adds tenant requirements; deletion does not erase a binding or turn it into legacy access.

Selected key inventory/exact operations cover bound keys for currently shared APIs only, including another issuer's key; unbound keys return `404`. Selected load-test history/detail/cancellation similarly covers `load-tests.run`-bound jobs for shared APIs, while targets/start additionally require every dependency USE. A selected run derives `load-tests.run` binding and its managed starting-revision pin; managed keys remain nonreplaceable. Revocation/cancellation require the action and API scope, but not retained USE. All-mode managers keep authorized inventory/history, with tenant-bearing privacy applied to every non-owner as described above. Malformed stored issuer pairs fail closed with `503`; deleting an issuer retains the key's identity rather than clearing it. See [selected actions and USE](roles.md#selected-api-actions-and-dependency-use).

## Published backend code

`GET /api/flows/:id/backend-code?revision=N` requires `flows.read`; `revision` optionally guards the expected current publication, and omission returns the latest publication; runtime keys cannot access management. Unknown/unpublished flows return `404`, an invalid/duplicate revision or an unknown query field returns `400`, and a changed or historical noncurrent revision returns `409`. Artifact integrity failure returns `503`. This read does not publish or execute an API and does not export a draft.

The artifact contains `flowId`, `revision`, numeric `compilerVersion`, `filename` (`besh-<flowId>-r<revision>.cjs`), `code`, `sha256`, `definitionSha256`, `endpoint: { method, path, graphql: boolean }`, and `requirements: string[]`. Generated code is bounded to 1 MiB (`400` on generation overflow). Endpoint paths include the actual `/run` or `/graphql` prefix. Code is canonical CommonJS generated from the validated release and depends on Besh runtime services; it is not a standalone deployment. Configured literals/resource references can appear in downloads; server-held secrets and caller tokens are not automatically inserted. Hashes describe generated content and are not signatures. See [published backend code](runtime-code.md).

Publication/rollback stages the module and compiled registered routes with migration-14 artifact/generation state and audit. Runtime keeps credentials, pins, contracts, GraphQL/data/execution limits, and audit SQL. A generation change during parsed-request admission rejects with `503` before effects; an already admitted immutable-release request may finish. Failed peer reconstruction or local restoration blocks runtime with `503` until restart or a successful local publication stage. Exact failure/recovery and native behavior belong in [testing](testing.md).

## Client code examples

All client-code routes require `flows.read`; runtime keys cannot access them. Cookie POSTs use the normal Origin/CSRF checks. These routes render request source only; they do not execute an API, issue a key, or save example payloads.

| Method | Path                         | Behavior                                                                          |
| ------ | ---------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/api/client-code/targets`   | Supported target catalog with IDs, labels, languages, dependencies, and filenames |
| GET    | `/api/flows/:id/client-code` | Saved-source metadata; optional single `source=published` or `source=draft`       |
| POST   | `/api/flows/:id/client-code` | Exact `{ target, source?, revision, baseUrl, request? }`; generated text result   |

Source defaults to the current immutable publication; an unpublished API returns `404`. Draft means the current saved definition, excluding unsaved browser edits. Metadata contains `source`, `revision`, `name`, `method`, `path`, `graphql: { schema } | null`, `contract | null`, and `targets`. Generation requires the positive safe-integer revision just reviewed; a stale source returns `409`. It cannot select arbitrary historical revisions.

REST `request` accepts optional `params`/`query` text maps and JSON `body`; GraphQL accepts only `graphql: { query, variables?, operationName? }`. REST path/query/body rules and GraphQL schema/operation/variable budgets are checked without executing the flow. GET/HEAD require the body property to be omitted, even for `null`; other methods preserve explicit JSON `null`, while an omitted body has no JSON content header. Path/query maps have at most 64 entries; keys at most 256 characters and values at most 4,096. GraphQL query text is at most 16,384 characters; operation names at most 100. Selected operations allow at most 2,000 tokens, depth 12, 200 fields, and 16 roots, or one root for product-login mutations. Introspection and subscriptions are rejected. JSON uses the normal nesting/256 KiB bound.

`baseUrl` is an HTTP(S) origin with an optional deployment prefix, at most 2,048 characters, without credentials, query, fragment, spaces, or control characters. It affects code only and causes no network fetch or Besh configuration change. Concrete path/query values are encoded and each target uses its own literal escaping.

The result contains `target`, `source`, `revision`, `method`, `url`, `code`, `dependencies`, `warnings`, `filename`, and `contentType: "text/plain"`. Code is at most 64 KiB and the full result at most 256 KiB. Examples use the caller's `BESH_RUNTIME_API_KEY` environment variable, a ten-second timeout, and no redirect following; no workspace or runtime token value is included. Draft output warns that the saved revision must be published first. Source metadata is not runtime revision pinning.

Supported IDs are `javascript-axios`, `javascript-fetch`, `php-curl`, `curl`, `rust-reqwest`, `go-net-http`, `java-http-client`, and `cpp-libcurl`. See [client code guide](client-code.md) for filenames, dependencies, and run instructions; exact observed compilation/execution belongs in [testing](testing.md).

## Load testing

Every load-test management route requires `load-tests.run`. Owners have it by default, and custom roles can grant it. Built-in editors and viewers receive `403`; runtime keys cannot access management. Cookie writes require the normal Origin and CSRF checks.

| Method | Path                         | Body / behavior                                               |
| ------ | ---------------------------- | ------------------------------------------------------------- |
| GET    | `/api/load-tests/targets`    | Published endpoint targets and any automatic-test restriction |
| GET    | `/api/load-tests`            | Latest 100 run records, newest first                          |
| GET    | `/api/load-tests/:id`        | One run; unknown ID returns `404`                             |
| POST   | `/api/load-tests`            | Starts a run; returns its record with `202`                   |
| POST   | `/api/load-tests/:id/cancel` | Cancels a running run; returns its updated record             |

A default REST start needs only `{ "flowId": "<published-flow-id>" }` when its route and contract require no input. A `/v1/items/:id` target needs `request.params.id`. Optional settings and request fields for that target:

```json
{
  "flowId": "<published-flow-id>",
  "config": {
    "vus": 1,
    "durationSeconds": 5,
    "p95Ms": 1000,
    "maxErrorRate": 0.01,
    "expectedStatus": null
  },
  "request": {
    "params": { "id": "42" },
    "query": { "name": "Ada" },
    "body": null
  }
}
```

`vus` is an integer from 1 to 10; `durationSeconds` is an integer from 1 to 30. `p95Ms` is from 1 to 60,000, `maxErrorRate` is a fraction from 0 to 1, and `expectedStatus` is `null` for any 2xx or an exact integer from 200 to 599. Omitted settings use the values shown above. Query values are strings, with at most 64 fields, 256-character names, and 4096-character values. Serialized request input is limited to 16 KiB with normal JSON nesting limits; the encoded target URL is limited to 8 KiB. GET and HEAD reject a non-null body. Unknown configuration/request fields are rejected.

For GraphQL, use `request.graphql` with the published schema:

```json
{
  "flowId": "<published-graphql-flow-id>",
  "request": {
    "graphql": {
      "query": "query Greeting($name: String!) { greeting(name: $name) { message } }",
      "variables": { "name": "Ada" },
      "operationName": "Greeting"
    }
  }
}
```

The operation document is limited to 16,384 characters, and an optional operation name to 100. Normal published-schema validation and GraphQL execution budgets apply. The server derives the temporary key's query/mutation grant from the selected operation and pins the key to the run's published revision. REST input cannot substitute for a GraphQL operation.

For parameterized REST targets, `request.params` supplies decoded text values for every route parameter, such as `{ "id": "42" }` for `/v1/items/:id`. Omit `params` or use `{}` for a literal route. Missing, extra, malformed, and unsafe values are rejected; declared path rules also apply. The server encodes the concrete path before launching k6. GraphQL does not accept path parameters.

Protected targets also include `tenantRequired: true`. Target records contain `id`, `name`, published `revision`, `method`, `path`, `graphql` schema metadata or `null`, and `unavailableReason`. Targets derive from the release, even after editing a different draft route. Run metadata captures the starting release and requests invoke its live route. Publication and rollback for the target flow return `409` while its run is active. Mutable source data and credentials remain outside this route lock. Product-login/social flows are unavailable for automatic tests. The server accepts no arbitrary target URL, scripts, shell command, or custom headers.

Run records contain `id`, `flowId`, `flowName`, published `revision`, `method`, `path`, boolean `graphql`, resolved `config`, `status`, `createdAt`, nullable `finishedAt`, nullable `summary`, and nullable safe `error`, and nullable `tenantId`; historical cleanup-only entries may include `cleanupOnly: true`. Summary fields are `requests`, `requestsPerSecond`, `failedRequests`, `checkRate`, `avgMs`, `p95Ms`, `maxMs`, and `thresholdsPassed`; rates use fractions or requests per second, and latency uses milliseconds. Status is `running`, `completed`, `failed`, `canceled`, or `interrupted`. Missing a goal still produces `completed` with `thresholdsPassed: false`; `failed` means provisioning/runner failure.

One run can be active at a time; another start returns `409`. Unknown runs return `404`. Canceling an already completed, failed, or interrupted run returns `409`; repeated cancellation of a canceled run is safe. Invalid/unpublished targets, unavailable social flows, configuration, or request input return `400`. A server without a listening local runtime cannot start a test.

Starts authorize repeated calls to the live API. Dashboard write/mutation starts require confirmation; direct permission-authorized clients have no separate confirmation field. Besh automatically issues a temporary scoped key, generates its local k6 script, and revokes the key on completion, failure, cancellation, or interruption. Existing caller keys remain unchanged. Restart interrupts rather than resumes active jobs. In-flight requests may finish after cancellation.

SQLite history and backups contain endpoint/settings/result metadata, excluding request values, raw tokens, generated scripts, and process logs. Load-test lifecycle audit events likewise record metadata only. See [load testing](load-testing.md) for automatic k6 provisioning, optional administrator configuration, live-write risks, and verification evidence.

## Flow format

```json
{
  "name": "Hello API",
  "method": "GET",
  "path": "/hello",
  "nodes": [
    {
      "id": "start",
      "type": "request",
      "position": { "x": 0, "y": 100 },
      "config": {}
    },
    {
      "id": "done",
      "type": "response",
      "position": { "x": 350, "y": 100 },
      "config": { "status": 200, "body": { "hello": "$input.query.name" } }
    }
  ],
  "edges": [{ "id": "next", "source": "start", "target": "done" }]
}
```

Condition config: `{ "field": "body.active", "equals": true }`. Edges from that condition use `sourceHandle: "true"` and `sourceHandle: "false"`.

REST paths support whole-segment parameters such as `/v1/items/:id`. Parameter names match `[A-Za-z_][A-Za-z0-9_]{0,63}`, must be unique, and cannot be `__proto__`, `prototype`, or `constructor`. Optional segments, wildcards, and regex are unsupported. GraphQL uses exact literal paths. Different version prefixes are separate flows, without automatic compatibility guarantees.

Draft test `params` and `query` values are text. For parameterized routes, supply exactly the path's parameter names; the server validates values before execution. Runtime path values are decoded once; malformed encoding, decoded slash/backslash/control characters, empty values, and the exact `.` or `..` segments are rejected. Response references can use `$input.params.id`, and conditions can use `params.id`. Optional scalar path rules under `contract.params` convert declared numeric/boolean values like query rules. See [API contracts](api-contracts.md).

Create/update responses add `id`, `revision`, `publishedRevision`, and `publishedEndpoint`. The last field is `null` before publication; otherwise it contains the live release's `method`, `path`, and GraphQL flag separately from editable draft settings. Save increments revision. Publish retains an immutable copy and atomically selects it for the live route. Route conflicts and stale revisions return `409`. Same-method REST routes cannot overlap: `/items/:id` conflicts with `/items/new` and `/items/:slug`. This keeps scoped-key routing unambiguous; Besh does not resolve conflicts by preferring literal paths.

## Spreadsheet data sources

Source listing/detail require `sources.read`; import, replacement, refresh, and deletion require `sources.write`. Generating a draft requires both `sources.read` and `flows.write`. Each permission is checked independently. Owners and editors have these grants by default; custom roles can select them. Built-in viewers and runtime API keys have no source-management access.

| Method | Path                              | Body / behavior                                                                          |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/data-sources`               | Source metadata array                                                                    |
| GET    | `/api/data-sources/:id`           | Metadata plus first 10 rows                                                              |
| POST   | `/api/data-sources/import`        | Multipart `name` and CSV/XLSX `file`; imports a snapshot                                 |
| POST   | `/api/data-sources/google-sheets` | JSON `{ "name": "Products", "url": "<public-sheet-share-link>" }`                        |
| PUT    | `/api/data-sources/:id/import`    | Multipart `file` and optional `name`; replaces an uploaded snapshot                      |
| POST   | `/api/data-sources/:id/refresh`   | Re-fetches a public Google source                                                        |
| POST   | `/api/data-sources/:id/api`       | JSON name, path, protocol, columns, limit, optional filter; returns a saved draft        |
| DELETE | `/api/data-sources/:id`           | Returns `{ "ok": true }`; current draft/current published source reference returns `409` |

Metadata contains `id`, `name`, `kind: "upload" | "google-sheets"`, `columns`, `rowCount`, `version`, `createdAt`, `updatedAt`, and optional `sheetName` or `sourceUrl`. Each column contains its safe API `key`, original `label`, inferred `type: "string" | "number" | "boolean"`, and `nullable`. Detail/import responses add `rows` for the first 10 records.

Generate a draft after reviewing columns:

```json
{
  "name": "Products API",
  "path": "/products",
  "protocol": "rest",
  "columns": ["name", "price"],
  "limit": 25,
  "filter": { "column": "name", "inputName": "name" }
}
```

Protocol is `rest` or `graphql`; limit is 1 to 100. Filter is optional and performs one equality comparison. Omitting the optional caller value returns all eligible rows up to the limit. Filters help callers search; they do not enforce authorization. The returned flow contains a `data` node with `{ sourceId, columns, limit, filter? }` and a response body reference `$data`. REST filters read query input; generated GraphQL filters read typed root arguments. Publication and runtime-key issuance require separate `flows.publish` and `runtime-keys.manage` grants.

Reads use the latest source snapshot. Replacement/refresh changes live data without publishing a new graph revision. Migration 7 stores source snapshots and audit changes. See [data sources](data-sources.md) for formats, limits, and private-sheet restrictions.

## Uploaded SQLite database copies

`database-connections.read` permits unprotected copy metadata and row previews; protected full/raw copy operations are owner-only. `database-connections.manage` permits upload, checking, and deletion. Owners have both; built-in editors and viewers have neither. Draft generation requires both `database-connections.read` and `flows.write`. Runtime keys cannot call these management routes.

| Method | Path                                    | Body / behavior                                                 |
| ------ | --------------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/database-connections`             | Read grant; metadata array                                      |
| GET    | `/api/database-connections/:id`         | Read grant; metadata for one copy                               |
| POST   | `/api/database-connections`             | Manage grant; multipart `name` and `file`                       |
| POST   | `/api/database-connections/:id/preview` | Read grant; exact `{ version, table, columns, filter?, limit }` |
| POST   | `/api/database-connections/:id/check`   | Manage grant; exact `{ "version": 1 }`; reinspects saved bytes  |
| DELETE | `/api/database-connections/:id`         | Manage grant; exact `{ "version": 1 }`                          |
| POST   | `/api/database-connections/:id/api`     | Read + flow-write grants; generated saved draft                 |

Metadata contains `id`, `name`, `kind: "sqlite"`, `mode: "uploaded-copy"`, byte count `bytes`, `version`, `tables`, `createdAt`, and `updatedAt`. Each table has `name`, `columns`, and `rowCount`; each column has a safe API `key`, original `label`, scalar `type`, and `nullable`. Metadata excludes the original file bytes. Names are trimmed, control-free, and 1 to 80 characters. New copies start at version 1. There is no replacement or synchronization endpoint.

Preview selects 1 to 32 unique inspected column keys and a limit of 1 to 100 rows. Optional `filter` is exactly `{ "column": "customer_id", "value": 42 }`, using an inspected key and a string, finite number, boolean, or null. Non-null values must match the inspected column type: numeric strings and numeric `0`/`1` for boolean fields are rejected. String values are at most 4,096 characters. SQL identifiers come from the inspected schema; equality values are bound parameters and null matches SQL null. Preview returns `{ version, table, columns, rows }`. A check returns `{ version, ok: true, tables }`; it does not refresh data. Unknown IDs return `404`, stale versions return `409`, and deletion returns `409` for any draft or immutable release reference, including noncurrent history. Create/check/delete commit with `database-connection.created`, `.checked`, or `.deleted` audit events.

Generation accepts exactly `{ version, table, name, path, protocol, columns, filter?, limit }`. `protocol` is `rest` or `graphql`; the path is a literal route. Optional `filter` is `{ "column": "customer_id", "inputName": "customerId" }`. It creates a REST GET draft with typed query input or a GraphQL query named `rows` with a typed argument. Selected fields and nullability generate the response contract/schema. Omitting the optional business filter returns eligible rows up to the limit; protected resources retain their mandatory tenant predicate. It neither publishes nor issues a runtime key.

A `database` node uses `{ connectionId, table, columns, filter?, limit }`; results replace `$data`. Filter values can reference `$input.query`, `$input.params`, or `$input.body`. At most four database nodes are allowed per flow. Draft testing, publication, rollback, and runtime execution validate referenced copies/tables/columns. Flow testing can expose configured rows without a separate database-read grant; runtime access follows the published flow's whole-operation key grants, not per-column or record authorization.

Copies are immutable original uploads stored inside the control database and included in consistent backups. Reads use a separate read-only engine in a trusted helper, with at most two active helpers per Bun process, a two-second deadline, 256 KiB output bound, and a 16 MiB SQLite allocation budget. Uploads are at most 2 MiB, with eight copies/16 MiB total; supported schema and row limits are in the [database guide](databases.md). Uploaded data is not encrypted. This is not an external live database connection, SQL-write adapter, or OS sandbox.

## Product login connections

Connection metadata requires `auth-connections.read`. Draft generation requires both `auth-connections.read` and `flows.write`. Creating, editing, or deleting connections requires `auth-connections.manage`. Owners have all three; built-in editors can read metadata and generate drafts, while viewers and runtime keys have no connection-management access. Custom roles grant each action explicitly. Cookie writes use the usual Origin and CSRF checks.

| Method | Path                                 | Body / behavior                                                                                                                                              |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/auth-connections`              | `auth-connections.read`; metadata array                                                                                                                      |
| POST   | `/api/auth-connections`              | `auth-connections.manage`; `{ "name": "Product GitHub", "provider": "github", "clientId": "<id>", "clientSecret": "<secret>", "redirectUri": "<callback>" }` |
| PUT    | `/api/auth-connections/:id`          | `auth-connections.manage`; `{ "name": "Product GitHub", "clientId": "<id>", "redirectUri": "<callback>", "clientSecret": "<optional-replacement>" }`         |
| DELETE | `/api/auth-connections/:id`          | `auth-connections.manage`; `{ "ok": true }`; a connection referenced by a draft or release returns `409`                                                     |
| POST   | `/api/auth-connections/:id/generate` | `auth-connections.read` + `flows.write`; `{ "name": "GitHub login", "path": "/login/github", "kind": "rest" }`; `kind` also accepts `graphql`                |

Metadata contains `id`, `name`, `provider: "github"`, `clientId`, `redirectUri`, `version`, `createdAt`, and `updatedAt`. It never contains the client secret or encrypted values. Names contain 1 to 80 trimmed characters, client IDs 1 to 200, and secrets 1 to 4096. The callback is at most 1000 characters, uses HTTPS or HTTP loopback, and cannot include user information, a query, or a fragment. It belongs to the product server and must be registered exactly in GitHub.

Omitting `clientSecret` during an update retains the existing secret. Updating a connection increments its version, affects future uses of its live credential reference, and invalidates pending login attempts. Creation, updates, deletion, and generation are audited. Missing connections fail draft testing and publication.

Generation returns a normal saved draft and does not publish or issue a runtime key. REST uses POST with body and response rules, including nullable authorization/state/proof/expiry fields and a typed nullable identity. GraphQL exposes `Mutation.login` with `LoginAction` values `BEGIN` and `COMPLETE`, plus a harmless static `Query.info`. Both templates connect request, social, and response nodes. Social config is `{ "connectionId": "<id>" }`; the response body is `$auth`.

BEGIN returns nullable result fields `{ authorizationUrl, state, proof, expiresAt, identity }` with no identity yet. COMPLETE requires `code`, `state`, and the separate server-held `proof`, and returns identity `{ provider: "github", subject, username, name, avatarUrl }` with the other fields null. Attempts expire after ten minutes, are single-use, and bind the flow/revision, caller, and connection version. Published calls require the same flow-scoped runtime key for both actions; draft attempts bind the testing member. Provider tokens and client secrets are never returned. Product cookies, JWTs, accounts, email linking, and record authorization are not provided.

Replacing a runtime key does not transfer pending product login attempts. The new key cannot complete BEGIN attempts started by the old key; start a new attempt after replacement.

OAuth flows allow one social node and selected mutation operations allow one login root call. Pending attempts are limited to ten per credential/flow and a thousand total. Provider exchange permits four concurrent calls, a five-second overall deadline, and 64 KiB per provider response. Invalid action fields or attempts return 400, exhausted attempt/concurrency limits return 429, and provider failures return the generic 502 `GitHub login could not be completed`. GraphQL wraps execution failures in its standard errors envelope.

OpenAPI exports describe generated REST response rules and include 429/502 responses for flows containing a social node. Login lifecycle audits use `product-login.started`, `product-login.consumed`, and `product-login.completed` or `product-login.failed`; insertion/consumption commit with their events. Events contain caller scope and flow ID without sensitive attempt or provider values.

The product server keeps the runtime key and proof private, sends only the authorization URL to the browser, and handles GitHub's callback itself. See [GitHub product login](product-auth.md) for the complete setup and request examples, provider-verification limits, and separate encryption-key backup procedure.

## Update notices

These routes are owner-only, including for custom roles with all 15 action permissions. Cookie writes use the normal Origin/CSRF checks. Runtime keys cannot access them.

| Method | Path                 | Body / behavior                                                                                            |
| ------ | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/api/updates`       | Current application version, saved settings, and nullable cached last check                                |
| PUT    | `/api/updates`       | Exact `{ "repositoryUrl": "https://github.com/mysbryce/besh", "includePrereleases": true, "revision": 1 }` |
| POST   | `/api/updates/check` | Exact `{ "revision": 1 }`; manually check the saved repository                                             |

The response is `{ currentVersion, settings, lastCheck }`. Settings contain `repositoryUrl`, `includePrereleases`, `revision`, and nullable `updatedAt`. Defaults use the public Besh repository shown above, prereleases included, revision 1, and no last check. Saving valid settings increments their revision and clears `lastCheck`.

A check contains `checkedAt`, `status`, `release`, and `error`. Status is `available`, `current`, `no-releases`, or `error`. A release notice contains `version`, `tag`, `name`, `url`, nullable `publishedAt`, and `prerelease`. The checker selects the highest eligible semantic version from the first 20 returned public releases, excludes drafts, and follows the prerelease choice. `available` means that selected version is newer than the running `currentVersion`; it does not establish compatibility or publisher authenticity.

Only canonical HTTPS GitHub repository URLs are accepted; credentials, query strings, fragments, and arbitrary hosts are rejected. Requests go to the fixed official GitHub release-list endpoint without caller tokens, private-repository access, or redirects. The whole request is limited to five seconds; response headers to 64 entries and 32 KiB; the decoded body to 256 KiB. Stale revisions or an active check return `409`; a persistent 60-second cooldown returns `429`. Settings changes during a check discard its result and return `409`. Provider failures save generic `error` status without upstream response details.

Checks never download artifacts, install updates, alter the application version, or migrate workspace data. See [update notices](updates.md) for the **Updates** page and verification limits.

## Runtime keys

Use a member token with `runtime-keys.manage` to issue a key after publishing:

```http
POST /api/runtime-keys
Authorization: Bearer <key-manager-member-token>
Content-Type: application/json

{
  "name": "Greeting client",
  "flowId": "<published-flow-id>",
  "permissions": ["rest"],
  "expiresAt": "<future-ISO-8601-date-with-timezone>"
}
```

Issuance accepts exactly `name`, `flowId`, `permissions`, `expiresAt`, and optional `releaseRevision` and owner execution selector `tenantId`; unknown fields return `400`. To pin the key, add `releaseRevision` as a JSON number that is a positive safe integer equal to the flow's current published revision. Numeric strings are not converted. Selected issuers must provide the current pin (`400` if omitted) and satisfy API/USE authority; the server derives their binding. For unprotected targets, all-mode issuers can omit it for following behavior and ordinary unbound issuance; protected targets require a current pin and every non-owner derives current tenant/issuer authority; explicit `null`, strings, booleans, fractions, and unsafe integers return `400`. The current-publication check and insertion/audit are atomic. A stale/noncurrent pin, including a known flow with no publication, returns `409` before newer dependency or grant/protocol checks and without issuing a key or creation audit. An unpublished following target returns `400`; an unknown flow returns `404`.

Name must contain 1 to 80 characters after trimming. Expiration must be a future ISO date with timezone within 366 days. A REST flow accepts `rest`; a GraphQL flow accepts `query`, `mutation`, or both. Empty, duplicate, or protocol-incompatible grants are rejected. One key scopes to one published flow ID.

The response contains `id`, `name`, `flowId`, `permissions`, `expiresAt`, `createdAt`, `revokedAt: null`, required nullable `releaseRevision`, `issuerBinding`, and `tenantId`, and a one-time `token`. `GET /api/runtime-keys` returns the same metadata without tokens or hashes. Keys owned by load-test jobs additionally contain `managedBy: "load-test"`; ordinary caller keys omit it. These temporary keys are revoked automatically and cannot be replaced (`409`). Manual revocation is allowed and interrupts their caller access. Revocation returns `{ "ok": true }` and retains `revokedAt`. Repeating revocation succeeds; an unknown key returns `404`.

### Replace an active or dormant key

```http
POST /api/runtime-keys/<key-id>/rotate
Authorization: Bearer <key-manager-member-token>
```

Send no body or an empty JSON object `{}`. Any other body, including name, scope, grants, or expiration settings, returns `400`. Cookie-authenticated callers require the usual exact `Origin` and `X-Besh-CSRF` headers.

A successful `200` response uses the issuance response format above, with a new `id`, `createdAt`, and one-time `token`. It preserves the original `name`, `flowId`, `permissions`, required nullable `releaseRevision`, original `issuerBinding` and `tenantId`, and exact `expiresAt`. Replacement does not renew expiration or change grants. The old revocation, new hash-only key insertion, and `runtime-key.revoked` / `runtime-key.created` audit events commit in one transaction. Their resource IDs identify the old and new keys respectively; audit records contain no token or credential hash.

| Status | Meaning                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | Replacement committed; save the returned token once                                                                                           |
| `400`  | Body is neither omitted nor an empty object                                                                                                   |
| `401`  | Missing or invalid workspace management credentials                                                                                           |
| `403`  | Caller lacks `runtime-keys.manage`                                                                                                            |
| `404`  | Original key does not exist                                                                                                                   |
| `409`  | Key is revoked or expired, another replacement won, issuer authority is blocked, or grants no longer match the selected compatibility release |

Replacement also requires current actor authority and, for a bound key, original issuer authority. Following-key compatibility uses the current published release. Pinned-key compatibility uses the immutable pinned release, including when it is dormant; a missing pinned release returns `409` without replacement. Neither uses an edited draft. A failed replacement leaves the old key unchanged. Concurrent replacements allow only one winner. New requests using the old token return `401` immediately after the commit; requests already authenticated may finish.

Do not automatically retry after a lost response: the replacement may already have committed and its token cannot be fetched again. List key metadata to inspect the state, then revoke/create or replace an active replacement if its token was lost. For uninterrupted handover, manually create another key, update callers, and revoke the original; this route has no grace period. See [runtime API keys](api-keys.md) for the dashboard workflow.

Runtime keys cannot authenticate management routes. Built-in editor and viewer member tokens cannot manage keys; custom members require `runtime-keys.manage`. Owner and member tokens cannot invoke published endpoints. Missing, expired, or revoked runtime credentials return `401`; valid keys targeting another flow or an ungranted operation return `403`. GraphQL checks the selected query or mutation before flow execution. Grants do not filter fields or records.

Following keys (`releaseRevision: null`) accept the flow's current publication. A pinned key accepts only its exact revision while that revision is currently published; a mismatch at the current route returns `403` before typed input validation or effects. A removed old route returns `404`. Rollback to the exact pin restores access only while the key is unexpired and unrevoked. Pins do not execute archived releases, freeze mutable data/credentials, or add field/record policy. Review following-key grants before republishing broader behavior. Migration 6 adds runtime-key storage; it preserves published releases but intentionally ends member-token runtime access. Existing callers need new runtime credentials.

Migration 13 adds a nullable, positive integer `release_revision` column; existing keys remain following keys. Replacement retains that value and existing audit behavior. Restoring a backup restores that snapshot's key state and can reactivate a key revoked or replaced later. Review restored keys before resuming callers.

## Runtime

Published routes live at `/run` plus their configured path. All seven supported methods require a runtime API key with the `rest` grant for that flow. Paths are literal or use safe whole-segment parameters such as `/v1/items/:id`. Path and query values start as strings; optional REST rules convert declared numeric and boolean fields before execution. HEAD and status codes 204, 205 and 304 return no body.

```sh
curl 'http://127.0.0.1:3000/run/hello?name=Ada' \
  -H 'Authorization: Bearer YOUR_RUNTIME_API_KEY'
```

The test endpoint returns `{ "status": 200, "body": {}, "visited": ["start", "done"] }`. The runtime endpoint returns the configured body and HTTP status directly.

Flows may include optional `contract.params`, `contract.query`, `contract.body`, and `contract.response` schemas. REST draft tests and live calls enforce these rules; GraphQL uses its SDL contract. OpenAPI export describes the selected saved REST draft or immutable published release. See [API rules and OpenAPI](api-contracts.md) for the schema subset, validation behavior, and export boundary.

The GitHub social node performs only its bounded provider exchange and profile read. Database nodes read inspected uploaded SQLite copies. Arbitrary code, live external database access, SQL writes, general external HTTP request nodes, other social providers, WebSocket endpoints, and AI execution remain unimplemented. Workspace email/password and key sessions never replace runtime API keys.
