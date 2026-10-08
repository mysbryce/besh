# Besh update notices

Owners open **Updates**, choose a public GitHub repository, and save the settings. Choose **Include preview releases** to include alpha, beta, and other prereleases. The default repository is `https://github.com/mysbryce/besh`; preview releases are included by default.

Choose **Check releases** to compare saved release information with the installed Besh version. Opening the page reads cached information and does not contact GitHub. A release link opens GitHub with a protected new tab. This feature reports versions; installation, artifact verification, migrations, and recovery remain planned.

## Results

- **Update available**: the selected eligible release has a higher semantic version than this installation.
- **No newer release found**: the selected eligible release is equal to or older than this installation.
- **No matching releases found**: none of the inspected releases has an eligible semantic version.
- **Release check failed**: GitHub could not return an acceptable response. Confirm that the repository is public and try again later.

The last check time identifies when GitHub was contacted. An available version does not prove that the release is compatible, authentic, or ready for production. Review release notes and back up data before upgrading. Besh stays below `1.0.0` until the maintainer explicitly confirms that version.

## Saved settings and recovery

Settings and the last result survive restart and are included in workspace SQLite backups. Saving settings clears the old result. A check started with older settings cannot overwrite newer settings. A stale save preserves the local form; **Refresh update settings** reloads saved settings after confirming disposal of unsaved edits.

Only one workspace check runs at a time. Wait at least one minute between checks, including failed checks and settings changes. This cooldown persists across restart. A stopped process may leave a ten-second check lease; shutdown aborts active work before the database closes. No checks run automatically on startup or sign-in.

## What is inspected

Besh calls GitHub's public release-list API for the configured repository. It inspects the first 20 returned release entries, skips drafts and invalid version tags, and selects the highest eligible semantic version. A leading `v` is accepted. Prerelease suffixes and GitHub's prerelease marker both count as preview releases. Build metadata does not affect precedence. This bounded list may omit an older release outside that page.

Plain Git tags without GitHub releases are not listed. Private repositories and access tokens are unsupported. Provider release notes, assets, and download URLs are not saved. The displayed release URL is built from the configured GitHub repository and accepted tag; provider-supplied links are ignored.

Repository settings accept only `https://github.com/owner/repository`, without credentials, query strings, or fragments. Checks use a fixed `api.github.com` target with redirects rejected. Response headers are limited to 64 entries/32 KiB, the decoded body to 256 KiB, and the whole request to five seconds. A repository with large release notes or asset lists can exceed these limits and show a failed check.

Only owners can read, save, and check update settings. Custom workspace grants cannot delegate this installation-level action. Audit records contain action metadata, without remote response bodies or credentials. API request formats are in the [HTTP reference](api.md).

GitHub documents [release listing](https://docs.github.com/en/rest/releases/releases#list-releases) and [REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions). Besh uses the supported `2026-03-10` API-version header. Version and changelog rules are in [release checks](releases.md).
