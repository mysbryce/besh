# Spreadsheet data sources

Create an API from a spreadsheet without writing JSON. Owners and editors can read and manage unprotected sources; built-in viewers cannot. Custom roles can separately grant source reads and changes. Generating an API needs source-read and flow-write permission; there are no implied grants. Published callers need a separate scoped runtime key. See [roles and permissions](roles.md).

## Import and review

1. Open **Data sources** and name the source.
2. Import a CSV or Excel `.xlsx` file, or choose a public Google Sheet and paste its standard share link.
3. Review the preview, inferred column types, and human headers. The first row supplies column names; Excel uses its first worksheet.
4. Choose API fields, protocol, endpoint path, and rows per request. Review the API field names displayed beside spreadsheet headers.
5. Create the draft, test it in API Studio, and publish with publication permission. Issue its runtime key in **API keys** with key-management permission.

Column names become safe, unique API field names. Text, numbers, true/false values, and blank cells are represented explicitly; Excel dates become ISO strings. Mixed-type columns become text. Nested output and custom graph behavior remain available through optional advanced configuration.

## Snapshots and access

Selected access separates **USE** from source reads/management. It permits choosing granted source structure and executing it through an existing authorized API, without direct row previews, uploads, refresh, or API generation. USE can expose stored rows through that API and is not record/column/tenant isolation. See [selected actions and USE](roles.md#selected-api-actions-and-dependency-use).

Uploads save a local snapshot. Replacement imports a new snapshot for the same source. Public Google Sheets are fetched by the server and saved locally; **Refresh saved data** fetches the sheet again. These are manual actions, not background synchronization or write-back to the spreadsheet. Private-sheet OAuth and account connections are not implemented.

Published APIs read the latest saved source snapshot. Refreshing or replacing a source can change live response values without republishing the graph; review the confirmation before proceeding. Owners, editors, and custom members granted source-write permission can make these changes for unprotected sources; protected full/raw changes require the owner. Release history preserves graph definitions, while source snapshots are mutable data.

Uploaded-file replacement labels, compatibility guidance, confirmation and completion follow your dashboard language. Switching language preserves the chosen file and saved data; replacement requires explicit confirmation. Canceling makes no request. A rejected import keeps the last valid snapshot, with the server error shown unchanged.

Deleting a source used by a current draft or currently published API returns `409`. Remove those references first. Older release history does not retain the source snapshot or block deletion; rollback to an old graph can fail when its source is missing. Import/refresh/replacement failure leaves the last valid snapshot intact. Workspace backups include source data; store them privately and review restored credentials before serving callers.

## Generated APIs

The generation form's guidance, field/filter controls, local validation, dirty-draft confirmation and completion follow all seven dashboard languages. Authored API names, paths, original headers, mapped keys and typed contracts stay literal. Language and protocol selection do not save or publish an API. Canceling dirty-draft review keeps the existing draft; confirmed creation saves a new unpublished draft. Changing language during pending creation keeps controls disabled and shows completion in the current language. Source-read and flow-write permissions still govern creation.

REST drafts use a request, spreadsheet-read, and response flow. They return selected rows directly as an array. A GraphQL draft exposes typed `Query.rows` fields matching the selected columns; no mutation or spreadsheet write operation is generated. Both protocols retain normal draft validation, publication permission checks, and scoped runtime authentication.

New REST drafts include [API rules](api-contracts.md) for their selected columns, inferred types/nullability, maximum row count, and optional typed query filter. No source rows are embedded in the OpenAPI download. Older drafts without rules still run. Replacing or refreshing data does not rewrite published rules: a changed snapshot that violates the live response contract fails with a generic 500 until data is corrected or a reviewed contract is republished.

Optional equality filters compare one spreadsheet column to a caller-supplied input. If the optional caller value is omitted, the API returns all eligible rows up to its configured limit. Search filters are not authorization: callers can omit or change them. Runtime reads project only selected columns; they do not grant field-level identity rules or record-level ownership checks. Choose projected columns and caller credentials accordingly.

## Limits

- CSV/Excel uploads and Google exports: at most 2 MiB; the actual upload listener caps the multipart request at 3 MiB.
- Excel archive expansion: at most 16 MiB, with archive/XML checks; macros and uploaded code are not executed.
- Source data: at most 5,000 rows and 64 uniquely named columns; normalized snapshot JSON at most 8 MiB.
- Preview: first 10 rows. API reads: 1 to 100 rows, still bounded by normal runtime response limits.
- Google imports accept standard HTTPS `docs.google.com` spreadsheet links and restricted Google export redirects. Arbitrary URLs, credentials in links, and unrestricted redirect destinations are rejected.

Migration 7 adds source snapshots to the control database. Narrow tenant-protected snapshot reads are implemented in 0.11 as described below. Live external database adapters, spreadsheet writes, private Google OAuth/typed Sheets API provenance, scheduling, broader field authorization, and multi-workspace isolation remain planned.

See [API routes](api.md), [GraphQL](graphql.md), [testing evidence](testing.md), and [security](../SECURITY.md).

## Tenant-protected snapshots

Implemented in 0.11. Under owner-only **Tenant protection**, select a spreadsheet and **Tenant rows only**, then review its **Tenant column**. Fresh imports/refreshes preserve mapped original cell types/text separately from normalized business output, up to 16 MiB per source. Exact original text controls tenant matching: `1.0` and `1` may both display as numeric `1`, but remain different identities; spaces/case matter. Original nonnull numeric/boolean/date cells cannot be coerced into identity text. Null/empty text matches no approved identity.

Original provenance means import-transport cells. Excel preserves typed numeric/boolean/date cells and rejects them as tenant text. CSV and public Sheets CSV preserve exact returned text; the connector cannot verify underlying Google cell types or distinguish identities whose exported display values collide. Keep tenant IDs distinct in the returned CSV. Private typed Sheets API provenance is planned.

Older normalized-only snapshots require reviewed reimport or an owner refresh that collects fresh original cells. Missing/misaligned provenance returns `409`; active malformed provenance fails closed without rows. Header changes must preserve compatible protected-column provenance before committing. Owner policy metadata lists eligible text columns without exposing original cells.

Protected full metadata, rows, refresh, replacement, and management are owner-only. Non-owner normal lists omit these sources; authorized structural catalogs still provide choices without rows/counts. The mandatory tenant predicate AND the optional business filter apply before projection and limits. Use the narrow supported graph and review permanent backup restrictions in [row protection](row-protection.md).

The 0.13 API field allowlist is implemented. **All fields** includes future columns; **Selected fields** allows only explicitly chosen mapped keys for returned fields and business filters. An empty selection stops protected API reads of that source, including owner tests and existing pinned releases. The private tenant predicate remains independent of that selection. Omitted field settings are preserved, and deprotection retains them dormant. Replacement/refresh rejects removal of a retained selected key before committing; adding a column does not add it to a selected allowlist. Owner raw previews and backups still contain full data, while authorized structure still shows column names. See [API field allowlists](row-protection.md#api-field-allowlists).

**Tenant-specific API fields** can narrow that shared selection for each approved tenant. Missing or reset choices inherit; selected fields intersect the global policy, including an empty choice that denies reads. Exact trusted assigned/reviewed/original-key identity selects the profile, never request values. Retained choices survive disabled protection and retired identities. Import replacement and Google refresh cannot remove a key retained by any selected profile; review that tenant's choice or reset to shared fields first. This does not activate protection or the tenant. See [tenant field profiles](row-protection.md#tenant-field-profiles).
