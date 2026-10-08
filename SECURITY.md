# Security

Do not put credentials, customer data, or exploit details in public issues.

For a vulnerability, use the repository's private security advisory channel if enabled, or a maintainer's published private contact. The repository owner must configure a reporting contact before public release. No response SLA is promised yet.

Besh starts as an early local-development project. A passing test suite is not a security certification. Before public deployment, require TLS, scoped identity, rate limits, encrypted secrets, isolated plugins, backup recovery checks, dependency review, and an independent security review.

See [architecture](docs/architecture.md) for trust boundaries and [AI policy](AI_POLICY.md) for agent access rules.

Owner and member credentials authenticate workspace management only. Published APIs require separate expiring runtime keys scoped to one published flow and REST or GraphQL query/mutation operations. Runtime keys cannot manage members, change flows, or test drafts. Only owners issue and revoke them. The server stores token hashes, returns each token once, and checks expiration and revocation on every call.

Workspace email/password or member keys exchange into HttpOnly, SameSite=Strict browser sessions with a fixed 12-hour expiry. Passwords use Argon2id hashes; session secrets are stored as hashes. Cookie-authenticated writes require a session-bound CSRF token and the exact trusted browser origin. HTTPS cookies use Secure; HTTP is limited to loopback development. Configure the exact public origin for a reverse proxy. See [workspace authentication](docs/workspace-auth.md) for configuration, login limits, account changes, and revocation.

Account changes require a current password or that member's key and end other sessions. Owner-key recovery ends owner sessions when the key changes, while preserving the owner's password account. Restoring a backup may restore old passwords and unexpired sessions; review accounts and revoke restored access before serving the workspace. Social authentication belongs to planned generated-API templates, separate from workspace sign-in.

Operation grants do not provide field-level or record-level authorization. Keys follow their flow across republishing, so broader published behavior also broadens what existing grants can invoke. Review grants before publication. Restoring a backup can reactivate keys revoked since the snapshot; revoke or rotate those restored keys before serving callers.

Spreadsheet source management and previews require owner/editor permission. Review projected columns before generating a public-facing API. Published APIs read the latest saved snapshot; source replacement/refresh can change live data independently from graph publication. CSV/Excel imports and Google exports are bounded, uploaded code/formulas are not executed, and Google fetches restrict HTTPS hosts and redirects. Private Google OAuth and spreadsheet writes are not implemented. Backups contain imported rows and must be stored privately.
