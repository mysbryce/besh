# Besh

Build APIs by connecting nodes. Test a draft, inspect its response, and publish when ready.

Besh is an early, local development preview. The runnable core works; external integrations and the full AI agent are planned. See the [roadmap](docs/roadmap.md).

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

Next time, run `bun run dev` and open `http://127.0.0.1:5173`. Use your saved owner key. Keys stay in browser memory, so a reload asks you to sign in again.

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

Use `bun run preview:all --no-serve` to capture without starting the gallery. Use `bun run preview:all --open` to serve the latest successful capture again. Press Ctrl+C to stop. Output stays in ignored `.preview/`; your normal workspace is untouched. See the [preview inventory](docs/preview.md) for details and limits.

## Build your first API

1. Select **+** beside **Your APIs**.
2. Give your API a name, method, and path, such as `GET /hello`.
3. The starter flow connects **HTTP request** to **JSON response**.
4. Select the response node. Edit its JSON configuration and choose **Apply configuration**.
5. Select **Save draft**, then **Test flow**. Review the response.
6. Select **Publish**. Your endpoint is available at `/run/hello` on the API server.

Example response configuration:

```json
{
  "status": 200,
  "body": {
    "message": "Hello, Besh!",
    "name": "$input.query.name"
  }
}
```

Call it with an owner or member token:

```sh
curl "http://127.0.0.1:3000/run/hello?name=Ada" \
  -H "Authorization: Bearer YOUR_WORKSPACE_TOKEN"
```

In PowerShell, use:

```powershell
$beshToken = Read-Host 'Workspace token'
Invoke-RestMethod 'http://127.0.0.1:3000/run/hello?name=Ada' `
  -Headers @{ Authorization = "Bearer $beshToken" }
```

Use **Condition** to compare `body.active` with `true`, for example. Connect both `true` and `false` handles to a response path. Drag nodes from the palette or use its buttons. Select nodes or edges and press Delete to remove them.

Input references replace a whole value and preserve JSON types. Supported roots are `$input.body` and `$input.query`; missing values become `null`. Arbitrary expressions and JavaScript are not executed.

## What works

| Feature     | Current behavior                                                         |
| ----------- | ------------------------------------------------------------------------ |
| Setup       | One-time browser wizard with a server-issued setup link                  |
| Editor      | Add, move, connect, configure, and remove nodes                          |
| Nodes       | HTTP request, condition, JSON response                                   |
| HTTP        | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS; exact paths                |
| Drafts      | SQLite persistence; incomplete graphs may be saved                       |
| Publishing  | Graph validation, route conflict checks, immutable release history       |
| Concurrency | Stale save/publish requests return `409`                                 |
| Access      | Server-enforced owner, editor, and viewer roles; revocable member tokens |
| Audit       | Changes, tests, runs, backups, and access denials; latest 200 visible    |
| Migrations  | Versioned control-database schema history                                |
| Backups     | Consistent SQLite snapshots and authenticated downloads; restore tested  |

Draft edits do not change a live endpoint. Save and publish a new revision to update it. All generated endpoints currently require a workspace token. Per-endpoint credentials and public endpoints are planned.

Limits: 64 nodes, 128 edges, no cycles, bounded JSON nesting, and 256 KiB flow/input/output limits. The HTTP server also limits request bodies to 256 KiB. No network or database execution nodes are included yet.

## Roles

| Action                                   | Owner | Editor | Viewer |
| ---------------------------------------- | ----- | ------ | ------ |
| Read drafts and call published endpoints | Yes   | Yes    | Yes    |
| Create/edit/test drafts                  | Yes   | Yes    | No     |
| Publish                                  | Yes   | No     | No     |
| Members, audit, migrations, backups      | Yes   | No     | No     |

Member tokens are shown once. Revoke a member to invalidate their token. The owner key cannot be revoked from the member screen. Tokens do not expire automatically in this preview.

## Data and recovery

Workspace data lives in `data/besh.sqlite`. Backups live in `data/backups/`. Both folders are ignored by Git. Backups contain credential hashes and workspace data; store them privately.

To restore without overwriting your current workspace:

1. Stop Besh.
2. Keep the existing database and its `-wal` / `-shm` files together. Do not replace a live database.
3. Copy a downloaded backup to a new filename, such as `data/restored.sqlite`.
4. Set `BESH_DATABASE_PATH=data/restored.sqlite` in `.env` and restart.
5. Sign in with a token valid at backup time. Check flows, logs, and a test response before using the restored copy.

Only Besh's control database is backed up. External database backups, schedules, retention, encryption, and remote storage are planned.

If you lose the owner key, stop Besh and generate a new long random value. Set `BESH_ADMIN_TOKEN` in a private `.env`, then restart. This replaces the owner token. Remove the variable afterward; the hash remains in SQLite. Treat server filesystem access as owner access.

## Configuration

Configuration is optional. Copy `.env.example` to `.env` only when needed.

| Variable             | Default / purpose                                               |
| -------------------- | --------------------------------------------------------------- |
| `PORT`               | API port, `3000`                                                |
| `BESH_HOST`          | API host, `127.0.0.1`                                           |
| `BESH_DATABASE_PATH` | `data/besh.sqlite`                                              |
| `BESH_BACKUP_DIR`    | `data/backups`                                                  |
| `BESH_ADMIN_TOKEN`   | Optional recovery/automation key, at least 32 random characters |
| `BESH_SETUP_KEY`     | Optional setup challenge; generated automatically otherwise     |
| `BESH_WEB_URL`       | Dashboard origin used for setup link; dev command sets it       |
| `BESH_API_URL`       | Vite proxy target; defaults to `http://127.0.0.1:3000`          |

If you change `PORT` during development, also set `BESH_API_URL` to that port. The dashboard uses port `5173`. It fails clearly if the port is already occupied.

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

PostgreSQL, MySQL/MariaDB, SQLite product data, MongoDB, Supabase, Firebase; GitHub, Discord, Facebook and other identity providers; WebSocket flows; custom plugins; GitHub update notices; and a full AI operator for Anthropic, OpenAI, OpenRouter, Ollama-compatible APIs and Codex CLI.

These are roadmap items, not enabled providers. No credentials or external accounts are required for this core release.

## Read more

- [Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md) · [API reference](docs/api.md)
- [Testing](docs/testing.md) · [Glossary](GLOSSARY.md) · [Agent instructions](AGENTS.md)
- [Page/action previews and Git ignore rules](docs/preview.md)
- [AI policy](AI_POLICY.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md)

MIT licensed, like [Elysia](https://github.com/elysiajs/elysia). See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
