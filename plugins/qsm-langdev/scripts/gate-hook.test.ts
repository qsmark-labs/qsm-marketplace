// The classic SubagentStop gate hook, spawned the way the harness spawns it:
// a process fed the event JSON on stdin, judged on its stdout, its stderr and
// its exit. `bun test` ignores plugins/*/hooks/**, so this lives beside the
// CLI test and spawns the hook's own source, never dist/, which may be stale.

import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fakeBin } from "../../../lib/fixtures/bin.ts";
import { isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { commit, git } from "../../../lib/fixtures/git.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";
import { findRepoRoot } from "../lib/config.ts";
import { recordStartPoint } from "../lib/state.ts";
import { defined } from "../lib/test-support.ts";

const GATE_HOOK = resolve(import.meta.dir, "../hooks/gate-hook.ts");

/** Opts `root` into `qsm-langdev init` without running it: the languages
 * a gate-hook test needs gated, and nothing else. */
function initGates(root: string, languages: readonly string[]): void {
  mkdirSync(join(root, ".qsm-langdev"), { recursive: true });
  writeFileSync(
    join(root, ".qsm-langdev", "gates.json"),
    `${JSON.stringify({ hooks: { "pre-commit": [], "pre-push": [] }, languages })}\n`,
  );
}

/** A sandbox git repository with one commit holding one tracked file. */
function repoWithFile(fileName: string, content: string): string {
  const root = sandboxDir("qsm-langdev-gate-hook-repo-");
  git(root, "init", "-q");
  writeFileSync(join(root, fileName), content);
  commit(root, "base");
  return root;
}

function runHook(hook: string, stateDir: string, stdin: string, env: Record<string, string> = {}) {
  const home = sandboxDir("qsm-langdev-gate-hook-home-");
  return runBin(hook, [], {
    input: stdin,
    // semgrep makes its own semgrep-mcp directory in its temp root: a sandbox, so none is left behind
    env: isolatedEnv(home, {
      ...env,
      QSM_LANGDEV_STATE_DIR: stateDir,
      TMPDIR: sandboxDir("qsm-langdev-gate-hook-tmp-"),
    }),
  });
}

/** What the edit hook leaves behind: the agent's start point in the edited file's repository. */
function runEditHook(stateDir: string, sessionId: string, agentId: string, filePath: string) {
  process.env.QSM_LANGDEV_STATE_DIR = stateDir;
  try {
    recordStartPoint(
      { sessionId, agentId },
      defined(findRepoRoot(dirname(filePath)), "a repository root"),
    );
  } finally {
    delete process.env.QSM_LANGDEV_STATE_DIR;
  }
}

function runGateHook(stateDir: string, sessionId: string, agentId: string) {
  return runHook(GATE_HOOK, stateDir, JSON.stringify({ session_id: sessionId, agent_id: agentId }));
}

/** Agent a1 of session s1 writes a fish syntax regression (`if` with no `end`) into a.fish, then
 * stops: the stop gate's run. */
function stopAfterFishRegression(stateDir: string, root: string) {
  writeFileSync(join(root, "a.fish"), "if true\necho alpha\n");
  runEditHook(stateDir, "s1", "a1", join(root, "a.fish"));
  return runGateHook(stateDir, "s1", "a1");
}

describe("qsm-langdev gate hook", () => {
  test("An agent with no recorded edit", () => {
    const stateDir = sandboxDir("qsm-langdev-gate-hook-state-");

    const r = runGateHook(stateDir, "s1", "a1");

    expect(r.exit).toBe(0);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("edited no tree");
  });

  test("The stop gate in an un-init'd repository", () => {
    const stateDir = sandboxDir("qsm-langdev-gate-hook-state-");
    const root = repoWithFile("a.fish", "echo alpha\n");

    // A genuine fish syntax regression, but this repository has no .qsm-langdev/gates.json, so
    // nothing here is ours to judge.
    const r = stopAfterFishRegression(stateDir, root);

    expect(r.exit).toBe(0);
    expect(r.stdout).toBe("");
  });

  test("An edit the agent did not stage", () => {
    const stateDir = sandboxDir("qsm-langdev-gate-hook-state-");
    const root = repoWithFile("a.fish", "echo alpha\n");
    initGates(root, ["fish"]);

    // The agent never stages the regression: it is on no way out, so it is named, not judged.
    const r = stopAfterFishRegression(stateDir, root);

    expect(r.exit).toBe(0);
    expect(r.stdout).not.toContain('"decision":"block"');
    expect(r.stderr).toContain("unstaged changes not scored: a.fish");
  });

  test("A new file the agent never added", () => {
    const stateDir = sandboxDir("qsm-langdev-gate-hook-state-");
    const root = repoWithFile("a.fish", "echo alpha\n");
    initGates(root, ["fish"]);
    runEditHook(stateDir, "s1", "a1", join(root, "a.fish"));
    writeFileSync(join(root, "b.fish"), "if true\necho beta\n");

    const r = runGateHook(stateDir, "s1", "a1");

    expect(r.exit).toBe(0);
    expect(r.stdout).not.toContain('"decision":"block"');
    expect(r.stderr).toContain("untracked not scored: ");
    expect(r.stderr).toContain("b.fish");
  });

  test("a tree back to its start commit never blocks the stop", () => {
    const stateDir = sandboxDir("qsm-langdev-gate-hook-state-");
    const root = repoWithFile("notes.txt", "alpha\n");

    // The edited verb records the start point (this commit) while the file
    // still differs from HEAD.
    writeFileSync(join(root, "notes.txt"), "alpha\nedited\n");
    runEditHook(stateDir, "s1", "a1", join(root, "notes.txt"));

    // By the time the agent stops, the edit is undone: the worktree is
    // identical to the recorded start commit, so there is nothing to judge
    // worse.
    git(root, "checkout", "--", "notes.txt");

    const r = runGateHook(stateDir, "s1", "a1");

    expect(r.exit).toBe(0);
    expect(r.stdout).not.toContain('"decision":"block"');
  });
});

const CLI = resolve(import.meta.dir, "cli.ts");

/** The commit gate the way git runs it: `qsm-langdev hook pre-commit` in `root`, with only
 * `langdev` gating the commit. */
function runCommitGate(root: string) {
  const config = join(root, ".qsm-langdev", "gates.json");
  writeFileSync(
    config,
    readFileSync(config, "utf8").replace('"pre-commit":[]', '"pre-commit":["langdev"]'),
  );
  const home = sandboxDir("qsm-langdev-gate-hook-home-");
  const env = isolatedEnv(home, { TMPDIR: sandboxDir("qsm-langdev-gate-hook-tmp-") });
  return runBin(CLI, ["hook", "pre-commit"], { env, cwd: root });
}

describe("qsm-langdev: the commit gate and the stop gate judge with one rule", () => {
  test("A missing config blocks the commit and only warns at the stop", () => {
    const stateDir = sandboxDir("qsm-langdev-gate-hook-state-");
    const root = repoWithFile("a.sh", "#!/bin/sh\necho hi\n");
    initGates(root, ["shell"]);
    writeFileSync(join(root, "a.sh"), "#!/bin/sh\necho hi\necho there\n");
    git(root, "add", "-u");
    runEditHook(stateDir, "s1", "a1", join(root, "a.sh"));
    const missing = "shell: no profile-scaffolded config in this repository";

    const commitGate = runCommitGate(root);
    const stopGate = runGateHook(stateDir, "s1", "a1");

    expect(commitGate.exit).toBe(1);
    expect(commitGate.stderr).toContain(missing);
    expect(stopGate.exit).toBe(0);
    expect(stopGate.stdout).not.toContain('"decision":"block"');
    expect(stopGate.stderr).toContain(missing);
  }, 60_000);

  test("A worse checker blocks the commit and the stop with the same description", () => {
    const stateDir = sandboxDir("qsm-langdev-gate-hook-state-");
    const root = repoWithFile("a.fish", "echo alpha\n");
    initGates(root, ["fish"]);
    writeFileSync(join(root, "a.fish"), "if true\necho alpha\n");
    git(root, "add", "-u");
    runEditHook(stateDir, "s1", "a1", join(root, "a.fish"));
    const worse = "WORSE fish-syntax: 0 -> 1";

    const commitGate = runCommitGate(root);
    const stopGate = runGateHook(stateDir, "s1", "a1");

    expect(commitGate.exit).toBe(1);
    expect(commitGate.stderr).toContain(worse);
    expect(stopGate.stdout).toContain('"decision":"block"');
    expect(stopGate.stdout).toContain(worse);
  }, 60_000);
});

/** `fish` and `fish_indent` stand-ins in a fresh bin directory: each names
 * a version, and otherwise sleeps far past any budget the test sets. */
function slowFish(): string {
  const bin = sandboxDir("qsm-langdev-gate-hook-bin-");
  for (const name of ["fish", "fish_indent"]) {
    fakeBin(
      bin,
      name,
      'if [ "$1" = --version ]; then echo "fish, version 4.0.0"; exit 0; fi\nexec sleep 30',
    );
  }
  return bin;
}

describe("qsm-langdev gate hook and a checker past its time", () => {
  test("a checker that is not measured warns and never holds the agent", () => {
    const stateDir = sandboxDir("qsm-langdev-gate-hook-state-");
    const root = repoWithFile("a.fish", "echo alpha\n");
    initGates(root, ["fish"]);
    const bin = slowFish();
    const env = {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      QSM_LANGDEV_GATE_BUDGET_MS: "500",
    };
    writeFileSync(join(root, "a.fish"), "echo alpha\necho beta\n");
    git(root, "add", "-u");
    runEditHook(stateDir, "s1", "a1", join(root, "a.fish"));

    const r = runHook(
      GATE_HOOK,
      stateDir,
      JSON.stringify({ session_id: "s1", agent_id: "a1" }),
      env,
    );

    expect(r.exit).toBe(0);
    expect(r.stdout).not.toContain('"decision":"block"');
    expect(r.stderr).toContain("fish-syntax: not measured: timed out after 0.5s");
  }, 60_000);
});
