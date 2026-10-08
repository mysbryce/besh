# Besh context

## 2026-10-08 decisions

- User corrected social-auth scope: social sign-in means templates for generated product APIs, not the Besh workspace panel. Workspace sign-in uses email/password or member/owner keys. Product social-auth templates remain planned; workspace accounts and cookie sessions are implemented separately.
- User requested a README banner. An original Besh asset now introduces the visual API workflow; detailed project instructions remain in `docs/`.
- User requested a visual API creator with Bun/Elysia, React/Zustand, Tailwind/shadcn, database adapters, social auth, plugins, WebSockets, audit/migrations/backups, roles, updates, and a full multi-provider AI agent.
- User selected **runnable core plus complete roadmap** for first delivery. External integrations and the full agent remain later milestones. Avoid presenting them as installed features.
- User approved HTTP API, flow executor, and browser workflow as test interfaces. Use the local TDD skill for further changes.
- User prefers no semicolons, single quotes, readable spacing, blank lines, and comments only for important intent. Captured in Prettier and `AGENTS.md`.
- User requested simple installation with a setup wizard. Basic startup now creates the workspace through a one-time local setup link. Environment overrides remain optional for deployment/recovery.
- User requested broader Git ignore rules and previews of every page and action. Preview output is reproducible, isolated, masked, and ignored; the gallery covers the implemented core rather than inventing integration screens.
- User requires custom styled checkbox, radio, and dropdown controls. Current checkbox/dropdowns now use shared accessible components; the gallery uses its own keyboard-operated dropdown.
- User confirmed GraphQL per visual API, with real typed schemas, queries/mutations, variables, and field selection. GraphQL endpoints now share flow lifecycle and permissions; full external data providers remain planned.
- User approved separate runtime credentials for published APIs. Owner-issued keys now scope to one published flow with REST/query/mutation grants, required expiration, and immediate revocation. Member tokens remain management credentials.
- User requested a shorter repository README with detailed instructions in `docs/`, a navigable documentation index, and clear repository description/topics suggestions.
- User requested a warm white dashboard with charcoal controls and rounded cards, keeping Besh's API-builder behavior and accessible custom controls.
- User prefers compact `besh` branding in the preview gallery navigation rather than a large walkthrough title.
- User requires readable dark mode and beginner workflows with field forms; basic API creation and testing must not require JSON editing.
- User requested spreadsheet-driven APIs using Excel and Google Sheets. CSV/Excel import and public Google Sheets snapshots now use server-checked owner/editor access, reviewed column mapping, bounded reads, and runtime credentials.
- REST API rules and OpenAPI continue Milestone 2. Optional contracts stay inside saved flow revisions; recursive field forms cover objects, lists, item rules, and limits, while GraphQL SDL stays authoritative. Draft and published exports remain separate management operations.
- User asked to continue ordinary authorized work without creating further goals after automated review stopped one agent's review. Root completed defensive Excel parser validation and its public HTTP regressions. No additional policy or permission gates were introduced.
- No vault state was supplied; user stated vault unavailable. Repository docs hold current decisions. No direct vault access occurred.

## Choices and reasons

- One package and shallow folders keep the initial codebase easy to navigate. A large monorepo was unnecessary for this milestone.
- SQLite makes the local wizard work without external services. Product database adapters stay distinct from control storage.
- Interpret validated graph JSON rather than executing generated code. Untrusted plugin runtime requires a later isolation design.
- Separate draft and published definitions to avoid changing live endpoints during edits. Revision checks prevent lost updates.
- Use role-scoped workspace accounts, sessions, and keys for management and separate expiring runtime keys for callers. Whole-query/mutation grants avoid conflating member access with published API execution. Product social-auth templates and field/record permissions remain planned.
- Exchange workspace login credentials for fixed-lifetime HttpOnly cookie sessions so reload can restore sign-in without storing member keys or passwords in browser storage. Exact-origin and session-bound CSRF checks protect browser writes while explicit bearer management clients remain compatible. Keep account changes limited to the caller and require fresh credential proof; this avoids granting password changes from session possession alone.
- Retain owner-key filesystem recovery, but revoke owner sessions when that key changes. Preserve the owner's email/password account and document that it must be changed separately when compromised. Session revocation alone leaves passwords and member keys usable, and a restored backup can revive their earlier states.
- Use MIT for Besh with Besh's own copyright attribution.
- Use a bounded explicit schema subset rather than accepting arbitrary JSON Schema keywords. Convert declared numeric/boolean query text only; preserve exact JSON body/response types. Reject invalid input before execution and hide mismatched response data behind a generic 500.
- Generate OpenAPI 3.1.1 from the chosen saved REST snapshot. Omitted source means published, with no draft fallback. Emit schema/route/security metadata rather than inferring contracts from literals or leaking source rows and credentials. Old flows without rules remain compatible.

## Verification notes

- Red/green cycles exercised executor behavior, protected HTTP routes, roles, releases, backups, setup and limits.
- First browser test failed at the empty page; it passed after the real dashboard was implemented.
- TypeScript 7 removed `baseUrl`; paths now use relative targets without that option.
- Windows restricted execution blocked a Vite helper. Build/browser verification succeeded with required process permissions.
- Installed Chrome was used for browser verification. CI/other machines can install Playwright Chromium.
- Final shutdown checks exposed retained SQLite statements on Bun 1.3. File-deletion retries did not solve the cause. The store now owns and reuses prepared statements, finalizes them explicitly, and closes strictly. The full suite passes with this fix.
- Browser regression caught unsaved new drafts being discarded when switching APIs. Dirty-state checks now protect new and existing drafts.
- The complete preview walkthrough caught a collapsed phone canvas and an unnamed mobile sign-out control. Browser assertions reproduced both issues before CSS sizing and an explicit accessible label fixed them.
- Runtime credential browser slices first failed at missing API key navigation, revocation action, and GraphQL grant controls. The implemented UI now issues/copies/acknowledges scoped credentials; real runtime calls prove member denial, operation grants, flow scope, and immediate revocation. Mobile saved-API selection is separately tested through its custom dropdown.
- Preview capture lost its session when Tailwind's default repository scan turned an existing documentation edit into a full reload. A browser reproduction failed before limiting CSS sources to `web/` and ignoring documentation/generated output in the development watcher, then passed with the workspace session intact.
- Beginner response/request/condition forms were introduced through failing browser slices. The advanced request editor also rejected valid JSON with the wrong envelope shape after a `null` regression exposed a component crash; request strings resembling references remain literal input data.
- Spreadsheet browser slices exercised real CSV import, generated visual REST/GraphQL drafts, simple source/column/limit settings, typed optional filters, publication with scoped credentials, replacement visible to live callers, and referenced-source deletion rejection. Controlled HTTP responses verified Google UI states offline; a separate real-network smoke verified public Google import and refresh.
- Generated GraphQL drafts seed a matching rows query and hide schema/variable JSON until Advanced is opened. Loading or creating another draft resets test state; saving the current draft preserves its in-progress inputs.
- The first spreadsheet delivery passed types, 49 backend tests with 380 assertions, production build, and formatting. Two Chrome browser tests passed in 31.4 seconds. Its walkthrough captured 148 masked screenshots. Gallery controls, image URLs, mobile containment, private-path denial, and theme persistence passed. Real public Google import/refresh and built-server Excel/dark/CSP smokes also passed.
- Visual review caught faint input borders: a global border rule overrode Tailwind's input token. Browser contrast checks failed at 1.29:1 in light mode and 1.69:1 in dark mode, then passed after explicit input/textarea border, focus, and invalid-state rules restored the intended tokens. Captures wait for the real Appearance control rather than its temporary lazy-loading fallback.

- REST-contract red/green slices covered malformed schemas, unsafe property names, strict query conversion, body/output validation, roles, audits, immutable releases, and OpenAPI exports. A raw property-name check was needed before schema parsing because parsing could discard `__proto__`. Independent validators checked actual HTTP/export examples against the official OpenAPI 3.1 schema and JSON Schema 2020-12 rules.
- The final REST-contract check passed types, 59 backend tests with 514 assertions, production build, and formatting. All three Chrome stories passed in about 1.3 minutes. The preview grew to 165 masked states, including nested rules and real draft/release document downloads.
- Loading the shared rule validator on demand reduced the initial dashboard bundle from roughly 569 kB to 473.51 kB and removed the build warning. The complete browser suite passed after this change.
- Preview integration caught offscreen connection handles after adding the rule panel; capture now brings both handles into view and checks the created edge. Visual review also caught an OpenAPI menu mid-fade; capture waits for full opacity instead of adding a fixed delay.
- Workspace identity slices exercised fixed-lifetime cookies, password/key sign-in, persistent throttling, CSRF/origin checks, permission boundaries, account proof, recovery, and session revocation. Async credential checks are revalidated before session issuance or account updates so changed credentials cannot win a race.
- Browser regressions caught already-revoked logout leaving stale UI and a new member inheriting the previous navigation page. Logout handles an ended session, and a new session opens API Studio. Failed logout still preserves the active workspace until the server acknowledges it. Visual review placed rejected account proof beside its form and removed empty-field masks that covered an open proof menu.
- The real built-dashboard regression first observed two blocked `eval` probes from schema validation. Moving browser validator configuration into the first bootstrap dependency removed both without weakening CSP. The tracked production story now verifies zero CSP violations through login, builder mounting, account changes, reload, logout, password sign-in, and Excel upload.
- The workspace-session delivery passed types, 70 backend tests with 660 assertions, production build, and formatting. Five Chrome stories passed in about 1.4 minutes, and the gallery captured 186 masked states. An actual historical version-7 backup upgraded to version 8 through HTTP with data and runtime behavior preserved; its original hash remained unchanged. The original README banner passed desktop light/dark and phone checks.

See [testing](testing.md), [architecture](architecture.md), and [roadmap](roadmap.md) for durable detail.
