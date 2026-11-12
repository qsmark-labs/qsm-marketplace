// What this install owes the user is the binary, and gh and br on PATH. The shared base probes the
// two, so these tests pin what is declared: the tool, and the line to type, because no command here
// installs it.

import { describe, expect, test } from "bun:test";
import { fakeInstall } from "../../../lib/fixtures/install.ts";
import { install } from "./install.ts";

describe("install", () => {
  test("gh and br present: the binary is compiled and both are already there", async () => {
    const r = await install(fakeInstall({ present: ["bun", "gh", "br"] }).ctx);
    expect(r.status).toBe("installed");
    expect(r.steps.find((s) => s.name === "upstream gh")).toMatchObject({ status: "already" });
    expect(r.steps.find((s) => s.name === "upstream br")).toMatchObject({ status: "already" });
  }, 60_000);

  test.each([
    ["gh", ["bun", "br"], "gh auth login"],
    ["br", ["bun", "gh"], "beads_rust"],
  ])(
    "%s missing is a missing prerequisite named with its line, and nothing runs",
    async (cmd, present, hint) => {
      const { ctx, runs } = fakeInstall({ present });
      const r = await install(ctx);
      const step = r.steps.find((s) => s.name === `upstream ${cmd}`);
      expect(step).toMatchObject({ status: "missing-prereq" });
      expect(step?.detail).toContain(hint);
      expect(runs).toHaveLength(0);
    },
  );
});
