# Runtime API keys

Runtime API keys let a caller use one published Besh API. They are separate from workspace sign-in: owner/member keys and browser sessions manage the workspace, while runtime keys call published endpoints.

Owners and custom members with runtime-key management permission can create, list, replace, or revoke runtime keys. Built-in editors and viewers cannot. Each key has a name, one published API, allowed operations, and an expiration. REST keys allow **REST requests**. GraphQL keys allow **GraphQL queries**, **GraphQL mutations**, or both. These grants cover entire operations; field and record authorization remain planned. Workspace role grants do not change issued runtime credentials; see [roles and permissions](roles.md).

The dashboard also needs `flows.read` to list APIs when choosing a target for a new key. Key-management permission alone still allows listing, replacing, and revoking existing keys. The management API can issue a key for a known published flow ID without granting API reading.

## Create and use a key

1. Save, test, and publish your API in **API Studio**.
2. Open **API keys** with runtime-key management permission.
3. Choose the published API, give the key a recognizable name, and select the required operations.
4. Choose an expiration. The dashboard offers 1, 7, 30, or 90 days; the management API accepts a future date within 366 days.
5. Select **Create API key**. Copy the token and save it privately before acknowledging that you saved it.
6. Configure the caller to send `Authorization: Bearer <runtime-key>` to the published endpoint.

For a REST API published at `/hello`:

```sh
curl 'http://127.0.0.1:3000/run/hello?name=Ada' \
  -H 'Authorization: Bearer YOUR_RUNTIME_API_KEY'
```

GraphQL uses the same header on `/graphql/<published-path>` with a POST JSON operation. See the [GraphQL guide](graphql.md) for query and mutation examples.

Use the endpoint shown for the published API. For `/v1/items/:id`, substitute an encoded value for `:id`, such as `/run/v1/items/42`. Editing a draft's path or API type does not change its live endpoint. Keys follow the flow ID across publication and rollback, so review grants before changing live behavior. Separate `/v1` and `/v2` flows need separate keys; see [routes and release history](api-routes.md).

## Replace an active key

Replacement creates a new token and immediately revokes the old key in one database transaction. It preserves the old key's name, API, allowed operations, and exact expiration. It does not renew the lifetime or add permissions.

1. Open **API keys** and find the active key.
2. Select **Replace key**. Review the confirmation: callers using the old token will lose access as soon as replacement succeeds.
3. Cancel to keep the current key, or confirm the replacement.
4. In **Save API key**, select **Copy API key**, privately save the new token, then select **I saved this API key**. It is shown once.
5. Update each caller to use the new token, then check a request through the published endpoint.

There is a gap between replacement and updating callers: new requests with the old token fail during that time. Requests already authenticated before replacement may finish. Replacement does not provide an overlap or grace period.

For gradual handover, create a separate key with the required scope and expiration, update and check callers, then revoke the original. That is a manual sequence, separate from **Replace key**.

Revoked and expired keys cannot be replaced. Replacement also fails if the current published API type no longer accepts the old grants, such as a REST key after the API is republished as GraphQL. Create an appropriate new key instead. A draft-only API type change does not block replacement while the compatible release remains published.

Two concurrent replacements of the same key cannot both succeed. One wins; the other sees a conflict. A server-side validation or transaction failure leaves the old key unchanged.

### If the response is lost

Do not automatically retry replacement. The server may have committed it even if the caller did not receive the response. Refresh the key list and check whether the original is revoked and a replacement exists. Tokens cannot be retrieved from that list. If the replacement succeeded but its token was lost, revoke that replacement and create a new key, or replace the active replacement and save its returned token.

The dashboard retains an issued token in memory until you acknowledge saving it. Save it before leaving or reloading; browser storage and SQLite do not hold a recoverable copy of the raw token.

## Revoke or let a key expire

Use **Revoke** when a caller should stop using an API. Revocation keeps metadata for the key and stops subsequent requests immediately. It does not cancel requests that already passed authentication. Revoking an already revoked key is safe; it stays revoked.

Expiration is required. When the saved expiration arrives, subsequent requests fail even if no one revokes the key. To continue after expiry, create a new key. Replacement before expiry keeps the existing expiration rather than extending it.

Invalid, expired, or revoked credentials return `401`. A valid key for another API or an operation it does not allow returns `403`. Runtime keys never grant workspace management or draft-test access.

## Product login attempts

GitHub product login binds each BEGIN attempt to the runtime key that started it. A replacement key cannot complete an attempt started by the old key. After replacement, start a new login attempt with the new token. A completion request that already passed authentication may finish. Product accounts and sessions remain the product server's responsibility. See [GitHub product login](product-auth.md).

## Save secrets and restore backups

Save runtime tokens privately in the caller's server configuration or secret store. Do not place them in browser code, browser storage, URLs, or logs. The server stores token hashes and shows raw tokens only when creating or replacing a key. Key lists and audit records contain metadata, not tokens.

A SQLite backup saves key hashes, scope, expiration, and revocation state; it cannot recover a raw token. Restoring an older backup can restore an old key as active and omit a later replacement. Review restored metadata and revoke or replace restored access before resuming callers. Retain the new token privately when replacement is used.

GitHub connection secrets use a separate encryption key file. SQLite backup downloads omit that file; restore the matching private key with databases containing encrypted product credentials. See [data and recovery](getting-started.md#data-and-recovery) and [product credential recovery](product-auth.md#back-up-the-encryption-key).

See the [Core API reference](api.md#runtime-keys) for request formats and replacement status codes.
