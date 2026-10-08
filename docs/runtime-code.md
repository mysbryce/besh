# Published backend code

Generated runtime routing is implemented in 0.8. Exact verification evidence belongs in [testing](testing.md).

Publishing generates a trusted CommonJS (`.cjs`) module for the validated release and registers its actual REST method/path or GraphQL endpoint. Basic use still means **Save draft**, **Test flow**, and **Publish**; you do not write backend code or manage a code directory.

## Inspect a publication

Members with **Read APIs** can inspect, copy, or download the current publication's backend module. Viewing code is a separate read action; it does not publish, execute a request, issue a credential, or select an archived release. Unsaved changes and saved drafts do not replace published code.

1. In API Studio, open **Generated backend**. Review **Published release · revision N**.
2. Review **Requirements** and the read-only **Generated backend code**. Expand **Release integrity** for **Code SHA-256** and **Definition SHA-256**.
3. Select **Copy backend code** or **Download backend code**. The download uses the artifact's `.cjs` filename. There is no extra generation or deployment action.

The dashboard request includes the current published revision you reviewed, and copy/download recheck the artifact before use. Raw management GET can omit this optional guard to read the latest publication. With the guard, a changed publication returns `409`; stale code/actions are cleared until you select **Refresh generated backend**, review the new revision, and request its code again. Unknown or unpublished APIs return `404`. Viewers can read/export; members without API-read permission do not load this panel. See [API reference](api.md#published-backend-code).

The module contains configured graph literals and resource references. Server-held OAuth secrets and runtime/member tokens are not inserted automatically, but values you put directly in a flow can appear in the source. Review downloaded code before sharing it.

Downloaded code depends on Besh's runtime and the requirements shown with it. It is not a standalone server, deployable package, database export, or editable plugin. Editing a download does not change the publication, and Besh has no uploaded-JavaScript execution route. [Client code examples](client-code.md) are different: those are programs your application uses to call an API.

## Registered routes and runtime checks

REST registers the selected method and full `/run` route, including supported whole-segment parameters. GraphQL registers POST at its full `/graphql` path plus method-rejection handlers. A fresh Elysia router is compiled when publication changes; native handler activation uses Bun's public server reload mechanism. These mechanisms are described in the official [Elysia routing guide](https://elysiajs.com/essential/route) and [Bun server reload documentation](https://bun.sh/docs/runtime/http/server#serverreload).

The runtime no longer searches flows by request path or loads a graph definition for every execution. Generated modules capture their validated release and delegate execution to the bounded Besh graph engine. They retain runtime-key authentication, expiration/revocation, release pins, typed REST contracts, GraphQL validation/budgets, dependency reads, and audit records. Generated routing does not add field, record, tenant, or product-user authorization.

Ordinary runtime requests use two fixed-size generation checks to handle publications made through another process. Before parsing a request, a changed generation triggers reconstruction and redispatch through current routes. After parsing, a final generation/credential read transaction refuses a changed generation with `503` before flow effects. Canonical URL redispatch and router refresh may perform additional fixed-size reads. A request admitted against one immutable release may finish after a later publication. Data, credential, and audit access still uses SQLite; this is not a database-free request path or a distributed activation guarantee.

## Publication, recovery, and backups

Migration 14 stores compiler artifacts and the runtime generation counter in the control database, so normal consistent backups include them. Startup reconstructs routes from saved publications. Canonical generated code is validated or regenerated from the trusted graph; stored or uploaded arbitrary JavaScript is never trusted as a handler.

Publication and rollback stage generated modules and a compiled router under an immediate transaction. Release selection, artifacts, generation, and audit state commit with synchronous local activation. A caught staging/activation failure rolls back state and restores the previous router. If restoring the local router fails, or any peer-publication reconstruction fails, runtime requests stay blocked with `503`. Restart Besh to reconstruct from committed state, or complete a successful publication stage in that process. Retrying a runtime request does not automatically repair it. This does not promise coordinated activation or uninterrupted availability across several processes.

By default the loader uses a unique OS temporary directory, exclusively creates each module file, loads it through `createRequire`, then removes the file/cache entry. `BESH_RUNTIME_CODE_DIR` (or programmatic `AppOptions.runtimeCodeDir`) can select an administrator-trusted private loader base; basic use needs neither. Keep that directory and server filesystem access privileged. Code generation does not freeze spreadsheet data or provider credentials: releases and pins retain references to current mutable dependencies. See [release history](api-routes.md), [runtime keys](api-keys.md), and [backups](getting-started.md#data-and-recovery).

Generated code is bounded to 1 MiB; exceeding that limit rejects generation with `400`. Artifacts include source and definition SHA-256 values for checking their exact generated content. A hash is not a signature or proof of publisher authenticity. Performance comparisons belong in [testing](testing.md); route registration alone establishes no latency, throughput, or production-capacity guarantee.
