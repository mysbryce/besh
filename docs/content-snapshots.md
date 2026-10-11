# Content snapshot APIs

The active 0.27 work lets an owner create and explicitly publish a fixed REST API from one reviewed saved rich-text field. Callers receive its sealed document, escaped HTML and provenance. Later entry, model or renderer edits do not update that response. This is a snapshot API, not a live collection query.

Public HTTP and browser checks, complete suites, the final gallery and rebuilt portable acceptance pass. The complete suites precede only the sharing-copy clarification; post-copy focused browser and artifact checks pass. Final formatting passes. Source commit and hosted CI remain pending. The preceding saved-renderer preview completed [PR #24](https://github.com/mysbryce/besh/pull/24); no new public executable release follows from this working feature. See [current receipts](testing.md#sealed-content-snapshot-draft--active-027-work) and [roadmap](roadmap.md).

## Create and publish

1. In **Content**, open a clean saved entry and choose **Preview HTML**.
2. Choose **Review collection settings**, select **Reviewed collection settings**, and explicitly **Generate HTML preview**. Temporary settings cannot authorize snapshot creation. Reviewed virtual defaults at renderer revision zero are eligible.
3. Under the result, enter **API name** and a literal **Endpoint path**, for example `/article-snapshot`. Choose **Create Content API**. This creates a sealed draft and records a metadata-only `flow.created` event; it does not publish or call an API.
4. Choose **Open API Studio** to review the fixed request and **Content snapshot** terminal. Snapshot ID and SHA-256 are read-only. The graph, name, path and transport cannot be edited through ordinary flow controls.
5. Choose **Publish** explicitly. The registered route is `GET /run/article-snapshot`; Studio shows its published endpoint URL.
6. In **API keys**, issue a REST caller key for **Only this release**. Snapshot callers require the current release pin and the original live owner issuer. Store the one-time token on your calling server.

Studio, content model, collection, entry and collection-settings drafts must all be clean before creation. An entry being edited or requiring review is ineligible. Creation and publication retain global pending navigation guards; the dashboard never silently discards another draft. The current browser journey verifies explicit creation, opening, publication and pinned caller issuance. Non-owner sharing choices conceal the snapshot API; the server independently rejects assignments and management actions.

## Exact management request

```text
POST /api/collections/:id/entries/:entryId/snapshot-flow
```

The owner request contains exactly six keys:

```json
{
  "name": "Article snapshot",
  "path": "/article-snapshot",
  "collectionVersion": 1,
  "entryVersion": 1,
  "rendererVersion": 0,
  "fieldPath": ["body"]
}
```

Names use 1–80 trimmed characters. Endpoint paths contain one or more literal `/segment` components using ASCII letters, numbers, `_` and `-`, with at most 160 characters. Named parameters, empty/trailing segments, queries and expressions are invalid. Collection and entry versions are positive safe integers; renderer versions are nonnegative safe integers. `fieldPath` has one to six typed field names or nonnegative safe integer array indexes. Indexes start at zero; dashboard item labels start at one.

The server rechecks the original same-actor current owner first inside the acquired write transaction, then reads the current reviewed collection, entry and renderer revisions. It selects content under the frozen Struct binding and seals the validated paired AST plus the rendered result and provenance. Caller AST, HTML, settings maps, code and snapshot identifiers are not accepted. Root literal paragraph schema/AST one and formatted schema/AST two are supported under their existing model rules. Nested formatted selection is verified; the existing version-one Struct rule remains root-only.

The response is an unpublished revision-one `SavedFlow` with two nodes: request and server-owned `cmsSnapshotResponse`. Its terminal contains only `snapshotId` and `snapshotSha256`; content and HTML stay outside editable graph JSON. Creation leaves model, collection, entry and renderer records unchanged. Normal session metadata and authorization-denial audit retain their existing behavior.

## Caller result

Publication uses the normal explicit flow route with `{ "revision": 1 }`. Its trusted generated module registers the fixed GET route. A separate unexpired REST runtime key, pinned to that current publication, is required; workspace owner/member credentials cannot call it.

The JSON response has exactly `document`, `html` and `provenance`. Provenance contains:

- `flowId`, `releaseRevision`, `snapshotId`, `snapshotSha256`
- `collectionId`, `collectionVersion`, `structId`, `structVersion`
- `entryId`, `entryVersion`, `fieldKey`, `fieldPath`
- `schemaVersion`, `astVersion`, `rendererSchemaVersion`, `rendererSha256`, `rendererVersion`, `consumerContract`

The document preserves saved nodes, text and mark order. `$input`, `$data`, `$auth` and markup-looking text remain literal data; caller query values cannot interpolate the sealed result. HTML preserves its already-reviewed escaped bytes. Source entry deletion does not remove the sealed published response. Creating a new snapshot is a separate explicit review and action.

The [HTML renderer's consumer rules](rich-text-html.md#fixed-consumer-identifier) still apply. Default output loads no framework. The optional fixed `x-data="h1"` requires the narrow `besh.fixed-heading-id.v1` trusted consumer contract; it is not permission to evaluate authored expressions or automatically load Alpine. Escaping does not establish safety in every downstream framework.

## Authority and bounds

Snapshot flows retain a resource-owned CMS classification outside graph JSON. Non-owner detail, catalog, sharing, key and load-job access cannot expose them through ordinary API grants. Ordinary POST/PUT cannot copy a valid seal or replace the sealed graph with an ordinary response. Runtime calls recheck the current key, required pin and original owner issuer before returning content. Accepted execution records `flow.executed`; publication records `flow.published`.

The trusted reader binds the exact flow, terminal, seal hash and draft/release revision. It checks stored UTF-8 bytes and SHA-256 before parsing, exact canonical payload/provenance, paired semantic rich-text validity and the serialized response limit. Missing, malformed or mismatched seals fail closed with `503`, without live source fallback. Existing AST, saved-entry and renderer limits remain separate from generic shallow flow JSON limits. The combined sealed payload and final serialized caller response each have a 262,144-byte cap; valid content can exceed either limit after rendering/provenance expansion. No truncation occurs.

CMS modules use backend compiler 3. Ordinary generation remains compiler 2, with canonical compiler-one archive compatibility preserved. Generated source is reconstructed from trusted definitions and verified against canonical hashes; uploaded or modified JavaScript is never trusted. These modules require Besh runtime services, not a standalone server.

## Conflicts and unconfirmed creation

Creation uses the reviewed versions. A changed collection, entry or renderer returns `409`; no draft or accepted change audit is added. Preserve authored name/path and explicitly reload the relevant content or review collection settings, then generate a fresh saved-mode preview. The dashboard blocks another Create until that review succeeds; it never switches versions or retries automatically.

A network failure, server failure or invalid successful response may follow a committed creation. The warning **Creation could not be confirmed. Review the API list before creating again.** blocks blind retry. Its owner/session-scoped memory latch survives local preview close/reopen, field/mode changes, name/path edits and rereview. The held-response and committed-but-aborted-response browser checks exercise real server replies. A manual API-list review cannot uniquely prove absence by name/path, and a page reload or crash can lose the latch. There is no idempotency key, automatic refresh or complete uncertain-delivery recovery guarantee.

## Backup and current evidence

Migration 28 adds sticky flow classification and foreign-key bound sealed payload storage. Full unencrypted workspace backups include seals and retain their existing backup authority; direct owner-only CMS access does not exclude authorized full-backup operators. Restoring an older backup also restores its credential and publication state. Review restored keys before reuse.

Current focused HTTP acceptance passes three cases/266 assertions in 987 ms. It covers strict six-key input and reviewed-version conflicts, ordinary forged/declassification writes, caller/key management boundaries, literal runtime output, downloaded backup restoration/reopen, and a disposable declassified copy failing startup with `503`. Nested formatted selection keeps its exact response after source entry deletion; a separate root version-one case preserves literal text and empty nodes. The migration check uses a representative preceding migration-27 schema, not an actual old-release artifact, and observes migration 28 once across two opens. An earlier nested version-one fixture was rejected by the preserved root-only Struct rule; correcting that fixture was not a product RED. A canonical-hash worked example also required its omitted `fieldPath` to be corrected without a source change.

Browser checks cover Create/Open/Publish, pinned caller UI, sharing concealment, held real accepted responses, explicit stale review and an actually committed creation whose delivery is aborted. Seven dictionaries align 921 keys and preserve all 908 prior decoded values, with 13 additions and no duplicate or placeholder drift. Fresh scoped original review covers all 17 new gallery states plus six affected legacy images, and all 13 portable originals have matching byte/hash/dimension proof. Scrolled frames and canvas regions are only partially visible; these reviews do not establish native-speaker certification or inspection of every gallery image. See [exact full receipts and limits](testing.md#sealed-content-snapshot-draft--active-027-work).

## Remaining work

CMS GraphQL, live collection queries, content mutations, media, shared CMS editing, snapshot graph updates, rollback, draft testing, OpenAPI and client-code exports remain planned. Complete recovery/corruption coverage and crash-safe duplicate prevention require separate public gates. Snapshot publication adds none of these implicitly.
