# Planned tenant row protection

This is an accepted design for a later slice, not an implemented feature. Exact API fields, limits, and owner forms remain proposed until that implementation is settled. Current runtime grants and dependency USE do not isolate tenants or rows.

## Smallest supported scope

Start with protected read-only spreadsheet snapshots and uploaded SQLite copies, using owner-approved text tenant identities. A beginner chooses a tenant column and assigns a caller identity through labeled owner forms; callers never establish identity through headers, body, query parameters, path values, or GraphQL variables. This does not add product sessions, field authorization, live databases, writes, or multiple workspaces.

Protection belongs to a versioned server-owned resource policy outside editable graph JSON. Every referenced spreadsheet or SQLite table must have an applicable policy; uncovered tables must fail closed. Removing a node filter, omitting its tenant column from returned fields, editing a branch, or restoring an old release cannot remove the resource's protection.

The first supported shape is request → one spreadsheet/SQLite read → response returning that data. Inspect every node and reject mixed protected/shared resources, extra reads, branches, response-data literals, and social-login nodes before effects. Joins, mixed tenant domains, and broader graph shapes need separate design. A row predicate cannot classify sensitive data copied into a response literal; this slice must not imply that every arbitrary graph response is isolated.

## Trusted identity and reads

The owner approves immutable tenant values and assigns members to identities. The proposed registry allows at most 256 entries, with each value limited to 128 Unicode code points and 512 UTF-8 bytes. Values must be well-formed text; do not silently trim, case-fold, or change them. Case and spaces matter. Labels may change without changing the identity value; retirement must deny affected callers. Reassigning a member must not silently retarget an existing key.

The accepted metadata design adds a versioned `Member.tenantAssignment` and nullable `tenantId` on runtime keys and load-test jobs. These records identify the approved registry entry without exposing its exact text value. Resource-policy changes must guard both the policy version and the reviewed source/copy version; SQLite policies need a complete table-to-tenant-column mapping. Exact wire schemas remain proposed.

Proposed owner routes are `GET/POST /api/tenants` (`POST { label, value }`), `PUT /api/tenants/:id` (`{ label, state: 'active' | 'retired', version }`), and `PUT /api/members/:id/tenant` (`{ tenantId, version }`). Source/copy row-policy GET/PUT routes use `version` and `resourceVersion`: unprotected mode has neither column selection nor mappings; tenant mode selects a source `column` or complete SQLite `tables: [{ table, column }]`. These are design interfaces, not currently available endpoints.

The server derives a private execution principal from the verified credential and current assignment. Keep it outside ordinary flow input and editable node configuration. Admission checks every static data/database branch, including untaken branches, against current identity, API/action/USE, and resource policy before typed inputs or effects. Asynchronous reads recheck current policy before returning data; a failed check returns no partial REST or GraphQL result.

Adapters combine the mandatory tenant predicate with any caller-controlled business filter using AND, before row limits and returned-column projection. A missing business filter never removes the mandatory predicate. Spreadsheet comparison uses exact text equality; SQLite must explicitly use BINARY comparison and bound values so uploaded NOCASE/RTRIM column settings cannot merge identities. SQLite documents [collation precedence](https://sqlite.org/datatype3.html#collating_sequences) and [WHERE filtering before result generation](https://sqlite.org/lang_select.html#where_clause_filtering).

Nullable tenant-column rows can be safely hidden by equality; never invent an identity for null, empty, or unmatched data. Missing/retired/reassigned caller identity denies admission with a generic authorization error; an authorized tenant with no matching rows receives an empty result. Refresh/replacement must preserve compatible tenant-column keys/types or fail before committing. Existing SQLite child deadlines, output/memory/concurrency limits remain required.

Spreadsheet support requires preserving mapped original cell types and values, aligned with normalized output rows, for new imports and refreshes while keeping normalized business output compatible. Authorization compares original TEXT independently of the normalized business column type: text `1.0` and `1` may both display as numeric `1`, but remain different identities; surrounding spaces also remain significant. The displayed business value does not promise the original identity text. Activation rejects a chosen column containing any nonnull original numeric, boolean, date, or unsupported cell; it never coerces or silently discards those rows. Original numeric/boolean cells cannot become tenant strings.

The current importer trims and automatically converts cells, so existing normalized-only snapshots do not establish exact original tenant text. Legacy snapshots need explicit reimport before protection (`409` otherwise); never infer or reconstruct the original identity from normalized values. Refresh/header mapping must preserve compatible protected-column provenance without a fallback. Missing, invalid, or misaligned legacy provenance returns `409` and asks for reimport; malformed active provenance must fail closed with `503` and no rows. An explicit owner Google refresh can collect fresh original cells, but must not invent provenance from normalized legacy data. Proposed owner policy metadata reports only provenance availability and eligible text-column keys, never original cell values. The raw-provenance storage bound still needs implementation evidence.

## Credentials, inventory, and cleanup

Protected issuance requires a reviewed current-release pin. Every non-owner, including an all-mode custom manager, must derive identity from the owner's current assignment and carry a live issuer/action binding. Non-owners must not choose arbitrary identities. The owner alone may explicitly issue independent protected credentials.

Replacement preserves tenant, original issuer/action, pin, operation grants, and exact expiry. A non-owner needs an approved matching tenant and a live authorized original issuer; an owner-origin independent protected key cannot become permanent independent authority through a non-owner replacement. Owner replacement of a bound key must also retain its binding; deleted/reassigned issuers stay denied. Separate reviewed issuance is a different decision.

Tenant-bearing credential/job privacy applies to all non-owners. Current action/API scope is required, then visibility needs a matching assigned tenant or the original issuer's historical cleanup access. Null-tenant legacy bound entries may remain cleanup-visible; a null assignment never matches a nonnull tenant. Lists omit foreign entries, and foreign direct IDs match missing-ID denials before input validation. Do not resolve or reveal another tenant's current labels/settings just because a flow is shared.

Own historical keys/jobs remain visible for revoke/cancel after reassignment or USE removal, with minimal metadata and a clear cleanup-only state. That visibility cannot mint a token or restore runtime access. Identity-bearing privacy remains even if resource protection is later removed. Rotation must not upgrade a null-tenant legacy key into a new identity.

Draft tests derive the member's approved identity; an owner explicitly reviews a test identity. Managed k6 keys inherit reviewed identity, issuer load-test action, and starting pin. Cleanup remains available without USE while current action/API scope permits it. Bounded thirty-second runs do not promise instant cross-process termination or cancellation of admitted work.

## Compatibility and recovery

Existing resources default to unprotected and retain legacy behavior. Once protection is enabled, old null-tenant credentials cannot read that resource, including through old releases or rollback. Policies and identity assignments stay live references rather than being frozen by graph pins.

Additive migration and complete backups must preserve policy, identity, assignment, credential, and issuer state. Deleted issuers must remain fail-closed rather than becoming null/unbound. Restoring a snapshot can restore old access and still-unexpired credentials; review before serving callers.

The selected management boundary is strict: protected resources' full metadata, rows, management, checks, refresh, and replacement are owner-only. Non-owner normal lists omit protected entries before exposing counts/data, and direct hidden IDs match `404`. Authorized structural catalogs retain read/USE choices without rows/counts. Delegated asynchronous raw reads and backup operations must recheck current policy before final disclosure or commit. The owner's raw previews remain unfiltered privileged access.

Backup downloads need guarded bounded-chunk streaming: recheck current actor and the permanent backup restriction around asynchronous file reads, and clean up handles on completion, failure, or cancellation without loading an entire unbounded archive. Bytes already delivered cannot be recalled; this is not instant retroactive revocation of previously admitted bytes. Protected REST/GraphQL row results instead withhold the private result when their final authority check fails.

First protection sets a permanent workspace backup restriction: all backup routes become owner-only, including old archives and after deprotection. Owner confirmation must explain the loss of delegated backup access and its persistence. This prevents a globally delegated preview/backup grant from bypassing the non-owner tenant boundary; it remains a proposed implementation requirement.

The restriction survives supported ordinary operations, deprotection, and restart. Physical/manual restoration of an older database is an owner-controlled operation outside that monotonic guarantee and can restore old security state. There is no rollback-resistant external enforcement claim. Normal deprotection must never clear the flag.

## Public acceptance checks

- Mixed A/B rows on both adapters, REST and GraphQL, with another tenant's first hundred rows proving filtering precedes limits/projection; exact-case/space and quoted/NOCASE/RTRIM SQLite cases.
- Forged identity headers/body/query/variables, omitted/null business filters, uncovered tables, untaken branches, altered projection, old releases/rollback, and unsupported mixed/social/literal shapes denied before disclosure or effects.
- Every non-owner's foreign inventory/detail/rotation denial, owner-origin independent-key protection, live issuer/assignment retirement/deletion, own historical cleanup, and null-tenant legacy behavior.
- Separate-process policy/assignment changes during native asynchronous reads with no returned rows; exact raw-text import/refresh and legacy reimport denial, pin/rotation, compatible business output, backup/restart, and managed k6 cleanup/cancellation audit.
- All-mode global resource grants cannot reveal protected rows/counts or manage protected copies; structural catalogs stay useful. Owner-only backup state covers old archives and deprotection, with the older-snapshot restore boundary explicitly tested/documented.
- Beginner owner review, selected and all-mode non-owner forms, stale/lost-response recovery, and light/dark/phone previews without an arbitrary tenant picker.

These are acceptance requirements, not test results or production certification. Field/record policies beyond these adapter reads, product accounts/sessions, and multi-workspace isolation remain separate roadmap work. See [roles](roles.md), [runtime keys](api-keys.md), and [roadmap](roadmap.md#next-steps).
