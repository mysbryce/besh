# Getting started

Build APIs by connecting nodes. Test a draft, inspect its response, and publish when ready.

Besh is an early, local development preview. Build visual REST and GraphQL APIs, then use built-in k6 load testing to check their published behavior. Spreadsheet snapshots, public Google Sheets imports, and a GitHub product login template also work. The GitHub exchange is tested with controlled provider responses; a live OAuth app round trip still needs your credentials and product callback. Database adapters and the full AI agent remain planned. See the [roadmap](roadmap.md).

## Start in two commands

Install [Bun](https://bun.sh/docs/installation) 1.3.14 or newer. From this folder:

```sh
bun install --frozen-lockfile
bun run setup
```

Open the **First-run setup** link printed in the terminal. The wizard will:

1. Ask for a workspace name.
2. Prepare the local SQLite database and migration history.
3. Generate an owner key. Copy and save it before continuing.
4. Open the API Studio.

No database server or `.env` file is needed. Keep the terminal running. Press Ctrl+C to stop both servers.

Next time, run `bun run dev` and open `http://127.0.0.1:5173`. Use your saved owner key, or choose **Email & password** after adding sign-in details under **Account & sessions**. The browser restores an active HttpOnly session after reload; keys and passwords are not saved in local storage. See [workspace accounts and sessions](workspace-auth.md).

For one server with a built dashboard:

```sh
bun run build
bun start
```

Open `http://127.0.0.1:3000`, or its first-run setup link. The server binds to loopback by default.

## Preview pages and actions

```sh
bun run preview:all
```

This runs the browser walkthrough in a separate demo workspace, captures every current page and its actions, and serves a searchable screenshot gallery at `http://127.0.0.1:4174`. Click a screenshot to see it full size. Setup, editor actions, error states, roles, members, audit, backups, and phone layouts are included. Keys are masked.

Installed Chrome is detected automatically on Windows. Otherwise, first run `bunx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome`.

Use `bun run preview:all --no-serve` to capture without starting the gallery. Use `bun run preview:all --open` to serve the latest successful capture again. Press Ctrl+C to stop. Output stays in ignored `.preview/`; your normal workspace is untouched. See the [preview inventory](preview.md) for details and limits.

## Build your first API

1. Select **+** beside **Your APIs**.
2. Give your API a name, method, and path, such as `GET /hello`.
3. The starter flow connects **HTTP request** to **JSON response**.
4. Select the response node. Choose a status, add named fields, choose their types and values, then select **Apply configuration**. JSON editing is optional under **Advanced configuration**.
5. Select **Save draft**, then **Test flow**. Review the response.
6. Select **Publish**. Your endpoint is available at `/run/hello` on the API server.
7. Open **API keys**. Choose the published API, name the key, allow **REST requests**, and choose an expiration. Select **Create API key**, copy it, then acknowledge that you saved it.

For a greeting, add a text field named `message` with value `Hello, Besh!`. Add another field named `name`, choose **From query parameter**, and enter `name` as its input field. The equivalent advanced configuration is:

```json
{
  "status": 200,
  "body": {
    "message": "Hello, Besh!",
    "name": "$input.query.name"
  }
}
```

Call it with that scoped runtime API key:

```sh
curl "http://127.0.0.1:3000/run/hello?name=Ada" \
  -H "Authorization: Bearer YOUR_RUNTIME_API_KEY"
```

In PowerShell, use:

```powershell
$beshToken = Read-Host 'Runtime API key'
Invoke-RestMethod 'http://127.0.0.1:3000/run/hello?name=Ada' `
  -Headers @{ Authorization = "Bearer $beshToken" }
```

Use **Condition** to choose an input source and field, then compare it with a typed value. Connect both `true` and `false` handles to a response path. **Try it out** has path, query, and body field rows; raw input stays available under **Advanced test input**. Drag nodes from the palette or use its buttons. Select nodes or edges and press Delete to remove them.

Input references replace a whole value and preserve JSON types. Supported roots are `$input.params`, `$input.body`, and `$input.query`; missing references become `null`, while route parameters must be supplied before execution. Arbitrary expressions and JavaScript are not executed.

For a record endpoint, use `/v1/items/:id` and read the path field `id` in your response or condition. Test with `id=42`; the live URL is `/run/v1/items/42`. Path fields are always required. Optional API rules can convert them to numbers or booleans. Separate `/v1` and `/v2` flows keep distinct endpoints and keys. See [routes and release history](api-routes.md) for supported names and overlap rules.

## What works

| Feature       | Current behavior                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Setup         | One-time browser wizard with a server-issued setup link                                                 |
| Editor        | Add, move, connect, configure, and remove nodes                                                         |
| Nodes         | HTTP request, condition, spreadsheet rows, GitHub social login, JSON response                           |
| Data          | CSV/Excel uploads and public Google Sheets, saved previews, typed column mapping                        |
| Product login | GitHub OAuth connection, generated REST/GraphQL identity draft; product server handles callback/session |
| Appearance    | Light, dark, or system theme; keyboard-accessible custom controls                                       |
| HTTP          | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS; literal paths and whole-segment parameters                |
| GraphQL       | Per-API typed schemas, queries/mutations, variables, field selection and bounded execution              |
| API rules     | Optional REST path/query/body/response types, required fields, nullability, and server checks           |
| OpenAPI       | JSON downloads for a saved REST draft or published release, kept separate                               |
| Drafts        | SQLite persistence; incomplete graphs may be saved                                                      |
| Publishing    | Graph validation, overlapping-route checks, immutable release history, owner rollback                   |
| Load testing  | Owner-started local k6 tests of published REST/GraphQL APIs, optional goals, saved summaries            |
| Concurrency   | Stale save/publish/rollback requests return `409`; active load tests block live route changes           |
| Access        | Server-enforced roles; workspace keys or email/password; expiring browser sessions                      |
| API keys      | Owner-issued keys for one published API, expiring grants, atomic replacement, immediate revocation      |
| Audit         | Changes, tests, runs, backups, and access denials; latest 200 visible                                   |
| Migrations    | Versioned control-database schema history                                                               |
| Backups       | Consistent SQLite snapshots and authenticated downloads; restore tested                                 |

Draft edits do not change a live endpoint. Save and publish a new revision to update it. Members can inspect published revision history; owners can restore an earlier release without changing the draft. Rollback does not restore spreadsheet rows or provider credentials. Published endpoints require a runtime API key; owner and member tokens only access workspace management and permitted draft tests. Public endpoints remain planned.

Runtime keys grant REST requests, GraphQL queries, or GraphQL mutations for one published API. Expiration is required and must be within 366 days; the dashboard offers 1, 7, 30, or 90 days. Tokens appear once; save the token before leaving the page. Raw values are not persisted in browser storage, and the server stores their hashes. Revoked or expired keys stop working immediately. Grants cover the whole operation, not individual fields or records. A key follows its API across published revisions, so review grants when republishing broader behavior.

To replace an active token, open **API keys**, select **Replace key**, and confirm. Save the returned token and update your callers: the original stops accepting new requests immediately. Replacement keeps the same name, API, operations, and exact expiration; it does not extend access. Already authenticated requests may finish. For gradual handover, manually create another key, update callers, then revoke the original. Revoked or expired keys need a new issuance. See [runtime API keys](api-keys.md) for confirmation, lost-response recovery, product login attempts, and backup behavior.

Limits: 64 nodes, 128 edges, no cycles, bounded JSON nesting, and 256 KiB flow/input/output limits. Spreadsheet uploads use a separate bounded multipart route. General network requests and external database execution nodes remain planned.

## Load test a published API

Open **Load testing** as the owner. Choose a published API, fill any required request fields, then select **Run load test**. Defaults run one virtual user for five seconds and check a 1000 ms p95 goal with at most 1% errors. You can change the settings, inspect results, cancel a running test, or review saved history.

Besh downloads and verifies pinned k6 on first use, then caches it. The first download needs internet access; no manual installation, script, runtime-key creation, or Grafana Cloud account is needed. For GraphQL, review the generated example operation and supply its required arguments; variables use field forms. Advanced JSON input is optional.

Write methods and mutations call the live API repeatedly and require dashboard confirmation. Tests do not roll back side effects. Product login APIs cannot be load tested automatically. One run is allowed at a time, with at most ten virtual users and thirty seconds of scheduled load. See [load testing](load-testing.md) for results, permissions, configuration, and recovery limits.

## Make an API from a spreadsheet

Open **Data sources** with an owner or editor key. Name the source and import a CSV or Excel `.xlsx` file, or choose **Public Google Sheet** and paste its standard share link. Review the first ten rows, detected types, and safe API field names. Choose columns to return, name the API, review its endpoint path and row limit, then select **Create API from data**. This creates a draft; test it before the owner publishes it and creates a caller key.

Imports save snapshots. Upload replacement and Google refresh require confirmation because published APIs read the latest saved source data. Google refresh is manual; private-sheet OAuth and scheduled synchronization are planned. See [spreadsheet data](data-sources.md) for limits and permissions.

## Add GitHub product login

Open **Product login** as the owner. Save a GitHub OAuth app's client ID, secret, and exact product-server callback URL. Generate a REST or GraphQL draft, test its BEGIN action, review the result and rules, then publish and issue a scoped runtime key. Editors can generate/test drafts but cannot edit credentials or publish.

Your product server retains the runtime key and separate proof, sends the authorization URL to the browser, handles GitHub's callback, and completes the attempt through Besh. Besh returns provider identity; your product defines its accounts and sessions. This does not sign users into the Besh workspace. Follow [GitHub product login](product-auth.md) for app registration, callback integration, request examples, test limits, and the required separate encryption-key backup.

## Add REST API rules

Open **API rules** in the REST studio. Add path, query, body, or response fields using names and type selectors. Path fields follow the route and are always required and non-nullable; other fields have required choices. Body and response fields can also allow null. Nested objects, lists, item rules, and optional limits all use forms. Save and test valid input, then try a missing required field. The server returns 400 for invalid input and a generic 500 for a response that violates its rules. GraphQL uses its own schema.

Choose a saved draft or published release to download its OpenAPI document. Save browser edits before exporting a draft. Published documentation and live rules stay at the last published revision until the owner republishes. Downloads require a workspace member token; calling the documented route requires its runtime API key. See [REST API rules and OpenAPI](api-contracts.md) for a quick example, supported types, and limits.

## Build a GraphQL API

1. Create an API and choose **GraphQL** in **API type**.
2. Set its path, such as `/greeting`. It will accept POST at `/graphql/greeting`.
3. The starter schema exposes `hello { message }`. Custom schema editing is available under **Advanced schema**.
4. Configure response nodes to return data matching your schema.
5. Save, enter a GraphQL operation and variables, then select **Test flow**.
6. Publish. In **API keys**, issue a key for this API with **GraphQL queries**, **GraphQL mutations**, or both. Call the endpoint with that key.

Each query or mutation root field runs the visual flow. Arguments are available under `$input.body`; conditions can branch on `query.field` and `query.operation`. GraphQL applies field selection, types, aliases, fragments, and nullability to the returned response body.

REST and GraphQL keep separate routes and published releases. GraphQL currently uses POST with JSON requests. Subscriptions, custom scalars, and runtime schema introspection are not enabled. See [GraphQL guide](graphql.md) for examples, permissions, and limits.

## Roles

| Action                                         | Owner | Editor | Viewer |
| ---------------------------------------------- | ----- | ------ | ------ |
| Read drafts                                    | Yes   | Yes    | Yes    |
| Create/edit/test drafts                        | Yes   | Yes    | No     |
| Import/read/manage spreadsheet sources         | Yes   | Yes    | No     |
| Read product login connections/generate drafts | Yes   | Yes    | No     |
| Create/edit/delete product login connections   | Yes   | No     | No     |
| Publish                                        | Yes   | No     | No     |
| Inspect release history                        | Yes   | Yes    | Yes    |
| Roll back a published release                  | Yes   | No     | No     |
| Members, audit, migrations, backups            | Yes   | No     | No     |
| Change own email/password with proof           | Yes   | Yes    | Yes    |
| Inspect/revoke own browser sessions            | Yes   | Yes    | Yes    |
| Inspect/revoke other members' sessions         | Yes   | No     | No     |
| Create/list/replace/revoke runtime API keys    | Yes   | No     | No     |
| Call published endpoints with member key       | No    | No     | No     |

Member tokens are shown once. Remove a member to invalidate their token, account, and sessions. The owner key cannot be revoked from the member screen. Owner and member keys do not expire automatically in this preview; browser sessions and runtime API keys expire. Runtime keys cannot manage the workspace or test drafts.

Every role can manage its own email/password under **Account & sessions**, with a current password or member key as fresh proof. Members see and revoke their own sessions; owners can inspect and revoke all workspace sessions. Ending a session leaves its member's sign-in credentials usable. See [workspace accounts and sessions](workspace-auth.md).

Owners add editors/viewers from **Members**. Fill **Member email (optional)** and **Member password** for email/password sign-in, or leave email blank for key-only access. Save the issued member key; no invitation email is sent.

## Data and recovery

Workspace data lives in `data/besh.sqlite`. Backups live in `data/backups/`. Both folders are ignored by Git. Backups contain credential hashes, workspace data, spreadsheet rows, and encrypted provider secrets; store them privately.

Saving a product login connection creates `data/besh-secrets.key` automatically by default. This local encryption key is not included in SQLite backup downloads. Back it up privately and separately; a restored database needs the original matching key. Never commit it. If encrypted records exist without the key, Besh fails startup rather than replacing it. See [product credential recovery](product-auth.md#back-up-the-encryption-key).

To restore without overwriting your current workspace:

1. Stop Besh.
2. Keep the existing database and its `-wal` / `-shm` files together. Do not replace a live database.
3. Copy a downloaded backup to a new filename, such as `data/restored.sqlite`.
4. Set `BESH_DATABASE_PATH=data/restored.sqlite` in `.env`. If the backup contains product connections, keep its matching `besh-secrets.key` beside the restored database or set `BESH_SECRET_KEY_PATH` to the matching private key path. Restart.
5. Sign in with credentials valid at backup time. Check flows, logs, and a test response before using the restored copy.
6. Review restored accounts and sessions, and revoke or replace restored keys. A snapshot can restore old passwords, unexpired sessions, and runtime keys revoked or replaced after it was taken, while omitting later replacements. Ending sessions alone does not disable restored passwords or member keys. Key hashes in a backup cannot recover a lost raw token.

Only Besh's control database is backed up. External database backups, schedules, retention, encryption, and remote storage are planned.

If you lose the owner key, stop Besh and generate a new long random value. Set `BESH_ADMIN_TOKEN` in a private `.env`, then restart. This replaces the owner token and ends owner sessions when the key changes. Remove the variable afterward; the hash remains in SQLite. The existing owner email/password remains valid; use the recovered key to update **Account & sessions** if that password also needs replacement. Treat server filesystem access as owner access.

## Configuration

Configuration is optional. Copy `.env.example` to `.env` only when needed.

| Variable               | Default / purpose                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `PORT`                 | API port, `3000`                                                                     |
| `BESH_HOST`            | API host, `127.0.0.1`                                                                |
| `BESH_DATABASE_PATH`   | `data/besh.sqlite`                                                                   |
| `BESH_BACKUP_DIR`      | `data/backups`                                                                       |
| `BESH_SECRET_KEY_PATH` | `besh-secrets.key` beside the control database; optional private encryption-key path |
| `BESH_ADMIN_TOKEN`     | Optional recovery/automation key, at least 32 random characters                      |
| `BESH_SETUP_KEY`       | Optional setup challenge; generated automatically otherwise                          |
| `BESH_WEB_URL`         | Exact browser origin for authentication and setup link; dev command sets it          |
| `BESH_API_URL`         | Vite proxy target; defaults to `http://127.0.0.1:3000`                               |
| `BESH_K6_PATH`         | Optional trusted existing k6 executable; otherwise provision automatically           |
| `BESH_K6_CACHE_DIR`    | Optional k6 cache directory; defaults to `.cache/k6`                                 |

If you change `PORT` during development, also set `BESH_API_URL` to that port. The dashboard uses port `5173`. It fails clearly if the port is already occupied.

Set `BESH_WEB_URL` to the exact public HTTPS origin when using a reverse proxy, with no path or trailing slash. HTTP browser sessions are allowed only on loopback. The server does not trust forwarded headers for the browser origin. See [workspace authentication](workspace-auth.md#browser-origin-and-api-clients) for cookie, CSRF, session, and login limits.

## Project layout

```text
src/              Elysia API, SQLite store, backup service
  flows/          Shared flow model, validation, executor, persistence
web/              React dashboard and Zustand editor state
  components/ui/  shadcn/ui components
test/             Bun tests through HTTP and executor interfaces
e2e/              Playwright browser story
scripts/          Local dev startup and preview gallery
docs/             Architecture, roadmap, testing, API reference
```

One package manifest. Shallow folders. Split features only when they need it.

## Development checks

```sh
bun run check
bunx playwright install chromium
bun run test:e2e
```

Playwright needs Node.js 22.22.1 or newer in addition to Bun. Alternatively, use installed Chrome for tests: set `PLAYWRIGHT_CHANNEL=chrome`. Browser tests use temporary SQLite databases and ports `4311` / `5179`.

Code style: no semicolons, single quotes, blank lines between steps, and comments for important intent only. Run `bun run format` before committing. Use Conventional Commits, such as `feat(flows): add condition nodes`. Tests must pass before every completed-work commit.

## Planned integrations

PostgreSQL, MySQL/MariaDB, SQLite product data, MongoDB, Supabase, Firebase; generated-product social-auth templates for Discord, Facebook, Google and other identity providers; product sessions and identity linking; WebSocket flows; custom plugins; GitHub update notices; and a full AI operator for Anthropic, OpenAI, OpenRouter, Ollama-compatible APIs and Codex CLI. Workspace sign-in uses email/password or member/owner keys.

These are roadmap items. Public Google Sheets imports and the GitHub product identity template are implemented; other providers and database adapters are not. GitHub needs a real OAuth app and product-server callback for a live sign-in. No external account is required for local flows or uploaded spreadsheets.

## Read more

- [Architecture](architecture.md) · [Roadmap](roadmap.md) · [API reference](api.md)
- [Testing](testing.md) · [Glossary](../GLOSSARY.md) · [Agent instructions](../AGENTS.md)
- [Page/action previews and Git ignore rules](preview.md)
- [GraphQL schemas and execution](graphql.md)
- [REST API rules and OpenAPI downloads](api-contracts.md)
- [Workspace accounts and sessions](workspace-auth.md)
- [Runtime API keys](api-keys.md)
- [REST routes and release history](api-routes.md)
- [Built-in k6 load testing](load-testing.md)
- [GitHub product login](product-auth.md)
- [AI policy](../AI_POLICY.md) · [Code of conduct](../CODE_OF_CONDUCT.md) · [Security](../SECURITY.md)

MIT licensed. See [LICENSE](../LICENSE) and [third-party notices](../THIRD_PARTY_NOTICES.md).
