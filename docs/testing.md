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

Install the browser with `bunx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome. Tests run against temporary SQLite databases on API port `4311` and dashboard port `5179`.

## Verified on 2026-10-08

Windows, Bun 1.3.14, Node 22.22.1, TypeScript 7.0.2, Playwright 1.64.0 with installed Chrome.

- Backend: 25 tests covering graph validation, branches, references, limits, credentials, roles, all seven REST methods, typed GraphQL operations, nesting/selection limits, error redaction, draft/release separation, conflicts, backup restoration, setup, and recovery.
- Browser: one complete user story covering wizard, custom checkbox/keyboard dropdown, owner login, node movement, drag/drop creation, handle connection, configuration, save, test, publish, live REST call, reload, members, backups, migrations, audit, unsaved-draft protection, and GraphQL schema/query/variable/mutation workflow.
- Browser console: no uncaught page errors in the verified story.
- Visual check: inspected the rendered studio screenshot at 1440px viewport width.
- Full preview: 71 screenshots covering all current pages and listed actions, custom controls, GraphQL success/error states, role boundaries, and 390px phone layouts. The walkthrough verifies a visible mobile canvas and accessible sign-out.
- Gallery: custom mouse/keyboard dropdown, search, group filters, empty results, all 71 image URLs, mobile layout, and denial of database/test-output URLs checked in Chrome. Desktop and mobile gallery screenshots inspected.
- Migration: a copy of the previous version-4 preview backup upgraded to version 5. Its published REST response remained unchanged, and a new GraphQL endpoint could use the same path in its own route namespace.
- React Flow emits non-fatal size warnings during full-page screenshot resizing. The final desktop and phone canvases render and pass visibility checks; no uncaught page errors were observed.
- Git ignore checks: 11 private/generated examples ignored and 10 source/configuration examples remain trackable.
- Launcher: `bun run setup` served a healthy API, HTTP 200 dashboard, and an unconfigured workspace through the proxy using an isolated temporary database.
- Final `bun run check`: type checks, 25 backend tests, production build, and formatting passed. SQLite statements are explicitly finalized before shutdown.

Run the commands again after any change. Production hosting, real external providers, multi-tenant isolation, plugin sandboxing, load testing, and security certification are not covered.
