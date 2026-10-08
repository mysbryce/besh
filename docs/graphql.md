# GraphQL APIs

Each visual API can publish a real GraphQL endpoint. Besh uses GraphQL.js to parse, validate, coerce variables, execute fields, and serialize typed responses. Choose **GraphQL** in the studio's **API type** dropdown.

The starter flow is ready to test without editing JSON. Schema text stays under **Advanced schema**; custom variables and an operation name stay under **Advanced GraphQL input**. Response field forms preserve values and types. Use the advanced editors when your custom contract needs them.

## Spreadsheet APIs

In **Data sources**, choose GraphQL, review the column-to-field mapping and row limit, and create an API. Besh generates a typed `Query.rows` contract and a request → spreadsheet rows → response draft. The studio seeds a matching query, so **Test flow** works immediately. The response step shows **Return spreadsheet rows** instead of requiring `$data` JSON configuration.

Selected spreadsheet columns become fields on the row type; an optional filter becomes a named root argument. Generated APIs expose queries only. The published graph and schema change only on publication, while reads use the source's latest saved snapshot. Confirm replacements and manual Google refreshes carefully. Private-sheet OAuth, writeback, and scheduled synchronization remain planned. See [spreadsheet data](data-sources.md).

## Example

Set path to `/greeting` and use this schema:

```graphql
type Query {
  greet(name: String!): Greeting!
}

type Mutation {
  greet(name: String!): Greeting!
}

type Greeting {
  message: String!
  name: String!
}
```

Configure the response node:

```json
{
  "status": 200,
  "body": {
    "message": "Hello from Besh",
    "name": "$input.body.name"
  }
}
```

Save, then test this operation with variables `{ "name": "Ada" }`:

```graphql
query Greeting($name: String!) {
  greet(name: $name) {
    name
  }
}
```

Set the optional operation name to `Greeting` when selecting this operation from a document containing several operations. The result contains `data.greet.name: "Ada"`; `message` is omitted because it was not selected.

After publishing, create a runtime API key for this API in **API keys** with **GraphQL queries**. Send a JSON POST to `/graphql/greeting` with `Authorization: Bearer <runtime-api-key>`:

```json
{
  "query": "query Greeting($name: String!) { greet(name: $name) { message name } }",
  "variables": { "name": "Ada" },
  "operationName": "Greeting"
}
```

Mutations use the same transport, for example `mutation { greet(name: "Grace") { message name } }`. The current response/condition nodes do not themselves write product data; database write nodes remain planned.

## How fields map to a flow

- Each top-level query or mutation field runs this API's visual flow once. Aliases and fragments follow GraphQL execution rules.
- Arguments, including typed input objects, become flow `body`. Use `$input.body.name` to read one argument.
- Flow `query.field` contains the schema field name. Flow `query.operation` is `query` or `mutation`. Use conditions to choose different branches.
- The response body becomes that root field's value. Nested objects resolve their own data properties; they do not start another flow.
- GraphQL validates and serializes the body against the field's declared type. Built-in scalars, enums, input objects, objects, lists, interfaces/unions with `__typename`, and nullability are supported by GraphQL.js.
- A flow status of 400 or higher becomes a GraphQL field error with `extensions.code: FLOW_ERROR` and `extensions.status`. It does not override GraphQL's HTTP envelope. Other execution failures omit internal values from their messages.

## Drafts, routes, and permissions

The management flow definition includes optional `graphql: { schema: "..." }`, plus `method: "POST"`. Omitting `graphql` keeps the REST behavior.

`POST /api/flows/:id/graphql/test` accepts the same request envelope and returns `{ status, body, visited }` for the draft. The studio renders that diagnostic wrapper. Published endpoints return the GraphQL envelope directly, such as `{ "data": { ... } }`.

Editors and owners can save and test drafts with their member tokens. Only owners can publish or manage runtime API keys. Published endpoints require a runtime key scoped to this flow. `query` permits queries and `mutation` permits mutations; a key may grant both. Query-only keys cannot run mutations. Owner and member tokens cannot call published endpoints, and runtime keys cannot access management routes or draft tests.

Authorization applies to the selected operation, including its `operationName` when the document contains several operations. Grants cover the whole operation, not individual root fields or data records. Keys require expiration within 366 days and stop working immediately upon expiration or revocation. Scope follows the flow across republishing, so owners must review keys when broadening published behavior.

Invalid schemas can be saved as drafts but cannot be tested or published. Draft edits do not alter live GraphQL behavior until publication. Duplicate GraphQL paths return `409`. REST `/run/greeting` and GraphQL `/graphql/greeting` may coexist. Migration 5 adds protocol-aware route uniqueness while preserving old REST routes.

GraphQL tests and calls record `graphql.tested` and `graphql.executed` audit events. Queries, variables, tokens, and returned data are not stored in these audit records. Workspace backups include GraphQL drafts, schemas, releases, and runtime-key hashes and metadata. Restoring a snapshot can restore key access revoked afterward; review and rotate or revoke restored keys.

## Transport and limits

- JSON POST only. Other HTTP methods return `405`. Request batching is rejected.
- Runtime responses use `application/graphql-response+json`. Invalid documents/variables return `400`; executed operations return `200`, potentially with `errors` and partial/null `data`.
- Tokens are required; authentication and route failures use their normal HTTP status.
- Schemas and operations: at most 16,384 characters and 2,000 parser tokens each.
- Selected operation: depth 12, 200 expanded field selections, and 16 root selections. Fragment expansion counts toward limits.
- Execution: 5,000 resolver calls; 256 KiB input/output limits and a conservative response budget based on root data size multiplied by selected fields. A large response can hit this budget even when a smaller subset was requested.
- Existing graph and JSON nesting limits still apply.

Subscriptions, incremental delivery, uploaded resolver code, custom scalar implementations, GET transport, batching, and runtime introspection are not enabled. The schema is available in the editor and authenticated management flow response. This is a bounded local-development implementation, not a complete hosted GraphQL platform.

References: [GraphQL.js](https://www.graphql-js.org/docs/) and [operation complexity controls](https://www.graphql-js.org/docs/operation-complexity-controls/).
