# AGENTS.md

Besh is a visual API builder. Read `README.md`, `GLOSSARY.md`, and `docs/architecture.md` before changing code. Track current work in `docs/roadmap.md`.

## Work rules

- Use short, direct explanations. Honor the user's caveman communication preference. Keep code and documents clear and readable.
- Treat repository evidence and user-provided vault notes as truth. Do not invent past decisions or integrations.
- Vault unavailable for this project. Use repository docs for working context. Never access `D:\VAULT\__codex` directly. If vault notes are supplied later, propose linked Markdown updates for manual save.
- Use Bun, Elysia, React, Zustand, Tailwind CSS, and shadcn/ui. Avoid adding frameworks without a concrete need.
- Code style: no semicolons, single quotes, readable spacing, and blank lines between logical steps. Comment only important intent, constraints, and non-obvious behavior. Use Prettier; do not compress several statements onto one line.
- Use custom styled, accessible controls for checkboxes, radio groups, and dropdowns. Do not expose browser-native widgets. Preserve keyboard interaction, labels, focus, and disabled states.
- Support real GraphQL APIs alongside REST. Keep schema validation, execution limits, authentication, and draft/release separation at the server boundary.
- Workspace sign-in uses email/password or member/owner keys. Social sign-in belongs to templates for generated product APIs, never the workspace panel.
- Keep local setup easy. Provide a first-run wizard; do not require manual environment edits for the basic workflow.
- Design common workflows for people who do not write code. Use labeled forms, selectors, examples, and data previews. Keep JSON and schema editors optional advanced tools.
- Support light, dark, and system appearance. Keep text, controls, focus, and error states readable in both themes; respect reduced-motion settings. Persist appearance preferences only, never credentials.
- Keep feature files together in shallow server folders: `src/auth/`, `src/data/`, `src/databases/`, `src/flows/`, `src/load-tests/`, `src/updates/`, and `src/workspace/`. Root server files compose/start the app or provide shared errors. Keep `web/` dashboard, `test/` backend tests, `e2e/` browser tests, and `docs/` documentation. Avoid empty folders and unnecessary barrel exports.
- Read applicable local skills when requested. Current requested skills: `tdd`, `wait-what`, `handoff`.
- Test first through agreed public interfaces. See `docs/testing.md` for approved scope. Work one failing test and implementation at a time.
- Run relevant tests, type checks, build, and formatting before committing. Run browser tests for editor behavior changes.
- Keep page and action previews current when changing dashboard behavior. Run `bun run preview:all --no-serve` and inspect affected screenshots; keep generated previews out of Git.
- Commit completed work with Conventional Commits, for example `feat(flows): publish validated API flows` or `fix(auth): reject expired credentials`.
- Bump `package.json` for every completed change delivery and update `CHANGELOG.md` in the same tested commit. Follow `docs/releases.md`: fixes use patch, new features use minor, incomplete releases use `alpha`. Never bump to `1.0.0` or above without the maintainer's explicit confirmation.
- Never commit secrets, generated data, dependencies, or build output. Never hide tests or this file in `.gitignore`.
- Preserve unrelated user edits. Do not force push, reset history, or publish without authorization.
- Document what works, what remains planned, and exact checks run. Never claim an adapter works based only on a type definition or mock.

## Security rules

- Check authentication and permissions on the server for every management operation.
- Keep member credentials limited to management and draft tests. Published APIs require a separate, unexpired runtime key scoped to the published flow and operation type. Never add a member-key bypass.
- Derive endpoint permissions and displayed URLs from the published release, not an edited draft. Query/mutation grants do not replace future field or record authorization.
- Replace runtime keys atomically with their audit events. Preserve exact scope and expiry, show the new token once, and keep navigation blocked while its request is pending.
- Validate flows before execution and publication. Bound graph, request, and response sizes.
- Never evaluate uploaded JavaScript inside the server process.
- Keep load tests permission-authorized, bounded, and restricted to the local published API. Owners have the grant by default; custom roles need `load-tests.run`. Use generated k6 scripts and temporary scoped keys; never accept arbitrary target URLs, uploaded scripts, or CLI options. Persist summaries, not request payloads, process logs, or secrets.
- Resolve current workspace action grants at the server on every request. Keep member/role administration and update notices owner-only. Permission changes and member assignments revoke affected browser sessions with audit; runtime keys keep their separate scope.
- Keep secrets on the server; store credential hashes where possible. Do not log tokens or payloads by default.
- Encrypt product OAuth secrets and PKCE verifiers with the private key file. Back up that file separately from SQLite; never commit it or recreate it while encrypted records exist.
- Save audit events with state changes. Keep migration history and test backup restoration.
- Separate editable drafts from published releases.
- Use parameterized queries. Keep product database connections separate from Besh's control database.
- SQLite product reads use immutable uploaded copies, inspected identifiers, bound values, and the trusted child reader. Preserve its deadline, output, storage, and process-wide concurrency limits. Never accept caller SQL or filesystem paths.
- Require explicit database read/manage grants for connection operations. Protect copies referenced by drafts or any historical release. Backups contain the complete unencrypted original copy; a projected API is not record authorization.
- AI tools obey caller permissions. Model output is untrusted. Follow `AI_POLICY.md`.

## Completion

Update affected docs and `docs/roadmap.md` next steps. Report checks and limitations. When handoff is requested, save a redacted handoff in the OS temporary directory and reference repository artifacts instead of duplicating them.
