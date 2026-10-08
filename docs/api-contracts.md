# REST API rules and OpenAPI

API rules describe what a REST endpoint accepts and returns. Add them when callers need a stable, typed interface. Besh checks rules on the server for draft tests and published calls. Rules are optional; existing APIs without them keep their previous behavior. GraphQL uses its SDL schema instead.

## Start with field rules

Open a REST API in **API Studio**, then open **API rules**. Define path parameters, query parameters, a JSON request body, or the response. Path parameters come from the route and are always required and non-nullable. Other fields have a name, type, and required choice; body and response fields also offer an allow-null choice. Use custom type selectors and checkboxes. Nested objects, lists, and their item rules also use field forms.

Types appear as **Text**, **Number**, **Whole number**, **True or false**, **Object with fields**, and **List of items**. Choose **List of items** for a body or response array, then configure the item type and its fields. Open **Limits and description** to set text length, item count, or numeric bounds. The form explains contradictory bounds before saving; the server validates them independently.

For a greeting at `GET /hello`:

1. Add a query field named `name`, choose **Text**, and mark it required.
2. Add response fields `message` and `name`, both **Text** and required.
3. Set the response node's `message` to `Hello, Besh!` and `name` to **From query parameter**, input field `name`.
4. Save the draft. Test with query parameter `name=Ada`; confirm the two response fields.
5. Remove `name` from the test input. The server rejects the request with 400 before running the flow.
6. Publish after testing. Issue a scoped runtime API key in **API keys**.

Required means a field must be present. Nullable means its value may be JSON `null`. These are separate choices: a required nullable field must still appear. A string field does not accept a number merely because that number could be displayed as text.

Saving updates the draft only. Live validation and the published documentation use the immutable release until a member with publication permission publishes a new revision.

## Request and response behavior

| Input or result                                                   | Server behavior                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Declared string query field                                       | Keeps its text value                                                              |
| Declared number/integer query field                               | Converts valid numeric text to a JSON number, then checks integer and range rules |
| Declared boolean query field                                      | Accepts `true` or `false`, then converts to a JSON boolean                        |
| Declared path parameter                                           | Converts numeric/boolean text with the same rules as query fields                 |
| JSON request body                                                 | Checks exact JSON types without converting strings into numbers or booleans       |
| Flow response body                                                | Checks exact JSON types before returning data                                     |
| Missing required field, wrong input type, or violated input limit | Returns 400; no submitted values in the error                                     |
| Response violates its contract                                    | Returns a generic 500; no partial response data                                   |

Declared query and path values reach conditions and response references with their converted types. Fields without rules retain text behavior. A contract checks shape and values; it does not add identity checks or grant access to fields or records. Caller-controlled spreadsheet filters remain search tools, not authorization.

For `/v1/items/:id`, an optional path rule can declare `id` as a required integer with `minimum: 1`. A request to `/run/v1/items/42` supplies the number `42` at `$input.params.id`; `params.id` is the condition field. Missing or unsafe path values are rejected even when no path contract is present. See [route rules](api-routes.md).

Numeric query text follows JSON number syntax: `12`, `-2.5`, and `1e3` work; whitespace, leading zeros such as `01`, hexadecimal, `NaN`, and infinity do not. Integer rules reject fractional values. Boolean query text is case-sensitive: `true` and `false` work; `1`, `0`, and `TRUE` do not.

GET and HEAD cannot declare a body contract. A flow using GraphQL cannot also use REST rules. Existing authentication, graph validation, execution budgets, and response-size limits still apply.

## Download documentation

Choose the saved draft or published release in the OpenAPI controls, then download its JSON document. Save changes first to export a draft: the server exports persisted state, not unsaved browser edits. A published download requires a published REST release and continues to describe that release while its draft is edited.

Owners, editors, viewers, and custom members with flow-read permission can download permitted API definitions. Runtime API keys cannot access this management route and are used only when calling the documented endpoint.

```http
GET /api/flows/<flow-id>/openapi?source=published
Authorization: Bearer <workspace-member-token>
```

Use `source=draft` for the saved draft. Omitting `source` chooses `published`; it never silently falls back to the draft. The document describes the selected revision's method and `/run/<path>` route, input/response rules, and required runtime bearer authentication. It does not contain runtime keys, request samples from actual callers, response-node literals, or spreadsheet rows.

The document identifies its selection with `x-besh-source`, numeric `x-besh-revision`, and a string revision in `info.version`. A missing API or published release returns 404. An unsupported source or GraphQL selection returns 400. Missing or invalid member credentials return 401. A saved draft may have an incomplete graph: downloading its contract does not certify that the draft can execute or publish.

Declared query fields appear as standard OpenAPI parameters. Path segments such as `:id` become `{id}` with required `in: path` parameters; parameters without declared rules use a string schema. The operation also includes `x-besh-query-schema` to retain the full query-object rule, including whether undeclared query fields are rejected. A parameter list alone cannot express that object-wide policy; tools may ignore this Besh extension, while the runtime still enforces it.

Besh exports [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html). Its nullable rules become JSON Schema type unions, such as `"type": ["string", "null"]`. Export documents a single REST API; it is not a combined workspace document or a GraphQL schema export. No automatic public documentation hosting or SDK generation is implemented.

## Advanced contract format

For management API integrations, the flow's optional `contract` contains `params`, `query`, `body`, and `response`. Omit a section to leave that part unconstrained; route matching still requires safe path values. The dashboard edits these rules through forms; the JSON below documents the stored/API format. This greeting contract is equivalent to the simple example above:

```json
{
  "query": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "minLength": 1, "maxLength": 80 }
    },
    "required": ["name"],
    "additionalProperties": false
  },
  "response": {
    "type": "object",
    "properties": {
      "message": { "type": "string" },
      "name": { "type": "string" }
    },
    "required": ["message", "name"],
    "additionalProperties": false
  }
}
```

Supported types and keywords:

| Type                | Supported constraints                                    |
| ------------------- | -------------------------------------------------------- |
| All six types       | `nullable`, `description`                                |
| `object`            | `properties`, `required`, boolean `additionalProperties` |
| `array`             | Required `items` schema, `minItems`, `maxItems`          |
| `string`            | `minLength`, `maxLength`                                 |
| `number`, `integer` | `minimum`, `maximum`                                     |
| `boolean`           | Type check                                               |

This is a bounded subset of schema concepts. It is not a complete JSON Schema implementation. References, composition (`oneOf`, `anyOf`, `allOf`), arbitrary formats, regular-expression patterns, enums, defaults, tuple items, and external schema loading are not supported. Unsupported keywords are rejected rather than ignored. There is no evaluation of schema-supplied code.

Query rules must be a non-nullable object with non-nullable string, number, integer, or boolean fields. Nested query objects and query arrays are unsupported. Body and response rules can use nested objects and arrays. Object fields are optional unless named in `required`; unknown fields are allowed unless `additionalProperties` is `false`.

Path rules use the same scalar field types as query rules, inside a non-nullable object. Its properties must exactly match the route's parameter names, and every parameter must be required and non-nullable. Extra, missing, nested, nullable, and optional path fields are rejected. For `/v1/items/:id`, a complete path section is:

```json
{
  "params": {
    "type": "object",
    "properties": { "id": { "type": "integer", "minimum": 1 } },
    "required": ["id"],
    "additionalProperties": false
  }
}
```

An absent JSON body becomes `null`, so a nullable body schema accepts its absence. A non-nullable body schema requires a body of its declared type.

Contracts are limited to 16 KiB serialized UTF-8 JSON, eight schema levels, 256 total schema nodes across all sections, and 64 properties per object. Property names use letters, digits, and underscores, begin with a letter or underscore, and contain at most 64 characters; reserved prototype names are rejected. Descriptions contain at most 500 characters. Required names must be declared and unique. Length/item bounds are non-negative integers; numeric bounds must be finite. Lower bounds cannot exceed upper bounds; an integer range must contain at least one integer.

Descriptions are documentation, not authorization. Review them before sharing a downloaded document. Existing normal flow/input/output limits remain in force alongside contract validation.

## Spreadsheet contracts

New generated REST APIs receive response rules for the selected columns' inferred types and nullable values, the projected row shape, and maximum row count. Optional equality filters receive matching query rules. Generated GraphQL continues to use typed SDL.

Changing a source snapshot changes data read by live APIs, while its release contract stays fixed. A source replacement that introduces incompatible values can fail published response validation. Correct the source or update, test, and publish reviewed rules. Do not assume that refreshing data updates documentation or permissions.

See [spreadsheet data](data-sources.md), [management routes](api.md), [GraphQL](graphql.md), and [testing](testing.md).
