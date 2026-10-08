# Planned WebSocket APIs

This is the next-slice design, not an implemented feature. It follows the implemented [tenant-read delivery](row-protection.md). The first WebSocket slice is authenticated, typed request/reply over an exact generated route. Broadcasts, external event sources, durable delivery, and GraphQL subscriptions remain separate work. Proposed wire names and limits need public tests before becoming a supported contract.

## Visual API and wire

Add a third **API type**: REST, GraphQL, or WebSocket. A central transport resolver must replace current `graphql`-versus-REST decisions across publication, endpoint metadata, keys, exports, callers, and load targets. Proposed saved flow metadata adds exclusive `websocket: { input, output, allowedOrigins }`; it cannot coexist with GraphQL SDL or REST rules. Old flows remain REST/GraphQL unchanged. Input is a typed object. Output is a typed object or an array of flat row objects, so canonical protected `$data` arrays remain usable. Deliberately reuse Besh’s bounded rule validators/forms rather than executable schemas; scalar outputs, branches, and social effects are outside this slice.

Publish trusted canonical code registering `app.ws('/ws/<exact-path>', trustedOptions)`, plus the reviewed ticket route. Start with static literal paths, without parameters, wildcards, or path-to-flow SQL dispatch; existing REST parameters keep their current meaning. Non-upgrade HTTP requests must fail explicitly rather than execute the graph. Artifacts, endpoint transport, revision/hash guards, rollback, and restart reconstruction must include this protocol. Planned trusted helper seams are `runtime.websocket(release, generation)` returning route options and `runtime.websocketTicket(release, generation, request, body)` returning JSON. Reject uncanonical/encoded WS paths rather than cloning or rewriting the native upgrade request; the first peer request after router refresh must redispatch the same original Request. Elysia documents [route registration and lifecycle hooks](https://elysiajs.com/patterns/websocket).

The beginner form chooses **WebSocket**, an endpoint, allowed browser origins, received fields, and an object or flat-row-list reply with its fields. Proposed node labels are **Receive message** and **Send reply**. The first supported graphs are request → response echoing `$input.body`, or request → one read → response `$data`. Response status is fixed at `200` internally; it is not an HTTP status sent for each frame. Protected reads obey the canonical tenant shape; no mixed/branch/social/literal graphs, writes, or arbitrary JavaScript.

Only UTF-8 JSON object messages are accepted:

```json
{ "id": "request-1", "body": { "customer": "Ada" } }
```

Success replies use `{ id, result }`; validation/execution failures use a generic `{ id, error }` without submitted values, private rows, stack traces, or credentials. The request ID is bounded text, not an identity or replay guarantee. Strict envelopes reject unknown fields and binary/primitive messages. Do not persist message bodies or results as audit payloads. The draft form can connect, send one example, inspect a reply, and disconnect without exposing runtime credentials.

## Handshake and identity

Introduce a dedicated runtime operation grant, proposed `ws`. REST/query/mutation grants cannot open this transport. Require a reviewed current-release pin for every initial WebSocket key. Authenticated native/server clients send the runtime bearer header on upgrade; use WSS outside loopback. Published upgrades reject workspace/member credentials and do not borrow workspace cookies.

Browsers cannot use Bun's custom-header client extension. Bun documents [this distinction](https://bun.sh/docs/runtime/http/websockets#connect-to-a-websocket-server). Proposed browser transport therefore uses a short-lived, one-use ticket:

1. The product server calls the generated `POST /ws/<path>/ticket` with its runtime bearer key and exact `{ revision, origin }`. This mint route always requires bearer proof; a ticket or cookie cannot substitute. The owner selects protected tenant identity during key issuance, not ticket minting.
2. Besh stores only a ticket hash, bound to key/flow/release/issuer/tenant and the exact approved browser origin. Proposed expiry is 30 seconds, never later than the key's expiry. Consumption is atomic in shared SQLite.
3. The product server gives the ticket to its authorized recipient. The browser keeps it in memory and offers subprotocols `besh.ws.v1` and `besh.ticket.<token>` during upgrade. The response selects only `besh.ws.v1`, never echoes the ticket. No credential in URL, local storage, logs, or copied source.

A planned `websocketNamespace(request)` guard runs before router refresh. It checks bearer/ticket proof format, hash existence, deadline, and original credential liveness only. It must not compare pin/revision/graph against a stale cached map, consume a ticket, reserve quota, or query paths/flow definitions. Explicit Authorization, including empty/malformed values, selects bearer mode and denies fallback; duplicate/malformed ticket protocols also deny admission. Then refresh the published router/map and redispatch the same original Request.

The exact upgrade hook requires genuine native upgrade headers before consuming a nonce or reserving quota. Its short transaction checks current persisted epoch/transport index, grant/pin, original issuer/action/API/USE, tenant, and Origin. Ticket consumption, deadline/proof/binding checks, and local quota admission must form one IMMEDIATE transaction with atomic DELETE consumption: one winner across peers. Proposed outstanding-ticket limits are 256 globally and eight per original proof, with expiry cleanup. These are bounded admission rules, not capacity guarantees.

Initialize the ticket service once before router attachment and purge saved tickets transactionally at that point, never inside the router factory/reload. After restoration/startup, both consumed and previously unused saved tickets must be unusable; a fresh mint must work. A joining peer can invalidate another peer’s pending tickets, requiring a new mint, while existing sockets remain unaffected. Make that retry boundary explicit.

The ticket delegates the original key's entire flow/tenant authority. It is not a product session or proof of who the recipient is. The product server must authorize the recipient before handing it out; a stolen unused ticket can win its one-use race. No raw runtime-key entry belongs in the browser form. Explicit invalid bearer credentials never fall back to a ticket or cookie.

Browser upgrades require an exact approved `Origin`, with no wildcard or reflected origin. Native upgrades may omit Origin, but an explicit Origin must satisfy the same policy. Origin approval does not replace credentials. Ticket minting/consumption must enforce origin, current publication/pin, credential expiry/revocation, original issuer/action/API/USE, and active approved tenant assignment. Every non-owner derives assigned tenant; no identity header/message/query/picker. Every frame must read current key authority even for independent unbound keys; a cached handshake or HTTP legacy-issuer shortcut cannot skip fresh expiry/revocation checks.

Proposed draft wires are `POST /api/flows/:id/ws/test-ticket` with exact `{ revision, tenantId? }`, then fixed upgrade `/api/flows/:id/ws/test`. The receipt is `{ ticket, expiresAt, revision, path, protocol: 'besh.ws.v1' }`, without graph, private principal, or underlying token metadata.

Draft testing needs a separate management-authorized ticket bound to the member/session, saved draft revision, API test action, USE, and current tenant principal. Owner tests review identity; other members use assignment. Cookie minting retains exact Origin/CSRF protections. Draft tickets never authenticate a published endpoint, and session logout/revocation denies subsequent draft frames. A session ticket must match its original live cookie, session ID, member, and workspace Origin; optional explicit Authorization can identify only that same member and cannot substitute for the missing original cookie. A member-key draft ticket requires the exact original native bearer hash/current member key plus matching ticket/Origin, without cookie fallback. Keep these proof modes explicit rather than silently changing one into the other.

## Bounded connection lifecycle

These numbers are design proposals, not measured capacity or final defaults:

| Boundary                       | Proposed first limit                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| Incoming frame / outgoing JSON | 32 KiB / 64 KiB                                                            |
| Request ID                     | 64 characters                                                              |
| Concurrent work per socket     | One graph execution; reject busy frames, no execution queue                |
| Message rate                   | Five per second, with a small bounded burst                                |
| Buffered output                | 128 KiB; close on backpressure rather than queue without bounds            |
| Idle / total lifetime          | 30 seconds / five minutes, or earlier underlying credential/session expiry |
| Connections                    | 100 per Bun process, ten per flow, three per key                           |
| Idle authority check           | Bounded one-second sweep                                                   |

Disable compression initially. Account for sockets being opened concurrently before admitting them; counters, busy slots, timers, and aborted reads must be released on every close/failure path. These quotas are process-local, not distributed limits. A bounded pending reservation timeout must release a slot if native upgrade fails after the hook. An already consumed nonce stays consumed; retry requires a fresh mint. Existing graph/SQLite deadline, allocation, output, and process-reader budgets still apply. Bun documents [message limits, idle timeouts, and send/backpressure results](https://bun.sh/docs/runtime/http/websockets); browser buffering also needs an explicitly bounded UI history.

A runtime-owned connection registry must survive router replacement. Check current generation, publication/protocol, key pin/expiry/revocation, issuer/action/API/USE, tenant assignment/state, and resource policy before message validation/effects. Carry a private principal outside ordinary input. Recheck around asynchronous work and before sending a result; failed final authorization sends no protected row result. Closing a socket aborts its native reader. Idle sockets need periodic checks so authority loss cannot leave them authorized indefinitely.

Publication/rollback closes affected old-revision sockets only after successful commit. A global generation change for another flow must not close an unchanged socket. After refreshing the global counter/router, compare this flow’s current in-memory revision and transport; transactionally check admission against the persisted epoch/transport index. Install the committed map before a no-throw registry notification closes only changed or missing published flows, not every connection. Isolate each close error so it cannot turn a committed publication into a reported failure; the one-second authority sweep is the cleanup fallback. A matching rollback may permit a new connection with an unexpired/unrevoked pin; it does not revive a closed socket. Caught staging/activation failure must preserve the previous router and admitted sessions, or block runtime fail-closed when restoration fails. Cross-peer changes need current message checks and bounded idle cleanup; there is no instantaneous distributed kill or activation guarantee. Bytes already enqueued/delivered cannot be recalled.

Shutdown must close/drain sockets and cancel reads before awaiting server stop, with a bounded force-close path. Timers and sockets must not keep the process alive. Bun's [server reload and stop documentation](https://bun.sh/docs/runtime/http/server) describes the APIs; their interaction with generated Elysia handlers on the installed runtime still requires native proof.

## Installed-source traps and proof gates

The repository uses Elysia `1.4.30`, Bun `1.3.14` for validation, and newer installed Bun type declarations. Source inspection is not native WebSocket verification. Do not assume a feature visible in current docs/types works on the pinned runtime.

Installed Elysia automatically parses JSON and coerces numeric/boolean/null strings before its custom message parser/handler. Its default message-validation path can send `ValidationError.message`; that path must not disclose submitted values or precede Besh's current authority check. Use strict object envelopes and a Besh-owned generic validation/error boundary. Explicitly send a guarded reply and return no value, avoiding a second automatic response. Upgrade state captures message/open/close callbacks, so replacing HTTP routes alone does not migrate already-open sockets.

A separate isolated native probe found that Elysia `1.4.30` invokes `beforeHandle` twice. Once-only ticket consumption, proof checks, quota admission, and context scrubbing therefore belong in the public `upgrade(context)` hook; denial must throw rather than return a value the adapter may ignore. That probe also verified the hook can scrub the actual context request headers and parsed cookies before the socket’s context spread, select only the version subprotocol, and leave reachable socket context without bearer/cookie/ticket values. This is framework evidence, not Besh implementation. The planned handler must capture only needed IDs/hashes and the original session ID, then scrub the actual request headers, parsed context headers/cookies, ticket subprotocol, and session object before upgrade. The original session includes `csrfToken`, which must not remain reachable from socket context. Avoid body/response validators and their default schema-error path; use Besh-owned generic guarded messages. Retain no raw-secret closure. No memory-erasure guarantee is made.

Current `src/flows/backend-code.ts` uses compiler version `1`; `src/flows/runtime.ts` reconstructs canonical artifacts, stages private modules, compiles a fresh router, and synchronously activates/restores native handlers around the publication transaction. WS must extend that same path, without an upgrade wildcard or credential bypass. If canonical generation changes, use an explicit new compiler version, proposed `2`, rather than silently changing compiler-1 output. The upgrade policy must verify legacy artifacts with the matching trusted canonical renderer before producing a new artifact from the validated graph; retain historical version/hash identity rather than executing stored code. Public legacy-backup, tamper, failed-upgrade, rollback, and fresh-directory tests must prove this policy. Planned migration 18 must introduce the three-way transport route index while preserving legacy archives and compiler/hash identities; its actual schema still needs implementation and restoration proof. A hash inventory is not a signature.

An isolated native capability probe on Bun `1.3.14` / Elysia `1.4.30` passed in 0.46 seconds: a REST-only listener accepted a newly compiled exact WS route, bearer-header upgrade and JSON frames without restart, followed by a WS path swap and rollback. Existing sockets retained their old release closure, confirming the need for explicit current-authority checks and post-commit connection cleanup. Client close/server stop completed. This verifies framework capability only, not Besh generated publication, authentication policy, failure recovery, or production support.

A genuine Besh native probe is currently RED: a REST-only `createApp` listener, REST publication, and pinned REST request succeeded, but public WS save stripped unknown `websocket` metadata. The explicit saved-metadata retention assertion failed before WS publication/key issuance/upgrade. This identifies the first missing product seam; it is not a passing WS implementation.

The genuine Besh hard gate remains native Bun `1.3.14`: start a REST-only listener, publish its first generated WS route through the existing atomic activation path, then exchange authenticated frames without restarting. Do this before broad WS implementation. Reload support in docs or newer declarations is insufficient evidence. Startup reconstruction and each REST/WS/GraphQL swap need the same native proof.

| Public/native seam   | Required evidence                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First WS publication | Start REST-only; publish WS; authenticate a real native upgrade and frames without restart                                                                                      |
| Registered protocols | REST → WS → GraphQL, wrong grants, ordinary HTTP, stale pins, route collisions, and exact rollback                                                                              |
| Tickets              | Two Bun peers consume one ticket: one winner; expiry/caps, Origin/subprotocol mismatch, replay, invalid bearer, exact original draft proof, and recipient-delegation warnings   |
| Input/output         | Binary, malformed JSON, primitive/unknown fields, oversize frames, busy/rate limits, slow receiver/backpressure, and generic errors                                             |
| Live authority       | Key expiry/revoke, issuer role/USE/API loss/deletion, tenant reassignment/retirement/policy change, idle cleanup, and native SQLite change-during-read with zero private rows   |
| Atomic activation    | Failed code staging/native activation preserves old routes/sessions or explicit blocked recovery; successful publish/rollback closes old revision sockets                       |
| Restore/startup      | Legacy backup migration, current artifact/key state, fresh code directory, startup ticket purge, no factory/reload purge, joining-peer pending-ticket retry, and reconstruction |
| Shutdown             | Open idle socket plus active read, close/drain/cancel, clean native process exit, and separately tested OS-signal handling                                                      |
| Beginner dashboard   | Owner and no-read operator forms, no forbidden private fetch, stale/lost response recovery, no credential persistence, keyboard/theme/phone behavior                            |

Keep OpenAPI and the eight HTTP client targets explicitly unavailable for WS until a separate supported export/caller design is verified. Do not silently render an HTTP request for this protocol. Existing k6 targets must exclude WS; dedicated native WS load scripts, metrics, quotas, and managed-key cleanup require their own acceptance work.

GraphQL subscriptions remain separate: they require subscription validation, an event source/async iterator, a defined transport such as `graphql-transport-ws`, per-event tenant/issuer checks, and disconnect/replay lifecycle. Plain request/reply WS is not a subscription implementation. See the official [GraphQL subscription guide](https://graphql.org/learn/subscriptions/) and [roadmap](roadmap.md#next-steps).

## Work split

Backend starts with the central transport model and a failing native first-publication/upgrade test, then dedicated grants, atomic tickets, authority checkpoints/connection registry, execution, app/store/migration integration, and public security tests. The parallel runtime lane owns canonical compiler/artifact-model changes, generated exact handlers/native proofs, controller activation, and startup/shutdown wiring; both lanes share the trusted helper seams above. Validate one public failure at a time before adding the next behavior.

Dashboard starts after the wire is stable: API-type/schema/origin forms, transport-aware published metadata and key grants, scoped draft connect/send/disconnect, generic bounded result history, and honest unsupported HTTP export/load actions. Keep current owner-assigned tenant review and no-read management boundaries. Native cross-peer/security evidence and full browser/preview checks gate the delivery; they are not supplied by this design document.
