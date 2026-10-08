# Besh roadmap

This is the product plan. Planned features are not implementation claims.

## Milestone 1: runnable core — implemented

- Visual flow editor: add, move, connect, configure, and remove nodes.
- First-run setup wizard with generated owner key; no manual environment setup.
- Save drafts, validate graphs, publish releases, and test responses.
- Bun + Elysia management and runtime APIs.
- SQLite persistence, role checks, audit history, migration history, and local backups.
- Tests through user-approved public HTTP, executor, and browser interfaces.
- Clear setup, contribution, security, AI, and community policies.
- Reproducible gallery of current pages, actions, error states, permissions, and phone layouts.
- Custom styled accessible controls and per-API GraphQL schemas, query/mutation execution, variables, and bounded field selection.
- Owner-issued runtime API keys for one published flow, required expiration, REST/query/mutation grants, hash-only storage, and immediate revocation; member identity stays at the management boundary.
- Beginner response/request/condition/data field forms with optional advanced JSON, generated GraphQL queries and optional schema editing, readable light/dark themes, and a mobile saved-API picker.
- CSV/Excel imports and public Google Sheets snapshots, reviewed column mapping, generated REST/typed GraphQL drafts, bounded data reads, manual snapshot replacement/refresh, and referenced-source deletion protection.

Current limits: one local workspace, exact HTTP paths, five node types, fixed roles, manual SQLite backups, and read-only spreadsheet snapshots. Google Sheets supports public exports; private OAuth, spreadsheet write-back, and database adapters remain planned. See [README](../README.md) for supported behavior and [testing](testing.md) for evidence.

## Milestone 2: identity and API contracts

- Implemented: optional REST query/body/response rules, server input/output checks, typed query conversion, recursive field/item forms and limits, generated spreadsheet contracts, and separate saved-draft/published OpenAPI 3.1.1 downloads. GraphQL retains its existing SDL contract.
- Planned: public endpoint policy, field-level and record-level authorization, key rotation workflows, and release-pinned grants where needed. Current runtime grants still authorize whole operations.
- Implemented workspace accounts and cookie sessions: optional email/password or member/owner-key sign-in, fixed 12-hour expiry, session restoration, CSRF/origin checks, bounded persistent login throttling, own-account changes with fresh proof, metadata-only session listing, member-own/owner-all revocation, and a 20-session member limit. Bearer management clients remain compatible.
- Implemented GitHub product identity template: owner-managed encrypted OAuth connections, owner/editor draft generation, REST POST or typed GraphQL login mutation, ten-minute state/proof with S256 PKCE, one-use caller/flow/revision/connection binding, and normalized identity output. Product servers retain runtime keys and separate proof, handle their own callbacks, and create their own sessions. Controlled GitHub responses test the boundary; no live OAuth app round trip has been verified.
- Planned product auth expansion: Discord, Facebook, Google, generic OIDC, product sessions/accounts, and reviewed identity linking. These do not change workspace sign-in.
- Planned workspace invites and account recovery.
- Per-workspace roles and custom permission grants.
- Extend GraphQL with reviewed introspection policy, custom scalar contracts, and subscriptions alongside WebSocket work. Whole-query/mutation runtime grants are implemented; field-level grants remain planned.
- WebSocket flows, lifecycle events, subscriptions, quotas and revocation.
- Path parameters, versioned routes, rollback, pagination, retry and error nodes.

## Milestone 3: data and plugins

- SQLite, PostgreSQL, MySQL/MariaDB, MongoDB, Supabase, Firebase adapters.
- Database connection testing and encrypted secret references beyond the current GitHub credential storage.
- Private Google Sheets OAuth, spreadsheet write-back, and scheduled synchronization beyond current manual public-sheet snapshots.
- Parameterized query builder and explicit transaction capabilities.
- Migration plans with dry runs, backup gates and restore verification.
- Backup scheduling, retention, encryption and off-site storage.
- Plugin SDK, manifest upload, compatibility checks and permission review.
- Isolated custom code execution with resource and network limits.
- Extension examples and adapter contract tests against real services.

## Milestone 4: AI operator

- Provider settings for Anthropic, OpenAI API, OpenRouter, Ollama and custom compatible APIs.
- Restricted Codex CLI process adapter with structured events and cancellation.
- Agent tools for flow design, testing, data inspection and permitted changes.
- Durable proposals, review, budgets, redaction, approvals and rollback.
- Provider capability checks and adversarial prompt/tool tests.

## Milestone 5: operations and releases

- GitHub release notices from a configured repository URL.
- Verified update artifacts, compatibility checks, backup, migration and rollback.
- CI release pipeline with conventional commits and changelog generation.
- Worker isolation, queues, horizontal scaling and production observability.
- Load, penetration, recovery and tenant-isolation tests.

## Completion gates

Each feature needs observable acceptance criteria, a failing test followed by a passing implementation, relevant type/build checks, updated docs, and a conventional commit. A configured provider must pass a real connection test before it is described as verified.

## Next Steps

1. Start with `bun install --frozen-lockfile` and `bun run setup`; complete the local wizard.
2. Run `bun run preview:all` and gather feedback on pages, node configuration, and route design before expanding the graph format.
3. Review workspace account/session feedback and the GitHub product login workflow. Connect a real GitHub OAuth app and exact product-server callback, verify a complete round trip, and back up the separate encryption key privately. Product sessions, identity linking, workspace invites, and account recovery remain planned.
4. Add integration tests against each real provider as its adapter is built. Do not mark live provider configuration verified from mocks. Review public endpoint policy and finer data permissions before exposing product data.
5. Choose a GitHub repository and private reporting contact before public release, then configure CI and update notices.
