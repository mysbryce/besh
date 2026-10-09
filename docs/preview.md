# Page and action previews

Run `bun run preview:all` from the project root. The command runs a real browser walkthrough, captures screenshots, then serves a searchable gallery at `http://127.0.0.1:4174`.

Each card describes the action or state being shown. Select a page group or search the descriptions. Open a screenshot for its full size. The action manifest is also available from the toolbar.

Document overviews use full-page images. Desktop actions inside a bounded scrolling inspector use viewport images so their actual reviewed fields and buttons remain visible. Phone forms flow naturally in full-page images; tall reviews include separate upper, argument and confirmation states.

## Commands

```sh
bun run preview:all
bun run preview:all --no-serve
bun run preview:all --open
```

The second command captures only. The third serves the latest successful capture without rerunning tests. Set `BESH_PREVIEW_PORT` to change the gallery port. Press Ctrl+C to stop.

Full-page overviews scroll to the top before capture. Check an opening panel's focus and viewport position before calling the capture helper; a completed task does not restore that earlier scroll position. Focused inspector actions verify the reviewed control stays inside its panel before and after the actual screenshot. Open dropdown captures preserve the viewport. The complete artifact walkthrough has a fifteen-minute budget; individual operations retain their shorter limits.

Inspect tall phone screenshots in lossless slices at their captured width when the viewer resizes the full image. Check dropdowns, selected text and confirmation buttons against their own cards on both phone and desktop; page-wide overflow checks alone can miss nested controls.

Member-field reviews also include native 390-pixel viewport companions for shared, tenant and member summaries and upper/lower confirmations. Use these originals for glyph and action checks when a full-page overview is resized.

Playwright needs Node.js 22.22.1 or newer. Installed Chrome is detected at its standard Windows location; otherwise install Chromium with `bunx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome`.

## Inventory

Member-field previews review a workspace member's inherited or selected source fields and complete SQLite table map. They distinguish current, inactive and unknown intersections; show configured members; and exercise selected-empty/reset, seven-value stale review, lost committed saves and delayed older shared-policy reads. Original credentials keep their issuer and published contract. Source/copy light/dark/system phone views check labels, nested controls and keyboard focus. See [member field profiles](row-protection.md#member-field-profiles) and current [acceptance evidence](testing.md).

First-task previews show the empty Studio's permitted spreadsheet and blank-API paths. The canonical shortcut opens the import form without saving data or an API; the standalone browser story also performs a real CSV import. Blank selection remains unsaved, and a member without source grants sees only its permitted path. Optional API tools and review details preserve visible primary actions and current status.

Protected read-graph previews add actual palette/handle branch authoring, reviewed last-read REST/GraphQL fields, simple body arguments and row-query forms. They exercise literal final results, nullable rows, untaken-branch denial/recovery with the original pin, metadata retry/pending/late responses, read-only controls, source-aware exports and desktop/phone appearance. Expanded graphs use Fit View; separate upper/argument/confirmation images expose tall reviews. See [protected read graphs](protected-read-graphs.md).

Tenant-specific field previews add approved-tenant labels, inherited/selected source fields and complete SQLite table maps. They distinguish currently applied choices from inactive prospective fields, show configured tenants, and require reviewed empty/widening/reset saves. Captures exercise independent table selections, all three version conflicts, retired/dormant maintenance, accepted/lost global saves, deferred initial loading, explicit recovery and late-response navigation. Light/dark/system phone views retain full labels and confirmation actions inside their own cards. See [tenant field profiles](row-protection.md#tenant-field-profiles).

Key handover previews add immediate/default and short-overlap forms, strict duration and acknowledgment, actual fixed deadlines, unchanged expiry, and exact linked-key cleanup. Captures distinguish pending metadata from confirmed deadlines, unconfirmed responses from active inventory, and explicit recovery from secret replay. All 35 added originals and affected legacy states were inspected; light/dark/system phone views keep timing and duration on separate field rows, full IDs readable, and receipts masked. Protected key-only members retain their assigned identity without private API/team/registry reads. See [key handover](api-keys.md#replace-an-active-or-dormant-key).

API field previews add all/selected controls for protected sources and individual SQLite tables, explicit empty/widening approval, retained inactive selections, and complete human labels. Actual pinned calls stop after restriction and recover after reviewed widening; owner raw previews and private tenant predicates stay separate. Captures cover stale/lost saves, pending navigation, explicit metadata recovery, permission boundaries, long Thai/unbroken labels, and light/dark/system phone views. See [API fields](row-protection.md#api-field-allowlists).

WebSocket previews cover reviewed protocol changes, flat received/reply field forms, canonical REST-read conversion, exact publication/artifact labels, required pinned `ws` callers, source-aware HTTP tools, and actual draft ticket/reply transport. Captures include readable rows, optional JSON, stale revision refresh, pending and dropped real mint responses, disconnect on edits, local oversized-message rejection, owner-reviewed or assigned tenant identity, read-only boundaries, and light/dark phone containment. Published WS is excluded from HTTP client exports/OpenAPI and k6 targets. External events and subscriptions remain planned. See [WebSocket APIs](websockets.md).

Tenant protection adds exact-text registry creation/editing/retirement, member assignment, spreadsheet and complete SQLite table policies, first-protection backup acknowledgment, and explicit recovery after stale or unconfirmed saves. Captures include owner-reviewed draft/caller/load identities, non-owner assigned identities without a picker, original-tenant replacement, real protected REST/GraphQL and k6, historical cleanup, incomplete backup rejection, and light/dark/system phone views. These are resource-owned read policies, not arbitrary graph or field authorization. See [tenant rows](row-protection.md).

Selected-API sharing adds all/selected modes, empty selections, compatible custom roles, confirmation/cancellation, role-expansion denials, current version/summary refresh, pending and lost saves, metadata retries, actual viewer session revocation/relogin, allowed REST/GraphQL exports, and hidden/private-read boundaries. Selected-empty views give owner-review guidance. Light/dark phone views contain the custom API controls and review. See [member sharing](roles.md).

Selected actions add typed source/database/product-login USE controls, schema-only node choices, real spreadsheet and SQLite execution, scoped publication, and member-linked callers. Captures cover operators without API-read access, required release pins, unchanged original bindings through replacement, dependency-use removal/restoration, explicit recovery after an unconfirmed issuance, actual k6, and authorized cleanup without USE. These controls do not provide row or tenant isolation. See [dependency use](roles.md#selected-api-actions-and-dependency-use).

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
| Tenant protection    | Exact identity, custom resource/column choices, complete SQLite mapping, review/confirm/cancel, permanent backup acknowledgment, stale/lost saves, explicit refresh, assigned identity and historical cleanup                                             |
| Data & backups       | Empty history, migration log, create snapshot, download and verify SQLite header, incomplete-response rejection/retry, permanent owner-only protection, refresh                                                                                           |
| Audit trail          | Recorded changes and actions, refresh                                                                                                                                                                                                                     |
| Updates              | Initial/cached/available/current/empty/failed notices, preview toggle, repository settings, unsaved refresh cancellation, stale-save recovery, cooldown, pending navigation, owner-only boundaries, light/dark/phone                                      |
| What's next          | All four planned integration cards                                                                                                                                                                                                                        |
| Permissions          | Viewer studio, denied administration pages, editor controls, revoked token rejected                                                                                                                                                                       |
| Phone layout         | Dashboard pages and login at 390px width, saved-API dropdown and selection, visible canvas, no document overflow, accessible sign-out                                                                                                                     |

The verified walkthrough captured 862 screenshots on 2026-10-09, including all 13 dashboard pages at desktop and phone widths in light and dark appearance. It preserves all previous 808 capture identities and adds 47 member-field states, three optional-tool states and four early first-task views. Existing coverage includes protected read graphs, tenant-specific/shared fields, WebSocket replies, tenant protection, selected actions/USE, generated backend code, REST/OpenAPI/client examples, workspace accounts, GitHub product login, API keys, k6, route history, roles, updates and SQLite copies.

Final gallery checks passed mouse/keyboard filtering, search, empty results, all 862 image URLs, phone containment and denial of private database/test-output paths. Light/dark/system appearance and reload passed separately. All three embedded fonts match the reviewed bytes and decode Latin, Latin Extended and Thai. Native 390-pixel companions show full labels, glyphs, warnings and confirmation controls. Tall overviews support state/context review rather than a native glyph claim when resized. The served denial image matches the exact refreshed artifact. The current walkthrough has 862 manifest records and 862 PNGs; exact browser/native results belong in [testing](testing.md).

All 54 new originals were independently inspected, including every native phone companion. Current own receipts, stale siblings, lost-save recovery, empty/reset choices and optional exports show their actual state. No supported visual blocker or credential exposure remained.

The preceding tenant-profile delivery inspected all 46 then-new originals and 40 affected legacy field-policy originals with 60 lossless native-width sections. Later captures refresh those states rather than reusing the earlier images.

All 40 added field states and affected policy/theme states were inspected. Original-pixel phone views preserve full human field labels, their normalized keys, independent table choices, empty/widening warnings, and explicit recovery. The legal 80-character unbroken header and Thai labels wrap without truncation in light/dark/system appearance. New captures contain no private row samples or caller credentials.

All 41 new selected-action states and 36 affected sharing states were inspected. Long phone forms were checked at their original pixel size. Sharing opens visibly after lower-row actions; member buttons and review controls stay contained. Key receipts remain masked, and historical or unknown release information is not presented as current authority.

All 68 added tenant states were inspected, with final affected phone forms and editor views checked at their original pixel size after the wrapping correction. The final capture includes a legal unbroken 80-character tenant label and 128-character immutable value in both phone themes. Complete labels wrap inside Edit buttons and registry/editor headings; ordinary Edit and Close retain their verified focus behavior. Full browser and native results belong in [testing](testing.md).

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

API key replacement previews cover cancel, confirmation results, one-time copy/acknowledgment, light/dark phone layouts, metadata refresh, stale and expired records, owner/editor boundaries, and audit history. Real published REST calls prove old-key 401 and replacement success. A query-only GraphQL replacement keeps its original expiry, succeeds for queries, and rejects mutations. See [runtime API keys](api-keys.md) for immediate replacement and reviewed bounded handover.

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
- Local skill installation metadata, including `skills-lock.json`. The local file stays available while Git stops tracking it.
- `.env` files, while keeping `.env.example` tracked.
- Root workspace `/data/` and `/backups/` folders; SQLite databases and their WAL, SHM, and journal sidecars even outside `data/`. Anchored folder rules keep `src/data/` application modules tracked and formatted.
- `besh-secrets.key`, the private product-login encryption key, wherever its default filename occurs. Keep any custom `BESH_SECRET_KEY_PATH` outside tracked source or add its exact private path to ignore rules.
- OS files and editor swap/temp files.

Keep application source, tests, scripts, docs, migrations, `bun.lock`, `AGENTS.md`, formatter settings, and shared editor settings tracked. Do not ignore all JSON, SQL, ZIP, or editor configuration files: they may be real project assets. If a test later needs a small database fixture, add an explicit exception and inspect its contents first.

Ignore rules do not remove files already tracked by Git. Inspect `git status` and staged changes before each commit.
