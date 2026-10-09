# Protected read graphs

Implemented in 0.16. Existing three-node protected reads remain supported. This guide covers the bounded REST/GraphQL extension; exact verification belongs in [testing](testing.md) and remaining work in the [roadmap](roadmap.md).

## What a graph does

A protected REST or GraphQL API can read up to four spreadsheets or uploaded SQLite tables, with up to three conditions that compare caller input. Each path must read data before reaching its single response. Every read uses the same trusted tenant identity.

Each read replaces the previous rows. `$data` means the rows from the last read on the selected path. It does not join, merge or name earlier results. A condition chooses the next step; it cannot establish tenant identity.

For example, request → spreadsheet → SQLite → response returns only the SQLite rows. Request → condition → spreadsheet or SQLite → response returns rows from the chosen source. Both branches still need authorized resources and compatible reply fields.

## Build without code

Connect reads and condition branches in Studio. Configure returned columns in each read form. Select the response and choose **Use last read fields**, then **Review last-read reply**. Review every possible final source, field, nullable value and row limit. **Apply last-read reply** explicitly replaces draft reply rules or GraphQL SDL; **Cancel reply review** leaves them unchanged. Save and test before publication.

For GraphQL, conditions and dynamic read filters must use simple request body fields such as `body.choose` or `$input.body.customer`. The helper does not translate query/path/nested references. Change those references explicitly before review. Use **Reply argument choose type** and **Require argument choose** to review scalar input; this is business input, never tenant identity.

In the GraphQL test panel, choose **Build rows query**, select **Query reply field** controls and fill labeled **Argument** values. **Review rows query** and **Use rows query** prepare one operation. Then test it with the reviewed owner tenant or your current assigned identity. Advanced SDL, operations and variables remain available for supported cases outside the simple form.

Metadata errors require explicit retry. Changes to graph, transport, rules or editor scope invalidate review and discard late metadata. Applying a helper changes only the draft. A forbidden branch denies the whole graph even when caller input chooses another branch; review resource/profile access rather than changing the caller identity.

An admitted draft test clears its previous response. If the request is rejected, read the error and repair access or input before retrying; an earlier successful reply is not shown as the current test result.

## Reply rules

An expanded REST graph needs explicit response rules: a nonnullable list of at most 100 nonnullable flat objects. Declare every returned field as required, allow no extra fields and use scalar field types. Individual scalar fields may explicitly allow null. Every possible last read must select the same field keys; their values must satisfy the declared rules.

An expanded GraphQL graph uses `Query.rows` with a flat row-object list. Mutations, nested row values, row-field arguments and additional business roots stay outside this scope. Every possible last read must match the row field keys. Complete raw rows are checked against scalar types, declared nullability and enum values before GraphQL selects or converts fields. Selecting fewer fields does not bypass an invalid row or a forbidden authored projection.

For expanded graphs, `String` and `ID` require actual strings; numeric IDs are not coerced. `Int` requires an integer within the signed 32-bit range, `Float` a finite number and `Boolean` an actual boolean. Enum values must match a declared name. Null is accepted only for a nullable scalar field. Legacy single-read behavior remains separate.

Root arguments and variables remain business input. They do not choose a caller identity. GraphQL root selections are reviewed before execution: at most one eligible `rows` response key may run the expanded graph. Repeated fragments sharing one alias merge into one execution. Different eligible aliases are rejected before any read. `@skip` and `@include` use actual variables and defaults; `__typename` alone performs no graph read. Existing document-size, field and depth limits still apply.

## Current authority

Every authored read must be protected. A protected graph cannot mix protected and shared resources, product-login effects or literal response data. Business filters use fixed scalars or safe caller-input references; they cannot read an earlier result.

The owner explicitly reviews an active tenant for draft tests and caller issuance. Other members use their current assigned identity. Original runtime keys keep their tenant, issuer, operation grant, expiry and publication pin. Caller body, query, path, headers and GraphQL variables never replace that identity.

Authorization checks every branch before effects and again around asynchronous reads and final results. Each resource enforces its own private tenant predicate, global field ceiling and tenant profile. Removing access to an unchosen branch can deny the whole graph. A policy change on an earlier resource while a later SQLite read is pending can withhold the final rows.

These checks do not create a consistent snapshot across separate resources, undo earlier effects or recall delivered bytes. Existing key handover and live-policy rules remain separate from the immutable published graph. See [tenant protection](row-protection.md), [runtime keys](api-keys.md) and [selected API sharing](roles.md).

## Separate work

WebSocket APIs retain their existing single-read request/reply shape. Joins, aggregation, transforms, writes, social effects, public endpoints, cross-tenant graphs and GraphQL subscriptions need their own design and verification.
