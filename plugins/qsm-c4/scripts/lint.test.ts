// qsm-c4 lint through its real surface: a graph on disk in, one envelope out. Each fixture is the
// marketplace's own C4 source with one change that breaks one rule.
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { findingsOf, type PrintedFinding, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { C4, CLI } from "./fixtures/c4.ts";

/** Lints `text` as `marketplace.c4` and returns the exit and the findings. */
function lint(text: string): { exit: number; findings: PrintedFinding[] } {
  const dir = sandboxDir("qsm-c4-lint-");
  writeIn(dir, "marketplace.c4", text);
  const run = runBin(CLI, ["lint", join(dir, "marketplace.c4"), "--json"]);
  return { exit: run.exit, findings: findingsOf(run.stdout) };
}

/** The marketplace's C4 source with `from` replaced by `to`, which must be there. */
function c4(from: string, to: string): string {
  expect(C4).toContain(from);
  return C4.replace(from, to);
}

describe("lint on C4", () => {
  it("passes the marketplace's source, a container without components included", () => {
    expect(lint(C4)).toEqual({ exit: 0, findings: [] });
  });

  it("gives the message and line of likec4 validate for a relation to a missing element", () => {
    const r = lint(c4("  owner -> agent 'plans", "  owner -> nobody 'plans"));
    expect(r.exit).toBe(3);
    const line = C4.split("\n").findIndex((l) => l.startsWith("  owner -> agent 'plans")) + 1;
    expect(r.findings.map(({ id, rule, message }) => ({ id, rule, message }))).toContainEqual({
      id: `line ${line}`,
      rule: "likec4-validate",
      message: "Could not resolve reference to Referenceable named 'nobody'.",
    });
  });

  it("refuses a container inside a container, which LikeC4 accepts", () => {
    const r = lint(
      c4(
        "    cockpit = container 'qsm-cockpit'",
        "    nested = container 'Nested' 'x' {\n      metadata { path 'x' }\n      inner = container 'Inner' 'y' { metadata { path 'y' } }\n    }\n    cockpit = container 'qsm-cockpit'",
      ),
    );
    const found = r.findings.find((f) => f.id === "mp.nested.inner");
    expect(found?.rule).toBe("level");
    expect(found?.message).toContain("a container sits in a system");
  });

  it("refuses two agents in one colour, naming both and the colour", () => {
    const r = lint(c4("metadata { colour 'green' }", "metadata { colour 'orange' }"));
    expect(r.findings.map(({ id, rule, message }) => ({ id, rule, message }))).toContainEqual({
      id: "reviewer, qa",
      rule: "actor-colour",
      message: "reviewer and qa are both orange: each actor has its own colour",
    });
  });

  it("refuses a source with its own specification or views", () => {
    const r = lint(
      `${C4}\nspecification {\n  element box\n}\nviews {\n  view mine {\n    include *\n  }\n}\n`,
    );
    expect(r.findings.map((f) => f.rule).toSorted()).toEqual(["own-views", "own-vocabulary"]);
  });

  it("refuses a relation without technology, two equal titles and a container without its path", () => {
    const r = lint(
      c4(
        "  owner -> agent 'plans, splits and reviews with' { technology 'terminal' }",
        "  owner -> agent 'plans, splits and reviews with'",
      )
        .replace("ccr = container 'qsm-ccr'", "ccr = container 'qsm-cockpit'")
        .replace(
          "metadata { group 'Harness' path 'plugins/qsm-opencode' }",
          "metadata { group 'Harness' }",
        ),
    );
    expect(r.findings.map((f) => `${f.id} ${f.rule}`).toSorted()).toEqual([
      "mp.cockpit, mp.ccr unique-title",
      "mp.opencode container-path",
      "owner -> agent relation-technology",
    ]);
  });

  it("refuses the verified key until the verified-commit check is built", () => {
    const r = lint(
      c4("metadata { colour 'green' }", "metadata { colour 'green' verified 'deadbee' }"),
    );
    expect(r.exit).toBe(3);
    expect(r.findings).toMatchObject([{ rule: "metadata" }]);
    expect(r.findings[0]?.message).toContain("verified-commit check is not built yet");
  });
});
