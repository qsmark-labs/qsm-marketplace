// The private Claude home of a launch, through the real functions on real directories: a teammate
// keeps its links when its lead's home goes, a failed cleanup never replaces claude's exit, and the
// installer cleans the homes of the shape before the pid name.
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";
import { fakeInstall } from "../../../lib/fixtures/install.ts";
import { install } from "../scripts/install.ts";
import { isolatedHome, removeHome } from "./claude-home.ts";
import { makeWorld } from "./fixtures/world.ts";
import { runLead } from "./lead.ts";
import { placesOf } from "./places.ts";

setDefaultTimeout(30_000);

function machine() {
  const base = sandboxDir("qsm-ccr-home-");
  const claude = join(base, "claude");
  mkdirSync(join(claude, "teams"), { recursive: true });
  mkdirSync(join(claude, "tasks"), { recursive: true });
  const env = { HOME: base, CLAUDE_CONFIG_DIR: claude, XDG_STATE_HOME: join(base, "state") };
  return { env, places: placesOf(env), base };
}

describe("a teammate's links", () => {
  test("still resolve after its lead's home is removed", () => {
    const m = machine();
    const lead = isolatedHome(m.env, m.places);
    const teammate = isolatedHome(lead, m.places);

    removeHome(lead, m.places);

    for (const name of ["teams", "tasks"]) {
      expect(existsSync(join(teammate["CLAUDE_CONFIG_DIR"] ?? "", name))).toBe(true);
    }
  });
});

describe("the lead's end", () => {
  test("a home that cannot be cleaned is named and claude's exit stays", async () => {
    const w = makeWorld();
    writeFileSync(join(w.bin, "claude"), '#!/bin/sh\nrm -rf "$CLAUDE_CONFIG_DIR"\nexit 7\n', {
      mode: 0o755,
    });
    const stderr = spyOn(console, "error").mockImplementation(() => {});

    const outcome = await runLead(undefined, [], w.env, "/opt/elsewhere/qsm-ccr");

    const said = stderr.mock.calls.map((c) => String(c[0]));
    stderr.mockRestore();
    expect(outcome.message).toContain("claude exited 7");
    expect(said.some((line) => line.includes("could not clean the home"))).toBe(true);
  });
});

describe("the installer and the homes of the shape before the pid name", () => {
  test("it removes what qsm-ccr made in each and keeps what Claude wrote", async () => {
    const fake = fakeInstall({ present: ["bun", "claude", "codex"] });
    const places = placesOf(fake.ctx.env);
    const homes = join(places.stateDir, "homes");
    const old = join(homes, "session-Ab12Cd");
    const empty = join(homes, "session-Zz99Yy");
    mkdirSync(old, { recursive: true });
    mkdirSync(empty, { recursive: true });
    writeFileSync(join(old, ".claude.json"), "{}");
    writeFileSync(join(old, "history.jsonl"), "what Claude wrote");
    symlinkSync(join(fake.home, "nowhere"), join(old, "skills"));
    writeFileSync(join(empty, ".claude.json"), "{}");

    const r = await install(fake.ctx);

    expect(r.steps.find((s) => s.name === "old homes")?.status).toBe("installed");
    expect(readdirSync(homes)).toEqual(["kept-Ab12Cd"]);
    expect(readdirSync(join(homes, "kept-Ab12Cd"))).toEqual(["history.jsonl"]);
    const again = await install(fake.ctx);
    expect(again.steps.find((s) => s.name === "old homes")?.status).toBe("already");
  }, 120_000);
});
