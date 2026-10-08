# GitHub product login

Generate a REST or GraphQL draft that starts GitHub authorization and returns a verified GitHub identity. This template is for users of your product. Besh workspace sign-in still uses member keys or email/password.

GitHub is the first implemented provider. Discord, Facebook, Google, and generic OIDC remain planned. Automated tests use controlled GitHub responses; no real OAuth app credentials were supplied for a live GitHub sign-in check. See [testing](testing.md) for verification evidence.

## What you need

- A Besh owner account or custom grants for managing the connection, publishing the API, and issuing a runtime key. Editors can review connections, generate drafts, and test their own attempts. Each action uses its own [workspace permission](roles.md).
- A GitHub OAuth app with its client ID and client secret.
- A product server with a callback route, such as `https://product.example.com/auth/github/callback`. Use HTTP only for local loopback development, such as `http://127.0.0.1:8080/auth/github/callback`.
- Temporary server-side storage that associates each login attempt with its initiating browser. Store the expected state and separate proof there until completion.

The generated endpoint requires a runtime API key. Your product server calls it and keeps the key and proof private. Besh does not host a public callback or a product login page. A browser-only product needs a server before it can use this template safely.

## Register the GitHub app

1. On GitHub, open **Settings**, then **Developer settings**, then **OAuth apps**.
2. Select **New OAuth App** or **Register a new application**.
3. Enter your product's application name and homepage URL.
4. Set **Authorization callback URL** to your product server's callback route. Register the exact URL you will enter in Besh and leave callback wildcard matching disabled.
5. Register the application. On its settings page, copy the client ID and select **Generate a new client secret**. Keep the secret private. See [GitHub's app credential instructions](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api#using-basic-authentication).

The callback URL points to your product, rather than `/run`, `/graphql`, or a Besh dashboard page. Besh accepts an HTTPS callback, or HTTP on `localhost`, `127.0.0.1`, or `[::1]`; it rejects user information, query strings, and fragments in that URL. Follow [GitHub's OAuth app registration guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) for the current GitHub settings.

## Save a connection and generate a draft

1. Sign in to Besh with product-connection management permission and open **Product login**.
2. Select **Connect GitHub**. Name the connection and enter the client ID, client secret, and exact callback URL. Select **Save connection**.
3. On its connection card, select **Create login API**. Enter **API name**, choose REST or GraphQL under **API type**, and set **Endpoint path** to `/login/github`.
4. Select **Create draft**. It connects **HTTP request** to **GitHub login** to **JSON response**. The social node references the saved connection under **GitHub connection**; the response returns `$auth`.
5. In **Try it out**, set **Login action** to **BEGIN · Start login** and select **Test flow**. Review the result and expiry. State and proof are hidden in the response display; **Copy authorization URL**, **Copy OAuth state**, and **Copy sensitive proof** are available for your own draft test. A BEGIN result creates an attempt but does not prove GitHub accepted the app credentials. For a draft completion, choose **COMPLETE · Finish login** and enter **Authorization code**, **OAuth state**, and **Login proof** from that same member's attempt and product callback.
6. Review the generated input/response rules or GraphQL schema. A member with publication permission publishes the draft when ready.
7. Under **API keys**, issue a key for that published API. Allow **REST requests** for REST, or **GraphQL mutations** for GraphQL, and choose an expiration. Save it in your product server's private configuration.

Built-in editors can generate and test a draft but cannot change provider credentials, publish, or issue runtime keys. Built-in viewers cannot access product connections. Custom roles grant `auth-connections.read` for metadata, `auth-connections.manage` for credential changes, and both `auth-connections.read` and `flows.write` for generation. Testing, publication, and key management need their separate grants. Draft-test attempts belong to the member who started them and cannot complete through a published route.

## Connect your product server

Selected access requires connection **USE** for existing authorized APIs. Structural choices expose only connection identity/provider, not OAuth settings or secrets. USE permits the API's product-login step; it does not grant connection management, new draft generation, a product session, or tenant authorization. Issuer-bound runtime keys retain their original issuer/action during rotation and recheck authority before/after provider work and final results. See [selected actions and USE](roles.md#selected-api-actions-and-dependency-use); this does not add provider verification.

The two actions use the same generated endpoint and the same runtime key:

1. When the user selects GitHub login, your product server sends `BEGIN` to Besh.
2. Besh returns `authorizationUrl`, `state`, `proof`, and `expiresAt`. Keep the proof and expected state in server-side temporary storage associated with that browser. Send only the authorization URL to the browser for navigation.
3. GitHub redirects the browser to your registered product callback with `code` and `state`, or an authorization error. Your product server checks that this callback belongs to the initiating browser and that state matches its saved attempt.
4. Your product server sends `COMPLETE`, the callback code/state, and its saved proof to Besh using the same runtime key. Finish within ten minutes. Do not retry a consumed attempt; start again after an error.
5. Besh exchanges the code with GitHub and reads the authenticated user's profile. On success, your product receives an identity. It can then apply its own account, session, and authorization rules.
6. Delete the temporary proof and state after success, denial, expiry, or failure.

Never place a runtime key or proof in a URL, your product's browser storage or frontend bundle, or logs. State is present in the GitHub authorization URL; proof is a separate server-held secret. Associate proof with the initiating browser rather than accepting a proof submitted by a product browser or completing any state that happens to exist. The member-authorized Besh draft tester is a management diagnostic; its attempts cannot be used through a published route.

### REST example

The generated REST route is POST. These requests are sent by your product server, with its runtime key in the Authorization header:

```http
POST /run/login/github
Authorization: Bearer <runtime-api-key>
Content-Type: application/json

{ "action": "BEGIN" }
```

A BEGIN response has this shape. Values below are placeholders:

```json
{
  "authorizationUrl": "https://github.com/login/oauth/authorize?...",
  "state": "<state>",
  "proof": "<server-held-proof>",
  "expiresAt": "<ISO-date>",
  "identity": null
}
```

After the product callback validates its browser association and state:

```http
POST /run/login/github
Authorization: Bearer <same-runtime-api-key>
Content-Type: application/json

{
  "action": "COMPLETE",
  "code": "<code-from-GitHub>",
  "state": "<matching-state>",
  "proof": "<saved-server-held-proof>"
}
```

### GraphQL example

Send the following mutation to `/graphql/login/github` from your product server with `Authorization: Bearer <runtime-api-key>`. `LoginAction` accepts `BEGIN` or `COMPLETE`; `code`, `state`, and `proof` are optional GraphQL arguments but required together for COMPLETE by the social node.

```graphql
mutation Login(
  $action: LoginAction!
  $code: String
  $state: String
  $proof: String
) {
  login(action: $action, code: $code, state: $state, proof: $proof) {
    authorizationUrl
    state
    proof
    expiresAt
    identity {
      provider
      subject
      username
      name
      avatarUrl
    }
  }
}
```

Use variables `{ "action": "BEGIN" }` first. For completion, use `{ "action": "COMPLETE", "code": "<code>", "state": "<state>", "proof": "<saved-proof>" }`. Choose only the fields your server needs. The generated `Query.info` returns the static string `GitHub product login` and cannot start or complete authorization. Calling it requires a query grant; the login mutation requires a mutation grant.

### Identity and limits

Successful completion returns `identity` with `provider: 'github'`, a stable provider `subject`, `username`, and nullable `name` and `avatarUrl`. The other result fields are null. Use the provider and subject together as the identity key; usernames can change.

The template does not return a GitHub access token or client secret, create a product account, issue a product cookie or JWT, link identities by email, or authorize access to product records. Those are separate product decisions. GitHub profile text and URLs are external data; render them with your normal escaping rules.

## Security and lifecycle

- BEGIN uses GitHub's authorization-code flow with S256 PKCE and the `read:user` scope. Besh fetches only fixed GitHub token/profile endpoints. An entire exchange has a five-second deadline, each provider response is limited to 64 KiB, and at most four exchanges run at once. See [GitHub's authorization guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
- State and proof are stored as hashes. The PKCE verifier is encrypted. An attempt expires after ten minutes and is bound to its flow, revision, runtime key or draft-testing member, and connection version.
- At most ten pending attempts exist for a credential and flow, with a thousand across the workspace. Flows allow one social node, and a selected OAuth mutation operation allows one login root call. Extra attempts or concurrent exchanges return 429; rejected graph/operation shapes cannot execute login.
- A valid completion consumes its attempt before calling GitHub. Reuse, mismatched proof, expiry, changed connection, or a different key/revision fails. Provider errors return a generic failure without provider tokens or payloads.
- Updating a connection increments its version and invalidates pending attempts. Published graphs keep immutable routes, rules, and connection references; they read current connection credentials. A connection used by a draft or release cannot be deleted.
- Audit events record `product-login.started`, `product-login.consumed`, and the final `product-login.completed` or `product-login.failed` outcome. Attempt insertion and consumption commit with their audit events. These records identify the caller scope and flow without storing the code, state, proof, provider tokens, or submitted payloads.
- Provider secrets and PKCE verifiers use AES-256-GCM encryption in SQLite. The local key file is created automatically when the first connection is saved. By default it is `besh-secrets.key` beside the control database; `BESH_SECRET_KEY_PATH` can select another private path. This protects local data at rest; it is not an OS-keystore integration or security certification.

### Back up the encryption key

The Besh backup download contains SQLite data, including encrypted provider secrets. It does **not** include the separate `besh-secrets.key` file. Back up that key privately and separately, and restore the database with its matching key. Never commit or share the key. Someone with both the database and key can decrypt provider secrets.

If encrypted records exist but their key file is missing, startup fails instead of creating a replacement key. Preserve the original key when moving the database or changing its path; configure `BESH_SECRET_KEY_PATH` if the key is stored elsewhere. Losing the key prevents recovery of the encrypted credentials. Review restored runtime keys and provider connections before resuming service, as described in [recovery](getting-started.md#data-and-recovery).

## Troubleshooting and next steps

- A missing connection prevents testing and publication. Select a saved GitHub connection in the social node.
- A draft test or runtime call can start an attempt without working GitHub credentials. Complete a real browser authorization round trip to verify the app and callback.
- After denial, expiry, provider failure, connection editing, or republishing, start a new attempt and discard the old proof.
- Keep the callback URL identical in GitHub and Besh. The product callback must be reachable by the user's browser.
- A member key cannot invoke a published login API. Use a current runtime key for that flow with its REST or mutation grant, and use the same key for both actions.

Next: implement your product's server-side callback and session policy, then run a real GitHub round trip using your own OAuth app. The repository's controlled provider tests verify local behavior but do not verify external GitHub credentials or deployed product infrastructure.

See [API reference](api.md#product-login-connections), [architecture](architecture.md#product-login-boundary), [security](../SECURITY.md), and [roadmap](roadmap.md).
