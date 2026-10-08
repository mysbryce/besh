# Runtime API keys

Runtime API keys let a caller use one published Besh API. They are separate from workspace sign-in: owner/member keys and browser sessions manage the workspace, while runtime keys call published endpoints.

Owners and custom members with runtime-key management permission can create, list, replace, or revoke authorized runtime keys. Built-in editors and viewers cannot. Each key has a name, one published API, allowed operations, and an expiration. REST keys allow **REST requests**. GraphQL keys allow **GraphQL queries**, **GraphQL mutations**, or both. These grants cover entire operations; field and record authorization remain planned. Unbound keys remain independent of workspace grant changes; issuer-bound keys also depend on current member authority. See [roles and permissions](roles.md).

The normal API picker needs `flows.read`. A selected key manager without API reading instead uses **Shared API ID**, **Known published release**, and **Operation type**, with values reviewed by the owner. No private API lookup is made. Key-management permission still allows authorized inventory, replacement, and revocation; the management API can issue for a known published flow without API reading.

## Create and use a key

1. Save, test, and publish your API in **API Studio**.
2. Open **API keys** with runtime-key management permission.
3. Choose the published API, give the key a recognizable name, and select the required operations.
4. Choose an expiration. The dashboard offers 1, 7, 30, or 90 days; the management API accepts a future date within 366 days.
5. Select **Create API key**. Copy the token and save it privately before acknowledging that you saved it.
6. Configure the caller to send `Authorization: Bearer <runtime-key>` to the published endpoint.

Under **Release access**, all-mode managers can keep **Follow published changes** or choose **Only this release**. Selected managers use **Only this release** and a live issuer binding. A pin captures the reviewed publication. Refresh does not silently move it to a newer revision; use **Use current release** to review that change. **Create release-pinned API key** confirms the API, route, **Only release N**, operations, and exact expiry before **Create pinned key**. The no-read form reviews supplied metadata instead of fetching the private route; after `409`, **Review supplied release** or an edited revision makes that review explicit.

For a REST API published at `/hello`:

```sh
curl 'http://127.0.0.1:3000/run/hello?name=Ada' \
  -H 'Authorization: Bearer YOUR_RUNTIME_API_KEY'
```

GraphQL uses the same header on `/graphql/<published-path>` with a POST JSON operation. See the [GraphQL guide](graphql.md) for query and mutation examples.

Use the endpoint shown for the published API. For `/v1/items/:id`, substitute an encoded value for `:id`, such as `/run/v1/items/42`. Editing a draft's path or API type does not change its live endpoint. Keys follow the flow ID across publication and rollback by default, so review grants before changing live behavior. Separate `/v1` and `/v2` flows need separate keys; see [routes and release history](api-routes.md).

## Follow publications or pin a release

A following key has `releaseRevision: null` and accepts the flow's current published behavior. Existing keys keep this default. A pinned key has a positive `releaseRevision` and accepts requests only while that exact revision is currently published. Issue a pin for the current publication; a stale expected revision returns `409` without issuing a key. This is not a way to serve archived releases at separate routes.

A valid pinned key becomes **dormant** when another revision is selected. At the current route it returns `403` before typed input validation or flow effects; an old route that is no longer published returns `404`. Rolling back to its exact revision makes it usable again if it remains unexpired and unrevoked. Expired/revoked keys return `401` and cannot be revived by rollback. Requests already authorized may finish after publication changes.

Changing an active pin into a dormant one does not revoke it. Replacing a dormant key preserves its dormant pin; issuing a separate current-release or following key is a different decision. Rollback does not undo revocation, and expiry still applies while the key is dormant.

The pin covers the graph revision only. Spreadsheet snapshots, product credentials, and other mutable dependencies retain their current values. It adds no field, record, tenant, or product-user authorization. See [routes and release history](api-routes.md).

Key rows show **Only release N** or **Follow published changes**. **Active**/**Dormant** needs authorized current API metadata. A key manager without **Read APIs** can refresh key metadata and replace/revoke existing keys, but sees **Current release unknown** instead of fetching forbidden API details. **Expired** and **Revoked** remain visible from the key itself. Active status does not prove that a request's inputs or response will satisfy its rules.

If required published API metadata fails to load, the normal picker blocks creation until **Refresh** succeeds. The no-read form uses supplied release metadata instead. Existing-key replacement and revocation remain available without loading API details.

## Replace an active or dormant key

Replacement creates a new token and immediately revokes the old key in one database transaction. It preserves the old key's name, API, allowed operations, exact expiration, and release pin or following mode. It does not renew the lifetime or add permissions.

Keys marked **Managed by load testing** are pinned to their run's starting revision, revoked automatically, and cannot be replaced. Use **Cancel run** to stop the load job; manual key revocation ends its caller access. See [load testing](load-testing.md).

1. Open **API keys** and find an unexpired, unrevoked key, including a dormant pin.
2. Select **Replace key**. Review the confirmation: callers using the old token will lose access as soon as replacement succeeds.
3. Cancel to keep the current key, or confirm the replacement.
4. In **Save API key**, select **Copy API key**, privately save the new token, then select **I saved this API key**. It is shown once.
5. Update each caller to use the new token, then check a request through the published endpoint.

There is a gap between replacement and updating callers: new requests with the old token fail during that time. Requests already authenticated before replacement may finish. Replacement does not provide an overlap or grace period.

For gradual handover, create a separate key with the required scope and expiration, update and check callers, then revoke the original. That is a manual sequence, separate from **Replace key**.

Revoked and expired keys cannot be replaced. A following key is checked against the current published API type, so a REST key cannot be replaced after its API becomes GraphQL. A pinned key is checked against its immutable pinned release, even while dormant; replacing it does not make it usable against a different current revision. Replacement never removes a pin or extends expiry. Create a separate key to change that choice. A draft-only edit changes neither check.

Two concurrent replacements of the same key cannot both succeed. One wins; the other sees a conflict. A server-side validation or transaction failure leaves the old key unchanged.

### If the response is lost

Do not automatically retry replacement. The server may have committed it even if the caller did not receive the response. Refresh the key list and check whether the original is revoked and a replacement exists. Tokens cannot be retrieved from that list. If the replacement succeeded but its token was lost, revoke that replacement and create a new key, or replace the active replacement and save its returned token.

The same one-time-token limit applies to a lost creation response. The dashboard reports **Could not confirm whether the API key was created. Refresh API keys to review the current list...** and disables creation until a successful explicit refresh. A committed secret cannot be retrieved. Revoke the created key or replace it while unexpired/unrevoked, including a dormant pin, if current issuer authority allows replacement. Review the current or supplied publication before a new pin after `409`.

The dashboard retains an issued token in memory until you acknowledge saving it. Save it before leaving or reloading; browser storage and SQLite do not hold a recoverable copy of the raw token.

## Revoke or let a key expire

Use **Revoke** when a caller should stop using an API. Revocation keeps metadata for the key and stops subsequent requests immediately. It does not cancel requests that already passed authentication. Revoking an already revoked key is safe; it stays revoked.

Expiration is required. When the saved expiration arrives, subsequent requests fail even if no one revokes the key. To continue after expiry, create a new key. Replacement before expiry keeps the existing expiration rather than extending it.

Invalid, expired, or revoked credentials return `401`. A valid key for another API, an operation it does not allow, or a pin that differs from the current publication returns `403`. Runtime keys never grant workspace management or draft-test access.

## Issuer-bound keys

Implemented in 0.10, required nullable metadata `issuerBinding: { memberId, action } | null` identifies a key's original member and authorizing action. Selected issuance requires an explicit current pin and derives the binding on the server. A bound key depends on that issuer's current action, API access, and dependency USE for the immutable release. Removing authority or deleting the issuer denies calls with `403`; old unbound keys remain independent. Restoring the authority can restore access while the key is unexpired, unrevoked, and its pin is current. Owner/all-mode ordinary issuance remains unbound.

Replacement checks current actor and original issuer authority and retains issuer/action/pin/grants/exact expiry, even for an owner. Blocked issuer authority returns `409` without replacement. Deleting a member retains a fail-closed issuer identity instead of clearing it. Checks also run around asynchronous data/provider work and before results; they do not undo already performed effects or promise cancellation of admitted work.

Selected key managers can list/manage bound keys for their shared APIs, while unbound keys are hidden as `404`. This is shared-API administration, not a claim that keys belong only to the member who created them. Revocation and scoped cleanup require the action/API scope but do not require retained USE. Managed load-test keys remain nonreplaceable.

Rows show **Linked to member _name_ · API key management** or **Load testing** for managed keys. Another issuer uses **Original member** and a short ID without a team lookup. **Current release · linked to member** describes metadata, not a guarantee that live issuer permissions allow a call. This is not product-user, record, field, or tenant authorization. See [selected actions and USE](roles.md#selected-api-actions-and-dependency-use).

## Product login attempts

GitHub product login binds each BEGIN attempt to the runtime key that started it. A replacement key cannot complete an attempt started by the old key. After replacement, start a new login attempt with the new token. A completion request that already passed authentication may finish. Product accounts and sessions remain the product server's responsibility. See [GitHub product login](product-auth.md).

## Save secrets and restore backups

Save runtime tokens privately in the caller's server configuration or secret store. Do not place them in browser code, browser storage, URLs, or logs. The server stores token hashes and shows raw tokens only when creating or replacing a key. Key lists and audit records contain metadata, not tokens.

A SQLite backup saves key hashes, scope, release pins, issuer bindings, expiration, and revocation state; it cannot recover a raw token. Restoring an older backup can restore old keys/member authority and omit a later replacement. Review restored metadata and revoke or replace restored access before resuming callers. Retain the new token privately when replacement is used.

GitHub connection secrets use a separate encryption key file. SQLite backup downloads omit that file; restore the matching private key with databases containing encrypted product credentials. See [data and recovery](getting-started.md#data-and-recovery) and [product credential recovery](product-auth.md#back-up-the-encryption-key).

See the [Core API reference](api.md#runtime-keys) for request formats and replacement status codes.
