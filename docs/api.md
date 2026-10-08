# Core API

Management routes accept a workspace session cookie or `Authorization: Bearer <workspace-token>`. Cookie-authenticated writes require the exact browser `Origin` and `X-Besh-CSRF`; bearer management clients remain compatible without these headers. An explicit Authorization header takes precedence over cookies and never falls back after an invalid credential. Send JSON for request bodies. Responses use JSON except backup downloads. Error responses have `{ "error": "message" }`.

GraphQL runtime endpoints use the GraphQL `data`/`errors` envelope. See [GraphQL guide](graphql.md).

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

Login and restoration return `{ "member": { "id": "...", "name": "...", "role": "owner" }, "csrfToken": "...", "sessionId": "...", "expiresAt": "..." }`. The secret appears only in the `besh_session` HttpOnly, SameSite=Strict cookie, with Secure on HTTPS. Session expiration is fixed at 12 hours. Each member has at most 20 active sessions; the next successful login evicts the oldest transactionally and records an audit event.

Session metadata contains `id`, `memberId`, `memberName`, `createdAt`, `expiresAt`, `lastSeenAt`, and `current`. It excludes secrets, hashes, and payloads. Expired sessions are omitted. An unknown session ID returns `404`; revoking another member's session without owner permission returns `403`. Revoking the current session ends subsequent management access through that cookie.

Updating an account requires a current password or that same member's valid key in the request body, including for bearer clients. The update retains the current cookie session and revokes the member's others. A bearer-authenticated update has no current cookie session and revokes all that member's sessions. Duplicate email returns `409`; invalid proof returns `403`. The member key is unchanged.

Browser login requires the configured `BESH_WEB_URL` origin, or the request URL's exact origin when unset. Use HTTPS outside loopback; HTTP is allowed only for `localhost`, `127.0.0.1`, and `[::1]`. Reverse proxies must configure the public origin; forwarded headers are not trusted. Login limits persist across restarts: 10 invalid attempts per identity in five minutes, 100 total attempts in five minutes, and four concurrent verifications. A successful login clears its identity limit; exceeded limits return `429`. See [workspace accounts and sessions](workspace-auth.md).

## Workspace

| Method | Path                           | Permission / body                                                                     |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------- |
| GET    | `/api/me`                      | Any member                                                                            |
| GET    | `/api/flows`                   | Any member; full drafts and revision metadata                                         |
| GET    | `/api/flows/:id`               | Any member                                                                            |
| GET    | `/api/flows/:id/openapi`       | Any member; `source=draft` or `source=published` (default); saved REST snapshot only  |
| POST   | `/api/flows`                   | Owner/editor; flow definition                                                         |
| PUT    | `/api/flows/:id`               | Owner/editor; flow definition plus current `revision`                                 |
| POST   | `/api/flows/:id/test`          | Owner/editor; `{ "body": {}, "query": {} }`                                           |
| POST   | `/api/flows/:id/graphql/test`  | Owner/editor; GraphQL `{ "query": "...", "variables": {}, "operationName": "..." }`   |
| POST   | `/api/flows/:id/publish`       | Owner; `{ "revision": 1 }`                                                            |
| GET    | `/api/members`                 | Owner; no credential hashes or tokens                                                 |
| POST   | `/api/members`                 | Owner; `{ "name": "Reader", "role": "viewer" }`; role may be `editor`                 |
| DELETE | `/api/members/:id`             | Owner; cannot remove bootstrap owner                                                  |
| GET    | `/api/runtime-keys`            | Owner; key metadata, including revoked keys; no tokens or hashes                      |
| POST   | `/api/runtime-keys`            | Owner; name, published flow ID, grants, expiration; returns the token once            |
| POST   | `/api/runtime-keys/:id/rotate` | Owner; replaces an active key with identical scope and expiration; returns token once |
| DELETE | `/api/runtime-keys/:id`        | Owner; immediate revocation; retains metadata                                         |
| GET    | `/api/audit`                   | Owner; latest 200 events, newest first                                                |
| GET    | `/api/migrations`              | Owner; schema versions in applied order                                               |
| GET    | `/api/backups`                 | Owner; local backup metadata                                                          |
| POST   | `/api/backups`                 | Owner; creates snapshot                                                               |
| GET    | `/api/backups/:id`             | Owner; SQLite download                                                                |

Drafts may be incomplete. Publishing and testing require one request node, reachable nodes, valid edges, and a response at every terminal path. Conditions require exactly one `true` and one `false` edge. Cycles are rejected.

Member creation also accepts optional `email` and `password` together, using the same account rules as setup. It still returns a member key once. Member listing exposes only member ID, name, and role; members read their own email through `/api/account`. No invitation email is sent. Removing a member cascades to its account and sessions.

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

Create/update responses add `id`, `revision`, `publishedRevision`, and `publishedEndpoint`. The last field is `null` before publication; otherwise it contains the live release's `method`, `path`, and GraphQL flag separately from editable draft settings. Save increments revision. Publish retains an immutable copy and atomically selects it for the live route. Route conflicts and stale revisions return `409`.

## Spreadsheet data sources

All source routes require an authenticated owner or editor, using a workspace session or member token. Viewers and runtime API keys cannot list, preview, import, refresh, generate, or delete sources.

| Method | Path                              | Body / behavior                                                                   |
| ------ | --------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/api/data-sources`               | Source metadata array                                                             |
| GET    | `/api/data-sources/:id`           | Metadata plus first 10 rows                                                       |
| POST   | `/api/data-sources/import`        | Multipart `name` and CSV/XLSX `file`; imports a snapshot                          |
| POST   | `/api/data-sources/google-sheets` | JSON `{ "name": "Products", "url": "<public-sheet-share-link>" }`                 |
| PUT    | `/api/data-sources/:id/import`    | Multipart `file` and optional `name`; replaces an uploaded snapshot               |
| POST   | `/api/data-sources/:id/refresh`   | Re-fetches a public Google source                                                 |
| POST   | `/api/data-sources/:id/api`       | JSON name, path, protocol, columns, limit, optional filter; returns a saved draft |
| DELETE | `/api/data-sources/:id`           | Returns `{ "ok": true }`; referenced draft/published source returns `409`         |

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

Protocol is `rest` or `graphql`; limit is 1 to 100. Filter is optional and performs one equality comparison. Omitting the optional caller value returns all eligible rows up to the limit. Filters help callers search; they do not enforce authorization. The returned flow contains a `data` node with `{ sourceId, columns, limit, filter? }` and a response body reference `$data`. REST filters read query input; generated GraphQL filters read typed root arguments. Publication and runtime-key issuance remain separate owner actions.

Reads use the latest source snapshot. Replacement/refresh changes live data without publishing a new graph revision. Migration 7 stores source snapshots and audit changes. See [data sources](data-sources.md) for formats, limits, and private-sheet restrictions.

## Product login connections

Connection metadata and draft generation require an authenticated owner or editor. Owners alone create, edit, or delete connections. Viewers and runtime keys have no connection-management access. Cookie writes use the usual Origin and CSRF checks.

| Method | Path                                 | Body / behavior                                                                                                                          |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/auth-connections`              | Owner/editor; metadata array                                                                                                             |
| POST   | `/api/auth-connections`              | Owner; `{ "name": "Product GitHub", "provider": "github", "clientId": "<id>", "clientSecret": "<secret>", "redirectUri": "<callback>" }` |
| PUT    | `/api/auth-connections/:id`          | Owner; `{ "name": "Product GitHub", "clientId": "<id>", "redirectUri": "<callback>", "clientSecret": "<optional-replacement>" }`         |
| DELETE | `/api/auth-connections/:id`          | Owner; `{ "ok": true }`; a connection referenced by a draft or release returns `409`                                                     |
| POST   | `/api/auth-connections/:id/generate` | Owner/editor; `{ "name": "GitHub login", "path": "/login/github", "kind": "rest" }`; `kind` also accepts `graphql`                       |

Metadata contains `id`, `name`, `provider: "github"`, `clientId`, `redirectUri`, `version`, `createdAt`, and `updatedAt`. It never contains the client secret or encrypted values. Names contain 1 to 80 trimmed characters, client IDs 1 to 200, and secrets 1 to 4096. The callback is at most 1000 characters, uses HTTPS or HTTP loopback, and cannot include user information, a query, or a fragment. It belongs to the product server and must be registered exactly in GitHub.

Omitting `clientSecret` during an update retains the existing secret. Updating a connection increments its version, affects future uses of its live credential reference, and invalidates pending login attempts. Creation, updates, deletion, and generation are audited. Missing connections fail draft testing and publication.

Generation returns a normal saved draft and does not publish or issue a runtime key. REST uses POST with body and response rules, including nullable authorization/state/proof/expiry fields and a typed nullable identity. GraphQL exposes `Mutation.login` with `LoginAction` values `BEGIN` and `COMPLETE`, plus a harmless static `Query.info`. Both templates connect request, social, and response nodes. Social config is `{ "connectionId": "<id>" }`; the response body is `$auth`.

BEGIN returns nullable result fields `{ authorizationUrl, state, proof, expiresAt, identity }` with no identity yet. COMPLETE requires `code`, `state`, and the separate server-held `proof`, and returns identity `{ provider: "github", subject, username, name, avatarUrl }` with the other fields null. Attempts expire after ten minutes, are single-use, and bind the flow/revision, caller, and connection version. Published calls require the same flow-scoped runtime key for both actions; draft attempts bind the testing member. Provider tokens and client secrets are never returned. Product cookies, JWTs, accounts, email linking, and record authorization are not provided.

Replacing a runtime key does not transfer pending product login attempts. The new key cannot complete BEGIN attempts started by the old key; start a new attempt after replacement.

OAuth flows allow one social node and selected mutation operations allow one login root call. Pending attempts are limited to ten per credential/flow and a thousand total. Provider exchange permits four concurrent calls, a five-second overall deadline, and 64 KiB per provider response. Invalid action fields or attempts return 400, exhausted attempt/concurrency limits return 429, and provider failures return the generic 502 `GitHub login could not be completed`. GraphQL wraps execution failures in its standard errors envelope.

OpenAPI exports describe generated REST response rules and include 429/502 responses for flows containing a social node. Login lifecycle audits use `product-login.started`, `product-login.consumed`, and `product-login.completed` or `product-login.failed`; insertion/consumption commit with their events. Events contain caller scope and flow ID without sensitive attempt or provider values.

The product server keeps the runtime key and proof private, sends only the authorization URL to the browser, and handles GitHub's callback itself. See [GitHub product login](product-auth.md) for the complete setup and request examples, provider-verification limits, and separate encryption-key backup procedure.

## Runtime keys

Use an owner member token to issue a key after publishing:

```http
POST /api/runtime-keys
Authorization: Bearer <owner-token>
Content-Type: application/json

{
  "name": "Greeting client",
  "flowId": "<published-flow-id>",
  "permissions": ["rest"],
  "expiresAt": "<future-ISO-8601-date-with-timezone>"
}
```

Name must contain 1 to 80 characters after trimming. Expiration must be a future ISO date with timezone within 366 days. A REST flow accepts `rest`; a GraphQL flow accepts `query`, `mutation`, or both. Empty, duplicate, or protocol-incompatible grants are rejected. One key scopes to one published flow ID.

The response contains `id`, `name`, `flowId`, `permissions`, `expiresAt`, `createdAt`, `revokedAt: null`, and a one-time `token`. `GET /api/runtime-keys` returns the same metadata without tokens or hashes. Revocation returns `{ "ok": true }` and retains `revokedAt`. Repeating revocation succeeds; an unknown key returns `404`.

### Replace an active key

```http
POST /api/runtime-keys/<key-id>/rotate
Authorization: Bearer <owner-token>
```

Send no body or an empty JSON object `{}`. Any other body, including name, scope, grants, or expiration settings, returns `400`. Cookie-authenticated callers require the usual exact `Origin` and `X-Besh-CSRF` headers.

A successful `200` response uses the issuance response format above, with a new `id`, `createdAt`, and one-time `token`. It preserves the original `name`, `flowId`, `permissions`, and exact `expiresAt`. Replacement does not renew expiration or change grants. The old revocation, new hash-only key insertion, and `runtime-key.revoked` / `runtime-key.created` audit events commit in one transaction. Their resource IDs identify the old and new keys respectively; audit records contain no token or credential hash.

| Status | Meaning                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| `200`  | Replacement committed; save the returned token once                                                                |
| `400`  | Body is neither omitted nor an empty object                                                                        |
| `401`  | Missing or invalid workspace management credentials                                                                |
| `403`  | Authenticated caller is not an owner                                                                               |
| `404`  | Original key does not exist                                                                                        |
| `409`  | Key is revoked or expired, another replacement won, or its grants no longer match the currently published API type |

Compatibility uses the current published release, not an edited draft. A failed replacement leaves the old key unchanged. Concurrent replacements allow only one winner. New requests using the old token return `401` immediately after the commit; requests already authenticated may finish.

Do not automatically retry after a lost response: the replacement may already have committed and its token cannot be fetched again. List key metadata to inspect the state, then revoke/create or replace an active replacement if its token was lost. For uninterrupted handover, manually create another key, update callers, and revoke the original; this route has no grace period. See [runtime API keys](api-keys.md) for the dashboard workflow.

Runtime keys cannot authenticate management routes. Editor and viewer member tokens cannot manage keys. Owner and member tokens cannot invoke published endpoints. Missing, expired, or revoked runtime credentials return `401`; valid keys targeting another flow or an ungranted operation return `403`. GraphQL checks the selected query or mutation before flow execution. Grants do not filter fields or records.

Keys follow the flow's published revisions rather than pinning one release. Review grants before republishing broader behavior. Migration 6 adds runtime-key storage; it preserves published releases but intentionally ends member-token runtime access. Existing callers need new runtime credentials.

Replacement uses the existing key and audit tables without a schema migration. Restoring a backup restores that snapshot's key state and can reactivate a key revoked or replaced later. Review restored keys before resuming callers.

## Runtime

Published routes live at `/run` plus their configured path. All seven supported methods require a runtime API key with the `rest` grant for that flow. Paths are exact; route parameters are not implemented. Query values start as strings; optional REST rules convert declared numeric and boolean fields before execution. HEAD and status codes 204, 205 and 304 return no body.

```sh
curl 'http://127.0.0.1:3000/run/hello?name=Ada' \
  -H 'Authorization: Bearer YOUR_RUNTIME_API_KEY'
```

The test endpoint returns `{ "status": 200, "body": {}, "visited": ["start", "done"] }`. The runtime endpoint returns the configured body and HTTP status directly.

Flows may include optional `contract.query`, `contract.body`, and `contract.response` schemas. REST draft tests and live calls enforce these rules; GraphQL uses its SDL contract. OpenAPI export describes the selected saved REST draft or immutable published release. See [API rules and OpenAPI](api-contracts.md) for the schema subset, validation behavior, and export boundary.

The GitHub social node performs only its bounded provider exchange and profile read. Arbitrary code, database access, general external HTTP request nodes, other social providers, WebSocket endpoints, and AI execution remain unimplemented. Workspace email/password and key sessions never replace runtime API keys.
