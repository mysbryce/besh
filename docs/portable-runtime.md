# Portable runtime source and rebuilding

This guide covers the runtime inside the portable executable. Ordinary users do not need a compiler or Bun installation. Developers rebuilding Besh need the complete project source for the executable's Besh commit, its `bun.lock`, and the runtime sources below. Use the release's external source/build manifest to match the version, commit, target and artifact hashes. See [release preparation](releases.md) for the existing source-bundle rules.

Runtime source archives are separate companion assets; they are not embedded in the executable or included automatically in the small Besh source candidate. Check the selected release's asset list before assuming an archive has been uploaded. The executable exports its embedded notices without an installed Bun or dependencies:

```powershell
.\besh-windows-x64.exe licenses --output .\besh-licenses
```

Choose a new output directory. Export refuses to overwrite an existing directory.

## Exact runtime sources

The portable build requires Bun >= 1.4.2. Reproducible release CI currently uses the 1.4.2 baseline. Metadata records the actual compiler version/revision; collected native notices remain attributed to their 1.4.2 source baseline. When distributing another runtime, reconcile its notices instead of relabeling baseline materials.

These pins come from the 1.4.2 runtime's source and build definitions:

| Component               | Exact source or toolchain                                                                                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bun 1.4.2               | [`744846f844374847c902b5e7fd59b4342a51ef99`](https://github.com/oven-sh/bun/tree/744846f844374847c902b5e7fd59b4342a51ef99)                                                                                                                                                                   |
| WebKit / JavaScriptCore | [`2e2aa2290fac856d6f451ceacb58f7f5b44dd057`](https://github.com/oven-sh/WebKit/tree/2e2aa2290fac856d6f451ceacb58f7f5b44dd057)                                                                                                                                                                |
| Windows WebKit ICU      | 78.3, [`21d1eb0f306e1141c10931e914dfc038c06121da`](https://github.com/unicode-org/icu/tree/21d1eb0f306e1141c10931e914dfc038c06121da), selected by the pinned [WebKit build script](https://github.com/oven-sh/WebKit/blob/2e2aa2290fac856d6f451ceacb58f7f5b44dd057/build-icu.ps1)            |
| Rust                    | [`nightly-2026-07-20`](https://github.com/oven-sh/bun/blob/744846f844374847c902b5e7fd59b4342a51ef99/rust-toolchain.toml); the [dated official manifest](https://static.rust-lang.org/dist/2026-07-20/channel-rust-nightly.toml) identifies source `9f36de775bc636c8e88c31a173c2bcb6995956a0` |
| LLVM build tools        | 21.1.8, as selected in [Bun's toolchain definitions](https://github.com/oven-sh/bun/blob/744846f844374847c902b5e7fd59b4342a51ef99/scripts/build/tools.ts)                                                                                                                                    |

Two upstream source archives were acquired and hashed during release preparation. These hashes describe those downloaded bytes, not a rebuilt binary:

- [Bun source archive](https://codeload.github.com/oven-sh/bun/tar.gz/744846f844374847c902b5e7fd59b4342a51ef99): 64,602,344 bytes.

  ```text
  SHA256 25e09a8804535b8fbea1dad9f95af8402fc9133d28127d5594ff00df1549590e
  ```

- [libarchive source archive](https://codeload.github.com/libarchive/libarchive/tar.gz/ded82291ab41d5e355831b96b0e1ff49e24d8939), commit `ded82291ab41d5e355831b96b0e1ff49e24d8939`: 6,134,289 bytes.

  ```text
  SHA256 042f0efe7147063ff9ba10f1a38ed080e949bcbd04bdbf3592b8846dd11b1da2
  ```

Retain Bun's complete `Cargo.lock`, JavaScript lock, patches and `scripts/build/deps/` definitions. They identify additional native dependencies and exact registry checksums; a collected notice does not establish that its component is linked into every target. WebKit and ICU links above identify source pins, not additional acquired archives.

## Build a modified Bun runtime

Follow the exact revision's [contribution guide](https://github.com/oven-sh/bun/blob/744846f844374847c902b5e7fd59b4342a51ef99/docs/project/contributing.mdx) and [Windows build guide](https://github.com/oven-sh/bun/blob/744846f844374847c902b5e7fd59b4342a51ef99/docs/project/building-windows.mdx). Install their developer prerequisites for the intended platform, including the pinned Rust and LLVM tools. Preserve the original source notices and record deliberate changes.

For JavaScriptCore changes, place the pinned WebKit source in Bun's `vendor/WebKit`, or select it with `BUN_WEBKIT_PATH`. From the Bun source directory, install its frozen dependencies and select the local WebKit release profile:

```sh
bun install --frozen-lockfile
bun run build:release:local
```

The [profile definition](https://github.com/oven-sh/bun/blob/744846f844374847c902b5e7fd59b4342a51ef99/scripts/build/profiles.ts) selects local WebKit; the package script uses `--build-dir=build/release-local`. On Windows, that path invokes WebKit's pinned ICU build script. Keep upstream dependency patches and flags. Bun's [Rust build](https://github.com/oven-sh/bun/blob/744846f844374847c902b5e7fd59b4342a51ef99/scripts/build/rust.ts) uses locked Cargo resolution. Check the actual runtime output path and target after building.

## Recompile Besh with that runtime

From the complete Besh source, use Bun >= 1.4.2 and its frozen lock:

```sh
bun --version
bun install --frozen-lockfile
```

Copy `scripts/build-portable.ts` to `scripts/rebuild-portable.ts` in your working source. Keep its dashboard build, assets, metadata and disabled autoload settings. Add `executablePath` inside its existing `compile` object:

```ts
compile: {
  target,
  executablePath: 'C:/runtime-source/bun/build/release-local/bun.exe',
  outfile,
  assets: ['dist', 'assets/portable-notices'],
  autoloadDotenv: false,
  autoloadBunfig: false,
  autoloadTsconfig: false,
  autoloadPackageJson: false,
},
```

Replace the illustrative path with your actual modified Bun executable. It must match the target. Then run the copied build script, for example on Windows x64:

```sh
bun scripts/rebuild-portable.ts --target bun-windows-x64 --outfile .cache/portable/besh-modified-runtime.exe
```

`compile.executablePath` is supported by the pinned Bun build API: its [option parser](https://github.com/oven-sh/bun/blob/744846f844374847c902b5e7fd59b4342a51ef99/src/runtime/api/JSBundler.rs) reads the file path and its [completion task](https://github.com/oven-sh/bun/blob/744846f844374847c902b5e7fd59b4342a51ef99/src/runtime/api/js_bundle_completion_task.rs) passes that executable to compilation. Keep the complete notice assets and update provenance for your modifications. Preserve Besh's separate SQLite reader process and permission boundaries.

## Verification and material limits

The modified-runtime route above was reviewed against source; a modified Bun/JSC build and Besh relink have not been executed. It does not establish byte-identical reproduction, Linux/macOS execution, or compatibility of arbitrary runtime changes. Test the resulting executable's setup, HTTP operations, SQLite reads, lifecycle commands and notice export before distributing it.

Some material mappings remain unresolved: Bun's index names libbase64, uucode and legacy polyfills without an identified exact source mapping in the inspected build files; the historical esbuild port revision is also unidentified. Original Bun and react-remove-scroll-bar standalone MIT notice files were unavailable in the inspected supplied materials. Their original declarations are preserved with separately labeled standard MIT terms, without invented copyright attribution. Complete per-file WebKit/Rust attribution and target-specific native linkage have not been fully reconciled. Available materials and these instructions are not a certification of license completeness.
