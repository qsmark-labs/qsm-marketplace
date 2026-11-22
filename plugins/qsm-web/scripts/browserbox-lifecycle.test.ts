// qsm-web browserbox lifecycle through the real CLI against a controlled
// fake container runtime: a failed listing is failed rather than an empty
// list, stop --all names the instance it could not remove, and a start that
// never becomes ready reports its cleanup truthfully. No real container
// runs, no network, no source cache.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { envelopeOf, isolatedEnv } from "../../../lib/fixtures/cli.ts";
import { deadPid } from "../../../lib/fixtures/dead-run.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";

const PLUGIN = resolve(import.meta.dir, "..");
const CLI = join(PLUGIN, "scripts", "cli.ts");

/** A docker that answers from the FAKE_* environment: ps prints
 * FAKE_PS_OUTPUT or exits FAKE_PS_EXIT, exec (the readiness ping) exits
 * FAKE_PING_EXIT or answers ok, a fetch job gets FAKE_FETCH_REPLY in place of
 * ok, rm exits FAKE_RM_EXIT, image reports no image, build and run succeed. */
function fakeRuntime(): string {
  const dir = sandboxDir("qsm-web-fake-docker-");
  writeFileSync(
    join(dir, "docker"),
    [
      "#!/bin/sh",
      'case "$1" in',
      '  ps) [ "${FAKE_PS_EXIT:-0}" -eq 0 ] || exit "$FAKE_PS_EXIT"; printf "%s" "${FAKE_PS_OUTPUT:-}"; exit 0 ;;',
      '  rm) echo "$@" >> "${FAKE_LOG:-/dev/null}"; exit "${FAKE_RM_EXIT:-0}" ;;',
      '  exec) [ -z "${FAKE_EXEC_HANG:-}" ] || exec sleep "$FAKE_EXEC_HANG"; [ "${FAKE_PING_EXIT:-0}" -eq 0 ] || exit "$FAKE_PING_EXIT";',
      '    reply=\'{"ok":true}\'; case "$(cat)" in *\'"cmd":"fetch"\'*) reply=${FAKE_FETCH_REPLY:-$reply} ;; esac',
      '    printf "%s\\n" "$reply"; exit 0 ;;',
      "  image) exit 1 ;;",
      "  build|run) exit 0 ;;",
      "esac",
      "exit 0",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  return dir;
}

/** The child's readiness loop waits on Atomics.wait; the fake runtime never
 * becomes ready, so the child skips the clock wait only — every ping, result
 * and status still goes through the real runtime command. */
function noWaitShim(): string {
  const file = join(sandboxDir("qsm-web-no-wait-"), "no-wait.ts");
  writeFileSync(
    file,
    'Object.defineProperty(Atomics, "wait", { value: () => 0, writable: true, configurable: true });\n',
  );
  return file;
}

/** The lifecycle runner: one outcome case becomes one child process. This
 * file owns the whole case-to-run mapping here — the argv, the extra FAKE_*
 * environment, and the preload decision — instead of restating a generic
 * argv/env spawner signature. */
function runOutcome(c: OutcomeCase) {
  const home = sandboxDir("qsm-web-bbox-home-");
  // A start is the one call whose child must preload the shim, and the
  // preload flag has to precede the script path, so this spawner stays.
  const preload = c.argv.includes("start") ? ["--preload", noWaitShim()] : [];
  const r = spawnSync(process.execPath, [...preload, CLI, "browserbox", ...c.argv], {
    encoding: "utf8",
    env: isolatedEnv(home, {
      PATH: `${fakeRuntime()}:${process.env.PATH ?? ""}`,
      QSM_MARKETPLACE: resolve(PLUGIN, "..", ".."),
      ...c.env,
    }),
  });
  return { exit: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

interface OutcomeCase {
  readonly title: string;
  readonly argv: readonly string[];
  readonly env: Record<string, string>;
  readonly exit: number;
  readonly says: readonly string[];
  readonly silent?: readonly string[];
}

describe("qsm-web browserbox lifecycle", () => {
  const outcomes: OutcomeCase[] = [
    {
      title: "a failed listing is failed, not an empty list",
      argv: ["ls", "--json"],
      env: { FAKE_PS_EXIT: "1" },
      exit: 1,
      says: ["listing", "exit 1"],
    },
    {
      title: "stop --all names the instance it could not remove",
      argv: ["stop", "--all", "--json"],
      env: { FAKE_PS_OUTPUT: "bbox-11000 11000\nbbox-11001 11001\n", FAKE_RM_EXIT: "1" },
      exit: 1,
      says: ["bbox-11000", "exit 1"],
      silent: ["stopped every instance"],
    },
    {
      title: "stop --all with every removal successful still claims all",
      argv: ["stop", "--all", "--json"],
      env: { FAKE_PS_OUTPUT: "bbox-11000 11000\n" },
      exit: 0,
      says: ["stopped every instance"],
    },
    {
      title: "a named stop succeeds",
      argv: ["stop", "bbox-11000", "--json"],
      env: {},
      exit: 0,
      says: [],
    },
    {
      title: "a named stop failure names the instance",
      argv: ["stop", "bbox-11000", "--json"],
      env: { FAKE_RM_EXIT: "1" },
      exit: 1,
      says: ["bbox-11000 could not be stopped"],
    },
    {
      title: "a start that never becomes ready says its container was removed",
      argv: ["start", "--json"],
      env: { FAKE_PING_EXIT: "1", FAKE_RM_EXIT: "0" },
      exit: 1,
      says: ["bbox-11000", "its container was removed"],
      silent: ["nothing was left running"],
    },
    {
      title: "a start whose removal failure names the leftover to check",
      argv: ["start", "--json"],
      env: { FAKE_PING_EXIT: "1", FAKE_RM_EXIT: "1" },
      exit: 1,
      says: ["bbox-11000", "its removal exited 1", "leftover"],
      silent: ["nothing was left running"],
    },
  ];
  test.each(outcomes)("$title", (c: OutcomeCase) => {
    const r = runOutcome(c);
    expect(r.exit).toBe(c.exit);
    const envelope = envelopeOf(r.stdout);
    expect(envelope.code).toBe(c.exit === 0 ? "ok" : "failed");
    // The message contract in one numbered place: slot 1 every phrase the
    // message had to say but did not, slot 2 every phrase it had to keep
    // quiet about but leaked. A failure shows both lists at once.
    expect([
      c.says.filter((phrase) => !envelope.message.includes(phrase)),
      (c.silent ?? []).filter((phrase) => envelope.message.includes(phrase)),
    ]).toEqual([[], []]);
  });
});

describe("qsm-web browserbox fetch whose own container cannot be removed", () => {
  const LEFT = "bbox-11000 could not be removed after the fetch (exit 1)";
  const fetchOf = (env: Record<string, string>, exit: number) =>
    runOutcome({
      title: "left container",
      argv: ["fetch", "http://x.invalid", "--json"],
      env: { FAKE_RM_EXIT: "1", ...env },
      exit,
      says: [],
    });

  test("a fetch that succeeded keeps its result and names the container on stderr", () => {
    const r = fetchOf({}, 0);

    expect(r.exit).toBe(0);
    expect(envelopeOf(r.stdout).code).toBe("ok");
    expect(r.stderr).toContain(LEFT);
  });

  test("a fetch that failed keeps its own failure", () => {
    const r = fetchOf({ FAKE_FETCH_REPLY: '{"ok":false}' }, 1);

    expect(r.exit).toBe(1);
    expect(envelopeOf(r.stdout).message).toContain("http://x.invalid could not be fetched");
    expect(r.stderr).toContain(LEFT);
  });
});

describe("qsm-web browserbox driver that never answers", () => {
  test("the call fails at the reply limit, not when the driver answers", () => {
    const started = Date.now();
    const r = runOutcome({
      title: "hung driver",
      argv: ["fetch", "--in", "bbox-11000", "http://x.invalid", "--timeout", "200", "--json"],
      env: { FAKE_EXEC_HANG: "60", QSM_BROWSERBOX_REPLY_MS: "1500" },
      exit: 1,
      says: [],
    });

    expect(r.exit).toBe(1);
    expect(JSON.stringify(envelopeOf(r.stdout).data)).toContain("did not answer within 1500 ms");
    expect(Date.now() - started).toBeLessThan(20_000);
  });
});

describe("qsm-web browserbox sweep of a dead run's container", () => {
  /** `ls` against a fake runtime holding these containers; answers the names it removed. */
  function removedBy(ps: string): { removed: string[]; stderr: string } {
    const log = join(sandboxDir("qsm-web-rm-log-"), "rm.log");
    writeFileSync(log, "");
    const r = runOutcome({
      title: "sweep",
      argv: ["ls", "--json"],
      env: { FAKE_PS_OUTPUT: ps, FAKE_LOG: log },
      exit: 0,
      says: [],
    });
    const removed = readFileSync(log, "utf8")
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => l.replace("rm --force ", ""));
    return { removed, stderr: r.stderr };
  }

  test("a container whose owner run is dead is removed and named", () => {
    const dead = deadPid();
    const r = removedBy(
      `bbox-11000 qsm.browserbox=1,qsm-owner=browserbox:${dead}\n` +
        `bbox-11001 qsm.browserbox=1,qsm-owner=browserbox:${process.pid}\n`,
    );
    expect(r.removed).toEqual(["bbox-11000"]);
    expect(r.stderr).toContain("removed bbox-11000");
  });

  test("a persistent container, with no owner, survives", () => {
    const r = removedBy("bbox-11000 qsm.browserbox=1\n");
    expect(r.removed).toEqual([]);
  });
});
