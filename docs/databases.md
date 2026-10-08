# Uploaded SQLite database copies

Besh reads an uploaded SQLite copy without attaching a database file from your server. The original upload is saved unchanged. Reads run against a separate read-only SQLite engine; they do not query Besh's control tables or change your source database.

This is a local copy, not a live external connection. Changes in the original database do not synchronize to Besh. Automatic refresh, replacement, SQL writes, joins, arbitrary SQL, and other database providers remain planned.

## Prepare a standalone copy

Export a consistent standalone `.sqlite` database from your database application in SQLite's rollback-journal format. If the source uses WAL, use its backup/export feature rather than uploading its live main file and `-wal`/`-shm` companions. Besh rejects WAL-marked files; a valid standalone WAL-mode backup also needs conversion/export to the supported format. No database server, connection string, environment edit, or server file path is needed.

Supported tables contain declared text, numeric, or `BOOL`/`BOOLEAN` columns. Values must match each column's type. Boolean columns contain only `0`, `1`, or null and become JSON true/false. Numbers must be finite; SQLite integer values must fit JavaScript's safe integer range. BLOBs, mixed column types, generated columns, views, virtual tables, unsupported declared types, and malformed/encrypted files are rejected. Nullability follows the inspected column declaration.

Column names become safe API keys while the original column labels remain visible. For example, `Full Name` becomes `full_name`. Selected reads return only the chosen API fields. A bounded equality filter matches a value of the column's type or null; use true/false for booleans, not numeric 0/1. Filter values are bound as SQL parameters. Caller-controlled filters are search tools, not record authorization.

## Upload and preview

1. Open **Database connections**, enter **Connection name**, and choose **SQLite file**.
2. Select **Upload read-only copy**. Besh inspects the complete supported file before saving it.
3. Under **Saved SQLite copies**, choose **Database connection** and **Table**. Review **Returned columns** and choose **Maximum rows**.
4. Optionally enable **Filter rows**, choose a **Filter column**, and set a typed equality value. Select **Preview rows** to inspect the selected result.

Empty results are valid; try a different table or equality value. **Refresh connections** reloads current metadata. It does not refresh the uploaded data from its original source.

## Permissions

- **Read database copies** (`database-connections.read`) reads connection/table metadata and selected row previews.
- **Manage database copies** (`database-connections.manage`) manages uploaded copies. Owners have both database grants by default; built-in editors and viewers have neither.

Custom roles grant these actions explicitly. Draft generation needs both `database-connections.read` and `flows.write`; opening API Studio also needs `flows.read`. Draft testing uses `flows.test` and can reveal configured rows without a database-read grant. Publication uses `flows.publish`, and published calls require the flow's runtime API key. These are separate from connection management. No field-level, record-level, or tenant isolation is added. See [workspace roles](roles.md).

## Generate and maintain an API

Selected access uses separate database-copy **USE** grants and structural table/column catalogs for existing authorized APIs. It gives no direct row previews, original-file download, upload/check/delete management, or new-API generation. USE can expose stored rows through an API; it is not record/column/tenant isolation. See [selected actions and USE](roles.md#selected-api-actions-and-dependency-use).

After reviewing the table and returned fields, fill **API name**, **API type**, and **Endpoint path**, then select **Create API draft**. If **Filter rows** is enabled, **Filter input name** names the caller's query parameter or GraphQL argument. The preview's fixed equality value is not saved as an API restriction; callers supply the generated input. Generation creates a saved REST GET or GraphQL query draft with typed fields and an optional equality input. It does not publish the draft or create a caller key. Review the draft, test it, publish it, then issue a scoped runtime key with the separate required permissions.

Changing a generated SQLite node's read settings does not rewrite its typed GraphQL schema or REST rules. Review selected fields, copied column types/nullability, and REST response row limits together; increasing the node's limit can otherwise fail response validation. For a forms-only workflow, create a new draft from **Database connections** with the desired choices. Use a different endpoint path if the original API remains published. Alternatively, update the matching contract in advanced tools before testing or publication. A new draft is a separate API and needs its own runtime key when published.

Generated REST reads use a query parameter; GraphQL reads use a typed `rows` argument. Omitting the optional input leaves the read unfiltered up to its limit. A database node can use fixed scalar/null equality or `$input.query`, `$input.params`, and `$input.body` references. A missing or null referenced input skips that filter. Returned rows replace `$data`; configure the response to return the rows. At most four database nodes are allowed per flow. Reads do not promise ordering or pagination.

In API Studio, choose **SQLite rows** and configure **Database connection**, **Table**, returned columns, maximum rows, and an optional filter. The form supports fixed values or request body/query/path inputs. Select **Apply configuration**, then choose **Rows from data step** under the response's **Response contents** and save the draft. All-mode members need database-read permission for these choices. Selected members use an operational API action and owner-granted database USE to load structure only; this gives no row preview.

Select **Check SQLite copy** to reinspect the original bytes. This does not fetch changes from your original database. To serve newer data, export and upload a new copy, update the draft's database reference, then test and publish the revision. Runtime keys continue following their flow across publication; review any broader exposure.

Select **Delete database connection**, review its name/version, and confirm permanent removal of the uploaded copy. Deletion is blocked by any draft or archived release reference, including releases no longer current. Editing a draft away from a copy does not remove its old release references. Stale actions return 409; use **Refresh connections** and review before retrying. Unknown/deleted copies return 404. No in-place replacement endpoint exists.

Management and REST errors use 429 for busy readers, 413 for oversized uploads/results, 503 for a helper deadline/cancellation, and 400 for invalid copy/read options. Retry a busy reader after active operations finish. GraphQL execution failures use its normal `data`/`errors` envelope. Prepare a smaller supported export when the source exceeds these limits.

## Limits

| Item                     | Limit                                                   |
| ------------------------ | ------------------------------------------------------- |
| One SQLite upload        | 2 MiB                                                   |
| Workspace copies         | 8 connections and 16 MiB of original bytes total        |
| Ordinary tables          | 1 to 8 per copy                                         |
| Columns                  | 1 to 32 per table                                       |
| Rows                     | 5,000 per table and 20,000 per copy                     |
| Text cell                | 4,096 characters                                        |
| Selected read            | 1 to 100 rows, at most 32 fields                        |
| Database nodes           | At most 4 per flow                                      |
| Reader helpers           | At most 2 active helpers per Bun process                |
| One helper operation     | 2-second deadline and 256 KiB serialized output         |
| SQLite allocation budget | 16 MiB per helper; does not cap the whole process's RAM |

Inspections and reads use Besh's trusted helper program in a native child process, with generated queries and no uploaded scripts. Timeout, cancellation, or shutdown stops the helper. This separates synchronous SQLite work from the management server; it is not an OS sandbox for arbitrary plugins or code.

## Back up the copy

Original SQLite bytes and connection metadata are stored in Besh's control database. A normal workspace backup includes them consistently, so restoration does not need a separate product database file. Query engines are temporary and reconstructed from those saved bytes.

Uploaded database contents are not encrypted by Besh. SQLite backup downloads include the entire original copy, including tables and columns you chose not to expose through an API. Keep workspace data/backups private and grant backup access accordingly. The separate product-OAuth secret key encrypts provider secrets and verifiers; it does not encrypt uploaded SQLite files.

Restoring a workspace backup restores its database copies, flow releases, role assignments, and credential state together. Review restored roles, sessions, and runtime keys before serving callers. Graph rollback is a separate operation and does not restore external data.

See [API reference](api.md), [workspace backups and recovery](getting-started.md#data-and-recovery), [runtime keys](api-keys.md), and [verification evidence](testing.md).
