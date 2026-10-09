# AGENTS.md

Besh is a visual API builder. Read `README.md`, `GLOSSARY.md`, and `docs/architecture.md` before changing code. Track current work in `docs/roadmap.md`.

## Work rules

- Use short, direct explanations. Honor the user's caveman communication preference. Keep code and documents clear and readable.
- Treat repository evidence and user-provided vault notes as truth. Do not invent past decisions or integrations.
- Vault unavailable for this project. Use repository docs for working context. Never access `D:\VAULT\__codex` directly. If vault notes are supplied later, propose linked Markdown updates for manual save.
- Use Bun 1.4.2, Elysia, React, Zustand, Tailwind CSS, and shadcn/ui. Keep runtime and CI pins aligned. Avoid adding frameworks without a concrete need.
- Use `Database.run()` for direct Bun SQLite SQL; `Database.exec()` is deprecated. Keep prepared statements parameterized and use their appropriate `run`, `get`, or `all` methods.
- TypeScript/JavaScript style: no semicolons, single quotes, readable spacing, and blank lines between logical steps. Generated examples in other languages use their own valid syntax. Comment only important intent, constraints, and non-obvious behavior. Use Prettier; do not compress several statements onto one line.
- Use custom styled, accessible controls for checkboxes, radio groups, and dropdowns. Do not expose browser-native widgets. Preserve keyboard interaction, labels, focus, and disabled states.
- Support real GraphQL APIs alongside REST. Keep schema validation, execution limits, authentication, and draft/release separation at the server boundary.
- WebSocket request/reply uses exact generated routes, flat typed messages, mandatory current pins and a dedicated `ws` grant. Preserve original-proof one-use browser tickets, policy-version admission, fresh frame/idle/final-send checks, bounded work and shutdown cancellation. Never imply subscriptions, WS HTTP client exports, or WS k6 support from basic replies.
- Publication must generate canonical trusted backend modules and register actual runtime routes. Preserve atomic publication/rollback recovery, cross-process generation checks, runtime credentials/pins, bounded graph execution, and data/audit access. Never trust uploaded or modified generated JavaScript.
- Keep copyable server-side REST/GraphQL examples for JavaScript Axios/Fetch, PHP cURL, shell cURL, Rust reqwest, Go net/http, Java HttpClient, and C++ libcurl. Default to the published release; make saved-draft selection explicit. Preserve typed input validation and source revisions, escape each language correctly, and document dependencies/run steps without claiming unobserved compilation.
- Workspace sign-in uses email/password or member/owner keys. Social sign-in belongs to templates for generated product APIs, never the workspace panel.
- Keep local setup easy. Provide a first-run wizard; do not require manual environment edits for the basic workflow.
- Design common workflows for people who do not write code. Use labeled forms, selectors, examples, and data previews. Keep JSON and schema editors optional advanced tools.
- Support light, dark, and system appearance. Keep text, controls, focus, and error states readable in both themes; respect reduced-motion settings. Persist appearance preferences only, never credentials.
- Keep feature files together in shallow server folders: `src/auth/`, `src/data/`, `src/databases/`, `src/flows/`, `src/load-tests/`, `src/updates/`, `src/websockets/`, and `src/workspace/`. Root server files compose/start the app or provide shared errors. Keep `web/` dashboard, `test/` backend tests, `e2e/` browser tests, and `docs/` documentation. Avoid empty folders and unnecessary barrel exports.
- Read applicable local skills when requested. Current requested skills: `tdd`, `wait-what`, `handoff`.
- Test first through agreed public interfaces. See `docs/testing.md` for approved scope. Work one failing test and implementation at a time.
- Run relevant tests, type checks, build, and formatting before committing. Run browser tests for editor behavior changes.
- Keep page and action previews current when changing dashboard behavior. Run `bun run preview:all --no-serve` and inspect affected screenshots; keep generated previews out of Git.
- Commit completed work with Conventional Commits, for example `feat(flows): publish validated API flows` or `fix(auth): reject expired credentials`.
- Bump `package.json` for every completed change delivery and update `CHANGELOG.md` in the same tested commit. Follow `docs/releases.md`: fixes use patch, new features use minor, incomplete releases use `alpha`. Never bump to `1.0.0` or above without the maintainer's explicit confirmation.
- Never commit secrets, generated data, dependencies, or build output. Never hide tests or this file in `.gitignore`.
- Keep local skill installation metadata such as `skills-lock.json` out of Git while preserving the local file.
- Preserve unrelated user edits. Do not force push, reset history, or publish without authorization.
- Document what works, what remains planned, and exact checks run. Never claim an adapter works based only on a type definition or mock.

## Security rules

- Check authentication and permissions on the server for every management operation.
- Keep member credentials limited to management and draft tests. Published APIs require a separate, unexpired runtime key scoped to the published flow and operation type. Never add a member-key bypass.
- Derive endpoint permissions and displayed URLs from the published release, not an edited draft. Query/mutation grants do not replace future field or record authorization.
- Client-code generation only renders text. Never execute an API, persist example payloads, or insert member/runtime key values. Examples read `BESH_RUNTIME_API_KEY` from the caller's server environment; keep credentials out of browser code and use bounded requests without following redirects.
- Preserve optional release pins: issue only for the current publication, deny mismatches before input validation or effects, never execute archived releases, and retain the pin through replacement. Managed load-test keys pin their starting revision. Pins do not freeze mutable dependencies or create field/record authorization.
- Replace runtime keys atomically with their audit events. Preserve exact scope, release pin, tenant, original issuer/action, and expiry, show the new token once, and keep navigation blocked while its request is pending.
- Validate flows before execution and publication. Bound graph, request, and response sizes.
- Never evaluate uploaded JavaScript inside the server process.
- Keep load tests permission-authorized, bounded, and restricted to the local published API. Owners have the grant by default; custom roles need `load-tests.run`. Use generated k6 scripts and temporary scoped keys; never accept arbitrary target URLs, uploaded scripts, or CLI options. Persist summaries, not request payloads, process logs, or secrets.
- Resolve current workspace action grants at the server on every request. Keep member/role administration and update notices owner-only. Permission changes and member assignments revoke affected browser sessions with audit; runtime keys keep their separate scope.
- Preserve owner-managed all/selected API access independently of role actions. Selected roles may use only API read/write/test/publish, key management, and load testing; no API creation or global resource administration. Every accepted access update advances the shared version, audits, and revokes affected cookies; bearer requests resolve current access. Keep compatibility scope updates and typed USE state coherent.
- Require explicit typed dependency USE across all graph branches and current transactional/asynchronous effect boundaries for selected operations. Keep structural catalogs free of rows/counts/secrets. Selected issuance derives a live issuer binding and current release pin; preserve issuer/action/pin/expiry through replacement, fail closed for deleted issuers, keep legacy unbound behavior independent for unprotected resources, and permit scoped cleanup without USE. Never call USE or projected fields row/column/tenant authorization, or bounded k6 an instant cross-process kill.
- Preserve resource-owned tenant protection outside graph JSON: exact approved text identities, current private execution principals, mandatory predicates before projection/limits, narrow protected graph shapes, and final asynchronous authority checks. Every non-owner derives assigned identity; retain tenant/issuer/pin/expiry on replacement and preserve historical cleanup privacy. Protected raw resources are owner-only. Recheck original management proof, current grants, and raw policy after asynchronous reads and first inside acquired write transactions before raw mutation or template/flow creation. First protection permanently restricts ordinary backups to owners. Do not imply physical older-database restore resistance or recall of delivered stream bytes.
- Keep protected API field policies resource-owned and current across existing releases, owner tests/callers, key issuance/replacement, rollback and k6. Gate configured projections and business filters before reading; the private tenant predicate may use an excluded column. All includes future columns; selected may be empty and new columns stay excluded. Preserve omitted/dormant selections and reject removal of retained source keys. Share the row-policy version for CAS and asynchronous/WS checks. Never silently redact outputs or rewrite contracts. Owner raw data/full backups and structural field names remain available under their existing grants.
- Keep secrets on the server; store credential hashes where possible. Do not log tokens or payloads by default.
- Encrypt product OAuth secrets and PKCE verifiers with the private key file. Back up that file separately from SQLite; never commit it or recreate it while encrypted records exist.
- Save audit events with state changes. Keep migration history and test backup restoration.
- Separate editable drafts from published releases.
- Use parameterized queries. Keep product database connections separate from Besh's control database.
- SQLite product reads use immutable uploaded copies, inspected identifiers, bound values, and the trusted child reader. Preserve its deadline, output, storage, and process-wide concurrency limits. Never accept caller SQL or filesystem paths.
- Require explicit database read/manage grants for connection operations. Protect copies referenced by drafts or any historical release. Backups contain the complete unencrypted original copy; projection is not authorization. Protected copy reads require the separate exact tenant policy, raw access is owner-only, and first protection permanently makes ordinary backups owner-only.
- AI tools obey caller permissions. Model output is untrusted. Follow `AI_POLICY.md`.

## Completion

Update affected docs and `docs/roadmap.md` next steps. Report checks and limitations. When handoff is requested, save a redacted handoff in the OS temporary directory and reference repository artifacts instead of duplicating them.
