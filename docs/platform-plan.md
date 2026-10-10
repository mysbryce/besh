# Planned backend platform

**Owner-only Struct drafts are implemented; the remaining platform is planned.** The `0.21.0-alpha.0` foundation defines and saves bounded nested field models through web forms; it creates no content entries or published routes. See [Struct drafts](structs.md) and actual [check receipts](testing.md). This plan records the later media library, CMS, schema publication, small published backend, payments, database breadth and product authentication. It selects no new framework or adapter. Portable Windows delivery is complete; see [roadmap](roadmap.md) for the next slice. Bun support starts at **1.4.2**; a pinned CI/release baseline is separate from that minimum.

Complete this platform roadmap through consecutive, tested slices. Keep the next bounded public journey visible in the roadmap and continue within the user's authorized scope; do not stop after each delivery merely to ask what comes next. Preserve unfinished work and remove completed feature branches only after verifying their merge. CI, migration gates and actual external-provider setup still determine when a slice can advance.

## 1. Visual Struct and content foundation

A saved Struct now describes named, typed fields through forms, including required flags, nested groups, lists and choices. Defaults, reviewed relationships, reusable groups and collection/content behavior remain planned. All collection and Struct configuration belongs in the web interface, including validation, editor options, access rules and renderer settings. Creating or changing a collection must not require editing TypeScript. Show examples and data previews; keep raw schema optional and authored values literal across languages. [Strapi's Content-type Builder](https://docs.strapi.io/cms/features/content-type-builder) is a workflow reference, not an adopted runtime.

The next bounded stage creates private collections from an exact saved Struct revision. The server must read and validate that revision itself, then retain an immutable definition snapshot with the collection binding; never accept a caller-provided substitute schema. Later Struct edits leave the existing binding unchanged until an explicit reviewed migration. Typed entry forms and server validation follow the bound snapshot, with current owner/entry permissions and version checks. Start without publication or generated runtime routes.

Version schemas separately from drafts/releases. Treat web configuration as validated data, never uploaded server code. Validate input/output server-side and generate canonical trusted modules and exact REST/GraphQL routes registered by the runtime. Before schema writes, add migration previews, explicit destructive-change review, backup gates and recovery. Unsupported shapes fail clearly.

**Public gate:** configure a collection and nested Struct without code, reject invalid HTTP values, publish its exact contract, restart and call its registered route with a scoped runtime key. Prove draft isolation, denied configuration/mutation and failed-migration recovery.

## 2. Media library and bounded optimization

Provide categorized folders, tags, search, thumbnails, alt text and content links. [Payload uploads](https://payloadcms.com/docs/upload/overview), [Payload folders](https://payloadcms.com/docs/folders/overview) and [Strapi's Media Library](https://docs.strapi.io/cms/features/media-library) inform the workflow. Folder names/tags do not establish authorization.

Verify file format, bytes, decoded dimensions and quota. Use generated storage IDs, safe paths and quarantined uploads; reject active content and malformed/decompression-heavy files. Private originals and variants need current resource ACLs and bounded authenticated or expiring URLs. Public delivery requires explicit review. Never execute uploaded JavaScript.

Create PNG-to-WebP variants with bounded quality, dimensions and output bytes; preserve reviewed transparency/orientation and show original/variant sizes. Conversion need not shrink every image. [Sharp output options](https://sharp.pixelplumbing.com/api-output/) are a codec reference, not an installation decision. Video thumbnails/transcoding need separate trusted workers and fixed profiles. Process outside request hot paths with bounded concurrency, memory, deadlines, retries and persistent jobs. Recheck access before delivery; define cancellation, crash recovery, referenced deletion and orphan cleanup.

**Public gate:** upload/organize a real image, complete a bounded WebP variant, restart and retrieve authorized bytes. Deny unsafe/oversized work and unauthorized originals/variants. Require a separate real video journey before claiming video optimization.

## 3. CMS editing and publication

Build collections on reviewed Structs/media IDs: labeled forms, validation, searchable lists, drafts, revision history and explicit publish/unpublish. Separate workspace editor permissions from generated product authority. Content/relationship/media access resolves trusted caller identity, not visible field names.

### Rich-text content model

Plan a full rich-text editor with paragraphs, headings, emphasis, links, ordered/unordered lists, quotes, code blocks, tables, approved media and typed content blocks. Configure supported features and block fields through web forms. Pasted or imported HTML must pass a reviewed sanitizer and conversion into the validated content model; raw HTML is not executable stored content.

Store a versioned, typed abstract syntax tree (AST), with explicit node kinds and bounded depth, node count, text bytes, attributes, relationships and media references. Validate on the server before saving, publication and rendering. Reject unsupported versions, unknown nodes, invalid references and excessive work clearly; do not silently lose content. Schema, AST and renderer migrations need previews, backup coverage, compatibility checks and failed-migration recovery before activation.

### Structured output and server-rendered HTML

Let the published contract choose typed structured object output for a client renderer or server-rendered HTML. Both formats derive from the same reviewed content revision and preserve its schema/AST version, renderer configuration revision and published release identity. Format selection does not change authorization, runtime-key scope, release pins, current policy checks or draft isolation. Populate relationships/media only under current access, with bounded work and an authority recheck after asynchronous reads.

Ship a default safe renderer and a documented typed node contract for client renderers. An owner can configure each supported child element's tag, classes and allowlisted attributes through reviewed forms. Keep renderer configuration separate from ordinary authored content, version it and require explicit owner review before publication. Changing a draft renderer must not alter an existing publication. Client adapters remain trusted application code; Besh accepts no uploaded converter functions, executable templates or JavaScript expressions.

[Payload's JSX conversion](https://payloadcms.com/docs/rich-text/converting-jsx) demonstrates rendering serialized rich text with node converters; its [HTML conversion](https://payloadcms.com/docs/rich-text/converting-html) documents on-demand JSON-to-HTML output. These inform the two formats, not a Payload/Lexical installation or a security guarantee for custom converters.

### Renderer safety and child attributes

Render only allowlisted semantic tags and attribute names. Escape text and quoted attribute values for their actual output context; code remains escaped text. Validate URL schemes and destinations before emitting links/media, allowing only the reviewed relative/HTTPS forms. Reject scripts, event-handler attributes, `srcdoc`, executable URL schemes, arbitrary inline CSS and template interpolation. Class tokens and safe accessibility/data attributes need bounded validated values. The client renderer must use text/attribute APIs safely, rather than treating structured text as HTML. These requirements follow [OWASP's context-specific XSS prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

The requested heading mapping can produce `<h1 class="text-heading-1" x-data="h1">…</h1>` only through an explicit owner-reviewed fixed mapping and a documented trusted client binding. `x-data` is not a generally safe arbitrary attribute: [Alpine evaluates its value as JavaScript](https://alpinejs.dev/directives/data). The default renderer excludes framework directives. Any optional binding must map the fixed `h1` identifier to trusted client code, reject authored expressions and event directives, and never auto-load or evaluate a framework from content. Without that reviewed consumer contract, reject the directive; ordinary class mapping remains available.

**Public gates, one journey at a time:** configure a collection/Struct and renderer in the web interface, edit rich content, select approved media, save a draft and explicitly publish. Retrieve typed objects and HTML for the same publication through actual generated routes; verify content, revision identity and safe heading attributes. Prove draft isolation, concurrent-edit conflict, denied writes/private media, current authorization in both formats and restart recovery without unpublished-content leakage. Add bounded-AST, hostile text/attribute/URL and import cases before expanding supported nodes. Prove migration/backup restoration without silently rewriting published contracts. Language changes must preserve authored content and configuration values.

## 4. Product database adapters

[DBX](https://github.com/t8y2/dbx) is a database-breadth reference; its driver list/size are not Besh support or performance claims. Keep Besh's SQLite control database separate from product connections. Start with PostgreSQL and MySQL/MariaDB; review live SQLite, MongoDB, Supabase, Firebase and other engines individually.

Document each adapter's reads/writes, transactions, schema, migrations, pooling and backup capabilities. Bound pools, queries, results, concurrency and cancellation. Encrypt server-held credentials, bind SQL values, inspect identifiers, and preserve management grants/explicit dependency USE. Implement engine-specific isolation, tenant/field checks and asynchronous authority rechecks; unsupported capabilities fail.

**Public gate per adapter:** use a real disposable database for typed reads/writes, rollback, denied access, concurrent updates, timeouts/restart and documented backup/recovery. Mocks, SDK types and compatible protocols are insufficient.

## 5. Product authentication breadth

[Better Auth](https://github.com/better-auth/better-auth) and its [OAuth documentation](https://better-auth.com/docs/concepts/oauth) are lifecycle/provider references. Plan Google, Discord, Facebook, Apple, LINE and generic OIDC separately for generated product APIs. Workspace sign-in retains its account/key boundary.

Keep secrets server-side, enforce state/PKCE and exact callbacks, validate provider identity/token claims, and review account linking. Never trust caller identity fields or silently join accounts by email. Product sessions, revocation and tenant assignment require explicit lifecycles.

**Public gate per provider:** use a real app/callback, prove identity/session behavior, reject forged/replayed callbacks, test linking conflicts/revocation and preserve draft/release separation. Configuration alone is not verification.

## 6. Payments

Plan Stripe, PayPal, Thai Omise and [Payso](https://payso.co/th) individually. Require server secrets, provider-hosted/tokenized checkout, durable order state, signature-verified webhooks, event/request idempotency and reviewed refund permissions. Never store card numbers/CVV or trust browser success redirects as payment proof.

Use provider-specific [Stripe webhooks](https://docs.stripe.com/webhooks)/[idempotency](https://docs.stripe.com/api/idempotent_requests), [PayPal verification](https://developer.paypal.com/api/rest/webhooks/) and [Omise signatures](https://docs.omise.co/api-webhooks). Payso's [API overview](https://api-docs.payso.co/docs/api/overviews) did not expose detailed callback contracts during this review; verify those first. Merchant country, currency, method and account eligibility need provider confirmation.

**Public gate per provider:** complete sandbox checkout, verify callbacks, reject forged/duplicate/out-of-order events, restart without double charging and exercise reviewed refunds. Live regional support needs separate merchant acceptance.

## 7. Small published backend

Keep request paths limited to trusted generated routes, validated contracts and necessary adapters; process media elsewhere. Measure artifact size, startup, idle memory, throughput and tail latency on named hardware. Compare draft/published behavior under real local load, including authority checks/failures. Small/high performance is a goal, not a promised benchmark; optimization cannot remove authentication or runtime limits.

Each stage starts with one public failing journey, then narrow implementation. Deliver relevant checks, light/dark/phone previews, migration/recovery evidence and documented limits before advancing. No dates or external integration success are implied.
