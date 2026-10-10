# Workspace invitation links

An owner can invite an existing member to set their own email/password sign-in. This does not create a member, change permissions, or grant access to published APIs.

## Invite a member

1. Open **Members**. Add the member with their intended role, API access and optional tenant. Leave email blank for key-only access.
2. Choose **Invite sign-in** for that member. Enter their email and create an invitation link.
3. Copy the link and send it privately to the intended person. Besh does not send an email.
4. Save the link before closing its receipt. It is shown once and cannot be retrieved later.

The link expires 24 hours after creation and works once. Anyone holding it can set the invited member's password. It is not proof that they own the email address. Use a trusted channel and check the intended recipient.

Existing email/password accounts cannot be invited or reset this way. The bootstrap owner cannot be invited. Review active links under **Invitations**; refresh before recovering an uncertain action. Reissuing replaces the previous link. Revoking an exact invitation ends only that link, without removing the member or changing their existing key.

## Accept a link

The page shows the workspace, member, email, current role and access mode. If another workspace session is open, sign out explicitly before setting the password. Set a password containing 12 to 128 characters, confirm it, then sign in normally using the invited email. Acceptance does not automatically sign in.

Opening a link from an unsaved editor asks before leaving. Returning keeps the draft; signing out asks before discarding it. Finish a pending workspace action before reopening a link.

The member's role, API access, tenant assignment and field profiles stay unchanged. Their existing member key remains valid. Setting the account ends their older browser sessions. Changing a role, permission set, API access or tenant assignment invalidates pending invitations. Owner-key recovery also clears pending links.

If acceptance is unconfirmed, do not repeatedly submit the password. Try normal sign-in or ask the owner to review the invitation. If creation is unconfirmed, refresh invitation metadata before an explicit reissue. Refresh never recovers a raw link.

## Safety and limits

The secret is captured from the URL fragment and removed from the address bar. It remains in page memory only; reloading after removal loses it. Preview and acceptance send it in a request body, never a query or path. Responses are not cached. Do not paste links into public issues or logs.

The database keeps only invitation hashes, intended emails and metadata. Audit records keep action and invitation IDs, not emails, passwords or links. There can be at most 256 pending invitations. Public invitation attempts have separate persisted limits; password hashing is bounded. Expired, revoked, replaced, used or invalid links cannot create an account. Existing accounts are never overwritten.

Backups include invitation hashes and metadata. Restoring an older database can restore an invitation that was subsequently used or revoked. Review and revoke restored links before reopening the workspace. Physical restoration of older data is outside the live revocation guarantee.

Email delivery, email verification, password recovery and invitations to new workspaces remain planned. See [workspace sign-in](workspace-auth.md), [roles](roles.md), [API reference](api.md) and [roadmap](roadmap.md).
