# Changelog

Every version change is recorded here. See [version rules](docs/releases.md). Development history below does not imply a published package, tag, or deployment.

## Unreleased

## 0.2.0-alpha.0 — 2026-10-08

### Added

- Built-in k6 load testing for published REST and GraphQL APIs, with automatic local setup and optional load settings.
- Version rules and this changelog. Besh remains below `1.0.0` until the maintainer explicitly confirms release.

### Security

- Load tests use bounded local targets and temporary scoped keys, with automatic revocation, cancellation, and restart cleanup. Request values and process logs stay out of saved reports.

## 0.1.0 — 2026-10-08

Initial development version. Earlier changes shared this version; separate historical versions were not assigned.

### Added

- Local setup wizard and visual API builder with editable drafts, testing, and published releases.
- REST API rules, OpenAPI downloads, and typed GraphQL queries and mutations.
- CSV/Excel imports and public Google Sheets snapshots with beginner field forms.
- Workspace email/password or key sign-in, cookie sessions, fixed roles, audit history, migrations, and SQLite backups.
- Scoped, expiring runtime API keys with atomic replacement and immediate revocation.
- GitHub identity templates for product APIs with encrypted provider connections.
- Custom controls, light/dark/system themes, phone layouts, documentation, and a masked page/action preview gallery.
