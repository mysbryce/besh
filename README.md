# Besh

Build and publish APIs visually. Connect nodes, test drafts, and publish REST or GraphQL endpoints with scoped access and audit logs.

Besh is an early local development preview. Database adapters, social login, plugins, and the AI operator remain planned.

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

Open `http://127.0.0.1:5173` and sign in with your saved workspace key. See [getting started](docs/getting-started.md) for configuration, examples, and recovery.

## What works

- Visual editor with response fields, input references, conditions, and spreadsheet reads; advanced JSON remains optional.
- Saved drafts, validated publication, and immutable releases.
- REST methods and typed GraphQL queries/mutations.
- Optional REST input/response rules and separate draft/published OpenAPI downloads.
- Owner, editor, and viewer roles; separate expiring runtime API keys.
- Local SQLite persistence, audit history, migrations, and tested backups.
- CSV, Excel (.xlsx), and public Google Sheets snapshots with manual refresh.
- Readable light/dark themes and keyboard-accessible custom controls.
- Browser walkthrough and masked page/action preview gallery.

## Documentation

[Documentation index](docs/README.md) · [Getting started](docs/getting-started.md) · [API reference](docs/api.md) · [GraphQL](docs/graphql.md) · [Roadmap](docs/roadmap.md)

[Contributing](docs/contributing.md) · [Security](SECURITY.md) · [AI policy](AI_POLICY.md)

MIT licensed. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
