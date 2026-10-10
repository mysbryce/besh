# Contributing to Besh

Read [architecture](architecture.md), [glossary](../GLOSSARY.md), and [agent instructions](../AGENTS.md) before changing code. Keep current work and next steps in [roadmap](roadmap.md). Separate implemented behavior from planned integrations.

## Local workflow

```sh
bun install --frozen-lockfile
bun run setup
```

Use `bun run dev` for later sessions. See [getting started](getting-started.md) for setup, optional configuration, and recovery.

Use the agreed public HTTP API, exported executor, and browser interfaces in [testing](testing.md). Write one failing test, observe its failure, implement the smallest behavior change, and rerun before the next slice. Prefer real temporary SQLite databases; do not replace Besh internals with implementation mocks.

## Check changes

```sh
bun run format
bun run check
bun run test:e2e
bun run preview:all --no-serve
```

Run browser checks for dashboard behavior and inspect affected preview screenshots after visual changes. Use installed Chrome with `PLAYWRIGHT_CHANNEL=chrome` on Windows, or install Playwright Chromium. See [preview isolation](preview.md) for generated output and credential masking.

Keep single quotes, no semicolons, readable spacing, and blank lines between logical steps. Use existing Bun, Elysia, React, Zustand, Tailwind, and shadcn/ui boundaries. Custom checkboxes, dropdowns, and radio controls must retain labels, keyboard navigation, focus, and disabled states.

Update affected documentation with exact checks and limitations. Commit finished work using Conventional Commits, such as `feat(auth): add scoped runtime API keys`. Preserve unrelated edits. Do not commit secrets, databases, backups, dependencies, build output, or preview artifacts; do not force push or publish without authorization.

Report vulnerabilities through the private channel described in [security](../SECURITY.md). Follow the [code of conduct](../CODE_OF_CONDUCT.md).

## GitHub workflow

Use the bug or feature form when opening an issue. Describe the user outcome and use made-up data. The pull-request template asks for the change, checks and any remaining limits.

Dependabot proposes Bun dependency and GitHub Action updates weekly, grouping minor/patch updates with small open-PR limits. Review and test proposals, then update the release version and changelog before completing a delivery. Bun runtime, CI pins and `@types/bun` are upgraded together manually. There is no automatic merge, publishing or fork-PR execution on the persistent Windows runner.

The funding file names `mysbryce` for GitHub Sponsors. GitHub handles account eligibility and the hosted funding button; local configuration does not verify activation.

Dependabot PRs are update proposals, not approvals. Review changed SHA pins and upstream release notes, especially major action updates. Keep the Windows runner and push/manual-only events. Add the dependency-only delivery's patch version and changelog entry before final validation. Run **Check** manually on that reviewed same-repository branch; artifact-action changes also need **Prepare release candidate** and artifact inspection. Merge only the tested revision. Do not enable fork PR execution or automatic merging to obtain checks.
