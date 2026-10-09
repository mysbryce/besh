# WebSocket APIs

Implemented in 0.12: authenticated typed request/reply with exact generated routes and beginner forms. Complete delivery evidence belongs in [testing](testing.md). Events, subscriptions, reconnect/replay, WS client-code exports, and WS k6 targets remain planned.

## Build a message API

1. Open API Studio and choose **WebSocket**. Review and confirm conversion when changing another protocol.
2. Choose a static endpoint such as `/v1/messages`. Parameters, wildcards, encoded paths, and ambiguous ticket-route overlaps are rejected.
3. Define **Received fields** and **Reply fields** with forms. Messages are flat objects; replies are a flat object or at most 100 flat rows. Nested messages and scalar replies are outside this slice.
4. Choose allowed browser origins for the published API. Enter exact HTTP(S) origins, without paths or wildcards. An empty list permits authenticated native clients without Origin only.
5. Use **Receive message → Send reply** for an echo, or **Receive message → one source/SQLite read → Send reply** for rows. Reply uses the message or selected data internally; branches, writes, social effects, and literal responses are unsupported.
6. Save. Use **Connect draft**, fill message fields, **Send message**, inspect the reply, and **Disconnect draft**. Publish separately when reviewed.

Supported generated REST reads can be converted through review. Flat response rules become row reply fields; declared query fields become received message fields, and a reviewed simple query filter moves to the message body. Columns, limits, and graph edges remain. Unsupported shapes require preparation instead of guessed schema or private data fetches. Canceling conversion preserves current changes. A saved conversion does not change an older live REST or GraphQL publication.

Browser testing needs both **Read APIs** and **Test APIs**, a clean saved draft, current dependency USE, and tenant review where required. Native management clients with only Test APIs can use an owner-provided API ID/revision without reading its graph. Their original member key remains the proof. Editing, navigation, sign-out, or changed access ends the test connection. A stale ticket request disables reconnection until explicit **Refresh saved draft** and review. Tests do not publish.

## Published routes and credentials

Publishing generates trusted compiler-two code registering an actual exact `app.ws('/ws/<path>', ...)` and `POST /ws/<path>/ticket`. Exact ordinary-HTTP rejection handlers return 426 after proof checks; they never execute a message graph. Existing `/run` REST and `/graphql` endpoints remain separate namespaces. No wildcard path-to-flow database lookup is used. See [generated backend code](runtime-code.md).

Issue a dedicated caller key with `permissions: ['ws']`, the current `releaseRevision`, and an expiration. A current pin is mandatory for every WS key. REST/query/mutation grants cannot open it, and workspace credentials cannot open a published endpoint. Selected/protected issuance preserves original issuer/action/API/USE and server-derived tenant identity.

Native/server clients send `Authorization: Bearer <runtime-key>` on upgrade. Origin may be omitted; if present it must match an approved origin. Use WSS outside loopback. Bun supports custom headers in its native client; ordinary browsers do not. See the official [Bun client documentation](https://bun.sh/docs/runtime/http/websockets#connect-to-a-websocket-server).

## Browser tickets

The product server keeps its runtime key private and authorizes the recipient before handing out a ticket:

1. Call `POST /ws/<path>/ticket` with the runtime bearer header and exact `{ revision, origin }`.
2. Receive `{ ticket, expiresAt, revision, path, protocol: 'besh.ws.v1' }`. The opaque nonce expires within 30 seconds, or earlier with the original key. Only its hash is stored.
3. Give the ticket to the authorized browser. Keep it in memory and offer subprotocols `besh.ws.v1` and `besh.ticket.<ticket>`. The response selects only `besh.ws.v1`.

No token in the URL, query, fragment, storage, copied source, or audit payload. Upgrades reject query fields. Consumption is atomic in shared SQLite: one native peer wins; replay denies. Wrong Origin, wrong family/release, malformed/duplicate protocols, missing original proof, and invalid explicit Authorization deny. Explicit Authorization chooses bearer mode and never falls back to a ticket or cookie. A quota-denied attempt does not consume the ticket.

A ticket delegates the original key's entire flow/tenant authority. It is not a product session or proof of the recipient's identity. A stolen unused ticket can win its race. Recipient authorization belongs to the product server; the broker must not distribute tickets publicly.

Draft tickets use separate management routes:

| Method | Path                            | Input                                                           |
| ------ | ------------------------------- | --------------------------------------------------------------- |
| POST   | `/api/flows/:id/ws/test-ticket` | Exact `{ revision, tenantId? }`; owner tenant selector only     |
| WS     | `/api/flows/:id/ws/test`        | Ticket subprotocol plus its original workspace proof and Origin |

Cookie minting requires current sign-in, exact workspace Origin, and CSRF. Upgrade must retain that exact original live cookie/session; another login, another member, or a bearer header cannot replace it. Native member-key tickets require the exact original current key hash. Draft and published tickets never substitute for one another. Draft Origin follows workspace configuration, independently of published allowed origins.

## Message format

Send UTF-8 JSON objects only:

```json
{ "id": "request-1", "body": { "customer": "Ada" } }
```

Success is `{ id, result }`. Validation/execution failures return generic `{ id, error }` without submitted values, private rows, credentials, or stack traces. IDs contain 1–64 Unicode characters without controls; they are not identity or replay guarantees. Unknown envelope fields, binary frames, primitives, and invalid values deny. Submitted bodies/replies are not persisted as audit payloads.

The dashboard permits one in-flight request, bounds messages and reply bytes, and retains at most five replies in memory. Disconnect clears replies. Received fields use labeled scalar controls; advanced schema/JSON is optional.

## Connection bounds

These are enforced/configured safeguards, not measured production capacity:

| Boundary                       | Limit                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| Incoming frame / outgoing JSON | 32 KiB / 64 KiB                                                          |
| Concurrent graph work          | One per connection; reject busy attempts, no execution queue             |
| Message attempts               | Five per second, including malformed attempts                            |
| Buffered native output         | 128 KiB; close on backpressure                                           |
| Idle / total lifetime          | 30 seconds / five minutes, or earlier original credential/session expiry |
| Connections                    | 100 per Bun process, ten per flow, three per original proof/key          |
| Outstanding tickets            | 256 in shared SQLite, eight per original proof                           |
| Pending upgrade reservation    | Three seconds                                                            |
| Idle authority sweep           | One second                                                               |

Compression is disabled. Existing graph, SQLite reader, allocation, output, deadline, and process-concurrency limits still apply. Native send results are handled without retrying an already queued frame. Server/client close frees counters, timers, and in-flight reads. Connection quotas are process-local; they are not distributed limits or scaling certification. Native closure codes for oversized incoming frames can differ; installed Bun was observed returning 1006 before an application reply.

## Current authority and recovery

Every frame and idle sweep checks the original current credential/session, grant, published pin or saved-draft revision, issuer/action/API/USE, approved assignment, and tenant state. Private identity stays outside submitted input. Resource policy mode/version is captured at admission and checked again before execution and send; policy changes end the connection. Mutable source refreshes between messages remain allowed. Existing per-operation checks still deny a refresh or policy change during a pending read before returning its rows.

The 0.13 API field allowlist uses that same resource policy version. A field update ends affected draft/published connections, including when their graph still uses allowed fields; pending reads are canceled and failed final checks send no rows. Both configured returned columns and business filters must be allowed for a new protected connection, including owner tests and original pinned callers. The private tenant predicate may use an excluded column. Restoring allowed fields permits a fresh connection to the same publication; it does not revive closed sockets or rewrite message rules. See [API field allowlists](row-protection.md#api-field-allowlists) and [testing](testing.md) for current acceptance status. Queued/delivered bytes still cannot be recalled.

Publication/rollback closes affected old-revision connections only after commit. Publishing another API leaves unchanged connections and their tickets usable. Exact rollback can admit a new connection with its still-valid original pin; it does not revive a closed connection. Failed staging preserves previous routes/connections, or runtime blocks with 503 if restoration fails. Peer changes take current checks and bounded sweep time; already delivered or queued bytes cannot be recalled.

Startup reconstructs exact routes in a fresh private code directory, verifies retained compiler-one artifacts with their trusted renderer, and creates compiler-two artifacts from validated graphs. Unknown/corrupt artifacts and conflicting helper routes fail closed. Migration 18 adds three-way transport indexing and hash-only tickets while preserving older release/key defaults. Stored generated JavaScript is never executed as trusted uploaded code.

Tickets are purged once at service startup, never on ordinary router rebuild. Restart or downloaded-backup restoration invalidates outstanding tickets; request a fresh one. A joining peer can invalidate another peer's pending tickets, while established connections remain unaffected. Ordinary backups contain credential state and require the existing protection/owner rules; see [recovery](getting-started.md#data-and-recovery).

Shutdown closes connections and aborts readers before awaiting native server stop. Actual signal, process, backup, cross-peer, reader, browser, and deadline observations are recorded separately in [testing](testing.md); configured limits alone do not prove their complete deployment behavior.

## Separate future work

OpenAPI and the eight HTTP [client-code targets](client-code.md) reject a WS source explicitly. If an edited WS draft still has a live REST release, published HTTP tools remain available for that release. Built-in [k6 targets](load-testing.md) exclude WS until dedicated WS scripts, metrics, and lifecycle acceptance exist.

Plain request/reply is not GraphQL subscriptions. Subscriptions need an event source/async iterator, a defined protocol, per-event authorization, disconnect/replay rules, and separate tests. See the official [GraphQL subscription guide](https://graphql.org/learn/subscriptions/) and [roadmap](roadmap.md#next-steps).
