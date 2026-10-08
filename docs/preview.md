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

Selected-API sharing adds all/selected modes, empty selections, compatible custom roles, confirmation/cancellation, role-expansion denials, current version/summary refresh, pending and lost saves, metadata retries, actual viewer session revocation/relogin, allowed REST/GraphQL exports, and hidden/private-read boundaries. Selected-empty views give owner-review guidance. Light/dark phone views contain the custom API controls and review. See [member sharing](roles.md).

Generated-backend states show unpublished guidance, automatic generation on Publish, source/hash/route details, draft exclusion, copy/download, stale export rejection, explicit refresh, rollback, failed and pending reads, late responses, GraphQL, and read permission boundaries. Light/dark desktop and phone captures include the code panel. See [published backend code](runtime-code.md).

Release-pin states show default following keys, optional current-release selection, confirmation, one-time receipts, dormant replacement, rollback reactivation, stale-selection review, expiration/revocation, managed k6 pins, operators without API-read access, and metadata-error recovery. Light/dark desktop and phone captures include the custom release selector and confirmation. See [runtime keys](api-keys.md).

Client-code states add all eight REST/GraphQL language choices, source revisions, request/variable forms, copied/downloaded contents, unsaved-draft guidance, stale revision recovery, invalid inputs, pending actions, metadata errors and late responses, viewer access, and account-only denial. Light/dark phone captures use Fit View and check both graph nodes inside the canvas. See [client examples](client-code.md).

| Page or group        | Previewed actions and states                                                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup                | Connection error, retry, wizard, incorrect setup key, create workspace, one-time owner key, copy key, acknowledge and enter                                                                                                                               |
| Authentication       | Key and email/password sign-in, rejected credentials, sign out, home link and session restoration after reload, current-session revocation, light/dark and phone sign-in                                                                                  |
| Account & sessions   | Key-only account, fresh-proof rejection, saved email, custom proof selector, current-password proof form, current/other session metadata, refresh, cancel/confirm own-session revocation, light/dark desktop and phone layouts                            |
| API Studio           | Empty workspace, route/path parameter forms, typed tests, save/publish, immutable release history/review, canceled/confirmed rollback, stale rollback recovery, preserved draft edits, load-test route input, canvas actions, discard/select API          |
| API rules            | Query/response field forms, required whole-number inputs, custom type dropdown, rejected missing input, typed response, light/dark controls, phone containment                                                                                            |
| OpenAPI              | Saved-draft/published source selector, real JSON downloads, selected route/revision/security, changed draft route/nullability with unchanged release documentation                                                                                        |
| Canvas               | Add condition, invalid graph, remove node, drag response from palette, connect handles, delete edge, restore request, true/false branches, zoom in/out, fit graph                                                                                         |
| Members              | Built-in/custom role list, grouped action forms, sensitive-grant guidance, create/assign/edit/delete, in-use/stale errors, session revocation, pending navigation, optional accounts, masked keys, refresh/recovery                                       |
| API keys             | No published APIs, empty list, API/expiration dropdowns, permission toggles, issue/copy/acknowledge, cancel/confirm replacement and revocation, refresh errors, stale/expired keys, live REST/GraphQL grants, owner/editor/viewer boundaries              |
| Data sources         | File import, typed row preview, column mapping, draft generation, snapshot replacement, referenced-source deletion rejection, public-sheet form, manual refresh, access boundaries                                                                        |
| Database connections | SQLite copy upload, selected table/columns, typed equality filters, empty results, REST/GraphQL draft generation, node forms, copy checks, cancel/delete, historical dependency rejection, stale-copy recovery, explicit grants, themes and phone layouts |
| Product login        | GitHub connection forms, invalid callback, create/edit/delete/cancel, secret retention, REST/GraphQL draft generation, node connection choice, BEGIN/COMPLETE forms, explicit proof copy, invalid/replayed attempts, typed identity, role boundaries      |
| Load testing         | Empty state, published target dropdown, defaults, canceled live confirmation, real k6 results, reload/history, request and variable forms, optional settings/JSON, failed checks, managed keys, cancel, unavailable OAuth, refresh recovery, audit        |
| Data & backups       | Empty history, migration log, create snapshot, download and verify SQLite header, refresh                                                                                                                                                                 |
| Audit trail          | Recorded changes and actions, refresh                                                                                                                                                                                                                     |
| Updates              | Initial/cached/available/current/empty/failed notices, preview toggle, repository settings, unsaved refresh cancellation, stale-save recovery, cooldown, pending navigation, owner-only boundaries, light/dark/phone                                      |
| What's next          | All four planned integration cards                                                                                                                                                                                                                        |
| Permissions          | Viewer studio, denied administration pages, editor controls, revoked token rejected                                                                                                                                                                       |
| Phone layout         | Dashboard pages and login at 390px width, saved-API dropdown and selection, visible canvas, no document overflow, accessible sign-out                                                                                                                     |

The verified walkthrough captured 510 screenshots on 2026-10-09, including all 12 dashboard pages at desktop and phone widths in light and dark appearance, plus selected-API sharing, generated backend code, REST rules, OpenAPI downloads, client examples, workspace accounts/sessions, GitHub product login, API key replacement/release pins, k6 load tests, path parameters, release review/rollback, custom roles, update notices, and uploaded SQLite copies.

Gallery checks passed mouse/keyboard filtering, search, empty results, every image URL, phone overflow, and denial of private database/test-output paths. Light/dark/system appearance, reload, and OS preference behavior were verified separately. Desktop and phone screenshots were inspected, including the corrected input boundaries and settled theme controls.

Custom-role previews include actual grant changes and affected cookie revocation, empty-grant account restoration without private reads, assigned-role deletion rejection, stale edits, canceled/pending/confirmed assignments, and permission-catalog recovery. The catalog error uses controlled transport. Member keys stay masked. The sidebar scrolls navigation independently while keeping sign-out visible on short screens.

Updates screenshot scenarios use explicitly labeled controlled Besh UI fixtures for cached states and transport errors; they do not claim a live GitHub request. The separate update browser story uses real Besh routes and SQLite with only external GitHub transport controlled, and a native HTTP/GitHub smoke is recorded in [testing](testing.md). Notices report versions without downloading or applying updates.

SQLite previews use actual uploaded databases, native read-only children, and Besh HTTP routes. The 43 new states include selected rows, strict boolean filters, generated REST/GraphQL drafts, node configuration and contract guidance, pending actions, referenced deletion rejection, malformed files, externally removed copies, and independent read/manage grants. Only selected request delivery is delayed or failed for pending/retry states; row results are not simulated. Changing node settings does not rewrite its typed API rules or GraphQL schema. See [database copies](databases.md).

Client-code previews use real source metadata and generated text from Besh routes. They compare copied/downloaded contents and confirm that generation makes no runtime request. Only selected metadata/generation transport is delayed or failed for pending/retry states. No runtime credential is inserted, and entered sample values are safe fixtures. The 41 new captures are not claims of running code in the browser; independent native programs and the browser story are recorded in [testing](testing.md).

The stock condition example is seeded through the public HTTP API; its runs are performed through the dashboard. Connection errors, runtime-key loading errors, and the explicitly labeled Google success/refresh states use controlled HTTP responses. CSV import, API generation, publication, scoped runtime calls, replacement, and deletion checks use the real local server and SQLite.

Product-login previews use real Besh routes, SQLite, validation, execution, one-time attempts, permissions, and audit events. Only GitHub's external token/profile responses are simulated by the preview server. The returned demo identity is labeled simulated. This walkthrough does not verify real GitHub app credentials or a deployed product callback. See [product login](product-auth.md) for the complete server-side setup and separate encryption-key backup.

GraphQL previews cover API type choice, schema editing, saving, named queries, variables and field selection, type errors, mutations, live publication, invalid schema rejection, and phone layout. The method and role dropdowns are also captured open. Checkbox and dropdown controls use custom styling with keyboard support.

Light and dark captures cover representative workspace, custom control, form, source-preview, and phone states. Optional Advanced editors remain available alongside simple response, condition, data, and request forms.

Generated login graph captures use **Fit View** after opening the node inspector or resizing to phone width. The walkthrough checks that all three nodes fit horizontally inside the canvas before capturing them.

The REST-contract walkthrough uses a real saved API, server input checks, and browser JSON downloads. It checks that numeric query text returns a JSON number, exported documents carry the selected revision and runtime-key requirement, and a new draft path/nullability does not change the published document. Body previews include list shapes, nested object fields, text/item limits, and a helpful local error for contradictory bounds before save. Contract forms and custom type menus are captured in both themes; phone captures check document containment. Runtime keys are never included in downloaded OpenAPI documents. See [API rules](api-contracts.md) for supported schema limits.

API key replacement previews cover cancel, confirmation results, one-time copy/acknowledgment, light/dark phone layouts, metadata refresh, stale and expired records, owner/editor boundaries, and audit history. Real published REST calls prove old-key 401 and replacement success. A query-only GraphQL replacement keeps its original expiry, succeeds for queries, and rejects mutations. See [runtime API keys](api-keys.md) for immediate replacement and manual caller handover.

Load-testing previews run the actual local k6 binary against published REST and GraphQL APIs. They show default results, a deterministic expected-status failure, request/variable field forms, optional custom load settings and Advanced JSON, history restoration, managed temporary keys, cancellation, and OAuth flows excluded from automatic load. A labeled controlled metadata-transport failure exercises Refresh recovery. Reports, job state, and audit records otherwise come from real HTTP and SQLite. First capture requires internet to prepare k6 unless its managed cache or `BESH_K6_PATH` is already available. See [load testing](load-testing.md).

Native browser confirmation dialogs are checked through their accept/cancel results. Screenshots show the resulting page rather than browser chrome. This is an action walkthrough, not an exhaustive combination of every input, browser, device, or network failure. Google success and refresh previews may use explicitly labeled controlled HTTP responses to keep capture independent of internet availability; a separate real-network smoke is documented in [testing](testing.md). Private Google Sheets OAuth and remote database adapters remain planned.

## Data isolation

- Every run creates a unique `.preview/run-*/` directory with its own demo database, backups, screenshots, and manifest.
- Test servers use ports `4322` and `5180`; the gallery uses `4174`. Occupied test ports cause failure instead of reusing another workspace.
- Screenshots mask owner, member, runtime API, setup, and login keys, plus populated password, provider-secret, code, state, and proof inputs. Login test output hides proof/state and authorization URL challenges, even after the social node is removed. Empty password fields stay visible so their masks cannot cover an open dropdown. Browser traces and videos are disabled. Clipboard checks use disposable demo credentials.
- The gallery serves only its HTML, manifest, and screenshot PNGs. It does not expose demo databases, downloads, or test output.
- `.preview/latest.json` points to the last passing run. Failed runs do not replace it.
- Generated output is local and ignored by Git. Stop the preview command before manually removing old run directories to reclaim space.

## Git ignore choices

Ignore generated or private material:

- Dependencies, build output, tool caches, coverage, Playwright reports, screenshots, logs, and TypeScript build state.
- `.env` files, while keeping `.env.example` tracked.
- Root workspace `/data/` and `/backups/` folders; SQLite databases and their WAL, SHM, and journal sidecars even outside `data/`. Anchored folder rules keep `src/data/` application modules tracked and formatted.
- `besh-secrets.key`, the private product-login encryption key, wherever its default filename occurs. Keep any custom `BESH_SECRET_KEY_PATH` outside tracked source or add its exact private path to ignore rules.
- OS files and editor swap/temp files.

Keep application source, tests, scripts, docs, migrations, `bun.lock`, `AGENTS.md`, formatter settings, and shared editor settings tracked. Do not ignore all JSON, SQL, ZIP, or editor configuration files: they may be real project assets. If a test later needs a small database fixture, add an explicit exception and inspect its contents first.

Ignore rules do not remove files already tracked by Git. Inspect `git status` and staged changes before each commit.
