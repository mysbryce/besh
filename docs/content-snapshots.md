# Content snapshot APIs

Delivered source `0.27.0-alpha.0` lets an owner create and explicitly publish a fixed REST API from one reviewed saved rich-text field. Callers receive its sealed document, escaped HTML and provenance. Later entry, model or renderer edits do not update that response. This is a snapshot API, not a live collection query.

Public HTTP/browser checks, complete local suites, the final gallery and rebuilt portable acceptance pass. [PR #25](https://github.com/mysbryce/besh/pull/25) completed source delivery with matching reviewed/merged trees and all three exact-head/main CI jobs passing before delivery-branch cleanup. Hosted checks pass 411 backend cases/9,415 assertions, 78 browser cases and ten portable cases/1,202 assertions; historical local chronology remains in [exact receipts](testing.md#sealed-content-snapshot-draft--active-027-work). No tag, new public executable or deployment is published; the public executable remains 0.19. The toolbar separately completed PR #26; the [active GraphQL candidate](#active-028-typed-graphql-snapshots) has focused HTTP/browser and complete core/E2E acceptance, with complete gallery and portable execution also passing; source and hosted delivery remain pending.

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

Snapshot flows retain a resource-owned CMS classification outside graph JSON. Non-owner detail, catalog, sharing, key and load-job access cannot expose them through ordinary API grants. Ordinary POST/PUT cannot copy a valid seal or replace the sealed graph with an ordinary response. Runtime calls recheck the current key, required pin and original owner issuer before returning content. Accepted REST execution records `flow.executed`; GraphQL execution records `graphql.executed`. Publication records `flow.published`.

The trusted reader binds the exact flow, terminal, seal hash and draft/release revision. It checks stored UTF-8 bytes and SHA-256 before parsing, exact canonical payload/provenance, paired semantic rich-text validity and the serialized response limit. Missing, malformed or mismatched seals fail closed with `503`, without live source fallback. Existing AST, saved-entry and renderer limits remain separate from generic shallow flow JSON limits. The combined sealed payload and final serialized caller response each have a 262,144-byte cap; valid content can exceed either limit after rendering/provenance expansion. No truncation occurs.

CMS modules use backend compiler 3. Ordinary generation remains compiler 2, with canonical compiler-one archive compatibility preserved. Generated source is reconstructed from trusted definitions and verified against canonical hashes; uploaded or modified JavaScript is never trusted. These modules require Besh runtime services, not a standalone server.

## Conflicts and unconfirmed creation

Creation uses the reviewed versions. A changed collection, entry or renderer returns `409`; no draft or accepted change audit is added. Preserve authored name/path and explicitly reload the relevant content or review collection settings, then generate a fresh saved-mode preview. The dashboard blocks another Create until that review succeeds; it never switches versions or retries automatically.

A network failure, server failure or invalid successful response may follow a committed creation. The warning **Creation could not be confirmed. Review the API list before creating again.** blocks blind retry. Its owner/session-scoped memory latch survives local preview close/reopen, field/mode changes, name/path edits and rereview. The held-response and committed-but-aborted-response browser checks exercise real server replies. A manual API-list review cannot uniquely prove absence by name/path, and a page reload or crash can lose the latch. There is no idempotency key, automatic refresh or complete uncertain-delivery recovery guarantee.

## Backup and current evidence

Migration 28 adds sticky flow classification and foreign-key bound sealed payload storage. Full unencrypted workspace backups include seals and retain their existing backup authority; direct owner-only CMS access does not exclude authorized full-backup operators. Restoring an older backup also restores its credential and publication state. Review restored keys before reuse.

Current focused HTTP acceptance passes three cases/266 assertions in 987 ms. It covers strict six-key input and reviewed-version conflicts, ordinary forged/declassification writes, caller/key management boundaries, literal runtime output, downloaded backup restoration/reopen, and a disposable declassified copy failing startup with `503`. Nested formatted selection keeps its exact response after source entry deletion; a separate root version-one case preserves literal text and empty nodes. The migration check uses a representative preceding migration-27 schema, not an actual old-release artifact, and observes migration 28 once across two opens. An earlier nested version-one fixture was rejected by the preserved root-only Struct rule; correcting that fixture was not a product RED. A canonical-hash worked example also required its omitted `fieldPath` to be corrected without a source change.

Browser checks cover Create/Open/Publish, pinned caller UI, sharing concealment, held real accepted responses, explicit stale review and an actually committed creation whose delivery is aborted. Seven dictionaries align 921 keys and preserve all 908 prior decoded values, with 13 additions and no duplicate or placeholder drift. Fresh scoped original review covers all 17 new gallery states plus six affected legacy images, and all 13 portable originals have matching byte/hash/dimension proof. Scrolled frames and canvas regions are only partially visible; these reviews do not establish native-speaker certification or inspection of every gallery image. See [exact full receipts and limits](testing.md#sealed-content-snapshot-draft--active-027-work).

## Active 0.28: typed GraphQL snapshots

The candidate adds a dedicated owner action:

```text
POST /api/collections/:id/entries/:entryId/snapshot-flow/graphql
```

It accepts the exact six-key [management request](#exact-management-request) above. No protocol flag, caller SDL, AST or HTML is accepted. The returned sealed draft uses POST and the server's fixed GraphQL schema. Explicit publication registers `POST /graphql/article-snapshot` for the example path; a separate unexpired `query` runtime key with the current release pin and original live owner issuer is required. Existing REST request/reply and canonical compiler-three bytes remain unchanged.

The fixed Query field is `contentSnapshot`, returning selectable `document`, `html` and `provenance`. Its document uses typed block and inline unions for both supported rich-text versions; there is no JSON scalar, mutation or subscription. Version-one text has no saved marks; selecting its nullable `marks` returns `null`. Revision counters project as decimal Strings to preserve safe integers beyond GraphQL Int range. Mixed field paths project as `CmsFieldKey { key }` or `CmsFieldIndex { index }`, with decimal String indexes. Stored content, canonical seal hashes and REST provenance are not converted.

For a saved heading document, this query selects its literal text and reviewed identity:

```graphql
query Article($withHtml: Boolean!) {
  contentSnapshot {
    document {
      astVersion
      children {
        ... on CmsHeading {
          level
          children {
            ... on CmsText {
              text
              marks
            }
          }
        }
      }
    }
    html @include(if: $withHtml)
    provenance {
      entryVersion
      rendererVersion
      snapshotSha256
      fieldPath {
        ... on CmsFieldKey {
          key
        }
        ... on CmsFieldIndex {
          index
        }
      }
    }
  }
}
```

Send it as the JSON `query` value to the published GraphQL route using the caller's runtime key, with `operationName: "Article"` and `variables: { "withHtml": true }`. Unselected fields are absent; changing `withHtml` to false omits `html`. Variables affect query selection only, never saved text or HTML. A paragraph document needs a `CmsParagraph` fragment instead of `CmsHeading`. Empty nodes, mark order, links and list boundaries remain literal under their typed projection.

Compiler-four modules validate the canonical schema and seal before registering the route. Runtime admission synchronously captures the original key, current pin, release generation and validated literal snapshot. Bounded GraphQL execution runs outside that database transaction; the same original key and generation are checked again after await before audit/delivery. Mutable source edits/deletion never provide replacement data. Ordinary compiler-one/two and REST-three contracts stay separate.

Existing GraphQL limits remain: schema/request length 16,384 characters, 2,000 parse tokens, depth 12, 200 fields, 16 roots, 5,000 resolutions and 262,144 response bytes with encoded JSON depth 24. Rich-text semantic depth six is a separate bound. The conservative whole snapshot body multiplied by selected field count still applies, so a large query can be rejected even when its final projection would be smaller. Standard fragments, directives, variables and aliases do not bypass those budgets; output is never silently truncated.

Five public HTTP cases/224 assertions pass in 749 ms. They cover typed families/mixed paths, literal version-one output, source deletion, restart and downloaded-backup coexistence with REST, owner/key denials, invalid operations and bounded output. A tampered disposable copy fails startup rather than serving its altered contract. Observed REST-three bytes remain unchanged across publication/restart/restore; this is not an actual compiled old-binary migration test. Focused browser creation/publication and unconfirmed-SDL cases pass. In the reviewed creation form, choose **GraphQL** under **API type**; REST remains the default and both protocols require explicit creation and publication. Complete core passes types, build, whole formatting and 416 backend cases/9,640 assertions in 44.18 seconds backend time. The explicit two-worker bundled-Chromium command passes all 81 browser cases in 337.57 seconds. The 930-key locale audit and focused 23-state capture also pass; the complete gallery now passes at 1,364 images/52 receipts with scoped review of 23 new and 17 affected originals. Eleven portable tests/1,265 assertions pass, including compiled GraphQL source-deletion/restart acceptance. All 14 copied-executable originals pass scoped review. Source-bundle, hosted CI and merge gates remain pending. See [exact receipts](testing.md#typed-graphql-content-snapshots--active-028-work).

## Remaining work

Complete the active GraphQL candidate's dashboard and full delivery gates first. Content HTTP client exports and live collection queries follow separate public tests. Content mutations, subscriptions, media, shared CMS editing, snapshot graph updates, rollback, draft testing and OpenAPI remain planned. Complete recovery/corruption coverage and crash-safe duplicate prevention require separate gates. Snapshot publication adds none of these implicitly.
