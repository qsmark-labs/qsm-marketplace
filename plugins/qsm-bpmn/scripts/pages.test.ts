// pages through the real entry, in throwaway repositories. Opening the pages in a browser is the
// line's own proof; this holds the cases a browser need not see.
import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { envelopeOf, runBin } from "../../../lib/fixtures/cli.ts";
import { repoWith } from "../../../lib/fixtures/git.ts";
import { writeIn } from "../../../lib/fixtures/sandbox.ts";
import { CLI, GRAPH } from "./fixtures/plan.ts";

const pages = (repo: string): { exit: number; message: string } => {
  const run = runBin(CLI, ["pages", "--json"], { cwd: repo });
  return { exit: run.exit, message: envelopeOf(run.stdout).message };
};

describe("pages", () => {
  it("writes bpmn.html into .qsm/bpmn/ and nothing else under .qsm/", () => {
    const { repo } = repoWith("qsm-bpmn-pages-", { "models/shop.bpmn": GRAPH });
    const r = pages(repo);
    expect(r.exit).toBe(0);
    expect(readdirSync(join(repo, ".qsm"))).toEqual(["bpmn"]);
    expect(readdirSync(join(repo, ".qsm/bpmn"))).toEqual(["bpmn.html"]);
  });

  it("fails naming models/ where only a C4 graph exists", () => {
    const { repo } = repoWith("qsm-bpmn-pages-", { "models/shop.c4": "x" });
    const r = pages(repo);
    expect(r.exit).toBe(1);
    expect(r.message).toContain("models/ holds no graph");
    expect(existsSync(join(repo, ".qsm"))).toBe(false);
  });

  it("writes no page for a graph lint refuses, and leaves the earlier pages as they were", () => {
    const { repo } = repoWith("qsm-bpmn-pages-", { "models/shop.bpmn": GRAPH });
    expect(pages(repo).exit).toBe(0);
    const before = readFileSync(join(repo, ".qsm/bpmn/bpmn.html"), "utf8");
    writeIn(
      repo,
      "models/shop.bpmn",
      GRAPH.replace(' name="Plan approved" sourceRef="planned"', ' sourceRef="planned"'),
    );
    const r = pages(repo);
    expect(r.exit).toBe(3);
    expect(r.message).toContain("f_planned_split");
    expect(r.message).toContain("split-flows-labelled");
    expect(readFileSync(join(repo, ".qsm/bpmn/bpmn.html"), "utf8")).toBe(before);
  });
});
