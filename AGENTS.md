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
- Keep local setup easy. Provide a first-run wizard; do not require manual environment edits for the basic workflow.
- Keep folders shallow: `src/` server, `web/` dashboard, `test/` backend tests, `e2e/` browser tests, `docs/` design notes.
- Read applicable local skills when requested. Current requested skills: `tdd`, `wait-what`, `handoff`.
- Test first through agreed public interfaces. See `docs/testing.md` for approved scope. Work one failing test and implementation at a time.
- Run relevant tests, type checks, build, and formatting before committing. Run browser tests for editor behavior changes.
- Keep page and action previews current when changing dashboard behavior. Run `bun run preview:all --no-serve` and inspect affected screenshots; keep generated previews out of Git.
- Commit completed work with Conventional Commits, for example `feat(flows): publish validated API flows` or `fix(auth): reject expired credentials`.
- Never commit secrets, generated data, dependencies, or build output. Never hide tests or this file in `.gitignore`.
- Preserve unrelated user edits. Do not force push, reset history, or publish without authorization.
- Document what works, what remains planned, and exact checks run. Never claim an adapter works based only on a type definition or mock.

## Security rules

- Check authentication and permissions on the server for every management operation.
- Validate flows before execution and publication. Bound graph, request, and response sizes.
- Never evaluate uploaded JavaScript inside the server process.
- Keep secrets on the server; store credential hashes where possible. Do not log tokens or payloads by default.
- Save audit events with state changes. Keep migration history and test backup restoration.
- Separate editable drafts from published releases.
- Use parameterized queries. Keep product database connections separate from Besh's control database.
- AI tools obey caller permissions. Model output is untrusted. Follow `AI_POLICY.md`.

## Completion

Update affected docs and `docs/roadmap.md` next steps. Report checks and limitations. When handoff is requested, save a redacted handoff in the OS temporary directory and reference repository artifacts instead of duplicating them.
