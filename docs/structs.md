# Content model drafts

Owners can define and save a Struct through **Content models** in the dashboard. A Struct describes record fields; it does not itself store content entries, publish a collection or create an API. Private collections can bind a saved revision. [Versioned rich text](rich-text.md) has passed local paragraph/formatted-editor checks, complete browser/gallery and compiled portable gates; hosted 0.23 source delivery remains pending. Renderer configuration, relationships, schema migrations for content and runtime routes remain [planned](platform-plan.md).

## Define a model

1. Sign in as the workspace owner and open **Content models**.
2. Enter a model name, then choose **Add field**. Give each field a display label, a key and a type; mark it required if the future record should need a value.
3. Use **Group** for nested fields, **List** for a configured item type, or **Choice** for labeled values. Lists can contain another supported type, including groups.
4. Choose **Save draft** explicitly. The first save creates revision one. Later saves update the same draft and advance its revision.

| Form type     | Saved schema type | Configuration                          |
| ------------- | ----------------- | -------------------------------------- |
| Text          | `text`            | Text field                             |
| Number        | `number`          | Numeric field                          |
| True or false | `boolean`         | Boolean field                          |
| Group         | `object`          | Nested fields                          |
| List          | `array`           | An item schema                         |
| Choice        | `select`          | Unique saved values and display labels |

Current 0.23 work also exposes **Rich text** for literal version-one paragraphs and **Formatted rich text** for version-two content, including nested fields. Both store explicit paired schema/AST versions. These controls have focused checks, not completed 0.23 delivery acceptance; see the [working contract](rich-text.md).

Labels, model names, keys and choice values remain authored text when the interface language changes. Private collections validate entries against their copied saved model, including required fields. Changing this draft does not change an existing collection's binding.

**Choose a model** opens a saved draft. **New model** starts an unsaved definition. Changing models, starting another model or leaving a dirty editor requires a discard decision; canceling preserves the current edits. Changing a type that contains nested fields or choices also asks before removing that structure. Opening a model never publishes it.

**Refresh** reloads only the model catalog. It preserves the current editor, unsaved values and any unresolved conflict alert/failure status; it does not adopt a newer model revision or reconcile another owner's changes automatically. After a stale save, **Reload saved version** offers an explicit reload; review the discard prompt before replacing unsaved work. Canceling keeps the conflict and draft. Accepting a successful model reload replaces the draft and shows loaded status rather than an earlier save-success notice. Accepted **New model** resets the draft and its canonical status only after discard is confirmed; canceling preserves both. These status corrections passed focused checks, the final complete browser command and original-detail review of all 21 fresh Struct captures. The complete 1,186-image gallery and inventory/promotion also passed. PR #18 completed source delivery after [exact-head CI](https://github.com/mysbryce/besh/actions/runs/38073598920) and [main CI](https://github.com/mysbryce/besh/actions/runs/38074035373) passed all three jobs. See [testing](testing.md).

Keyboard removal returns focus to the corresponding **Add field** or **Add option** control. Phone actions retain at least 44-by-44-pixel targets; required checkboxes remain square within their labeled row. Save completion follows the selected language, including a language change while a real save response is pending or after its notice is already shown.

## Bounds and concurrency

The server validates complete definitions and rejects unknown properties. Model names, field labels, choice values and choice labels are trimmed and must contain 1 to 80 characters. Keys contain 1 to 64 characters, start with a lowercase ASCII letter and then use lowercase ASCII letters, digits or underscores. `constructor`, `prototype` and `__proto__` are reserved. Keys must be unique within each field group; choice values must be unique within their field.

Each top-level or nested group supports at most 32 fields. A choice field needs 1 to 32 options. A model supports six schema levels and at most 128 schema nodes, counting field schemas and nested list item types together. A complete definition is limited to 32,768 UTF-8 JSON bytes. The workspace holds at most 128 saved drafts. Empty field groups are allowed; unsupported types and over-budget input are rejected.

An update supplies the saved positive safe-integer `version`. The server compares it inside an immediate transaction, rechecks the original owner's current authority and rejects a stale version with `409`. Every accepted update increments the version, including an identical definition. A rejected update changes neither the draft nor its audit record. The UI preserves unsaved edits on a conflict; no automatic merge or overwrite occurs.

## Management API

These routes require the current owner. Editor, viewer and custom-role action grants do not grant Struct access. Workspace session/Origin/CSRF rules and management bearer authentication remain unchanged; runtime keys cannot manage these drafts.

| Method | Path               | Body or result                                                 |
| ------ | ------------------ | -------------------------------------------------------------- |
| GET    | `/api/structs`     | Summaries: `id`, `name`, `version`, `createdAt`, `updatedAt`   |
| GET    | `/api/structs/:id` | One summary plus complete `fields`                             |
| POST   | `/api/structs`     | Exact `{ name, fields }`; returns the saved revision-one draft |
| PUT    | `/api/structs/:id` | Exact `{ name, fields, version }`; returns the updated draft   |

A field has exact `{ key, label, required, schema }` properties. For example:

```json
{
  "name": "Products",
  "fields": [
    {
      "key": "title",
      "label": "Title",
      "required": true,
      "schema": { "type": "text" }
    }
  ]
}
```

Groups use `{ "type": "object", "fields": [] }`, lists use `{ "type": "array", "items": { "type": "text" } }`, and choices use `{ "type": "select", "options": [{ "value": "retail", "label": "Retail" }] }`. Scalars contain only their `type` property. An update adds the current numeric `version` to the definition body.

Invalid definitions or versions return `400`; a missing draft returns `404`; stale saves and a full catalog return `409`. Malformed persisted definitions fail closed with `503` instead of returning a partial model. There is no Struct delete, entry, publication or runtime endpoint in this delivery.

## Storage and recovery

Control-database migration 24 adds saved Struct definitions and versions. Accepted writes and metadata-only `struct.created`/`struct.updated` audit events commit together; audit records omit names and field payloads. Struct definitions are part of the ordinary workspace database backup. Existing backup permissions, owner-only protection rules and separate OAuth key recovery remain unchanged; a Struct grants no new backup authority.

Restore the matching workspace backup using the existing [recovery procedure](getting-started.md). A backup made before migration 24 has no later Struct definitions to recover. This foundation performs no content-data migration or published-contract rewrite. Exact executed restart/backup and browser checks belong in [testing](testing.md).
