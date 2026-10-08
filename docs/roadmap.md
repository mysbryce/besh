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

Current limits: one local workspace, exact HTTP paths, three node types, fixed roles, manual SQLite backups. No external providers are enabled. See [README](../README.md) for supported behavior and [testing](testing.md) for evidence.

## Milestone 2: identity and API contracts

- Social sign-in: GitHub, Discord, Facebook, Google, generic OIDC.
- Invites, account recovery, session expiry and revocation.
- Per-workspace roles and custom permission grants.
- Input/output schemas, generated OpenAPI, API keys and scoped tokens.
- Extend GraphQL with scoped per-operation grants, reviewed introspection policy, custom scalar contracts, and subscriptions alongside WebSocket work.
- WebSocket flows, lifecycle events, subscriptions, quotas and revocation.
- Path parameters, versioned routes, rollback, pagination, retry and error nodes.

## Milestone 3: data and plugins

- SQLite, PostgreSQL, MySQL/MariaDB, MongoDB, Supabase, Firebase adapters.
- Connection testing and encrypted secret references.
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
3. Implement Milestone 2: separate endpoint credentials from member identity, then session-based social sign-in and per-endpoint schemas.
4. Add integration tests against each real provider as its adapter is built. Do not mark provider support complete from mocks.
5. Choose a GitHub repository and private reporting contact before public release, then configure CI and update notices.
