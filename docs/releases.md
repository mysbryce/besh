# Versions and releases

Besh stays below `1.0.0` until the project is ready and the maintainer explicitly confirms that release. A roadmap milestone or an AI agent cannot authorize `1.0.0`.

Every completed change delivery gets a new version in `package.json` and an entry in [CHANGELOG.md](../CHANGELOG.md), in the same tested commit. Work in progress does not need a version change after every edit.

## Choose the version

Use `x.y.z` with an optional `-alpha.N`, `-beta.N`, or `-rc.N` suffix.

| Change                                              | Before `1.0.0`          | Example                           |
| --------------------------------------------------- | ----------------------- | --------------------------------- |
| Fix, security patch, documentation, or small polish | Increase `z`            | `0.2.0-alpha.0` → `0.2.1-alpha.0` |
| New feature or breaking API change                  | Increase `y`, reset `z` | `0.2.1-alpha.0` → `0.3.0-alpha.0` |
| Another candidate for the same planned release      | Increase suffix number  | `0.3.0-beta.0` → `0.3.0-beta.1`   |
| Feature complete, wider testing needed              | Use `beta`              | `0.3.0-alpha.2` → `0.3.0-beta.0`  |
| Final release candidate                             | Use `rc`                | `0.3.0-beta.2` → `0.3.0-rc.0`     |
| Approved stable milestone                           | Remove suffix           | `0.3.0-rc.1` → `0.3.0`            |

Use `alpha` while the platform is incomplete. A stable `0.x` milestone still does not promise a complete platform or a stable public API. After an explicitly approved `1.0.0`, use normal major/minor/patch versioning for breaking changes, features, and fixes.

## Record and verify

1. Choose the bump from the delivered behavior. Add a dated changelog section with short **Added**, **Changed**, **Fixed**, or **Security** notes as needed. Keep newest versions first.
2. Update `package.json`. Refresh `bun.lock` only if its metadata actually changes.
3. Run relevant tests, type checks, production build, and formatting. Update previews for dashboard changes.
4. Commit the implementation, version, and changelog together using a Conventional Commit.
5. When publishing is authorized, use the matching `v<version>` tag and release notes from the changelog. Never reuse a published version.

A Git push stores commits remotely. It does not by itself publish a package, deploy Besh, or create a GitHub release. Do not push, tag, or publish unless requested. The k6 binary's upstream version is separate from Besh's version.
