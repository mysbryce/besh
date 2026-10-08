# Built-in k6 load testing

Load testing is a main Besh feature. Owners and custom members with load-test permission can send repeated requests to a published REST or GraphQL API and inspect latency, throughput, errors, and pass/fail goals from the dashboard. Besh runs a local [Grafana k6 binary](https://grafana.com/docs/k6/latest/set-up/install-k6/); no Grafana Cloud account is required.

## First run

1. Build, test, and publish an API.
2. Open **Load testing** with load-test permission and choose the published API.
3. Supply any required request fields. For GraphQL, review the generated example operation and its arguments; variable field forms are available.
4. Select **Run load test**. Confirm repeated live writes when testing a write method or mutation.
5. Watch the run, then inspect its result and saved history.

The default test uses one virtual user for five seconds, a p95 latency goal of 1000 ms, a maximum error rate of 1%, and any 2xx response as the expected HTTP result. Settings are optional. Besh prepares the request, generates the k6 script, and issues and later revokes a temporary runtime key automatically. You do not install k6, write a script, or create a caller key for this workflow.

The first run downloads pinned k6 2.3.0 from its [official release](https://github.com/grafana/k6/releases/tag/v2.3.0), verifies the archive SHA-256 against the release checksum, and caches the executable under `.cache/k6`. Internet access is required for that first download. Later runs can use the cached binary offline. A failed download leaves a failed run with a safe error; retry after correcting network or cache access.

Required input remains required: Besh validates REST path values and request rules, and GraphQL operations and variables against the published schema before starting. For `/v1/items/:id`, fill `id` with decoded text such as `42`; Besh encodes the concrete `/run/v1/items/42` target. Missing, extra, and unsafe path values fail before launch. Draft edits do not change the selected live route or its rules. REST request values and GraphQL variables use labeled field forms; advanced JSON remains optional. The GraphQL operation is visible and editable, with an example generated from its published schema.

## Optional settings

| Setting              | Default   | Meaning                                                             |
| -------------------- | --------- | ------------------------------------------------------------------- |
| Virtual users        | 1         | Concurrent request loops; at most 10                                |
| Duration             | 5 seconds | Scheduled test duration; at most 30 seconds                         |
| p95 latency goal     | 1000 ms   | Target for the 95th percentile request duration                     |
| Maximum error rate   | 1%        | Allowed proportion of failed HTTP requests or failed success checks |
| Expected HTTP status | Any 2xx   | Optional exact success status                                       |

Each virtual user pauses 0.2 seconds between requests; individual HTTP calls time out after two seconds. One run can be active in the workspace at a time. Request input is limited to 16 KiB, and the encoded target URL to 8 KiB. These limits keep tests small; they do not reserve resources or isolate normal callers from load.

An administrator can optionally set `BESH_K6_PATH` to an existing trusted executable or `BESH_K6_CACHE_DIR` to another cache directory. Basic use needs neither setting. An explicit executable path is a server administrator trust decision: Besh executes that local program. It is not a browser upload or a way for members to supply scripts. Besh's automatic download verifies the official archive; a supplied binary remains the administrator's responsibility.

## Results and history

Results show total requests, requests per second, failed HTTP requests, check success rate, average/p95/maximum request latency, and whether configured goals passed. Unexpected HTTP status counts as an HTTP failure. GraphQL errors in an HTTP-success response lower the separate success-check rate. Request latency covers sending, waiting, and receiving; it excludes initial connection setup. See k6's [metric definitions](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/). The configured goals and selected published endpoint appear beside the result. Metrics come from k6's [end-of-test summary](https://grafana.com/docs/k6/latest/results-output/end-of-test/custom-summary/).

Run states are `running`, `completed`, `failed`, `canceled`, and `interrupted`. A completed run has a metric summary, including `thresholdsPassed: false` when a goal was missed. `failed` means the runner or provisioning failed, rather than merely missing a performance goal. Cancellation or interruption may have no summary. A small local test is a performance sample, not a capacity guarantee or security certification.

Migration 10 persists run metadata, configuration, and summary in SQLite. History survives restart and is included in workspace backups. Request bodies, query/variable values, raw runtime tokens, generated scripts, and process logs are not saved as run history. Request values may still reach the live API and produce its normal effects. Keep workspace backups private.

Starting, completing, failing, canceling, and interrupting runs records metadata-only audit events. An application restart marks unfinished runs interrupted and revokes their temporary keys; runs cannot resume. Canceling stops further load work, but an already authenticated or in-flight request can finish. Restoring an older backup may restore credential state; review restored keys before serving callers as described in [runtime API keys](api-keys.md).

Temporary keys appear in **API keys** as **Managed by load testing**. They are automatically revoked and cannot be replaced. Manual revocation is allowed; remaining requests from that run will be rejected. Use **Cancel run** to stop the load test itself.

## Live API and permission boundary

Load-test permission allows listing targets, starting runs, reading history, inspecting a run, and cancellation. Owners have it by default; custom roles can grant it. Built-in editors and viewers receive `403`; runtime keys cannot access load-test management. Browser writes use the same origin and CSRF protections as other management actions. This permission allows repeated live writes or mutations without requiring separate runtime-key management; Besh prepares a managed temporary key. See [roles and permissions](roles.md).

Targets are this Besh instance's published APIs. Arbitrary URLs, uploaded scripts, custom shell commands, and arbitrary request headers are not accepted. The server derives the method, route, validation rules, and temporary key grants from the published release at start. REST methods and GraphQL queries/mutations use the same live runtime authentication and execution boundary as normal callers. Existing caller keys and grants are unchanged.

Publication and rollback for the tested flow are blocked until its active run finishes or is canceled. History records the starting revision, requests call the live route, and temporary keys are pinned to that run's starting revision and cannot be replaced. This lock prevents changing that route during the run; it does not freeze spreadsheet snapshots, OAuth credentials, or other mutable dependencies. See [release history](api-routes.md).

Write methods and GraphQL mutations repeatedly invoke the live API. The dashboard asks for confirmation after showing this risk. Direct permission-authorized API clients authorize the run by sending the start request; there is no extra confirmation property in its body. There is no transaction rollback or synthetic test database. Published product OAuth/social-login flows are unavailable for automatic load testing: generating manufactured authorization attempts would exercise a different workflow and provider boundary.

## Verification boundary

Native automatic download and execution were observed on Windows amd64: a default REST run, a report that missed its expected-status goal, and typed GraphQL query/mutation runs. Temporary runtime keys were revoked afterward. See [testing](testing.md) for exact checks and results. Automatic provisioning also targets Linux amd64/arm64 and macOS amd64/arm64; those operating systems have not been executed in this verification. UI and controlled-runner tests alone do not verify the native k6 process or its download path.

See [API reference](api.md), [architecture](architecture.md), and [roadmap](roadmap.md) for management routes and planned operations work.
