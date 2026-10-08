# Page and action previews

Run `bun run preview:all` from the project root. The command runs a real browser walkthrough, captures screenshots, then serves a searchable gallery at `http://127.0.0.1:4174`.

Each card describes the action or state being shown. Select a page group or search the descriptions. Open a screenshot for its full size. The action manifest is also available from the toolbar.

## Commands

```sh
bun run preview:all
bun run preview:all --no-serve
bun run preview:all --open
```

The second command captures only. The third serves the latest successful capture without rerunning tests. Set `BESH_PREVIEW_PORT` to change the gallery port. Press Ctrl+C to stop.

Playwright needs Node.js 22.22.1 or newer. Installed Chrome is detected at its standard Windows location; otherwise install Chromium with `bunx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome`.

## Inventory

| Page or group  | Previewed actions and states                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup          | Connection error, retry, wizard, incorrect setup key, create workspace, one-time owner key, copy key, acknowledge and enter                                                                                                                       |
| Authentication | Login, rejected token, sign out, home link and reload                                                                                                                                                                                             |
| API Studio     | Empty workspace, new API, route settings, move/select nodes, invalid and applied configuration, save draft, invalid test input, test response, publish, HTTP call, release separation, publish revision, cancel/confirm discard, select saved API |
| Canvas         | Add condition, invalid graph, remove node, drag response from palette, connect handles, delete edge, restore request, true/false branches, zoom in/out, fit graph                                                                                 |
| Members        | Member list, create viewer/editor, role choice, copy token, acknowledge token, refresh, cancel/confirm revocation                                                                                                                                 |
| Data & backups | Empty history, migration log, create snapshot, download and verify SQLite header, refresh                                                                                                                                                         |
| Audit trail    | Recorded changes and actions, refresh                                                                                                                                                                                                             |
| What's next    | All four planned integration cards                                                                                                                                                                                                                |
| Permissions    | Viewer studio, denied administration pages, editor controls, revoked token rejected                                                                                                                                                               |
| Phone layout   | All five dashboard pages and login at 390px width, visible canvas, no document overflow, accessible sign-out                                                                                                                                      |

The current walkthrough produces 60 screenshots. The stock condition example is seeded through the public HTTP API; its runs are performed through the dashboard. The connection-error example is deliberately simulated at the HTTP boundary. Other recorded operations use the real local server and SQLite.

Native browser confirmation dialogs are checked through their accept/cancel results. Screenshots show the resulting page rather than browser chrome. This is an action walkthrough, not an exhaustive combination of every input, browser, device, or network failure. External integrations remain roadmap cards until implemented.

## Data isolation

- Every run creates a unique `.preview/run-*/` directory with its own demo database, backups, screenshots, and manifest.
- Test servers use ports `4322` and `5180`; the gallery uses `4174`. Occupied test ports cause failure instead of reusing another workspace.
- Screenshots mask owner, member, setup, and login keys. Browser traces and videos are disabled. Clipboard checks use disposable demo tokens.
- The gallery serves only its HTML, manifest, and screenshot PNGs. It does not expose demo databases, downloads, or test output.
- `.preview/latest.json` points to the last passing run. Failed runs do not replace it.
- Generated output is local and ignored by Git. Stop the preview command before manually removing old run directories to reclaim space.

## Git ignore choices

Ignore generated or private material:

- Dependencies, build output, tool caches, coverage, Playwright reports, screenshots, logs, and TypeScript build state.
- `.env` files, while keeping `.env.example` tracked.
- Workspace data and backup folders; SQLite databases and their WAL, SHM, and journal sidecars even outside `data/`.
- OS files and editor swap/temp files.

Keep application source, tests, scripts, docs, migrations, `bun.lock`, `AGENTS.md`, formatter settings, and shared editor settings tracked. Do not ignore all JSON, SQL, ZIP, or editor configuration files: they may be real project assets. If a test later needs a small database fixture, add an explicit exception and inspect its contents first.

Ignore rules do not remove files already tracked by Git. Inspect `git status` and staged changes before each commit.
