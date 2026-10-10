# Node plugins — planned

Plugin installation and execution are **not implemented**. This guide proposes the package format, upload experience and safety requirements for a later delivery. The current six node kinds remain request, response, condition, spreadsheet rows, SQLite rows and GitHub product login.

The goal is simple: an owner receives a ZIP from a plugin author, reviews what it adds, and makes its nodes available in the categorized node picker. Members should not need a terminal, package manager or JavaScript editor to install or use it. Favorites are display preferences; they grant no access.

## Owner upload experience

1. Open **Plugins**, choose **Upload plugin ZIP**, and select the author's file.
2. Review the plugin name, version, compatibility, new node labels, requested capabilities and package checksum. The author name is declared information unless a separate signature verification feature proves it.
3. Resolve any compatibility or safety error before installation. A missing safe worker must block executable plugins; there must be no fallback that evaluates their code in Besh.
4. Confirm installation. The new cards appear in the node picker under their reviewed categories. Connection and field choices still use the member's authorized forms.
5. Review later updates explicitly. Installation must not replace an existing API's pinned plugin version or silently publish its draft.

The first executable plugin slice should be a typed, bounded **pure transformation** in an ordinary REST graph. Network, credentials, database writes, protected row graphs, GraphQL and WebSocket integration need separate admission designs and tests. A manifest declaring such features does not make them available.

## Proposed ZIP layout

One package root, with no extra enclosing directory:

```text
uppercase-text.zip
├── besh-plugin.json
├── nodes/
│   └── uppercase-text.cjs
├── README.md
└── LICENSE
```

No `node_modules`, installation scripts, native binaries, symlinks or workspace files belong in this bundle. Authors prepare any allowed pure JavaScript dependencies before packaging; Besh must not run `npm install`, `bun install` or an uploaded build command.

The proposed `besh-plugin.json` describes cards and typed messages without evaluating their code:

```json
{
  "formatVersion": 1,
  "id": "uppercase-text",
  "name": "Uppercase text",
  "version": "1.0.0",
  "sdkVersion": 1,
  "besh": ">=0.19.0-alpha.0 <1.0.0",
  "description": "Turn a supplied text value into uppercase.",
  "nodes": [
    {
      "id": "uppercase-text",
      "label": "Uppercase text",
      "category": "transform",
      "description": "Return the supplied text in uppercase.",
      "keywords": ["text", "uppercase"],
      "entry": "nodes/uppercase-text.cjs",
      "capabilities": [],
      "input": {
        "type": "object",
        "properties": { "text": { "type": "string", "maxLength": 256 } },
        "required": ["text"],
        "additionalProperties": false
      },
      "config": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "output": {
        "type": "object",
        "properties": { "text": { "type": "string", "maxLength": 512 } },
        "required": ["text"],
        "additionalProperties": false
      }
    }
  ]
}
```

These names and versions are a **proposed format**, not a currently accepted upload. The Besh compatibility range above is illustrative, not a promised implementation release. The eventual SDK must publish its exact schema, supported categories, bounded rule subset, version policy and examples before uploads are enabled. Configuration defaults must contain no credentials, connection bindings, filesystem paths or private tenant/member identity.

## Proposed CommonJS export

An author could supply this ordinary `.cjs` module:

```js
'use strict'

module.exports = {
  execute({ input }, context) {
    context.throwIfCancelled()

    return { text: input.text.toUpperCase() }
  },
}
```

[Bun supports CommonJS and `.cjs` modules](https://bun.sh/docs/runtime/module-resolution). That module format provides no security isolation. Importing a module evaluates its top-level code, so even export inspection must happen only inside the approved isolated worker after metadata review.

The proposed SDK signature is `execute({ input, config }, context) -> JSON | Promise<JSON>`. Input, configuration and output must pass their declared bounded rules. `throwIfCancelled()` is cooperative; it cannot replace a hard worker deadline and termination. The caller's original credential, trusted tenant/member principal, raw connection secrets and control database must never enter plugin input or context.

A future capability broker could provide narrowly typed operations through messages to Besh. Every call must authorize the actual original caller, API, dependency and current policy, then recheck after asynchronous results. Declaring a capability requests review; it neither grants it nor allows unrestricted `fetch`, SQL or filesystem access. Raw network/database capabilities are excluded from the first pure-transform slice.

## Archive and worker admission

Proposed starting upload limits are 2 MiB compressed, 16 MiB expanded, 128 regular entries, a 64 KiB manifest, 32 node cards and 256 KiB per JavaScript entry. Final limits require real acceptance tests before adoption.

Validate the complete archive before extracting or loading anything. Reject encryption, unsupported compression, nested archives, symlinks/reparse entries, duplicate or case-colliding names, absolute/drive/UNC paths, `..`, backslashes and ambiguous normalized names. Only the declared package layout and allowlisted file types are eligible. Count expanded bytes while reading; archive metadata alone is insufficient. Keep extraction inside a fresh checked temporary directory with no existing links and verify every final target stays inside it.

Each approved package version needs immutable bytes and a stored SHA-256 digest. A checksum detects disagreement with reviewed bytes; it does not establish the author's identity or make arbitrary code safe.

Execution needs a fixed trusted worker launcher with a versioned, bounded message protocol. Load time belongs inside the wall-time budget. A proposed first budget is two seconds, four active workers per process and 64 KiB input/output, with bounded queues, stderr suppression, metadata-only audits and cancellation followed by awaited child cleanup.

**A separate process, JavaScript import restriction or `vm` context is not an OS sandbox.** Executable imports stay disabled until the supported host can enforce filesystem, network, process and memory restrictions and real escape/termination tests pass. Do not pass Besh secrets or inherited private environment values to that worker. Windows support must be proven on the actual supported runtime and isolation mechanism. Uploaded code must never run in the API process or generated-route compiler.

## API and release lifecycle

Plugin administration should be owner-only. Catalog reading and node use must remain separate from administration and from connection permissions. A member can only save/test/publish under the existing action, API scope and dependency checks; plugin nodes cannot bypass protected graph rules or grant access through their defaults.

A future plugin node should pin the exact plugin ID, node ID, package version and digest in its saved definition. Draft save, test, publication, rollback and startup must validate those references, compatibility and schemas. Generated backend code calls trusted Besh dispatch helpers; it must not paste uploaded JavaScript into the generated module.

Updates install a separate immutable package version. Existing drafts/releases retain their references. Owners review any capability expansion before adopting a version. Disabling a package is a live execution denial, including existing keys and pending work, with current-policy checks and clear errors. Removing a referenced version must fail with cleanup guidance; an unreferenced retired version can be deleted through an audited operation. Uninstall must never silently rewrite an API or leave it executing an unreviewed substitute.

Backups must include approved immutable package bytes, digests and version/approval state consistently with API references. Restore validates structure and compatibility without loading modules in Besh. Execution requires the restored version to remain approved and a supported safe worker to be available; no new trust, capability or replacement version is inferred. Older physical backups are owner-controlled snapshots, not proof against rollback or archive tampering.

## Implementation order and acceptance

Keep this proposal separate from implemented node search/favorites and from current built-in execution:

1. Publish the manifest/SDK specification and package examples. Review the archive parser through owner public HTTP upload/list/revoke and malformed ZIP tests, with no guest-code execution.
2. Prove the real safe worker boundary, startup/load/output limits, cancellation, shutdown and denied filesystem/network access. Keep installation disabled where that boundary is unavailable.
3. Add one pure-transform node end to end: ZIP review → catalog → explicit inputs → saved draft → test → pinned publication → real caller result. Use public HTTP, executor and browser seams.
4. Verify update/reference conflicts, disable during pending work, restart, downloaded backup restore and current action/credential revocation. Demonstrate that import/load failures produce no publication or audit inconsistency.
5. Design resource-capability, protected-row, GraphQL and WebSocket integration independently. Validate every authored branch and current final result before any broader claim.

Suggested server files when implementation is authorized are `src/plugins/model.ts`, `archive.ts`, `service.ts` and `worker.ts`, with focused public tests and direct imports. These files, installer routes and plugin workers do not exist as an implemented feature today. See [architecture](architecture.md), [testing](testing.md), [AI policy](../AI_POLICY.md) and [roadmap](roadmap.md).
