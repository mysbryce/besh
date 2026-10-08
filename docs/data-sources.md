# Spreadsheet data sources

Create an API from a spreadsheet without writing JSON. Owners and editors can import and manage sources; viewers cannot access source management or previews. Published callers need a separate scoped runtime key.

## Import and review

1. Open **Data sources** and name the source.
2. Import a CSV or Excel `.xlsx` file, or choose a public Google Sheet and paste its standard share link.
3. Review the preview, inferred column types, and human headers. The first row supplies column names; Excel uses its first worksheet.
4. Choose API fields, protocol, endpoint path, and rows per request. Review the API field names displayed beside spreadsheet headers.
5. Create the draft, test it in API Studio, and publish as owner. Issue its runtime key in **API keys**.

Column names become safe, unique API field names. Text, numbers, true/false values, and blank cells are represented explicitly; Excel dates become ISO strings. Mixed-type columns become text. Nested output and custom graph behavior remain available through optional advanced configuration.

## Snapshots and access

Uploads save a local snapshot. Replacement imports a new snapshot for the same source. Public Google Sheets are fetched by the server and saved locally; **Refresh saved data** fetches the sheet again. These are manual actions, not background synchronization or write-back to the spreadsheet. Private-sheet OAuth and account connections are not implemented.

Published APIs read the latest saved source snapshot. Refreshing or replacing a source can change live response values without republishing the graph; review the confirmation before proceeding. Owners and editors have this data-management permission. Release history preserves graph definitions, while source snapshots are mutable data.

Deleting a source used by any draft or published release returns `409`. Remove its references first. Import/refresh/replacement failure leaves the last valid snapshot intact. Workspace backups include source data; store them privately and review restored credentials before serving callers.

## Generated APIs

REST drafts use a request, spreadsheet-read, and response flow. They return selected rows directly as an array. A GraphQL draft exposes typed `Query.rows` fields matching the selected columns; no mutation or spreadsheet write operation is generated. Both protocols retain normal draft validation, owner-only publication, and scoped runtime authentication.

New REST drafts include [API rules](api-contracts.md) for their selected columns, inferred types/nullability, maximum row count, and optional typed query filter. No source rows are embedded in the OpenAPI download. Older drafts without rules still run. Replacing or refreshing data does not rewrite published rules: a changed snapshot that violates the live response contract fails with a generic 500 until data is corrected or a reviewed contract is republished.

Optional equality filters compare one spreadsheet column to a caller-supplied input. If the optional caller value is omitted, the API returns all eligible rows up to its configured limit. Search filters are not authorization: callers can omit or change them. Runtime reads project only selected columns; they do not grant field-level identity rules or record-level ownership checks. Choose projected columns and caller credentials accordingly.

## Limits

- CSV/Excel uploads and Google exports: at most 2 MiB; the actual upload listener caps the multipart request at 3 MiB.
- Excel archive expansion: at most 16 MiB, with archive/XML checks; macros and uploaded code are not executed.
- Source data: at most 5,000 rows and 64 uniquely named columns; normalized snapshot JSON at most 8 MiB.
- Preview: first 10 rows. API reads: 1 to 100 rows, still bounded by normal runtime response limits.
- Google imports accept standard HTTPS `docs.google.com` spreadsheet links and restricted Google export redirects. Arbitrary URLs, credentials in links, and unrestricted redirect destinations are rejected.

Migration 7 adds source snapshots to the control database. Database-provider adapters, live SQL queries, spreadsheet writes, private Google OAuth, scheduling, and multi-tenant data isolation remain planned.

See [API routes](api.md), [GraphQL](graphql.md), [testing evidence](testing.md), and [security](../SECURITY.md).
