# Test agreement

User approved all three interfaces on 2026-10-08.

| Interface       | Catches                                                             | Does not prove                                       |
| --------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Public HTTP API | Authentication, permissions, save/publish/run flows, audit, backups | Browser behavior, external production infrastructure |
| Flow executor   | Branches, graph validation, input handling, execution limits        | Real external providers                              |
| Browser flow    | Add/move/connect nodes, save, test response, publish                | Production deployment and load                       |

Use real SQLite in temporary directories. Test through public routes or exported executor functions. Do not inspect private database state to assert behavior. Test one new behavior, observe failure, implement it, and rerun before the next slice.

## Commands

- `bun test ./test`: backend behavior.
- `bun run typecheck`: server and dashboard types.
- `bun run build`: production dashboard bundle.
- `bun run test:e2e`: browser flow with isolated servers and data.
- `bun run preview:all --no-serve`: full page/action walkthrough with masked screenshots and an isolated demo workspace. See [preview inventory](preview.md).
- `bun run format:check`: formatting.

Install the browser with `bunx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome. Tests run against temporary SQLite databases on API ports `4311` and `4312` and dashboard port `5179`.

## Verified on 2026-10-08

Windows, Bun 1.3.14, Node 22.22.1, TypeScript 7.0.2, Playwright 1.64.0 with installed Chrome.

- Backend: 59 tests with 514 assertions covering the core, scoped runtime keys, spreadsheet parsing and imports, source permissions, generated REST/GraphQL drafts, migration 7, and REST contracts/OpenAPI through public HTTP routes.
- Browser: three tests passed in about 1.3 minutes. The main story covers wizard, keyboard controls, node movement/creation/connection, forms, save/test/publish, REST/GraphQL runtime calls, reload, members, backups, migrations, audit, unsaved drafts, source lifecycle, filters, and scoped key grants/revocation. The appearance test covers system theme, explicit light/dark selection, keyboard interaction, and persistence after reload.
- The contract story uses a dedicated real server and temporary SQLite database. It covers nested field/item forms, local limit errors, query conversion, rejected input/output, save/reload, destructive-change confirmation, viewer restrictions, and real saved-draft/published OpenAPI downloads. Management requests are forwarded to that server rather than answered with mock data.
- Browser console: no uncaught page errors or uncontrolled-input warnings in the verified story. Contrast regression checks require at least 3:1 for active input boundaries in both themes and 4.5:1 for dark workspace input text.
- Visual checks: inspected setup, request/response/data forms, generated GraphQL, source mapping, custom controls, nested API rules, limit errors, and OpenAPI source choices in light/dark desktop and phone layouts. Tables and forms stay contained on phones. Dropdown capture waits for its opening fade to finish.
- Full preview: 165 masked screenshots captured successfully. Includes light/dark desktop and phone pages, simple/Advanced forms, scoped keys, spreadsheet API journeys, REST rules, OpenAPI downloads, errors, and role boundaries.
- Gallery verification passed: custom mouse/keyboard filters, search, empty results, all 165 PNG URLs returning 200, mobile layout without overflow, and private database/test-output paths returning 404. Gallery light/dark/system selection, reload, and OS preference behavior passed separately. Desktop, dark, and phone gallery screenshots were inspected.
- Independent standards smoke validated four actual HTTP/export cases plus a changed saved draft against the [official OpenAPI 3.1 schema](https://spec.openapis.org/oas/3.1/schema/2022-10-07) and a separate JSON Schema 2020-12 validator. Cases include numeric/boolean query values, one-code-point Unicode strings, nullable/absent bodies, nullable spreadsheet rows, and unchanged published documentation after draft edits. Python tooling was used only for this verification; it is not required to install Besh. This does not mean Besh accepts every JSON Schema keyword.
- Full `bun run check`: type checks, 59 backend tests with 514 assertions, production build, and formatting passed. Rule validation loads on demand; the initial dashboard bundle is 473.51 kB before gzip, with no large-chunk warning.

## Earlier core and integration checks

These checks passed during the same day's earlier spreadsheet delivery. They were not rerun for the REST-contract change unless listed above.

- Migration: a copy of the previous version-4 preview backup upgraded to version 5. Its published REST response remained unchanged, and a new GraphQL endpoint could use the same path in its own route namespace.
- Runtime-key migration smoke: a copy of a version-5 preview backup upgraded to version 6. A newly issued runtime key preserved its published REST response; the old owner token was rejected by the runtime boundary. The source backup remained untouched.
- React Flow emits non-fatal size warnings during full-page screenshot resizing. The final desktop and phone canvases render and pass visibility checks; no uncaught page errors were observed.
- Git ignore checks: 11 private/generated examples ignored and 10 source/configuration examples remain trackable.
- Launcher: `bun run setup` served a healthy API, HTTP 200 dashboard, and an unconfigured workspace through the proxy using an isolated temporary database.
- SQLite statements are explicitly finalized before shutdown. The earlier input-border regression was corrected and remains covered by the current browser suite.
- The final Chrome story passed real CSV import, column selection, simple data-node settings, generated drafts, immediate GraphQL testing without JSON/schema edits, published scoped-key REST/GraphQL calls and typed filters, canceled/live replacement, referenced-source deletion rejection, invalid Google links, controlled Google refresh UI, canceled dirty-draft generation, viewer source denial, dark input contrast, and literal request values.
- Final public Google smoke used the official public sample sheet over real network and HTTP: six columns, 30 rows, refresh version 2, and generated/published REST and GraphQL responses with two selected rows. This verifies public-sheet import and manual refresh; private OAuth and scheduling remain unimplemented.
- Final built-server Chrome smoke verified same-origin theme initialization with CSP preserved, dark appearance, owner login, actual Excel upload, and its rendered Ada row. The dark source screenshot was inspected. This does not certify hosting or load behavior.
- Migration 7 smoke upgraded a disposable version-6 snapshot through actual HTTP and preserved flow/key metadata and a published REST response. The untouched source backup's hash matched afterward. The baseline used current application code with migration 7 omitted, rather than a historical executable.

Browser traces and videos are disabled so one-time credentials do not enter captured browser artifacts. Preview screenshots mask keys, including runtime API keys. Tests use disposable credentials against isolated local databases.

Run the commands again after any change. Standard browser and preview suites remain independent of internet availability. Any controlled Google success/error responses in previews are labeled simulated; the separate smoke above exercised real Google. Production hosting, private external accounts, multi-tenant isolation, plugin sandboxing, load testing, and security certification are not covered.
