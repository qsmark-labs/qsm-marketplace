// What a git hook answers when a checker could not be measured: blocked,
// with its own code, never the failure a worse tree gets.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "bun:test";
import { cliShim, fakeBin } from "../../../lib/fixtures/bin.ts";
import { isolatedEnv } from "../../../lib/fixtures/cli.ts";
import { commit, git as plainGit } from "../../../lib/fixtures/git.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import type { Verdict } from "./compare.ts";
import { allowed, gatesCode, langdevOutcome, runGates } from "./gate-runner.ts";
import { installHooks } from "./git-hooks.ts";

const unmeasured: Verdict = {
  check: "semgrep-ts",
  kind: "not-measured",
  summary: "semgrep-ts: not measured: timed out after 60s; retry",
};
const worse: Verdict = {
  check: "oxlint",
  kind: "measured",
  pass: false,
  summary: "oxlint: 0 -> 1",
};

test("a checker not measured blocks the langdev gate with its cause, never as worse", () => {
  const outcome = langdevOutcome([unmeasured], "file sets: changed: 1 file", true);

  expect(outcome.status).toBe("blocked");
  const said = outcome.status === "blocked" ? [outcome.reason, ...outcome.remedy] : [];
  expect(said.join("\n")).toContain("semgrep-ts: not measured: timed out after 60s; retry");
  expect(said.join("\n")).not.toContain("WORSE");
});

test("a worse checker fails the langdev gate even beside one not measured", () => {
  expect(langdevOutcome([unmeasured, worse], "sizes", true).status).toBe("failed");
});

test("a missing config fails the gate and the block line says missing, never worse", () => {
  const noConfig: Verdict = {
    check: "oxlint",
    kind: "missing-config",
    summary: "oxlint: no config",
  };

  const outcome = langdevOutcome([noConfig], "sizes", true);

  expect(outcome.status).toBe("failed");
  expect(outcome.status === "failed" ? outcome.reason : "").toBe(
    "1 checker(s) missing (binary or config)",
  );
  const mixed = langdevOutcome([noConfig, worse, unmeasured], "sizes", true);
  expect(mixed.status === "failed" ? mixed.reason : "").toBe(
    "1 checker(s) worse, 1 checker(s) missing (binary or config), 1 checker(s) not measured",
  );
});

test("the hook's code: failed over blocked over ok", () => {
  const blocked = langdevOutcome([unmeasured], "sizes", true);
  const failed = langdevOutcome([worse], "sizes", true);
  const passed = langdevOutcome([], "sizes", true);

  expect(gatesCode([passed])).toBe("ok");
  expect(gatesCode([passed, blocked])).toBe("blocked");
  expect(gatesCode([blocked, failed])).toBe("failed");
});

test("A regression the author allows once", () => {
  const outcome = allowed(langdevOutcome([worse], "sizes", true), "known");

  expect(outcome.status).toBe("pass");
  const said = outcome.status === "pass" ? (outcome.note ?? "") : "";
  expect(said).toContain("oxlint: 0 -> 1");
  expect(said).toContain("allowed once: known");
});

test("A check that could not run is not allowed", () => {
  const missing: Verdict = {
    check: "oxlint",
    kind: "missing-binary",
    summary: "oxlint missing",
  };

  expect(allowed(langdevOutcome([missing], "sizes", true), "known").status).toBe("failed");
  expect(allowed(langdevOutcome([unmeasured], "sizes", true), "known").status).toBe("blocked");
  expect(allowed(langdevOutcome([worse], "sizes", true)).status).toBe("failed");
});

test("a push whose every ref is skipped says why, per ref, instead of a bare pass", async () => {
  const root = sandboxDir("qsm-langdev-skip-");
  const git = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git(
    "-c",
    "user.email=t@example.com",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "a",
  );
  const head = git("rev-parse", "HEAD").stdout.trim();
  const lines = `refs/heads/main ${head} refs/heads/main ${"0".repeat(40)}\n`;

  const outcomes = await runGates(root, "pre-push", ["langdev", "structure"], {
    pushLines: lines,
    remote: "/somewhere/empty.git",
  });

  for (const outcome of outcomes) {
    expect(outcome.status).toBe("skipped");
    expect(outcome.status === "skipped" ? outcome.reason : "").toContain(
      "refs/heads/main: this clone knows no default branch of '/somewhere/empty.git'",
    );
  }
});

test("git commit <paths> is scored on the files it commits, never on the rest of the index", () => {
  const root = sandboxDir("qsm-langdev-partial-");
  const bin = join(root, "bin");
  mkdirSync(bin);
  // quality is 1000 minus the files the checker was handed
  fakeBin(
    bin,
    "sentrux",
    `cd "$3" || exit 1
c='{"score":0.5}'
printf '{"quality":%d,"cross_module_edges":[],"root_causes":{"modularity":%s,"equality":%s,"redundancy":%s,"depth":%s,"acyclicity":%s}}' $((1000 - $(git ls-files | wc -l))) "$c" "$c" "$c" "$c" "$c"`,
  );
  cliShim(bin, "qsm-langdev", resolve(import.meta.dir, "../scripts/cli.ts"));
  const repo = join(root, "repo");
  writeIn(repo, ".sentrux/rules.toml", "[constraints]\nmax_cycles = 0\n");
  writeIn(
    repo,
    ".qsm-langdev/gates.json",
    `${JSON.stringify({ hooks: { "pre-commit": ["structure"], "pre-push": [] } })}\n`,
  );
  plainGit(root, "init", "-q", repo);
  commit(repo, "first");
  installHooks(repo, ["pre-commit"]);
  writeIn(repo, "a.ts", "export const a = 1;\n");
  writeIn(repo, "b.ts", "export const b = 2;\n");
  plainGit(repo, "add", "a.ts", "b.ts");

  // fixtures/git.ts turns hooks off, so this is git itself running the installed hook
  const committed = spawnSync("git", ["commit", "-q", "-m", "a only", "a.ts"], {
    cwd: repo,
    encoding: "utf8",
    env: isolatedEnv(root, {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    }),
  });

  expect(committed.stderr).toContain("structure quality: 998 -> 997 (-1)");
  expect(committed.status).toBe(0);
}, 60_000);
