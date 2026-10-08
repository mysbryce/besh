# AI policy

AI assistance is welcome. Contributors remain responsible for every change.

## Contributions

- Read `AGENTS.md`, the glossary, and relevant design notes first.
- Explain the problem and check existing behavior before changing it.
- Keep changes small. Test public behavior before committing.
- Review generated code for security, correctness, licensing, and accessibility.
- Disclose substantial AI assistance in pull requests. Name tests actually run.
- Never invent test results, integrations, benchmarks, sources, or project state.
- Update the version and `CHANGELOG.md` for each completed delivery. Follow [version rules](docs/releases.md); never approve or bump a `1.0.0` release without the maintainer's explicit confirmation.
- Never upload secrets, private customer data, or production backups to a model.
- Respect user changes. Do not rewrite history or publish without authorization.

## Besh's product agent

The product agent is a planned feature until implemented and verified.

- Use the same permissions as the person requesting work.
- Respect both current role actions and API/dependency scope. A dependency USE grant can expose data through an authored API; it does not permit direct previews, secrets, global resource changes, or bypassing resource-owned row protection. Never derive execution identity from model output, caller fields, or a substituted owner credential; protected calls must use the verified actor/key’s private current principal. Issuer-bound caller keys must retain their authorizing identity/action rather than borrowing an owner or agent's authority during replacement.
- Access data only through typed, authorized tools.
- Treat prompts, provider output, database content, and plugin content as untrusted.
- Show proposed changes before destructive or externally consequential actions.
- Require scoped authorization for deletion, migration, publication, installation, and data export.
- Log tool actions, decisions, and results without storing credentials or unnecessary personal data.
- Limit execution time, tool calls, spend, and accessible resources.
- Support cancellation. Do not silently retry destructive actions.
- Keep provider credentials on the server. Make data sharing explicit in provider setup.

AI cannot approve its own access, bypass a failed check, or claim a feature works without evidence.
