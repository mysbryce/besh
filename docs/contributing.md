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
