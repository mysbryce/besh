# Besh architecture

Goal: help teams build secure, documented APIs with a visual editor.

## Decisions

1. Use Bun and Elysia for the server. Use React, Zustand, Tailwind CSS, shadcn/ui, and React Flow for the dashboard. Keep one repository and one package manifest until independent packages are needed.
2. Keep server code in `src/`, dashboard code in `web/`, tests in `test/`, and design notes in `docs/`. Group growing server features by domain. Avoid empty abstraction layers.
3. Store flows as versioned JSON. The dashboard edits this format; the server validates and executes it. Never evaluate JavaScript from a flow.
4. Separate drafts from releases. Validate before publishing. Existing releases remain unchanged when drafts are edited. Route conflicts must fail explicitly.
5. Start with a local SQLite control database. Product database connections are separate adapters. Do not pretend SQL databases, MongoDB, Firebase, and Supabase have identical query or transaction semantics.
6. Keep management authentication separate from endpoint authentication. Every management operation checks permission on the server. Public endpoints must be an explicit choice.
7. Record state changes and their audit events together. Keep migration history. Back up before destructive changes and test restore procedures.
8. Add integrations through capability-based adapters. Unsupported features fail clearly. A provider listed in a roadmap is not a working integration.
9. Keep AI providers replaceable. Use typed tools with the caller's permissions. Models cannot grant themselves access. Codex CLI requires a separate, restricted process adapter; an HTTP provider adapter cannot substitute for it.
10. Check GitHub releases for update notices. Do not execute downloaded code or silently migrate a running installation. Pin dependencies and release artifacts.

## Runtime boundary

`Dashboard -> management API -> validate draft -> publish release -> runtime API -> flow executor`

The executor must limit graph size, steps, input size, execution time, and output size. Validate node configuration and all edges. Reject cycles until bounded loops are designed. Errors must not reveal credentials or stack traces.

Implemented nodes are request, condition, response, and bounded spreadsheet reads. Later add validation schemas, broader transformations, database operations, outbound HTTP, plugins, retries, subflows, and explicit error paths. A finite graph cannot promise support for every possible API.

HTTP targets: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. CONNECT and TRACE need separate threat review. OpenAPI describes HTTP operations; WebSocket messages need their own schemas and lifecycle rules.

GraphQL uses one POST endpoint per visual API at `/graphql/<path>`. Optional SDL lives inside the versioned flow definition; each root field runs the flow with arguments as input. GraphQL.js handles schema and operation validation and typed field selection. Runtime budgets include expanded fragments, depth, root calls, and output size. REST routes remain under `/run/<path>`. See [GraphQL guide](graphql.md) for supported behavior.

Checkboxes and dropdowns use local styled components built on Radix primitives. Keep labels, keyboard navigation, disabled states, and focus return intact. Browser-native form controls may exist as hidden accessibility/form plumbing; no native checkbox, radio, or select is exposed as the visual control. New radio groups must follow the same rule.

Basic response, condition, and REST request editing uses labeled field forms. Raw JSON is an optional advanced view; complex nested values are preserved. Returning from advanced request input validates the full body/query envelope before mounting the form, including text-only query values. Input strings resembling reference syntax stay literal request values. Light/dark appearance uses shared tokens, a same-origin initialization script compatible with the content security policy, and accessible custom controls; see [design system](design.md).

## Spreadsheet data boundary

Migration 7 stores CSV/Excel and public Google Sheets snapshots in the control database. Only owners/editors can access source metadata, previews, lifecycle actions, or generated drafts. Public Google exports use a restricted HTTPS URL/redirect policy and bounded requests. Upload formats, archive expansion, row counts, column counts, and normalized snapshot sizes are checked before persistence. Uploaded formulas and code are not executed.

A data node reads one source, projects approved columns, optionally applies an equality filter, and returns at most 100 rows within normal response limits. `$data` resolves its result. Generated REST and GraphQL APIs are normal drafts and use the existing validation, publication, and scoped runtime-key boundaries. Generated GraphQL is query-only and includes typed selected columns.

Published graph definitions remain immutable, while source data is mutable: manual replacement or Google refresh changes the saved snapshot read by existing APIs. Owners/editors can perform this data change; it does not grant publication rights. Sources referenced by a draft or release cannot be deleted. Snapshot data is included in workspace backups. Database adapters and private Google OAuth remain separate planned capabilities.

## Extensions

| Adapter     | Required boundary                                                                        |
| ----------- | ---------------------------------------------------------------------------------------- |
| SQL         | Prepared parameters, pools, transactions, dialect-specific migrations and backup         |
| MongoDB     | Typed document filters, bounded queries, index management, no raw operator injection     |
| Supabase    | Server-held secrets, RLS-aware access, explicit tenant ownership                         |
| Firebase    | Verified identity, scoped Admin SDK operations, security rules and export strategy       |
| Social auth | OAuth state, PKCE where supported, redirect allowlist, identity linking safeguards       |
| Plugin      | Manifest, API version, integrity, capability grants, isolated runtime, resource limits   |
| AI          | Provider configuration, redaction, tool permissions, budgets, approval and audit         |
| WebSocket   | Origin and authentication checks, message schemas, rate limits, revocation and reconnect |

Uploaded plugin code must run in a real process/container isolation boundary before public uploads are enabled. A JavaScript VM or Bun Worker is not a security sandbox. Declarative plugins can be introduced earlier with a constrained schema.

## Identity and roles

Initial single-workspace roles: owner, editor, viewer. Owner manages members, publication, backups, and settings. Editor edits and tests drafts. Viewer reads allowed resources. Add custom permissions and multi-workspace isolation with explicit tests before claiming multi-tenancy.

Social providers planned: GitHub, Discord, Facebook, Google, and generic OIDC where supported. Keep dashboard identity and generated API identity configurable independently.

Published REST and GraphQL endpoints accept only runtime API keys. Owner and member tokens authenticate management routes and role-authorized draft tests. Only owners can issue, list, and revoke runtime keys. Migration 6 adds hash-only key storage, a single published flow scope, operation grants, required expiration within 366 days, and retained revocation metadata. Issuance and revocation are transactional with their audit records.

REST keys grant `rest`; GraphQL keys grant `query`, `mutation`, or both. GraphQL authorization checks the selected operation before execution, including operation-name selection from documents containing several operations. Runtime keys cannot cross flow boundaries or access management. Expiration and revocation are checked on each request. Grants authorize whole operations; field-level and record-level authorization remain planned.

Scope follows the flow ID across republishing rather than pinning a release. An owner must review keys before publishing broader behavior. Management responses expose the immutable published endpoint metadata separately from draft settings so key issuance displays the live route even when draft paths or protocols change. Restoring a backup also restores its key state; keys revoked after the snapshot may work again and need review, revocation, or rotation.

## Agent policy

The future agent should inspect APIs, explain runs, propose flows, test drafts, and manage permitted data through typed tools. Destructive data changes, publication, plugin execution, migrations, and external transfers require scoped authorization. Persist proposals and decisions. Treat database values, plugin output, and model responses as untrusted input.

Provider targets: Anthropic, OpenAI API, OpenRouter, Ollama/OpenAI-compatible endpoints, and a local Codex CLI adapter. Discover model capabilities rather than assuming all providers support tools, JSON schemas, or streaming equally. No mandatory cloud gateway.

## Sources

- [Elysia documentation](https://elysiajs.com/essential/best-practice): server framework usage.
- [React Flow](https://reactflow.dev/learn): node editor and graph interactions.
- [shadcn/ui with Vite](https://ui.shadcn.com/docs/installation/vite): dashboard component setup.
- [Bun SQLite](https://bun.sh/docs/runtime/sqlite): local control database.

See [roadmap](roadmap.md), [glossary](../GLOSSARY.md), and [AI policy](../AI_POLICY.md).
