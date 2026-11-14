# etassia

The npm package `etassia` is the TypeScript binding for the Etassia diagram
engine: a Mermaid-syntax diagram source is rendered to SVG by the Rust runtime
(`crates/etassia-wasm` on the `wasm32-unknown-unknown` target), which ships
inside the package as WebAssembly. All rendering, including number formatting,
happens in Rust; JavaScript only moves bytes. The package is a single
platform-independent artifact, because the same `.wasm` binary serves every
operating system and processor architecture that Node.js 20 or newer supports.

## Install

```sh
npm install etassia
```

## Usage

```ts
import { render, detect, UnportedError, EtassiaError } from "etassia";

try {
  const svg = render("pie\n  \"a\": 1\n"); // SVG bytes, produced entirely by the Rust runtime
} catch (e) {
  if (e instanceof UnportedError) {
    // The runtime has no renderer for this diagram type; use the Ruby fallback.
  } else if (e instanceof EtassiaError) {
    // The source is invalid: errorClass, line and col describe the failure.
  }
}
```

`detect(source)` returns the diagram type name and throws `EtassiaError` when
the type is undetectable.

## Engine pinning and releases

Every release of this package vendors the engine built from one exact
etassia-rs commit. The commit is recorded in `etassia-rs-version.txt` at the
repository root, and the `etassia-rs` git submodule is pinned to the same
commit. The ride ritual is that the package version and the pin move together
in one commit: an engine update is a version bump plus the new pin, and no
release ships a wasm binary whose provenance is not the recorded commit. At
build time, `scripts/build-wasm.mjs` reads the pin and fetches the engine
source for that commit from codeload.github.com into `tmp/engine`; a local
etassia-rs checkout is used instead when the `ETASSIA_ENGINE_DIR` environment
variable names it. The golden corpus that the tests and the smoke check render
against comes from the same submodule, so the corpus and the engine are pinned
together.

Releases are cut by pushing a tag of the form `etassia-ts-v<version>`, where
the version equals the `version` field of `package.json`, and the release
workflow fails when the two differ. Publication to npm uses Trusted Publishing
(OIDC), which signs the published tarball with provenance that npm verifies
against this repository and this workflow file.

## Development

```sh
npm ci
npm run build # fetches the pinned engine, builds crates/etassia-wasm, compiles src/ to dist/
npm test      # renders the whole golden corpus through the wasm build and byte-compares it with Ruby
```

`npm test` requires the `wasm32-unknown-unknown` Rust target; the build script
installs it through rustup when rustup is available. When `ETASSIA_ENGINE_DIR`
points at a local etassia-rs checkout, the build compiles that checkout instead
of the pin, which is the workflow for engine development.

The installed tarball is smoked separately from the build: `npm pack` produces
the tarball, the tarball is installed into a clean project, and
`scripts/smoke_installed_npm.mjs` renders one golden case and compares the
result byte for byte with the Ruby-rendered reference.

```sh
mkdir -p pkg && npm pack --pack-destination pkg
# in a clean project, with the tarball and the two golden files copied in:
npm install --no-audit --no-fund ./etassia-*.tgz
node scripts/smoke_installed_npm.mjs \
  etassia-rs/golden/pie/pie_spec-0b1f3197.mmd \
  etassia-rs/golden/pie/pie_spec-0b1f3197.svg
```

## WebAssembly notes

The shipped `dist/etassia.wasm` is the raw cdylib output of
`crates/etassia-wasm`; the package does not run the wasm-bindgen command-line
tool and does not generate glue code. `src/index.ts` instantiates the module
directly and supplies the one import that the binary declares on the render
path, the `__wbg_getRandomValues_*` stub that fills the entropy request of the
getrandom dependency, which seeds hash generators; every other stub throws when
called, which keeps an unexpected import visible instead of silent. Rendering
allocates the source in linear memory, calls `etassia_render` or
`etassia_detect`, and reads the result back through the result pointer; the
source allocation is released even when the call fails.
