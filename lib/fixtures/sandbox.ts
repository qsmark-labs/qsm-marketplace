// The test run's temp guard, loaded by bunfig.toml as the `bun test` preload, and the sandbox helper
// tests import. A preload's hooks are global: afterEach runs after every test of every file and
// afterAll once per run. A helper's own top-level afterEach would bind only to the first test file
// that imports it, which is how every other file's sandboxes leaked.
import { afterAll, afterEach, beforeEach } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const RUN_PREFIX = "qsm-test-run.";
const sandboxes: string[] = [];

/** A fresh temp directory, removed after the test that made it. */
export function sandboxDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  sandboxes.push(dir);
  return dir;
}

/** Writes `text` to `rel` under `root`, making the directories on the way. */
export function writeIn(root: string, rel: string, text: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Removes run dirs whose run died before its afterAll, naming each; a live run is left alone. */
function cleanBefore(base: string): void {
  for (const name of readdirSync(base)) {
    const pid = Number(name.slice(RUN_PREFIX.length).split(".")[0]);
    if (!name.startsWith(RUN_PREFIX) || !Number.isInteger(pid) || alive(pid)) {
      continue;
    }
    rmSync(join(base, name), { recursive: true, force: true });
    console.error(
      `test-run: removed ${join(base, name)}, left by run ${pid} that ended before its cleanup`,
    );
  }
}

// bun reads bunfig.toml from the working directory only. A run started inside a plugin loads this
// file as a plain import, its afterAll binds to the first test file, and that file's end removes the
// run directory under every later file (ENOENT on mkdtemp).
const bunfig = join(process.cwd(), "bunfig.toml");
if (!existsSync(bunfig) || !readFileSync(bunfig, "utf8").includes("lib/fixtures/sandbox.ts")) {
  throw new Error(
    "test-run: run bun test from the repository root, where bunfig.toml preloads lib/fixtures/sandbox.ts",
  );
}

// The run: every temp path below points into one directory of this process. A nested `bun test`
// inherits TMPDIR, so the runs' parent is passed down too and its run sits beside this one.
const runs = process.env.QSM_TEST_RUNS ?? join(tmpdir(), "qsm-test-runs");
process.env.QSM_TEST_RUNS = runs;
mkdirSync(runs, { recursive: true });
cleanBefore(runs);
const run = mkdtempSync(join(runs, `${RUN_PREFIX}${process.pid}.`));
process.env.TMPDIR = run;

// A process a test started and left running keeps writing into homes the cleanup removes, so a
// test fails by name when one outlives it.
if (!existsSync("/proc/self/environ")) {
  throw new Error("test-run: the process guard reads /proc, which this system does not have");
}

const pids = (): Set<number> =>
  new Set(
    readdirSync("/proc")
      .filter((n) => /^\d+$/.test(n))
      .map(Number),
  );

/** The command line of `pid` when it is alive and belongs to this run, else null. A child belongs
 * to the run when its working directory or any of its environment values points into the run:
 * a fixture may hand a child its own env with no TMPDIR, but its HOME or cwd still sits here. */
function ofThisRun(pid: number): string | null {
  if (pid === process.pid) {
    return null;
  }
  try {
    const inRun = (path: string): boolean => path === run || path.startsWith(`${run}/`);
    const env = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
    const values = env.map((entry) => entry.slice(entry.indexOf("=") + 1));
    if (!inRun(readlinkSync(`/proc/${pid}/cwd`)) && !values.some(inRun)) {
      return null;
    }
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").join(" ").trim();
  } catch (cause) {
    if (
      cause instanceof Error &&
      "code" in cause &&
      (cause.code === "ENOENT" || cause.code === "EACCES" || cause.code === "ESRCH")
    ) {
      return null;
    }
    throw cause;
  }
}

/** Ends what a test left running and names it. */
function stopLeft(candidates: Iterable<number>): string[] {
  const left: string[] = [];
  for (const pid of candidates) {
    const command = ofThisRun(pid);
    if (command !== null) {
      left.push(`  ${pid} ${command}`);
      process.kill(pid, "SIGKILL");
    }
  }
  return left;
}

let before = new Set<number>();
beforeEach(() => {
  before = pids();
});

afterEach(() => {
  const left = stopLeft([...pids()].filter((pid) => !before.has(pid)));
  for (const dir of sandboxes.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  if (left.length > 0) {
    throw new Error(
      `test-run: the test left ${left.length} process(es) running; wait for the end of what a test starts:\n${left.join("\n")}`,
    );
  }
});

afterAll(() => {
  const running = stopLeft(pids());
  const left = readdirSync(run);
  const lines = left.map((name) => `  ${join(run, name)}`);
  rmSync(run, { recursive: true, force: true });
  if (running.length > 0 || lines.length > 0) {
    throw new Error(
      `test-run: ${running.length} processes and ${lines.length} temp entries left after the run; each test ends what it starts and removes what it makes:\n${[...running, ...lines].join("\n")}`,
    );
  }
});
