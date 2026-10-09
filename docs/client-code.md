# Client code examples

Besh generates server-side request examples for eight targets. Each example describes one saved source revision and uses `BESH_RUNTIME_API_KEY` from the caller's environment. Generating, copying, or downloading code does not call the API, publish a draft, issue a key, or test your application.

These targets support REST and GraphQL HTTP calls. Selecting a WebSocket source returns an explicit unsupported error; no HTTP example or browser runtime key is generated for it. A WebSocket draft with an older published REST release can still use **Published release** for that HTTP source. WebSocket callers use the separate [connection and ticket workflow](websockets.md).

Expanded [protected read graphs](protected-read-graphs.md) accept at most one eligible GraphQL `rows` response key, including variable/directive/fragment decisions. Client generation checks that operation before rendering an example. Caller fields never select tenant identity or bypass an unchosen branch's policy.

## Generate an example

1. Save the API, expand **API tools** below the canvas and test response, then open **Use this API** with **Read APIs** permission.
2. Keep **Example source** as **Published release**, or explicitly select **Saved draft**. Review the displayed revision. Unsaved editor changes are excluded.
3. Choose **Client language** and review its requirements. **Client base URL** defaults to the current origin; override it for your deployment origin or path prefix.
4. Fill path/query/body values, or the GraphQL operation and typed variables. **Advanced request JSON** is optional. GET and HEAD examples omit the body.
5. Select **Generate example**, then review the URL, source revision, requirements, warnings, and code. Select **Copy code** or **Download code**.

Use sample input values. The generated source contains the inputs you enter; a downloaded file keeps them on your computer. Besh does not save example payloads in the workspace. It supplies no member key or runtime-key value and has no token-entry field.

## Choose the correct source

**Published release** is the default and requires an existing publication. Editing a draft does not change this source. **Saved draft** uses the last saved definition; publish that saved revision before expecting its runtime URL and rules to work. Draft examples use runtime authentication, not member-key draft-test routes.

The expected revision guards generation against stale metadata. Use **Refresh saved source** after a conflict, review the current source, and generate again. A source revision describes the example; it does not pin later runtime calls. Following keys use their flow's current publication. Callers can separately choose a release-pinned key in **API keys**; generating code does not select or issue that key. See [runtime keys](api-keys.md) for the pin's current delivery status and dormant behavior.

The base URL affects copied code only. It does not configure Besh, test a server, or fetch a remote URL. Use an HTTP(S) origin with an optional deployment prefix, without embedded credentials, query, fragment, spaces, or control characters.

## Install and run

Issuer-bound key authority is separate from example generation: rendering still executes nothing and embeds no credential. A caller may use a bound runtime key whose issuer/action/API/dependency policy is checked live. A generated source revision guard does not establish that authority or pin the key. See [selected actions and USE](roles.md#selected-api-actions-and-dependency-use).

Set `BESH_RUNTIME_API_KEY` in your application's server environment using a separately issued, unexpired key for this published flow and REST/query/mutation operation. Keep it out of browser code, source control, URLs, and logs. See [runtime keys](api-keys.md). The code examples read this variable; Besh does not read or store the caller's environment value.

| Target               | Requirements                                                                                                                    | Save and run                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript — Axios   | Node.js or Bun; install [Axios](https://axios-http.com/docs/req_config) with `npm install axios` or `bun add axios`             | Save `request.mjs`; run `node request.mjs` or `bun request.mjs`                                                                          |
| JavaScript — Fetch   | Node.js 18+ or Bun with [built-in Fetch](https://nodejs.org/api/globals.html#fetch)                                             | Save `request.mjs`; run `node request.mjs` or `bun request.mjs`                                                                          |
| PHP — cURL           | PHP with its [cURL extension](https://www.php.net/manual/en/function.curl-setopt.php)                                           | Save `request.php`; run `php request.php`                                                                                                |
| cURL — shell         | POSIX shell and [curl](https://curl.se/docs/manpage.html)                                                                       | Save `request.sh`; run `sh request.sh`                                                                                                   |
| Rust — reqwest       | Rust/Cargo and [reqwest](https://docs.rs/reqwest/latest/reqwest/blocking/struct.ClientBuilder.html) with the `blocking` feature | Create a Cargo project, put the code in `src/main.rs`, add the dependency below, then run `cargo run`                                    |
| Go — net/http        | Go and its [standard HTTP library](https://pkg.go.dev/net/http)                                                                 | Save `main.go`; run `go run main.go`                                                                                                     |
| Java — java.net.http | Java 11+ with [HttpClient](https://docs.oracle.com/en/java/javase/21/docs/api/java.net.http/java/net/http/HttpClient.html)      | Save UTF-8 `Main.java`; run `javac -encoding UTF-8 Main.java`, then `java Main`                                                          |
| C++ — libcurl        | C++17 compiler and [libcurl](https://curl.se/libcurl/c/curl_easy_setopt.html) development headers/library                       | Save `main.cpp`; for a compiler with these libraries available, run `c++ -std=c++17 main.cpp -lcurl -o request`, then run the executable |

For Rust, add this under `[dependencies]` in `Cargo.toml`:

```toml
reqwest = { version = "0.13", features = ["blocking"] }
```

Install the required toolchain separately. These instructions describe the generated targets; they do not establish that every compiler/platform has been verified. Exact observed runs belong in [testing](testing.md).

## Request and safety limits

REST examples validate the selected contract's typed inputs and encode concrete path/query values. GET/HEAD reject a supplied body; other methods preserve explicit JSON `null` and distinguish it from an omitted body. GraphQL examples accept only GraphQL input and validate the selected schema, operation, variables, and operation budgets. Invalid inputs are rejected before source generation. This is input validation, not a flow execution or proof that your API returns the intended result.

Examples use a ten-second request timeout and do not follow redirects. They remain starting points for your application's response and error handling. Language strings and shell arguments are escaped for their selected target.

The base URL is at most 2,048 characters. Path/query maps have at most 64 entries, with keys at most 256 characters and text values at most 4,096. Example JSON uses the normal 256 KiB and nesting limits. Generated code is bounded to 64 KiB, and the full result to 256 KiB. Only the eight listed targets are supported; arbitrary templates and automatic execution are not provided.

See [API reference](api.md), [REST contracts](api-contracts.md), [GraphQL](graphql.md), and [routes and releases](api-routes.md).

## Protected caller identity

Implemented in 0.11. Generated input values, custom origins, and source revision guards never choose tenant identity. A protected call uses a separately reviewed current-release-pinned runtime key carrying the approved identity and live issuer authority. Identity fields entered as ordinary body/query/GraphQL variables cannot establish another tenant. Generation still executes nothing. See [row protection](row-protection.md).
