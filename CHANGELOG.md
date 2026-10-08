# Changelog

Every version change is recorded here. See [version rules](docs/releases.md). Development history below does not imply a published package, tag, or deployment.

## Unreleased

## 0.5.0-alpha.0 — 2026-10-08

### Added

- Read-only uploaded SQLite copies with inspected tables, selected columns, typed equality previews, and REST/GraphQL draft generation.
- Database flow nodes, explicit connection read/manage permissions, and original-copy inclusion in workspace backups through migration 12.
- Beginner database forms, custom controls, and page/action previews in light, dark, and phone layouts.

### Changed

- Group server modules in shallow feature folders with direct imports and shared application entrypoints.

### Fixed

- Keep source data modules trackable by limiting generated data-directory ignores to the repository root.
- Clear stale database errors after a successful explicit refresh.
- Await native database-reader cleanup before the server exits.

### Security

- Quote inspected identifiers and bind filter values; reject arbitrary SQL, filesystem paths, unsupported structures, and unsafe scalar data.
- Bound uploads, storage, schemas, rows, native SQLite allocation, reader concurrency, output, and execution time. Cancel trusted child readers on caller abort or shutdown.
- Recheck current authorization after asynchronous connection operations and protect copies referenced by drafts or any historical release.
- Document that backups contain complete unencrypted copies and optional filters do not provide record authorization.

## 0.4.0-alpha.0 — 2026-10-08

### Added

- Custom workspace roles with 13 explicit action permissions, beginner permission forms, and owner-managed member assignment.
- Manual GitHub release notices with saved public-repository settings, preview-release filtering, and an owner-only Updates page.

### Fixed

- Members without API-read permission can sign in and manage their own account without private API requests.
- Permission and CSRF denials now attribute valid cookie sessions to the signed-in member in audit history.
- Workspace navigation scrolls independently so sign-out stays reachable on short desktop and phone screens.

### Security

- Resolve current grants for bearer and cookie requests; commit role changes with audit and affected session revocation.
- Reject stale role changes and deletion of assigned roles; keep administration and update notices owner-only.
- Bound update requests, reject redirects and stale results, and persist check cooldowns across restarts. Notices do not install updates.

## 0.3.0-alpha.0 — 2026-10-08

### Added

- REST path parameters with beginner input forms, typed rules, OpenAPI path documentation, and built-in k6 support.
- Immutable release history and owner rollback that preserves saved drafts and unsaved edits.
- Read-only CI checks, version/changelog guards, and a manual release-candidate bundle with a SHA-256 inventory.

### Fixed

- Health responses now report the installed package version after each bump.

### Security

- Reject overlapping published routes, stale rollback, and publication changes during an active load test.
- Require owner authorization and CSRF protection for rollback; revalidate archived dependencies before restoring.
- Exclude private files and external directory links from release candidates; keep publication separately authorized.

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
