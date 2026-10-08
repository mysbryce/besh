# Security

Do not put credentials, customer data, or exploit details in public issues.

For a vulnerability, use the repository's private security advisory channel if enabled, or a maintainer's published private contact. The repository owner must configure a reporting contact before public release. No response SLA is promised yet.

Besh starts as an early local-development project. A passing test suite is not a security certification. Before public deployment, require TLS, scoped identity, rate limits, encrypted secrets, isolated plugins, backup recovery checks, dependency review, and an independent security review.

See [architecture](docs/architecture.md) for trust boundaries and [AI policy](AI_POLICY.md) for agent access rules.

Owner and member credentials authenticate workspace management only. Published APIs require separate expiring runtime keys scoped to one published flow and REST or GraphQL query/mutation operations. Runtime keys cannot manage members, change flows, or test drafts. Only owners issue and revoke them. The server stores token hashes, returns each token once, and checks expiration and revocation on every call.

Workspace email/password or member keys exchange into HttpOnly, SameSite=Strict browser sessions with a fixed 12-hour expiry. Passwords use Argon2id hashes; session secrets are stored as hashes. Cookie-authenticated writes require a session-bound CSRF token and the exact trusted browser origin. HTTPS cookies use Secure; HTTP is limited to loopback development. Configure the exact public origin for a reverse proxy. See [workspace authentication](docs/workspace-auth.md) for configuration, login limits, account changes, and revocation.

Account changes require a current password or that member's key and end other sessions. Owner-key recovery ends owner sessions when the key changes, while preserving the owner's password account. Restoring a backup may restore old passwords and unexpired sessions; review accounts and revoke restored access before serving the workspace. GitHub product login belongs to generated APIs, separate from workspace sign-in.

Operation grants do not provide field-level or record-level authorization. Keys follow their flow across republishing, so broader published behavior also broadens what existing grants can invoke. Review grants before publication. Restoring a backup can reactivate keys revoked since the snapshot; revoke or rotate those restored keys before serving callers.

Spreadsheet source management and previews require owner/editor permission. Review projected columns before generating a public-facing API. Published APIs read the latest saved snapshot; source replacement/refresh can change live data independently from graph publication. CSV/Excel imports and Google exports are bounded, uploaded code/formulas are not executed, and Google fetches restrict HTTPS hosts and redirects. Private Google OAuth and spreadsheet writes are not implemented. Backups contain imported rows and must be stored privately.

GitHub product login requires a product server that holds the runtime key and separate login proof, associates each attempt with its initiating browser, and handles its own exact registered callback. Keep runtime keys and proofs out of browser code/storage, URLs, and logs. The template uses ten-minute, hash-stored state/proof, S256 PKCE, caller/flow/revision/connection-version binding, and one-use completion before bounded fixed-endpoint provider calls. It returns a verified provider identity without provider tokens or client secrets. It does not issue product sessions/JWTs, link email addresses, or enforce product record authorization. A passing controlled-provider test does not verify a real GitHub app or deployed callback. See [product login](docs/product-auth.md).

Provider client secrets and PKCE verifiers use AES-256-GCM encryption in SQLite with a separate local 32-byte key. The default `besh-secrets.key` sits beside the control database; `BESH_SECRET_KEY_PATH` can select another private location. This is encryption at rest, not an OS-keystore integration or certification. Restrict access to both the database and key: possession of both allows decryption.

SQLite backup downloads do not contain the encryption key. Back it up privately and separately, and restore the matching database and key together. Encrypted records with a missing key cause startup to fail rather than generate a replacement; losing the original key prevents recovery of provider credentials. SQLite backups still contain sensitive accounts, credential hashes, sessions, spreadsheet rows, and encrypted provider data. Connection edits affect live credential references and invalidate pending attempts even when published graphs stay immutable.
