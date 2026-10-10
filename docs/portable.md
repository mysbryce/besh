# Portable Besh

Use the standalone launcher to run Besh without a developer setup. Choose the matching Windows asset from [GitHub releases](https://github.com/mysbryce/besh/releases), or build it from source below.

## Start on Windows

Place the built executable in a writable folder, then double-click it. With no command, Besh starts a background process and asks Windows to open your browser. On first use, complete the workspace setup and save the owner key. Later launches reopen the same workspace for sign-in.

The executable contains the Bun runtime and production dashboard. Running it does not require Bun, Node, the source checkout, or a separate dashboard folder. It listens only on `127.0.0.1`, using port `3000` by default.

This is a process owned by your user account. It is not a Windows service and does not install an automatic startup task. Closing the browser does not stop Besh.

## Open, check, and stop

These PowerShell examples assume the executable is named `besh.exe`:

```powershell
.\besh.exe start
.\besh.exe status
.\besh.exe open
.\besh.exe stop
```

`start` also works without the command name. Starting an already verified instance reopens it rather than creating another server. `status` prints a small JSON result with `running` and the public URL, or `stopped`. `stop` waits for the owned instance to stop and its HTTP listener to disappear.

For a server that stays attached to your terminal:

```powershell
.\besh.exe run --no-open
```

Use `stop` from another terminal to stop that instance. Startup prints its public address, never the private setup challenge or a workspace key. On a new workspace, use `open` to receive the setup page in the browser; typing the public address alone does not supply the setup challenge.

## Storage and options

By default, the compiled executable stores the workspace in **`besh-data` beside the executable**, regardless of the terminal's current folder. This contains the SQLite control database, uploaded copies, backups, generated runtime code, private encryption key when needed, k6 cache, and private instance records. Keep this folder private and retain it when replacing the executable. Stop Besh before moving its executable and data folder.

Choose another writable directory explicitly:

```powershell
.\besh.exe start --data-dir 'D:\My Besh Workspace' --port 3001
.\besh.exe status --data-dir 'D:\My Besh Workspace'
.\besh.exe open --data-dir 'D:\My Besh Workspace'
.\besh.exe stop --data-dir 'D:\My Besh Workspace'
```

Use the same data directory for later control commands. Relative `--data-dir` paths resolve from the invoking terminal's current folder. A requested port applies to a new server; reopening an existing instance keeps its current port.

| Option                      | Meaning                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `--data-dir <path>`         | Use this workspace directory instead of the adjacent default.                           |
| `--port <number>`           | Use `0` for an available port, or a port through `65535`. Default: `3000`.              |
| `--no-open`                 | Start without opening a browser.                                                        |
| `--browser <absolute-path>` | Hand the URL to a trusted existing browser executable instead of the OS default opener. |

An unwritable directory, occupied port, unsafe permissions, stale ownership record, or unverifiable instance fails clearly. Besh does not silently pick another data folder or create a replacement workspace. It does not kill a process using a PID found in a file. Keep uncertain instance records and workspace data intact while diagnosing the failure.

Portable storage paths are controlled by these CLI options, not source-development `.env` settings. Follow [backup guidance](getting-started.md) and preserve the separate `besh-secrets.key` when backing up encrypted product credentials.

## Build from source

Use **Bun >= 1.4.2**. CI uses 1.4.2 as a reproducible minimum-version baseline; newer stable versions are accepted. From a reviewed checkout, install its locked dependencies:

```sh
bun install --frozen-lockfile
```

Install Bun on Ubuntu/macOS with the [official installer](https://bun.sh/docs/installation): `curl -fsSL https://bun.com/install | bash`. Check `bun --version` is at least 1.4.2. Ubuntu also needs `unzip`. These are build prerequisites; users running the finished executable do not install Bun.

The portable build script creates a fresh production dashboard, records its module/assets inventory, and embeds it with the runtime and third-party notices. A previous `dist` build is not a prerequisite. See [runtime source and rebuild details](portable-runtime.md) for notice generation and provenance.

On Ubuntu x64:

```sh
bun run scripts/build-portable.ts --target bun-linux-x64
chmod +x .cache/portable/besh-linux-x64
./.cache/portable/besh-linux-x64
```

On macOS with Apple Silicon:

```sh
bun run scripts/build-portable.ts --target bun-darwin-arm64
chmod +x .cache/portable/besh-darwin-arm64
./.cache/portable/besh-darwin-arm64
```

Select the target for the intended machine:

| Machine             | Build target       | Default output under `.cache/portable/` |
| ------------------- | ------------------ | --------------------------------------- |
| Windows x64         | `bun-windows-x64`  | `besh-windows-x64.exe`                  |
| Linux x64           | `bun-linux-x64`    | `besh-linux-x64`                        |
| Linux ARM64         | `bun-linux-arm64`  | `besh-linux-arm64`                      |
| macOS Intel         | `bun-darwin-x64`   | `besh-darwin-x64`                       |
| macOS Apple Silicon | `bun-darwin-arm64` | `besh-darwin-arm64`                     |

For Windows, run `bun run scripts/build-portable.ts --target bun-windows-x64`. The build also accepts `--outfile <path>`. Linux browser opening requires `/usr/bin/xdg-open` and a desktop session; macOS uses `/usr/bin/open`. Running the executable needs no Bun installation, but still needs a compatible operating system and CPU. A successful cross-build is not proof that the target platform runs it.

## Notices and verification limits

Export the embedded notices without starting a workspace:

```powershell
.\besh.exe licenses --output 'D:\Besh Notices'
```

The destination must be a **new directory**, and its parent must already exist. Existing destinations are rejected. The export includes the inventory and verified notice bytes. See [portable runtime source and rebuild information](portable-runtime.md).

Observed Windows artifact tests cover a copied executable alone in a path containing spaces and Thai text, embedded production HTML/assets, real SQLite upload and filtered preview through the compiled child reader, reopen/status/stop, concurrent starts, and denial of explicitly broadened private-file permissions. They include actual HTTP cessation after stop.

A real browser also completed first-run setup, key sign-in, explicit draft save/test/publication and a pinned runtime call, with seven masked screenshots, locally served fonts, CSP checks and denied private-file requests. Public compiled REST, GraphQL and WebSocket publication/restart journeys passed. A separate first-use k6 network journey produced positive native metrics, revoked its managed key, and preserved the same summary after restart.

The default Windows browser opener still needs manual desktop verification. Native Linux/macOS execution remains pending. Release artifacts are verified separately from source checks. These tests do not establish that every external integration works in a compiled artifact or that shutdown joins every native load-test process.

The dashboard and runtime are bundled, but Besh is not entirely offline: first-use k6 provisioning downloads a pinned, checksum-verified official binary unless it is already cached. Google Sheets, product OAuth, and update checks also need their respective services. The optional first-use k6 network test is separate from ordinary CI.
