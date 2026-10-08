# Workspace roles and permissions

Use custom roles when a member needs a smaller set of workspace actions than an editor or owner. Owners create roles and assign them to members. Role permissions do not authorize calls to published APIs; those still need scoped runtime keys.

## Choose a role

The built-in roles keep their existing behavior:

- **Owner** has all 15 action permissions and alone manages roles, members, other members' browser sessions, and update notices. The bootstrap owner cannot be reassigned or removed.
- **Editor** reads, edits, and tests APIs; reads and manages sources; and reads product-login connection metadata. Editors can generate drafts from sources and product connections.
- **Viewer** reads APIs, releases, OpenAPI documents, and generated client/backend code.
- **Custom** uses only the selected permissions. An empty role can sign in and manage its own account and sessions but has no product-management actions.

Built-in roles cannot be edited. Custom roles have no implied permissions: granting **Edit APIs** does not automatically grant **Read APIs** or **Test drafts**. Select each action needed for the member's workflow.

## Understand each permission

| Permission ID                 | Dashboard label                  | Allows                                                                                            |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `flows.read`                  | Read APIs                        | Read saved drafts, release history, OpenAPI, and generated client/backend code                    |
| `flows.write`                 | Edit APIs                        | Save authorized drafts; creating APIs requires all-mode access                                    |
| `flows.test`                  | Test drafts                      | Execute saved REST/GraphQL drafts, including configured data reads and product-login steps        |
| `flows.publish`               | Publish and roll back            | Change live behavior by publishing or restoring a release                                         |
| `sources.read`                | Read data sources                | Read source metadata and saved row previews                                                       |
| `sources.write`               | Manage data sources              | Import, replace, refresh, and delete sources; changes can affect live API data                    |
| `database-connections.read`   | Read database copies             | Read uploaded SQLite metadata, tables, and selected row previews                                  |
| `database-connections.manage` | Manage database copies           | Upload, check, and delete immutable SQLite copies; backups include their entire original data     |
| `auth-connections.read`       | Read product login connections   | Read connection metadata without provider secrets                                                 |
| `auth-connections.manage`     | Manage product login connections | Create, change, and delete server-held credentials; changes affect live login                     |
| `runtime-keys.manage`         | Manage runtime API keys          | Issue, list, replace, and revoke authorized caller keys, subject to scope and issuer authority    |
| `audit.read`                  | Read audit history               | Read workspace activity and security events                                                       |
| `backups.manage`              | Manage workspace backups         | List, create, and download complete backups with saved data and sensitive credential records      |
| `migrations.read`             | Read migration history           | Read control-database migration history                                                           |
| `load-tests.run`              | Run load tests                   | Read published targets/history, start bounded local runs, and cancel them; runs can repeat writes |

These are workspace action grants. Existing/default members can read every API when they have **Read APIs**; eligible members can instead use selected access below. Source and database-copy management grants remain workspace-wide. **Test drafts** can reveal configured data without direct preview grants; selected members additionally need dependency USE. **Manage runtime API keys** can issue caller access without publication permission. **Run load tests** prepares its own managed temporary runtime key and can repeat live mutations. Review these capabilities when choosing grants.

Creating a draft from a spreadsheet needs both `sources.read` and `flows.write`. Creating one from an uploaded SQLite copy needs both `database-connections.read` and `flows.write`. Creating a product-login draft needs both `auth-connections.read` and `flows.write`. Testing, publication, and key issuance remain separate actions. For example, a data reviewer can receive `sources.read`; a source-based draft author also needs `flows.read`, `flows.write`, and `flows.test` for the normal Studio workflow. Built-in editors and viewers have no database-copy grants; owners can assign them through a custom role.

A key manager can list, replace, and revoke authorized runtime keys without **Read APIs**. API reading supplies the normal target picker; a selected key-only manager can instead enter a **Shared API ID** and owner-provided **Known published release** without fetching private API details. See [runtime keys](api-keys.md).

## Create and assign a custom role

1. Open **Members** as the owner, then find **Custom roles**.
2. Select **New role**, enter **Role name**, and select the labeled permissions grouped by workflow.
3. Review permissions that change live APIs, credentials, source data, backups, or load-test traffic.
4. Select **Save role**, then assign it when adding a member. For an existing member, choose **Role for _name_**, select **Change role**, and confirm the session effects.
5. Ask the affected member to sign in again after a grant or assignment change and check their allowed workflow.

A role name is trimmed, contains 1 to 80 characters, and cannot contain control characters or use `owner`, `editor`, or `viewer`, regardless of case. Custom names cannot differ only by ASCII letter case: `Reviewer` and `reviewer` count as the same name. Selected permissions must be known and unique; zero permissions is allowed.

Roles carry a version. Editing or deleting uses the version you reviewed; a stale version returns 409 rather than overwriting another owner's edit. A role assigned to any member cannot be deleted: reassign its members first. Member administration never allows assigning the owner role or changing the bootstrap owner's role.

## Changes take effect on the server

The server resolves the current role grants on every management request, including bearer-key and cookie requests. Changing a role's permission set revokes its members' browser sessions in the same transaction as the role change and audit events. Changing a member's role revokes that member's sessions. They can sign in again with their existing password or member key and receive current permissions.

Member keys are not rotated by a role change. Their next request uses the new grants; a saved browser permission list cannot retain old access. Requests already authorized before a change may finish. Role creation/update/deletion and assignments produce audit events without credential values.

Renaming a role without changing its permission set keeps its members' browser sessions. Custom members without **Read APIs** open **Account & sessions** on sign-in or reload. Pages show permission guidance when access is missing.

Backups include roles, member assignments, and session state. Restoring an old backup can restore old grants and unexpired sessions; review them alongside credentials before serving the restored workspace. A downloaded backup contains more than the downloader's normal page access. Grant `backups.manage` only to someone trusted with the complete workspace snapshot. After first tenant protection, ordinary backup operations are permanently owner-only even when this grant remains assigned.

Custom roles do not add public endpoints, field/record authorization, product account policies, or multi-workspace tenant isolation. Runtime keys keep their flow scope, operation grants, expiration, and revocation behavior. See [API reference](api.md), [workspace sessions](workspace-auth.md), [runtime keys](api-keys.md), and [roadmap](roadmap.md).

## Selected-API reading

Introduced for reading in 0.9 and extended to existing-API actions in 0.10, this lets an owner share only chosen APIs. Exact verification belongs in [testing](testing.md).

The member keeps a role and also has an API-access choice:

- **All APIs** preserves existing/default behavior, subject to the role's permissions. The owner always has all access.
- **Selected APIs only** narrows eligible role actions to the chosen APIs. An empty selection shares no APIs.

Selected access allows viewers and custom roles using only **Read APIs**, **Edit APIs**, **Test drafts**, **Publish and roll back**, **Manage runtime API keys**, and **Run load tests**. An empty custom role is allowed, but selection never grants a missing action. Editors and roles with global source/database/product-connection, audit, backup, or migration grants are incompatible. Incompatible creation, role assignment, or assigned-role expansion is rejected before changes. Selected members cannot create APIs or generate new drafts from resources.

For an eligible member with **Read APIs**, the selection covers API lists, saved drafts, release history, OpenAPI, client examples, and generated backend code. Direct requests for an unshared or unknown API return the same `404`, including malformed read/export requests rejected before input validation. A member without **Read APIs** still receives the normal `403`; selecting IDs never adds the action. A visible graph can contain configured literals and dependency references; sharing it does not grant source/database previews or provider credentials.

1. When adding a viewer or eligible custom member, choose **Selected APIs only** under **API access**, then **Choose APIs to share**. Select the **Share _API name_** checkboxes. No selection means the member can sign in but sees no APIs.
2. For an existing member, select **Manage APIs for _name_** to open **API sharing for _name_**. Choose **All APIs** or review the selected checkboxes.
3. Select **Review API sharing**, check the scope and session effects, then **Confirm API sharing**. The affected member signs in again; their existing member key immediately uses the new policy.
4. After a conflict, your selections stay visible but review is disabled. **Refresh API access** explicitly replaces unsaved selections with the latest policy/version; review that state before submitting again.

If current metadata cannot be loaded, saving stays blocked. If a save response is lost, the change may already have committed: the page shows **Could not confirm whether API sharing was saved. Refresh to read the current policy.** Use **Refresh API access** to read the outcome and current version before reviewing another change; do not blindly retry. Successful save/refresh updates the member-table summary.

The member list shows **All APIs** or **Selected APIs · N**. An API-reading member with an empty selection sees **No APIs shared** in Studio and can ask the owner for access. Own account/session actions remain available; selected members cannot inspect another member's session, and unknown/foreign session IDs both return `404`.

The owner updates access with the version they reviewed. Every accepted access update, even an identical choice, increments the version and commits with audit and affected browser-session revocation. Role assignment also increments that version while retaining compatible access. Compatible custom-role permission edits keep the version but apply normal grant-change session revocation. Existing member keys use current policy on their next request; already authorized requests may finish. Migrations 15 and 16 include selected APIs, dependency USE, and issuer bindings in complete backups; restoring an old snapshot can restore old sharing and session state.

API reading includes graph literals and dependency references, so share exports deliberately. Selected access adds no row, field, product-identity, or tenant isolation. Existing unbound runtime keys retain unprotected behavior; keys issued by selected members carry live issuer authority as described below. See [API reference](api.md#selected-api-reading).

## Selected API actions and dependency USE

Implemented in 0.10, selected existing-API actions require both the role action and API selection. The owner separately grants typed **USE** of spreadsheet sources, uploaded SQLite copies, or product-login connections. A USE grant lets the member expose that dependency's data through an authored API or execute its product-login step. It is not row, column, record, field, or tenant isolation.

Dependency pickers show authorized structure, never row previews, original files, provider settings/secrets, or credentials. API reading alone does not grant these catalogs: selected members need an operational API action and matching USE. Every graph branch is checked, including branches not executed by a test. State changes check current policy transactionally; asynchronous reads/provider work and final results recheck authority. A caller-controlled query filter or projection cannot substitute for authorization. A denied result reveals no rows, but a permission change cannot undo effects already performed.

The owner form uses **Dependencies these APIs may use**, with **Use spreadsheet sources**, **Use SQLite copies**, and **Use product login connections** groups. Checkboxes identify each granted dependency, and entries show **Structure only · version N**. **Review API sharing** names dependencies before **Confirm API sharing**; **Refresh API access** remains explicit stale/lost-save recovery. Role action choices remain separate.

Member `access` carries separate API and typed USE lists; `flowAccess` remains its compatibility projection with the same version. Old selected-to-selected API-only updates preserve USE; switching to all clears it. Resources cannot be deleted while USE is assigned. Exact requests are in the [API contract](api.md#selected-api-actions-and-dependency-use).

Selected runtime-key issuance pins the current publication and links the key to the original member's key-management action. Calls recheck that issuer's current action, API selection, and immutable release dependencies. Deleted or unauthorized issuers remain denied; unbound credentials retain unprotected behavior; live resource protection adds identity requirements. Replacement retains issuer/action/tenant/pin/grants/expiry, even for an owner. Selected managers administer authorized bound keys for shared APIs, subject to tenant-entry privacy for every non-owner; this is shared-API administration. Unbound keys stay hidden. Revocation requires action/API scope but remains available after USE removal. See [runtime keys](api-keys.md#issuer-bound-keys).

Managed load-test keys carry the issuer's load-test action and starting pin. Selected history/cancellation covers bound jobs for shared APIs; cancellation remains available after USE removal with current action/API scope. Runs stay bounded to thirty seconds, without an instant cross-process kill of admitted requests or native work. See [load testing](load-testing.md#selected-issuers), [roadmap](roadmap.md), and exact evidence in [testing](testing.md).

## Tenant protection and global grants

Implemented in 0.11. A separate owner-assigned tenant identity and resource row policy narrow supported API data reads. API sharing and USE still do not establish that identity. Every non-owner, including an all-mode manager, derives protected draft/key/load-test identity from assignment and cannot choose another tenant.

Protected full resource metadata, previews, checks, refresh/replacement, and management are owner-only; ordinary non-owner lists omit them before revealing rows/counts. Structural catalogs keep authorized choices without raw data. First protection permanently makes all ordinary backup routes owner-only, including old archives and after deprotection. A global source/database/backup grant cannot bypass these boundaries.

Tenant-bearing keys/jobs add privacy to shared-API administration for every non-owner: foreign entries are hidden, while an original issuer's historical entries remain cleanup-visible after reassignment. Scoped revoke/cancel still needs current action/API access but not USE; cleanup cannot mint or rotate a different identity. Owner raw previews and complete backups remain explicitly privileged. See [row protection](row-protection.md).
