# Besh glossary

- **Workspace**: one team and its APIs, members, connections, and audit records.
- **Flow**: a saved graph that defines an API operation.
- **Node**: one step in a flow, such as checking input or returning a response.
- **Edge**: a connection that chooses which node runs next.
- **Draft**: an editable flow. Saving a draft does not change a published endpoint.
- **Release**: a validated, immutable copy of a flow used by callers.
- **API rules**: optional REST query, body, and response constraints checked by the server; GraphQL uses its schema instead.
- **Contract**: the versioned definition of an API's accepted inputs and returned data.
- **OpenAPI document**: a downloadable description of one saved REST draft or published release, including its route, rules, and runtime-key authentication.
- **GraphQL schema**: a typed contract describing query/mutation fields, their arguments, and returned data.
- **GraphQL operation**: a query or mutation selecting fields from a published schema; variables supply typed argument values.
- **Run**: one execution of a flow with an input and a result.
- **Connection**: a reference to a database or service. Credentials stay on the server.
- **Data source**: an imported CSV/Excel file or public Google Sheet whose rows are saved as a versioned local snapshot.
- **Snapshot**: the current saved rows and inferred column types for a data source; refresh/replacement updates the data used by published APIs.
- **Column mapping**: the reviewed selection of spreadsheet columns and API field names exposed by a generated API.
- **Plugin**: a versioned extension that adds nodes or integrations.
- **Permission**: a named action a member may perform. Roles group permissions.
- **Member token**: an owner, editor, or viewer credential for workspace management; it cannot invoke published endpoints.
- **Runtime API key**: a server-issued credential granting REST requests or GraphQL query/mutation operations for one published flow, with required expiration and immediate revocation.
- **Runtime grant**: permission to invoke an entire REST request, GraphQL query, or GraphQL mutation; it does not filter fields or records.
- **Audit event**: a record of who performed an action, when, and on which resource.
- **Migration**: a versioned change to a database schema.
- **Backup**: a consistent copy of data that can be restored and verified.
- **Agent proposal**: an AI-generated change that must pass the same checks as a human change.

See [architecture](docs/architecture.md) and [roadmap](docs/roadmap.md).
