# REST routes and release history

Use a path parameter when part of a URL identifies a record. Use separate flows when callers need separate API versions. Saved drafts and published releases remain separate.

## Add a path parameter

For an item endpoint, set the REST path to `/v1/items/:id`. Its live URL is `/run/v1/items/42` when the caller supplies `id=42`.

1. Add a parameter as a whole path segment, such as `:id`.
2. Set a response field's type to **From path parameter**, input field `id`, or choose **Path parameter** as a condition's input source.
3. In **Try it out**, fill **Path parameter id** under **Path parameters**.
4. In **API rules**, optionally enable **Validate path parameters** and choose **Whole number** for **Path id type**, with a minimum greater than zero.
5. Save, test, and publish. Issue a runtime key for that published flow.

Without a path rule, `id` reaches the flow as text. With an integer rule, `42` reaches it as the number `42`; invalid input returns 400 before execution. Advanced response configuration uses `$input.params.id`. Advanced draft test input uses `{ "body": null, "query": {}, "params": { "id": "42" } }`.

Parameters occupy exactly one nonempty segment. They cannot contain a slash, backslash, control character, or the exact segments `.` and `..`. Names use at most 64 letters, digits, and underscores, begin with a letter or underscore, and must be unique within the route; `__proto__`, `prototype`, and `constructor` are rejected. Optional parameters, wildcards, and regular expressions are unsupported. GraphQL paths remain exact paths.

Encode the caller's value once as a URL segment. Besh decodes it once and rejects malformed or unsafe values. Draft and load-test forms accept the decoded text value and handle URL encoding. OpenAPI documents `/run/v1/items/{id}` with a required path parameter.

Bun and browsers canonicalize some dot segments and backslashes before Besh receives the request. Such an address can resolve to its canonical route instead of returning 400. Runtime keys are checked against the resulting flow, so normalization never grants access to another flow. Observable encoded separators and control characters are rejected; draft and k6 inputs reject unsafe values before constructing the URL.

## Separate API versions

Create separate flows for `/v1/items/:id` and `/v2/items/:id`. Both can be published together and receive separate runtime keys. Besh does not infer compatibility, migrate callers, or generate version prefixes automatically.

For the same REST method, two published routes cannot match the same URL. For example, `GET /items/:id` conflicts with `GET /items/new`, even if one seems more specific. `/items/:id` and `/items/:slug` also overlap. Choose a different route, or change and republish the conflicting flow's route first. Different methods can share a path. GraphQL uses its separate `/graphql` route namespace.

## Review and restore a release

Release history lists immutable published revisions and identifies the current one. Workspace owners, editors, and viewers can inspect history and a release definition. Only owners can restore an earlier published revision.

1. Save unfinished edits if needed, then open **Release history**.
2. Select **Review release N** and inspect its method, path, API type, and step count. The management API also exposes the archived definition.
3. Review current runtime keys and dependencies before restoring.
4. Select **Roll back to release N**, then **Confirm rollback** as the owner. The server checks that the current publication still matches the one you reviewed.
5. Check the restored endpoint with an appropriate runtime key.

Rollback changes the current publication only. It does not overwrite your draft, add a draft revision, or mutate an old release. Restoring the current release is rejected. A concurrent publication, overlapping route, invalid dependency, or active load test for this flow blocks the change. Refresh history after a conflict and review again.

Keys follow the flow ID across publication and rollback. They keep their existing operation grants and expiration; changing the API type can make an existing grant unusable. Rollback is not a key rotation or a credential recovery procedure.

A release stores its graph, route, rules, and referenced resource IDs. Spreadsheet snapshots and product OAuth connection contents remain mutable. Restoring a graph does not restore spreadsheet rows, provider secrets, product sessions, or external database contents. A missing dependency can make an old release unrestorable. Workspace backup restoration is a separate operation.

Publication and rollback are blocked while that flow has an active load test, so its published route cannot change during the run. Load-test history still records the starting release; tests do not pin mutable data or external resources.

See [API reference](api.md), [API rules and OpenAPI](api-contracts.md), [runtime keys](api-keys.md), and [load testing](load-testing.md).
