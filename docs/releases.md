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

## Automated checks and candidate artifacts

[Check workflow](../.github/workflows/check.yml) runs on pull requests and pushes. Windows and Ubuntu use pinned Bun 1.3.14, frozen dependencies, release-policy checks, and `bun run check`. An Ubuntu job installs Playwright Chromium and runs the browser stories. Actions are pinned to commit hashes; checkout does not persist credentials. Repository permissions are `contents: read`.

Run the policy locally with:

```sh
bun scripts/release-check.ts
```

Without a comparison base, it checks the current package version and newest dated changelog entry. Optional environment variables:

| Variable                  | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `BESH_RELEASE_BASE_SHA`   | Full 40-character base commit; requires a newer version and new changelog entry |
| `BESH_RELEASE_COMMIT_SHA` | Full commit to inspect for a Conventional Commit subject; defaults to HEAD      |
| `BESH_RELEASE_VERSION`    | Exact expected package version for a manual candidate                           |

With a base, the policy checks the Conventional Commit and requires a minor bump for `feat`. The version parser permits `alpha.N`, `beta.N`, and `rc.N` prereleases. It rejects `1.0.0` and above until explicit maintainer approval is reflected in a reviewed policy change. The check does not generate release notes or approve their contents.

[Prepare release candidate](../.github/workflows/release-candidate.yml) is manual. Supply the exact `package.json` version. It runs policy, tests, types, build, formatting, and browser checks, then uploads a candidate artifact retained for 14 days. It does not create a tag, GitHub release, deployment, or package publication.

The bundle script, `bun scripts/release-bundle.ts`, requires a clean committed checkout and a built dashboard. It writes a fresh `.cache/release-candidate/` containing selected tracked source, docs, startup scripts/configuration, and dashboard build output. It excludes workspace databases, secrets, dependencies, and test output. `.besh-release.json` records the source commit/version and a SHA-256 file inventory. These hashes support content inspection; they are not a digital signature or proof of publisher authenticity. Review the candidate before any separately authorized publication.

Workflow configuration is implemented. Hosted GitHub execution remains unverified until an actual run is observed; local checks alone do not prove hosted runners pass. See [testing](testing.md) for exact recorded evidence.
