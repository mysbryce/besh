![Besh — Build APIs visually, with connected request, flow, and response nodes](docs/assets/besh-banner.png)

# Besh

Build and publish APIs visually. Connect nodes, test drafts, and publish REST or GraphQL endpoints with scoped access and audit logs.

Besh is an early local development preview. Remote databases, more login providers, plugins, and the AI operator remain planned.

## Start locally

Install [Bun](https://bun.sh/docs/installation) 1.3.14 or newer, then run:

```sh
bun install --frozen-lockfile
bun run setup
```

Open the setup link printed in the terminal. Name your workspace and save the owner key. No database server or manual environment edits are required. Keep the terminal running.

For later sessions:

```sh
bun run dev
```

Open `http://127.0.0.1:5173` and sign in with your workspace key or configured email/password. See [getting started](docs/getting-started.md) for configuration, examples, and recovery.

## What works

- Visual editor with response fields, input references, conditions, and data reads; advanced JSON remains optional.
- Saved drafts, validated publication, immutable release history, and rollback.
- REST methods and path parameters, plus typed GraphQL queries/mutations.
- Built-in k6 load testing for published REST/GraphQL APIs, with automatic local setup and optional goals.
- Optional REST input/response rules and separate draft/published OpenAPI downloads.
- Built-in and custom action roles; expiring runtime API keys with replacement and revocation.
- Optional email/password sign-in and revocable workspace browser sessions.
- GitHub product-login templates for REST and GraphQL, with server-held credentials.
- Local SQLite persistence, audit history, migrations, and tested backups.
- Manual GitHub release notices with saved repository settings.
- CSV, Excel (.xlsx), and public Google Sheets snapshots with manual refresh.
- Uploaded SQLite copies with table previews and REST/GraphQL draft generation.
- Readable light/dark themes and keyboard-accessible custom controls.
- Browser walkthrough and masked page/action preview gallery.

## Documentation

[Documentation index](docs/README.md) · [Getting started](docs/getting-started.md) · [Load testing](docs/load-testing.md) · [API reference](docs/api.md) · [Roadmap](docs/roadmap.md)

[Contributing](docs/contributing.md) · [Security](SECURITY.md) · [AI policy](AI_POLICY.md)

MIT licensed. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
