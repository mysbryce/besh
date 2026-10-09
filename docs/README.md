# Besh documentation

Use this index for setup, supported API behavior, development checks, and planned work. Besh currently runs as a local workspace with spreadsheet snapshots, uploaded read-only SQLite copies, and a GitHub product login template. Live external database adapters, SQL writes, and AI execution remain planned.

## Use Besh

- [Getting started](getting-started.md): installation, first API, runtime keys, roles, configuration, recovery, project layout, and development commands.
- [Workspace accounts and sessions](workspace-auth.md): key or email/password sign-in, account changes, session metadata, revocation, and recovery boundaries.
- [Workspace roles and permissions](roles.md): built-in/custom roles, selected API actions, typed dependency USE, issuer bindings, member assignment, and current server checks.
- [Tenant rows and API fields](row-protection.md): owner-assigned identity, protected reads, shared fields, per-tenant choices, credential privacy, and backup boundaries.
- [Protected read graphs](protected-read-graphs.md): bounded multiple reads, last-read replies, input conditions and all-branch authority.
- [WebSocket APIs](websockets.md): typed request/reply forms, exact generated routes, browser/native authentication, current authority, connection bounds, and recovery.
- [Runtime API keys](api-keys.md): create, use, pin, replace with optional overlap, revoke exact keys, save one-time tokens, and recover unconfirmed actions.
- [Published backend code](runtime-code.md): generated modules, registered routes, source inspection, runtime checks, and recovery.
- [Client code examples](client-code.md): eight server-side targets, saved-source selection, typed inputs, dependencies, and copied-code limits.
- [REST routes and release history](api-routes.md): path parameters, explicit version prefixes, overlapping routes, release inspection, and rollback boundaries.
- [Built-in k6 load testing](load-testing.md): published API targets, automatic local k6 setup, optional goals, live write confirmation, results, and history.
- [GitHub product login](product-auth.md): OAuth app setup, generated REST/GraphQL drafts, server-held proof, product callbacks, identity results, and encryption-key backups.
- [Core API reference](api.md): setup and management HTTP routes, flow format, runtime-key lifecycle, and published REST authentication.
- [REST API rules and OpenAPI](api-contracts.md): simple field rules, server validation, supported schema subset, and draft/published downloads.
- [GraphQL APIs](graphql.md): typed schemas, variables, selected operations, runtime grants, and execution limits.
- [Spreadsheet data sources](data-sources.md): CSV/Excel import, public Google Sheets, reviewed field mapping, generated APIs, and snapshot lifecycle.
- [Uploaded SQLite database copies](databases.md): bounded import, inspected tables/columns, read previews, generated APIs, permissions, and backup/recovery limits.
- [GitHub update notices](updates.md): owner-only manual release checks, saved repository/prerelease choices, cached results, and notice-only limits.
- [Page and action previews](preview.md): capture commands, gallery inventory, masked credentials, data isolation, and Git ignore choices.
- [Glossary](../GLOSSARY.md): workspace, draft, release, member identity, and caller credentials.

## Develop Besh

- [Architecture](architecture.md): stack, management/runtime boundaries, publication, storage, and extension constraints.
- [Design system](design.md): interface palette, typography, card/control styling, responsive layout, and motion rules.
- [Testing](testing.md): approved public interfaces, commands, verification evidence, and limits.
- [Roadmap](roadmap.md): implemented milestones, planned capabilities, completion gates, and next steps.
- [Context and decisions](context.md): current user constraints, architecture choices, and resolved regressions.
- [Repository presentation](repository.md): suggested public description and topics.
- [Contributing](contributing.md): development workflow and contribution expectations.
- [Versions and releases](releases.md): version bumps, prerelease labels, verification, and explicit approval before `1.0.0`.
- [Changelog](../CHANGELOG.md): dated version changes and development history.
- [Agent instructions](../AGENTS.md): repository work rules and security requirements.

## Policies

- [Security](../SECURITY.md): private reporting, credential boundaries, and deployment review needs.
- [AI policy](../AI_POLICY.md): permissions, untrusted model output, and future operator constraints.
- [Code of conduct](../CODE_OF_CONDUCT.md): community expectations.
- [License](../LICENSE) and [third-party notices](../THIRD_PARTY_NOTICES.md).
