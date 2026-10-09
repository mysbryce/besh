# Getting started

Build APIs by connecting nodes. Test a draft, inspect its response, and publish when ready.

Besh is an early, local development preview. Build visual REST and GraphQL APIs, then use built-in k6 load testing to check their published behavior. Spreadsheet snapshots, public Google Sheets imports, uploaded read-only SQLite copies, and a GitHub product login template also work. The GitHub exchange is tested with controlled provider responses; a live OAuth app round trip still needs your credentials and product callback. Live external database adapters, SQL writes, and the full AI agent remain planned. See the [roadmap](roadmap.md).

## Start in two commands

Install [Bun](https://bun.sh/docs/installation) 1.4.2 or newer. From this folder:

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

An empty API Studio offers **Build a blank API** and, with source access, **Start with a spreadsheet**. Choose the spreadsheet path if your rows already live in CSV, Excel or a public Google Sheet. Import and inspect them, then explicitly create an API draft. Opening either path does not save or publish an API.

For a blank API:

1. Choose **Build a blank API**, or select **+** beside **Your APIs** for another API.
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

| Feature       | Current behavior                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Setup         | One-time browser wizard with a server-issued setup link                                                   |
| Editor        | Add, move, connect, configure, and remove nodes                                                           |
| Nodes         | HTTP request, condition, spreadsheet rows, uploaded SQLite rows, GitHub social login, JSON response       |
| Data          | CSV/Excel uploads and public Google Sheets, saved previews, typed column mapping                          |
| Databases     | Immutable uploaded SQLite copies, inspected tables, selected read previews, REST/GraphQL draft generation |
| Product login | GitHub OAuth connection, generated REST/GraphQL identity draft; product server handles callback/session   |
| Appearance    | Light, dark, or system theme; keyboard-accessible custom controls                                         |
| HTTP          | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS; literal paths and whole-segment parameters                  |
| GraphQL       | Per-API typed schemas, queries/mutations, variables, field selection and bounded execution                |
| API rules     | Optional REST path/query/body/response types, required fields, nullability, and server checks             |
| OpenAPI       | JSON downloads for a saved REST draft or published release, kept separate                                 |
| Client code   | Eight server-side request targets, saved-source revisions, typed inputs, and copy/download                |
| Drafts        | SQLite persistence; incomplete graphs may be saved                                                        |
| Publishing    | Graph validation, overlapping-route checks, immutable release history, permission-checked rollback        |
| Load testing  | Permission-authorized local k6 tests of published REST/GraphQL APIs, optional goals, saved summaries      |
| Concurrency   | Stale save/publish/rollback requests return `409`; active load tests block live route changes             |
| Access        | Built-in/custom action roles; workspace keys or email/password; expiring browser sessions                 |
| API keys      | Permission-issued keys for one published API, expiring grants, atomic replacement, immediate revocation   |
| Audit         | Changes, tests, runs, backups, and access denials; latest 200 visible                                     |
| Migrations    | Versioned control-database schema history                                                                 |
| Backups       | Consistent SQLite snapshots and authenticated downloads; restore tested                                   |
| Updates       | Owner-only manual public GitHub release notices; saved settings and cached results; no installation       |

Draft edits do not change a live endpoint. Save and publish a new revision to update it. Members with flow-read permission can inspect published history; publication permission allows restoring an earlier release without changing the draft. Rollback does not restore spreadsheet rows or provider credentials. Published endpoints require a runtime API key; owner and member tokens only access workspace management and permitted draft tests. Public endpoints remain planned.

Runtime keys grant REST requests, GraphQL queries, or GraphQL mutations for one published API. Expiration is required and must be within 366 days; the dashboard offers 1, 7, 30, or 90 days. Tokens appear once; save the token before leaving the page. Raw values are not persisted in browser storage, and the server stores their hashes. Revoked or expired keys stop working immediately. Grants cover the whole operation, not individual fields or records. A following key uses its API across published revisions. A pinned key only accepts its exact revision while it is currently published, becomes dormant after another publication, and can work again after exact rollback if unexpired/unrevoked. Pins do not restore mutable data or add tenant/record policy. See [runtime keys](api-keys.md).

To replace an active token, open **API keys**, select **Replace key**, and confirm immediate replacement. For a short handover, open **Replacement options**, select **Short overlap**, and review 1–300 seconds. Save the returned token and update your callers before the server's accepted deadline. Replacement preserves the name, API, operations, release pin, issuer, tenant, and exact expiration. General requests already admitted may finish; WS and product-login final checks retain their original credential window. Revoke only the exact reviewed key when cleanup is needed. Revoked or expired keys need new issuance. See [runtime API keys](api-keys.md) for deadlines, lost-response recovery, login attempts, and backup behavior.

Limits: 64 nodes, 128 edges, no cycles, bounded JSON nesting, and 256 KiB flow/input/output limits. Spreadsheet and SQLite uploads use separate bounded multipart routes. SQLite reads have additional [database limits](databases.md#limits). General network requests, live external database connections, and SQL writes remain planned.

## Inspect published backend code

**Publish** prepares the backend module and current runtime routes automatically; no manual backend coding or code-directory setting is needed. With API-read permission, expand **API tools** below the canvas and test response, then open **Generated backend** to inspect/copy/download the current publication, review its requirements, and refresh after a revision conflict. The downloaded module uses Besh runtime services and contains configured flow values; it is not a standalone server. See [published backend code](runtime-code.md) for recovery and security boundaries.

## Copy client code

In API Studio, expand **API tools** below the canvas and test response, then open **Use this API** with flow-read permission. Keep **Published release** as the example source, choose a client target, fill its request inputs, and select **Generate example**. Copy or download the source and follow its dependency instructions. Examples use a separately issued runtime key through `BESH_RUNTIME_API_KEY` in your caller's server environment; no token is entered into the panel. Generation does not call the API. Explicit **Saved draft** examples require publication before runtime use. See [client code examples](client-code.md) for the eight targets, source/revision rules, and setup.

## Load test a published API

Open **Load testing** with load-test permission. Choose a published API, fill any required request fields, then select **Run load test**. Defaults run one virtual user for five seconds and check a 1000 ms p95 goal with at most 1% errors. You can change the settings, inspect results, cancel a running test, or review saved history.

Besh downloads and verifies pinned k6 on first use, then caches it. The first download needs internet access; no manual installation, script, runtime-key creation, or Grafana Cloud account is needed. For GraphQL, review the generated example operation and supply its required arguments; variables use field forms. Advanced JSON input is optional.

Write methods and mutations call the live API repeatedly and require dashboard confirmation. Tests do not roll back side effects. Product login APIs cannot be load tested automatically. One run is allowed at a time, with at most ten virtual users and thirty seconds of scheduled load. See [load testing](load-testing.md) for results, permissions, configuration, and recovery limits.

## Make an API from a spreadsheet

Open **Data sources** with source-read and source-write permission, as owners and editors have by default. Name the source and import a CSV or Excel `.xlsx` file, or choose **Public Google Sheet** and paste its standard share link. Review the first ten rows, detected types, and safe API field names. Choose columns to return, name the API, review its endpoint path and row limit, then select **Create API from data** with flow-write permission. This creates a draft; testing, publication, and caller-key creation each require their separate grants.

Imports save snapshots. Upload replacement and Google refresh require confirmation because published APIs read the latest saved source data. Google refresh is manual; private-sheet OAuth and scheduled synchronization are planned. See [spreadsheet data](data-sources.md) for limits and permissions.

## Make an API from a SQLite copy

Open **Database connections** with the appropriate database-copy grants. Upload a consistent standalone SQLite export, choose a table and fields, and preview a bounded selection of rows. No database server, SQL, or connection string is needed. Generated APIs read the saved copy; changes to your original database do not synchronize automatically. See [uploaded SQLite copies](databases.md) for permissions, generation, limits, and recovery.

## Add GitHub product login

Open **Product login** with connection-management permission. Save a GitHub OAuth app's client ID, secret, and exact product-server callback URL. Generate a REST or GraphQL draft with connection-read and flow-write permissions, test its BEGIN action, review the result and rules, then publish and issue a scoped runtime key with those separate grants. Built-in editors can generate/test drafts but cannot edit credentials or publish.

Your product server retains the runtime key and separate proof, sends the authorization URL to the browser, handles GitHub's callback, and completes the attempt through Besh. Besh returns provider identity; your product defines its accounts and sessions. This does not sign users into the Besh workspace. Follow [GitHub product login](product-auth.md) for app registration, callback integration, request examples, test limits, and the required separate encryption-key backup.

## Add REST API rules

Open **API rules** in the REST studio. Add path, query, body, or response fields using names and type selectors. Path fields follow the route and are always required and non-nullable; other fields have required choices. Body and response fields can also allow null. Nested objects, lists, item rules, and optional limits all use forms. Save and test valid input, then try a missing required field. The server returns 400 for invalid input and a generic 500 for a response that violates its rules. GraphQL uses its own schema.

Choose a saved draft or published release to download its OpenAPI document. Save browser edits before exporting a draft. Published documentation and live rules stay at the selected published revision until a member with publication permission changes it. Downloads require flow-read permission; calling the documented route requires its runtime API key. See [REST API rules and OpenAPI](api-contracts.md) for a quick example, supported types, and limits.

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

The table shows unchanged built-in roles. Owners can also create custom roles with selected action grants and assign them to members. Custom grants are independent. Eligible members can narrow existing-API actions to selected APIs and typed dependency USE; global resource/audit/backup grants remain workspace-wide. Neither form filters product fields or records. See [workspace roles and permissions](roles.md) for the catalog, examples, and session effects.

| Action                                         | Owner | Editor | Viewer |
| ---------------------------------------------- | ----- | ------ | ------ |
| Read drafts                                    | Yes   | Yes    | Yes    |
| Create/edit/test drafts                        | Yes   | Yes    | No     |
| Import/read/manage spreadsheet sources         | Yes   | Yes    | No     |
| Read/upload/check/delete SQLite copies         | Yes   | No     | No     |
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

Owners add editors/viewers or custom-role members from **Members**. Fill **Member email (optional)** and **Member password** for email/password sign-in, or leave email blank for key-only access. Save the issued member key; no invitation email is sent. Owners alone manage roles/member assignments and other members' sessions. Grant changes end affected browser sessions; member keys keep working with current server-checked permissions.

## Data and recovery

Workspace data lives in `data/besh.sqlite`. Backups live in `data/backups/`. Root runtime directories `/data/` and `/backups/` are ignored by Git; server source in `src/data/` remains tracked. Backups contain credential hashes, workspace data, spreadsheet rows, entire original SQLite uploads, and encrypted provider secrets; store them privately. Uploaded SQLite data is not encrypted by Besh.

Saving a product login connection creates `data/besh-secrets.key` automatically by default. This local encryption key is not included in SQLite backup downloads. Back it up privately and separately; a restored database needs the original matching key. Never commit it. If encrypted records exist without the key, Besh fails startup rather than replacing it. See [product credential recovery](product-auth.md#back-up-the-encryption-key).

To restore without overwriting your current workspace:

1. Stop Besh.
2. Keep the existing database and its `-wal` / `-shm` files together. Do not replace a live database.
3. Copy a downloaded backup to a new filename, such as `data/restored.sqlite`.
4. Set `BESH_DATABASE_PATH=data/restored.sqlite` in `.env`. If the backup contains product connections, keep its matching `besh-secrets.key` beside the restored database or set `BESH_SECRET_KEY_PATH` to the matching private key path. Restart.
5. Sign in with credentials valid at backup time. Check flows, logs, and a test response before using the restored copy.
6. Review restored accounts and sessions, and revoke or replace restored keys. A snapshot can restore old passwords, unexpired sessions, and runtime keys revoked or replaced after it was taken, while omitting later replacements. Ending sessions alone does not disable restored passwords or member keys. Key hashes in a backup cannot recover a lost raw token.

Besh's control database backup includes saved spreadsheet rows and original uploaded SQLite copies. No separate product copy file is needed for restoration. Live external database backups, schedules, retention, backup encryption, and remote storage are planned.

If you lose the owner key, stop Besh and generate a new long random value. Set `BESH_ADMIN_TOKEN` in a private `.env`, then restart. This replaces the owner token and ends owner sessions when the key changes. Remove the variable afterward; the hash remains in SQLite. The existing owner email/password remains valid; use the recovered key to update **Account & sessions** if that password also needs replacement. Treat server filesystem access as owner access.

## Configuration

Configuration is optional. Copy `.env.example` to `.env` only when needed.

| Variable                | Default / purpose                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `PORT`                  | API port, `3000`                                                                                     |
| `BESH_HOST`             | API host, `127.0.0.1`                                                                                |
| `BESH_DATABASE_PATH`    | `data/besh.sqlite`                                                                                   |
| `BESH_BACKUP_DIR`       | `data/backups`                                                                                       |
| `BESH_SECRET_KEY_PATH`  | `besh-secrets.key` beside the control database; optional private encryption-key path                 |
| `BESH_ADMIN_TOKEN`      | Optional recovery/automation key, at least 32 random characters                                      |
| `BESH_SETUP_KEY`        | Optional setup challenge; generated automatically otherwise                                          |
| `BESH_WEB_URL`          | Exact browser origin for authentication and setup link; dev command sets it                          |
| `BESH_API_URL`          | Vite proxy target; defaults to `http://127.0.0.1:3000`                                               |
| `BESH_K6_PATH`          | Optional trusted existing k6 executable; otherwise provision automatically                           |
| `BESH_K6_CACHE_DIR`     | Optional k6 cache directory; defaults to `.cache/k6`                                                 |
| `BESH_RUNTIME_CODE_DIR` | Optional administrator-trusted private loader directory; defaults to a unique OS temporary directory |

If you change `PORT` during development, also set `BESH_API_URL` to that port. The dashboard uses port `5173`. It fails clearly if the port is already occupied.

Set `BESH_WEB_URL` to the exact public HTTPS origin when using a reverse proxy, with no path or trailing slash. HTTP browser sessions are allowed only on loopback. The server does not trust forwarded headers for the browser origin. See [workspace authentication](workspace-auth.md#browser-origin-and-api-clients) for cookie, CSRF, session, and login limits.

## Project layout

```text
src/              app.ts wiring, index.ts startup, errors.ts shared errors
  auth/           Workspace sessions and product OAuth
  data/           Spreadsheet snapshots, Google Sheets, Excel parsing
  databases/      Uploaded SQLite copies and bounded native readers
  flows/          Flow model, contracts, executor, releases, generated routing
  load-tests/     Local k6 jobs and provisioning
  updates/        Manual GitHub release notices
  workspace/      Control store, permissions, backups
web/              React dashboard and Zustand editor state
  components/ui/  shadcn/ui components
test/             Bun tests through HTTP and executor interfaces
e2e/              Playwright browser story
scripts/          Local dev startup and preview gallery
docs/             Architecture, roadmap, testing, API reference
```

One package manifest. Server features are grouped by domain; application wiring, startup, and shared errors stay at the source root.

## Development checks

```sh
bun run check
bunx playwright install chromium
bun run test:e2e
```

Playwright needs Node.js 22.22.1 or newer in addition to Bun. Alternatively, use installed Chrome for tests: set `PLAYWRIGHT_CHANNEL=chrome`. Browser tests use temporary SQLite databases and ports `4311` / `5179`.

Code style: no semicolons, single quotes, blank lines between steps, and comments for important intent only. Run `bun run format` before committing. Use Conventional Commits, such as `feat(flows): add condition nodes`. Tests must pass before every completed-work commit.

## Planned integrations

PostgreSQL, MySQL/MariaDB, live SQLite connections and writes, MongoDB, Supabase, Firebase; generated-product social-auth templates for Discord, Facebook, Google and other identity providers; product sessions and identity linking; WebSocket events/subscriptions and WS client/load tooling; custom plugins; verified update installation/recovery; and a full AI operator for Anthropic, OpenAI, OpenRouter, Ollama-compatible APIs and Codex CLI. Workspace sign-in uses email/password or member/owner keys.

These are roadmap items. Public Google Sheets imports, uploaded read-only SQLite copies, typed WebSocket request/reply, and the GitHub product identity template are implemented; other providers and live database adapters are not. GitHub needs a real OAuth app and product-server callback for a live sign-in. No external account is required for local flows, uploaded spreadsheets, or uploaded SQLite copies.

## Read more

- [Architecture](architecture.md) · [Roadmap](roadmap.md) · [API reference](api.md)
- [Testing](testing.md) · [Glossary](../GLOSSARY.md) · [Agent instructions](../AGENTS.md)
- [Page/action previews and Git ignore rules](preview.md)
- [GraphQL schemas and execution](graphql.md)
- [Published backend code](runtime-code.md)
- [Client code examples](client-code.md)
- [Spreadsheet data sources](data-sources.md)
- [Uploaded SQLite database copies](databases.md)
- [REST API rules and OpenAPI downloads](api-contracts.md)
- [Workspace accounts and sessions](workspace-auth.md)
- [Workspace roles and permissions](roles.md)
- [Runtime API keys](api-keys.md)
- [REST routes and release history](api-routes.md)
- [Built-in k6 load testing](load-testing.md)
- [GitHub product login](product-auth.md)
- [GitHub update notices](updates.md)
- [AI policy](../AI_POLICY.md) · [Code of conduct](../CODE_OF_CONDUCT.md) · [Security](../SECURITY.md)

MIT licensed. See [LICENSE](../LICENSE) and [third-party notices](../THIRD_PARTY_NOTICES.md).

## Protected tenant reads — implemented in 0.11

Implemented in 0.11. Owner-only **Tenant protection** approves exact immutable identities, assigns members, and selects source/table tenant columns. Supported APIs contain exactly one protected read returning `$data`; protected GraphQL uses the narrow flat `Query.rows` shape. Caller request values never establish identity. Protected keys require a current pin, and every non-owner uses their assigned identity with live issuer authority. Follow [row protection](row-protection.md) for reviewed setup, original-text spreadsheet eligibility, and stale/lost-save recovery.

First protection permanently makes ordinary backup routes owner-only, including older archives after deprotection/restart. Protected raw previews are also owner-only. An interrupted download is rejected when its size differs from reviewed metadata. Physical restoration of an older database can restore old security state; review policies, assignments, sessions, and credentials before serving callers. Product sessions and multiple workspaces remain separate work.

For a protected source or table, **API field access** chooses **All fields** or **Selected fields**. All includes future columns; selected can share none and new columns stay excluded. Review full column names and acknowledge empty or broader selections. Every protected graph using returned/filter columns outside the allowlist stops, including old publications and owner tests. The private tenant predicate still works; owner raw previews remain full. Omitted or inactive selections stay saved, and stale/unconfirmed saves require explicit refresh. See [API field allowlists](row-protection.md#api-field-allowlists) for setup and limits.

For different fields per tenant, open **Tenant-specific API fields** and choose an **Approved tenant** label. **Use shared API fields** inherits the global selection; **Choose fields for this tenant** narrows it. Review every SQLite table and confirm the change. Empty selections deny reads. A tenant choice cannot grant globally blocked fields or change tenant assignment. After an unknown or stale save, use **Refresh tenant API fields** before reviewing again. See [tenant field profiles](row-protection.md#tenant-field-profiles) for recovery and retained settings.
