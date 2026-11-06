// render through the real entry: a source lint refuses writes no view.
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { envelopeOf, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { C4, CLI } from "./fixtures/c4.ts";

describe("render", () => {
  it("writes nothing for a source that puts a container inside a container", () => {
    const dir = sandboxDir("qsm-c4-render-");
    writeIn(dir, "shop.c4", C4);
    expect(runBin(CLI, ["render", dir]).exit).toBe(0);
    const views = readdirSync(dir).filter((f) => f.endsWith(".drawio.svg"));
    const before = views.map((v) => readFileSync(join(dir, v), "utf8"));
    writeIn(
      dir,
      "shop.c4",
      C4.replace(
        "    cockpit = container 'qsm-cockpit'",
        "    nested = container 'Nested' 'x' {\n      metadata { path 'x' }\n      inner = container 'Inner' 'y' { metadata { path 'y' } }\n    }\n    cockpit = container 'qsm-cockpit'",
      ),
    );
    const run = runBin(CLI, ["render", dir, "--json"]);
    expect(run.exit).toBe(3);
    expect(envelopeOf(run.stdout).message).toContain("mp.nested.inner");
    expect(envelopeOf(run.stdout).message).toContain("(level)");
    expect(views.map((v) => readFileSync(join(dir, v), "utf8"))).toEqual(before);
    expect(readdirSync(dir).filter((f) => f.endsWith(".drawio.svg"))).toEqual(views);
  });
});
