# Workspace accounts and sessions

Besh workspace sign-in uses a workspace key or email/password. Social sign-in belongs to planned templates for generated product APIs. A workspace account or session cannot call a published API; callers still need its scoped runtime API key.

## Sign in

The first-run wizard creates a workspace and shows its owner key once. Save that key before entering the studio. On later visits, choose **Workspace key** or **Email & password** on the sign-in screen.

To add email/password sign-in, open **Account & sessions** after signing in with your key. Enter an email address and a new password containing 12 to 128 characters. Under **Confirm your identity**, choose **Workspace key** or **Current password** and enter that credential. Select **Save sign-in details**.

An account change needs fresh proof even when you already have a browser session. It changes only your own account, keeps your current session, and ends your other sessions. It does not change your workspace key. Email addresses are trimmed, lowercased, and unique across the workspace; passwords retain their exact characters. Email delivery, verification links, password-reset links, and workspace invitations are not implemented.

Owners can add an editor or viewer from **Members**. Enter **Member email (optional)** and **Member password** to create email/password access with the member, or leave email blank for key-only access. The member key still appears once and must be saved. This creates access directly; no invitation email is sent. Members can later change their own account under **Account & sessions**.

## Manage sessions

The browser keeps an HttpOnly, SameSite=Strict session cookie and restores your sign-in after reload. Sessions expire 12 hours after sign-in; reload and activity do not extend that time. A member can have at most 20 active sessions; a new sign-in ends the oldest when the limit is reached. Passwords and workspace keys are not saved in local storage. **Sign out** ends this browser session on the server.

Open **Account & sessions** to inspect active sessions. The page identifies **This device** and shows session expiration. Members see their own sessions; owners see all workspace sessions. Use **Refresh sessions** for current metadata or **Revoke** to end a selected session after confirmation.

Ending a session does not disable its member's password or workspace key. The member can sign in again while those credentials remain valid. Remove a member to end that member's access; the bootstrap owner cannot be removed from the member screen.

## Browser origin and API clients

Basic local setup requires no environment changes. Use the dashboard URL printed by `bun run setup` or `bun run dev`; its same-origin proxy sends browser authentication to the API server. A built dashboard uses the API server's origin.

For a reverse proxy, set `BESH_WEB_URL` to the exact public browser origin, such as `https://besh.example.com`, without a path or trailing slash. HTTPS is required outside loopback development. HTTP is allowed only for `localhost`, `127.0.0.1`, or `[::1]`. HTTPS sessions use a Secure cookie. Forwarded headers do not determine the trusted origin; without configuration, the server uses the request URL's origin.

Login requires that exact `Origin`. Cookie-authenticated management writes and logout also require `X-Besh-CSRF`, returned by login/session restoration and kept in browser memory. The dashboard sends these automatically. Scripted management clients can continue using `Authorization: Bearer <member-key>` without cookie CSRF headers. An explicit Authorization header takes precedence over a cookie, including when its credential is invalid.

Login throttling persists across restarts: 10 invalid attempts for an identity in five minutes, 100 total attempts in five minutes, and at most four concurrent verifications. Successful sign-in clears that identity's attempt count. A limit returns `429`; wait before trying again. These limits protect login, not a general management or runtime request quota.

## Recovery

Keep the owner key privately even when using email/password. Server-side owner-key recovery is described in [getting started](getting-started.md#data-and-recovery). Changing `BESH_ADMIN_TOKEN` replaces the owner key and ends owner sessions when the key changes. It preserves the owner's existing email/password account. If that password also needs replacement, sign in with the recovered key and update **Account & sessions**, using that key as proof.

Backups include password hashes, session hashes/metadata, and login throttle state. Restoring an older snapshot can restore an old password, an unexpired session, or a key revoked after the snapshot. Review restored member access, accounts, sessions, and runtime keys before serving the restored workspace. Ending sessions alone does not invalidate restored passwords or keys.

See [API reference](api.md), [architecture](architecture.md#identity-and-roles), and [roadmap](roadmap.md) for supported boundaries and remaining work.
