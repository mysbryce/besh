# Planned backend platform

**PLANNED — not implemented.** This records the requested media library, CMS, visual Struct/schema builder, small published backend, payments, database breadth and product authentication. It selects no new framework or adapter. Portable acceptance remains current work; see [roadmap](roadmap.md). Bun support starts at **1.4.2**; a pinned CI/release baseline is separate from that minimum.

## 1. Visual Struct and content foundation

A Struct will describe a named, typed record through forms: field name, type, required/default rules, allowed values and reviewed relationships. Show examples and data previews; keep raw schema optional and authored values literal across languages. [Strapi's Content-type Builder](https://docs.strapi.io/cms/features/content-type-builder) is a workflow reference, not an adopted runtime.

Version schemas separately from drafts/releases. Validate input/output server-side and generate canonical trusted modules and exact REST/GraphQL routes. Before schema writes, add migration previews, explicit destructive-change review, backup gates and recovery. Unsupported shapes fail clearly.

**Public gate:** create a Struct without code, reject invalid HTTP values, publish its exact contract, restart and call it with a scoped runtime key. Prove draft isolation, denied mutation and failed-migration recovery.

## 2. Media library and bounded optimization

Provide categorized folders, tags, search, thumbnails, alt text and content links. [Payload uploads](https://payloadcms.com/docs/upload/overview), [Payload folders](https://payloadcms.com/docs/folders/overview) and [Strapi's Media Library](https://docs.strapi.io/cms/features/media-library) inform the workflow. Folder names/tags do not establish authorization.

Verify file format, bytes, decoded dimensions and quota. Use generated storage IDs, safe paths and quarantined uploads; reject active content and malformed/decompression-heavy files. Private originals and variants need current resource ACLs and bounded authenticated or expiring URLs. Public delivery requires explicit review. Never execute uploaded JavaScript.

Create PNG-to-WebP variants with bounded quality, dimensions and output bytes; preserve reviewed transparency/orientation and show original/variant sizes. Conversion need not shrink every image. [Sharp output options](https://sharp.pixelplumbing.com/api-output/) are a codec reference, not an installation decision. Video thumbnails/transcoding need separate trusted workers and fixed profiles. Process outside request hot paths with bounded concurrency, memory, deadlines, retries and persistent jobs. Recheck access before delivery; define cancellation, crash recovery, referenced deletion and orphan cleanup.

**Public gate:** upload/organize a real image, complete a bounded WebP variant, restart and retrieve authorized bytes. Deny unsafe/oversized work and unauthorized originals/variants. Require a separate real video journey before claiming video optimization.

## 3. CMS editing and publication

Build collections on reviewed Structs/media IDs: labeled forms, validation, searchable lists, drafts, revision history and explicit publish/unpublish. Separate workspace editor permissions from generated product authority. Content/relationship/media access resolves trusted caller identity, not visible field names.

**Public gate:** edit an article without code, select approved media, publish and read it through the generated API. Prove draft isolation, concurrent-edit conflict, denied writes/private media and restart recovery without unpublished-content leakage.

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
