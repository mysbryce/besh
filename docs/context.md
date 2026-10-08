# Besh context

## 2026-10-08 decisions

- User requested a visual API creator with Bun/Elysia, React/Zustand, Tailwind/shadcn, database adapters, social auth, plugins, WebSockets, audit/migrations/backups, roles, updates, and a full multi-provider AI agent.
- User selected **runnable core plus complete roadmap** for first delivery. External integrations and the full agent remain later milestones. Avoid presenting them as installed features.
- User approved HTTP API, flow executor, and browser workflow as test interfaces. Use the local TDD skill for further changes.
- User prefers no semicolons, single quotes, readable spacing, blank lines, and comments only for important intent. Captured in Prettier and `AGENTS.md`.
- User requested simple installation with a setup wizard. Basic startup now creates the workspace through a one-time local setup link. Environment overrides remain optional for deployment/recovery.
- No vault state was supplied; user stated vault unavailable. Repository docs hold current decisions. No direct vault access occurred.

## Choices and reasons

- One package and shallow folders keep the initial codebase easy to navigate. A large monorepo was unnecessary for this milestone.
- SQLite makes the local wizard work without external services. Product database adapters stay distinct from control storage.
- Interpret validated graph JSON rather than executing generated code. Untrusted plugin runtime requires a later isolation design.
- Separate draft and published definitions to avoid changing live endpoints during edits. Revision checks prevent lost updates.
- Use role-scoped bearer keys for the local preview. Session/social authentication and independent endpoint credentials remain explicit next steps.
- Use MIT for Besh, matching Elysia's license type while retaining Besh's own copyright attribution.

## Verification notes

- Red/green cycles exercised executor behavior, protected HTTP routes, roles, releases, backups, setup and limits.
- First browser test failed at the empty page; it passed after the real dashboard was implemented.
- TypeScript 7 removed `baseUrl`; paths now use relative targets without that option.
- Windows restricted execution blocked a Vite helper. Build/browser verification succeeded with required process permissions.
- Installed Chrome was used for browser verification. CI/other machines can install Playwright Chromium.
- Final shutdown checks exposed retained SQLite statements on Bun 1.3. File-deletion retries did not solve the cause. The store now owns and reuses prepared statements, finalizes them explicitly, and closes strictly. The full suite passes with this fix.
- Browser regression caught unsaved new drafts being discarded when switching APIs. Dirty-state checks now protect new and existing drafts.

See [testing](testing.md), [architecture](architecture.md), and [roadmap](roadmap.md) for durable detail.
