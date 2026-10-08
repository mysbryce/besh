# Core API

Management routes use `Authorization: Bearer <workspace-token>`. Send JSON for request bodies. Responses use JSON except backup downloads. Error responses have `{ "error": "message" }`.

GraphQL runtime endpoints use the GraphQL `data`/`errors` envelope. See [GraphQL guide](graphql.md).

## Setup

| Method | Path            | Behavior                                                                          |
| ------ | --------------- | --------------------------------------------------------------------------------- |
| GET    | `/health`       | Health and application version                                                    |
| GET    | `/setup/status` | Whether setup is needed and workspace name                                        |
| POST   | `/setup`        | `{ "key": "server-setup-key", "name": "My workspace" }`; returns owner token once |

Setup needs the challenge from the local server terminal. It returns `409` once an owner exists. Changing the environment setup key does not reopen an existing workspace.

## Workspace

| Method | Path                          | Permission / body                                                                   |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/api/me`                     | Any member                                                                          |
| GET    | `/api/flows`                  | Any member; full drafts and revision metadata                                       |
| GET    | `/api/flows/:id`              | Any member                                                                          |
| POST   | `/api/flows`                  | Owner/editor; flow definition                                                       |
| PUT    | `/api/flows/:id`              | Owner/editor; flow definition plus current `revision`                               |
| POST   | `/api/flows/:id/test`         | Owner/editor; `{ "body": {}, "query": {} }`                                         |
| POST   | `/api/flows/:id/graphql/test` | Owner/editor; GraphQL `{ "query": "...", "variables": {}, "operationName": "..." }` |
| POST   | `/api/flows/:id/publish`      | Owner; `{ "revision": 1 }`                                                          |
| GET    | `/api/members`                | Owner; no credential hashes or tokens                                               |
| POST   | `/api/members`                | Owner; `{ "name": "Reader", "role": "viewer" }`; role may be `editor`               |
| DELETE | `/api/members/:id`            | Owner; cannot remove bootstrap owner                                                |
| GET    | `/api/runtime-keys`           | Owner; key metadata, including revoked keys; no tokens or hashes                    |
| POST   | `/api/runtime-keys`           | Owner; name, published flow ID, grants, expiration; returns the token once          |
| DELETE | `/api/runtime-keys/:id`       | Owner; immediate revocation; retains metadata                                       |
| GET    | `/api/audit`                  | Owner; latest 200 events, newest first                                              |
| GET    | `/api/migrations`             | Owner; schema versions in applied order                                             |
| GET    | `/api/backups`                | Owner; local backup metadata                                                        |
| POST   | `/api/backups`                | Owner; creates snapshot                                                             |
| GET    | `/api/backups/:id`            | Owner; SQLite download                                                              |

Drafts may be incomplete. Publishing and testing require one request node, reachable nodes, valid edges, and a response at every terminal path. Conditions require exactly one `true` and one `false` edge. Cycles are rejected.

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

All source routes require an owner or editor member token. Viewers and runtime API keys cannot list, preview, import, refresh, generate, or delete sources.

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

Runtime keys cannot authenticate management routes. Editor and viewer member tokens cannot manage keys. Owner and member tokens cannot invoke published endpoints. Missing, expired, or revoked runtime credentials return `401`; valid keys targeting another flow or an ungranted operation return `403`. GraphQL checks the selected query or mutation before flow execution. Grants do not filter fields or records.

Keys follow the flow's published revisions rather than pinning one release. Review grants before republishing broader behavior. Migration 6 adds runtime-key storage; it preserves published releases but intentionally ends member-token runtime access. Existing callers need new runtime credentials.

## Runtime

Published routes live at `/run` plus their configured path. All seven supported methods require a runtime API key with the `rest` grant for that flow. Paths are exact; route parameters are not implemented. Query values are strings. HEAD and status codes 204, 205 and 304 return no body.

```sh
curl 'http://127.0.0.1:3000/run/hello?name=Ada' \
  -H 'Authorization: Bearer YOUR_RUNTIME_API_KEY'
```

The test endpoint returns `{ "status": 200, "body": {}, "visited": ["start", "done"] }`. The runtime endpoint returns the configured body and HTTP status directly.

No arbitrary code, database access, external HTTP requests, social login, WebSocket endpoint, or AI execution is exposed in this version. OpenAPI export is planned.
