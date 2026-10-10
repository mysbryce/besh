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

## Protected main and dependency updates

The repository's [main rules](https://github.com/mysbryce/besh/rules/24821269) require a pull request. Direct pushes to `main` are rejected; use a named branch and review its PR instead. Keep the rules enabled.

Dependency updates still need a patch version and dated changelog entry. An initial branch push or manual run can pass without a comparison base, but merging an unchanged version would fail the next main push check. Validate against the current main commit explicitly before merging. If another delivery advances main, incorporate it and review the version again.

Use a Conventional Commit squash title, match the reviewed head commit, and wait for the resulting main checks. Keep action commits pinned and preserve the self-hosted runner controls. Local browser/k6 runs and remote CI on the same machine must not overlap; workflow concurrency only serializes GitHub runs.

Checkout v7.0.1 passed both jobs at the reviewed dependency head and again after the normal PR merge, in [main run 38014643079](https://github.com/mysbryce/besh/actions/runs/38014643079) at `9e797b4`: 343 backend cases and all 28 browser stories. Its patch release is `0.17.1-alpha.0`. Later dependency or dashboard changes need their own exact-head checks.

Upload-artifact v7.0.1 was reviewed and merged as `0.17.2-alpha.0`. [Head run 38015072008](https://github.com/mysbryce/besh/actions/runs/38015072008) at `a46db22` passed all 343 backend cases and 28 browser stories. [Candidate run 38015516497](https://github.com/mysbryce/besh/actions/runs/38015516497) passed policy, types, tests, build, formatting, browser tests and preparation of 223 bundle files. Its upload failed at `CreateArtifact` with GitHub's storage-quota error; keep that failure visible. Successful remote upload, download and digest verification remain unobserved.

A separately generated local archive from the same reviewed head passed safe-path, complete inventory, byte-count, SHA-256, source-byte and dashboard-asset checks for all 223 payload files. This is local bundle evidence, not verification of GitHub delivery or a signed artifact. The repository artifact inventory was empty. Review the owner's [Actions and Packages storage allowance](https://docs.github.com/en/billing/concepts/product-billing/github-actions), then rerun the candidate when uploads are available. Do not delete unrelated artifacts, change billing or weaken workflow failures to make the run green.

After the normal PR #2 merge, [main run 38016098723](https://github.com/mysbryce/besh/actions/runs/38016098723) at `7851bff` passed both check and browser jobs. This main check does not upload artifacts and does not resolve the candidate's storage-quota failure.

Studio/navigation PR #3 was subsequently merged as `0.18.1-alpha.0`. [Main run 38017384825](https://github.com/mysbryce/besh/actions/runs/38017384825) at `8255b4e` passed both check and browser jobs. Future work starts from this merged head on a new branch; keep any preserved local main history instead of resetting it. This check does not resolve remote candidate-upload capacity.

Account/update language PR #4 merged as `0.18.2-alpha.0`. [Main run 38021228538](https://github.com/mysbryce/besh/actions/runs/38021228538) at `fe7dd57` passed both jobs. The maintainer now authorizes continuing implementation and normal merges after exact-head core/browser CI passes. Match the reviewed head, preserve repository rules and wait for post-merge main CI before competing local native work. This authorization does not publish tags, packages or deployments.

Member/role language [PR #5](https://github.com/mysbryce/besh/pull/5) merged normally as `0.18.3-alpha.0` after [head run 38024237654](https://github.com/mysbryce/besh/actions/runs/38024237654) passed at `51c812d`: 361 backend cases and all 42 browser cases. The resulting [main run 38024532880](https://github.com/mysbryce/besh/actions/runs/38024532880) at `50495bd` passed both jobs before local Studio work resumed. The normal match-head squash preserved repository rules and did not publish a tag, package or deployment.

## Automated checks and candidate artifacts

[Check workflow](../.github/workflows/check.yml) uses the maintainer's Windows x64 runner with `runs-on: [self-hosted, windows, x64]`. It runs on branch pushes in this repository or manual requests, checking out the event's exact commit. Both jobs admit only those events; pull requests do not trigger this workflow. A same-repository branch push runs checks before its PR review. Repository writers and manual-run actors remain trusted to execute host code. See [GitHub's runner labels](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/use-in-a-workflow).

Keep the runner online and registered for this repository with those three labels, Git on `PATH`, and a current runner application supporting the pinned Node 24 actions. Each job uses Windows PowerShell and pinned Node 22.22.1 setup. The local Windows action installs exact Bun 1.4.2 from its official release archive into a fresh job temporary directory and copies a regular `bunx.exe`; it needs no symbolic-link privilege or manual Bun setup and leaves the user's Bun installation alone. The version is checked before its directory is added to the job's `PATH`; this is not a cryptographic archive-authenticity check. Frozen dependencies, release-policy checks and `bun run check` run before the browser job installs Chromium and runs the stories. Browser checks wait for the core check. Both workflows share one concurrency group because the tests use fixed local ports; active runs are not canceled by newer requests. Checkout does not persist credentials, package-manager caching is disabled, and repository permissions remain `contents: read`.

A normal Windows user can run the runner. The earlier upstream action attempted a `bunx.exe` symlink before checking an existing Bun install and failed with `EPERM` on the maintainer's non-admin account. The local action avoids that operation. See the [upstream source](https://github.com/oven-sh/setup-bun/blob/0c5077e51419868618aeaa5fe8019c62421857d6/src/action.ts#L53-L71).

Normal browser tests now use four workers with locks for shared feature ports, setup, clipboard and native k6 work. This does not parallelize the core/browser jobs or change the workflow concurrency group. Local 0.18 acceptance passed the same 34 cases in both serial and four-worker modes. Review subsequent exact-head runner results on the delivery PR; see [testing](testing.md) for recorded local acceptance.

Start a new workflow run from the commit containing this fix; [rerunning an older failed run uses its original commit and ref](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs). If the runner is installed as a service, opening a separate administrator terminal does not change that service's account.

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

[Prepare release candidate](../.github/workflows/release-candidate.yml) is manual and uses the same self-hosted Windows labels and tool setup. Supply the exact `package.json` version. It runs policy, tests, types, build, formatting, and browser checks, then uploads a candidate artifact retained for 14 days. It does not create a tag, GitHub release, deployment, or package publication.

The bundle script, `bun scripts/release-bundle.ts`, requires a clean committed checkout and a built dashboard. It writes a fresh `.cache/release-candidate/` containing selected tracked source, docs, startup scripts/configuration, and dashboard build output. It excludes workspace databases, secrets, dependencies, and test output. `.besh-release.json` records the source commit/version and a SHA-256 file inventory. These hashes support content inspection; they are not a digital signature or proof of publisher authenticity. Review the candidate before any separately authorized publication.

The corrected Bun action and complete core check passed in actual [GitHub run 37900521295](https://github.com/mysbryce/besh/actions/runs/37900521295). Its browser job exposed separate test transport and result-timing failures addressed by 0.16.2. The subsequent [run 37908053400](https://github.com/mysbryce/besh/actions/runs/37908053400), at `02d98a1`, passed the core check and 24 browser stories; the builder timed out while creating a GraphQL API key. Version 0.16.3 strengthens that test's form-readiness and keyboard-state checks. The precise earlier failure cause did not reproduce locally. Both jobs then passed in [run 37914121477](https://github.com/mysbryce/besh/actions/runs/37914121477) at `b184145`: 325 backend cases and all 25 bundled-Chromium browser stories, the latter in 3.7 minutes. See [testing](testing.md) for exact recorded evidence. This verifies that committed baseline, not subsequent uncommitted work or a release publication.
