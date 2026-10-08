# Security

Do not put credentials, customer data, or exploit details in public issues.

For a vulnerability, use the repository's private security advisory channel if enabled, or a maintainer's published private contact. The repository owner must configure a reporting contact before public release. No response SLA is promised yet.

Besh starts as an early local-development project. A passing test suite is not a security certification. Before public deployment, require TLS, scoped identity, rate limits, encrypted secrets, isolated plugins, backup recovery checks, dependency review, and an independent security review.

See [architecture](docs/architecture.md) for trust boundaries and [AI policy](AI_POLICY.md) for agent access rules.
