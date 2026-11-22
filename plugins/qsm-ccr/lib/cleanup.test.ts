// What a call leaves behind: a home after its claude ends, a grandchild after codex or ccr stop.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fakeBin } from "../../../lib/fixtures/bin.ts";
import { deadPid, ended } from "../../../lib/fixtures/dead-run.ts";
import { atTestEnd, sandboxDir } from "../../../lib/fixtures/sandbox.ts";
import { refreshCatalog } from "./codex.ts";
import { takeDown } from "./daemon.ts";
import { makeWorld, setMode } from "./fixtures/world.ts";
import { runLead } from "./lead.ts";

setDefaultTimeout(30_000);

/** A command body that leaves a sleeping grandchild behind and writes its pid to `pidFile`. */
const leavesSleeper = (pidFile: string) => `sleep 300 >/dev/null 2>&1 &\necho $! > "${pidFile}"`;

describe("a call ends what it started", () => {
  test("a lead's home keeps what claude wrote, and a dead launch's empty home is gone", async () => {
    const w = makeWorld();
    const homes = join(w.stateDir, "homes");
    // a launch that died: its pid is of a process that has ended
    const dead = deadPid();
    const left = join(homes, `session.${dead}.abc123`);
    mkdirSync(left, { recursive: true });
    setMode(w, "claude-writes-history");
    expect((await runLead(undefined, [], w.env, "/opt/qsm-ccr")).code).toBe("ok");
    const [home, ...others] = readdirSync(homes);
    expect(others).toEqual([]);
    // what qsm-ccr copied and linked is gone, what claude wrote stays, under a name no later
    // launch sweeps again
    expect(home).toStartWith("kept.");
    expect(readdirSync(join(homes, home ?? ""))).toEqual(["history.jsonl"]);
  });

  test("a dead launch's home that a live claude still uses is not swept", async () => {
    const w = makeWorld();
    const homes = join(w.stateDir, "homes");
    const dead = deadPid();
    const used = join(homes, `session.${dead}.abc123`);
    mkdirSync(used, { recursive: true });
    writeFileSync(join(used, "settings.json"), "{}");
    const claude = spawn("sleep", ["300"], { env: { CLAUDE_CONFIG_DIR: used } });
    atTestEnd(() => {
      claude.kill("SIGKILL");
    });
    expect((await runLead(undefined, [], w.env, "/opt/qsm-ccr")).code).toBe("ok");
    expect(existsSync(join(used, "settings.json"))).toBe(true);
  });

  test("codex's grandchild does not outlive the catalog refresh", async () => {
    const dir = sandboxDir("qsm-ccr-codex-");
    const pidFile = join(dir, "pid");
    fakeBin(dir, "codex", leavesSleeper(pidFile));
    expect(refreshCatalog({ PATH: `${dir}:/usr/bin:/bin` })).toBeNull();
    expect(await ended(Number(readFileSync(pidFile, "utf8")))).toBe(true);
  });

  test("a grandchild of ccr stop does not outlive the take-down", async () => {
    const dir = sandboxDir("qsm-ccr-stop-");
    const pidFile = join(dir, "pid");
    fakeBin(dir, "ccr", leavesSleeper(pidFile));
    await takeDown({ env: { PATH: `${dir}:/usr/bin:/bin` }, ccrHome: dir });
    expect(existsSync(pidFile)).toBe(true);
    expect(await ended(Number(readFileSync(pidFile, "utf8")))).toBe(true);
  });
});
