// Build crates/etassia-wasm for wasm32-unknown-unknown and copy the cdylib to
// dist/etassia.wasm.
//
// The engine source is the etassia-rs commit pinned in etassia-rs-version.txt
// at the repository root (the etassia-rs submodule is pinned to the same
// commit). When tmp/engine does not hold that exact checkout, the script
// downloads the engine tarball for the pin from codeload.github.com and
// extracts it there, so `npm run build` never needs a local etassia-rs clone.
// Point ETASSIA_ENGINE_DIR at a local etassia-rs checkout to build from it
// instead of the pin, which is the workflow for engine development.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

let engine = process.env.ETASSIA_ENGINE_DIR;
if (!engine) {
  const commit = readFileSync(join(root, "etassia-rs-version.txt"), "utf8").trim();
  engine = join(root, "tmp", "engine");
  const pinFile = join(engine, "COMMIT");
  const cached =
    existsSync(join(engine, "Cargo.toml")) &&
    existsSync(pinFile) &&
    readFileSync(pinFile, "utf8").trim() === commit;
  if (!cached) {
    if (existsSync(engine)) {
      console.error(
        `tmp/engine holds a different etassia-rs checkout than the pin; remove tmp/engine and rerun.`,
      );
      process.exit(1);
    }
    const tgz = join(root, "tmp", `etassia-rs-${commit}.tar.gz`);
    mkdirSync(dirname(tgz), { recursive: true });
    execFileSync("curl", ["-sfL", "-o", tgz, `https://codeload.github.com/etassia/etassia-rs/tar.gz/${commit}`], {
      stdio: "inherit",
    });
    mkdirSync(engine, { recursive: true });
    execFileSync("tar", ["xzf", tgz, "--strip-components=1", "-C", engine], { stdio: "inherit" });
    writeFileSync(pinFile, `${commit}\n`);
  }
}

// The build needs the wasm32-unknown-unknown target. rustup installs it when
// rustup is present; a rustup-less toolchain (for example Homebrew's rust)
// ships no target manager, and cargo then fails with its own message.
try {
  execFileSync("rustup", ["--version"], { stdio: "ignore" });
  execFileSync("rustup", ["target", "add", "wasm32-unknown-unknown"], { stdio: "inherit" });
} catch {
  // no rustup on PATH: the caller manages the toolchain
}

execFileSync("cargo", ["build", "-p", "etassia-wasm", "--target", "wasm32-unknown-unknown", "--release"], {
  cwd: engine,
  stdio: "inherit",
});

mkdirSync(dist, { recursive: true });
copyFileSync(join(engine, "target", "wasm32-unknown-unknown", "release", "etassia_wasm.wasm"), join(dist, "etassia.wasm"));
