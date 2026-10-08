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

Create/update responses add `id`, `revision`, and `publishedRevision`. Save increments revision. Publish retains an immutable copy and atomically selects it for the live route. Route conflicts and stale revisions return `409`.

## Runtime

Published routes live at `/run` plus their configured path. All seven supported methods require a workspace token. Paths are exact; route parameters are not implemented. Query values are strings. HEAD and status codes 204, 205 and 304 return no body.

The test endpoint returns `{ "status": 200, "body": {}, "visited": ["start", "done"] }`. The runtime endpoint returns the configured body and HTTP status directly.

No arbitrary code, database access, external HTTP requests, social login, WebSocket endpoint, or AI execution is exposed in this version. OpenAPI export is planned.
