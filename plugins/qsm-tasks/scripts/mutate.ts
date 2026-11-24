import { cpSync, rmSync, symlinkSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { reapOrphaned, runTempDir, spawnMarked, sweepNamed } from "../../../lib/reap.ts";

const root = resolve(import.meta.dir, "../../..");
const plugin = relative(root, resolve(import.meta.dir, ".."));
const tool = `${basename(plugin)}-mutate`;
reapOrphaned(tool, "left by a mutation run that ended before cleanup");
sweepNamed(tool);
const scratch = runTempDir(tool);
process.env.TMPDIR = scratch;
try {
  for (const path of ["bunfig.toml", "lib", plugin]) {
    cpSync(join(root, path), join(scratch, path), {
      dereference: true,
      recursive: true,
      filter: (source) => !["node_modules", ".stryker-tmp"].includes(basename(source)),
    });
  }
  const cwd = join(scratch, plugin);
  symlinkSync(join(root, plugin, "node_modules"), join(cwd, "node_modules"));
  const manifest = require.resolve("@stryker-mutator/core/package.json");
  const args = [resolve(manifest, "../bin/stryker.js"), "run", "--inPlace"];
  const result = spawnMarked(tool, "node", args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
