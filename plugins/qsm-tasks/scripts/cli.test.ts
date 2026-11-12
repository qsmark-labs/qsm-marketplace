// qsm-tasks as a shell meets it, through the real entry. Where a live repository cannot show a
// case, a recording fake gh answers what the real gh answered.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bareRuntimePath, fakeBin } from "../../../lib/fixtures/bin.ts";
import { envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";

const CLI = join(import.meta.dir, "cli.ts");

describe("qsm-tasks without gh", () => {
  it("exits missing no-gh on a verb on the board", () => {
    const env = isolatedEnv(sandboxDir("qsm-tasks-"), { PATH: bareRuntimePath() });
    const r = runBin(CLI, ["ready", "--json"], { env });
    expect(r.exit).toBe(4);
    expect(envelopeOf(r.stdout).data).toMatchObject({ reason: "no-gh" });
  });
});

const BOARD = { id: "PVT_kwDOFMPqAc4Bo0vN", number: 1, owner: { login: "qsmark-labs" } };

function linked(nodes: readonly unknown[], hasNextPage = false): string {
  const repo = { id: "R_kgDOVGCdTA", nameWithOwner: "qsmark-labs/qsm-marketplace" };
  const projectsV2 = { pageInfo: { hasNextPage }, nodes };
  return JSON.stringify({ data: { repository: { ...repo, projectsV2 } } });
}

interface FakeGh {
  /** what it answers the resolution, or any call when `search` is absent */
  readonly stdout: string;
  readonly stderr?: string;
  readonly exit?: number;
  /** what it answers a search */
  readonly search?: string;
  /** what it answers the read of a move's card */
  readonly card?: string;
}

/** Runs `qsm-tasks <argv> --json` with a gh that answers `gh` and records each call. */
function run(gh: FakeGh, argv: readonly string[] = ["ready"]) {
  const dir = sandboxDir("qsm-tasks-");
  const calls = join(dir, "calls");
  // builtins only: the PATH holds the fake and the runtime, no cat
  const answer = `printf '%s' '${gh.stdout}'; printf '%s' '${gh.stderr ?? ""}' >&2; exit ${gh.exit ?? 0}`;
  const search = [
    gh.search === undefined ? "" : `*search\\(*) printf '%s' '${gh.search}' ;; `,
    gh.card === undefined ? "" : `*viewer\\{login\\}*) printf '%s' '${gh.card}' ;; `,
  ].join("");
  const stdin = join(dir, "stdin");
  const comment = `*"issue comment"*) while IFS= read -r l || [ -n "$l" ]; do printf '%s\\n' "$l"; done > "${stdin}" ;; `;
  const body = `printf '%s\\n' "$*" >> "${calls}"\ncase "$*" in ${search}${comment}*) ${answer} ;; esac`;
  fakeBin(dir, "gh", body);
  const env = isolatedEnv(dir, { PATH: `${dir}:${bareRuntimePath()}` });
  const r = runBin(CLI, [...argv, "--json"], { env });
  const out = envelopeOf(r.stdout);
  const recorded = existsSync(calls) ? readFileSync(calls, "utf8").trim().split("\n") : [];
  const posted = existsSync(stdin) ? readFileSync(stdin, "utf8") : null;
  return { exit: r.exit, data: out.data, message: out.message, calls: recorded, posted };
}

describe("qsm-tasks resolves the board", () => {
  it("is missing no-repo when gh finds no repository, from gh's recorded words", () => {
    const stderr = `error parsing "owner" value: failed to run git: fatal: not a git repository (or any parent up to mount point /)`;
    const r = run({ stdout: "", stderr, exit: 1 });
    expect(r.exit).toBe(4);
    expect(r.data).toMatchObject({ reason: "no-repo" });
  });

  it("is missing no-board when the repository has no open linked board, after one gh call", () => {
    const r = run({ stdout: linked([]) });
    expect(r.exit).toBe(4);
    expect(r.data).toMatchObject({ reason: "no-board" });
    expect(r.calls).toHaveLength(1);
  });

  it("is a usage naming the boards when several are linked", () => {
    const r = run({ stdout: linked([BOARD, { ...BOARD, id: "PVT_other", number: 2 }]) });
    expect(r.exit).toBe(2);
    expect(r.message).toContain("(qsmark-labs/1, qsmark-labs/2)");
  });

  it("is a usage when GitHub holds more linked boards than one page", () => {
    const r = run({ stdout: linked([BOARD], true) });
    expect(r.exit).toBe(2);
    expect(r.message).toContain("(qsmark-labs/1 and more)");
  });

  it("runs no gh call on an unknown flag", () => {
    const r = run({ stdout: linked([BOARD]) }, ["ready", "--bogus"]);
    expect(r.exit).toBe(2);
    expect(r.calls).toEqual([]);
  });
});

function task(number: number, priority: string | null, blockedBy: number[] = [], status = "Todo") {
  const card = {
    id: `PVTI_${number}`,
    project: { id: BOARD.id },
    status: { name: status },
    priority: priority === null ? null : { name: priority },
  };
  return {
    number,
    title: `task ${number}`,
    state: "OPEN",
    issueType: { name: "Task" },
    assignees: { nodes: [] },
    labels: { nodes: [] },
    blockedBy: { nodes: blockedBy.map((n) => ({ number: n, state: "OPEN" })) },
    projectItems: { nodes: [card] },
  };
}

function found(nodes: readonly unknown[]): string {
  return JSON.stringify({ data: { search: { pageInfo: { hasNextPage: false }, nodes } } });
}

describe("qsm-tasks reads the board", () => {
  it("ready lists P0 first and no priority last, and leaves out the blocked and what is not Todo", () => {
    const ready = [task(4, "P2"), task(7, "P0"), task(9, null), task(11, "P0"), task(1, "P0")];
    const others = [task(2, "P0", [1]), task(5, "P0", [], "In Dev")];
    const r = run({ stdout: linked([BOARD]), search: found([...ready, ...others]) });
    expect(r.exit).toBe(0);
    expect(r.message.split("\n").map((line) => line.split(" ")[0])).toEqual([
      "#1",
      "#7",
      "#11",
      "#4",
      "#9",
    ]);
    expect(r.calls[1]).toContain('-label:"deferred"');
  });

  it("list --spec reads a change's feature by its exact label, in any state, in one search", () => {
    const r = run({ stdout: linked([BOARD]), search: found([]) }, ["list", "--spec", "add-x"]);
    expect(r.message).toBe("none");
    expect(r.calls).toHaveLength(2);
    expect(r.calls[1]).toEndWith(
      'q=repo:qsmark-labs/qsm-marketplace is:issue label:"change:add-x"',
    );
  });
});

describe("qsm-tasks note", () => {
  it("posts the text on stdin, unchanged, and nothing as an argument", () => {
    const text = 'waiting for the "API" key\nand a second line';
    const r = run({ stdout: linked([BOARD]) }, ["note", "5", text]);
    expect(r.exit).toBe(0);
    expect(r.posted).toBe(`${text}\n`);
    expect(r.calls[1]).toBe("issue comment 5 --repo qsmark-labs/qsm-marketplace --body-file -");
  });
});

/** A move's card as GitHub answers it: the caller, the Status field and one task on the board. */
function cardOf(status: string, assignees: readonly string[], more: object = {}): string {
  const statuses = ["Todo", "In Dev", "Agent Review"];
  const field = { id: "PVTSSF_1", options: statuses.map((name, i) => ({ id: `opt${i}`, name })) };
  const issue = {
    ...task(5, null, [], status),
    id: "I_5",
    assignees: { nodes: assignees.map((login) => ({ login })) },
    ...more,
  };
  return JSON.stringify({
    data: { viewer: { login: "Questi0nM4rk" }, board: { field }, repo: { issue } },
  });
}

describe("qsm-tasks moves a task", () => {
  it("claim on a task held by another login is blocked held, and writes nothing", () => {
    const r = run({ stdout: linked([BOARD]), card: cardOf("Todo", ["someone-else"]) }, [
      "claim",
      "5",
    ]);
    expect(r.exit).toBe(5);
    expect(r.data).toMatchObject({ reason: "held" });
    expect(r.message).toContain("someone-else");
    expect(r.calls).toHaveLength(2);
  });

  it("unclaim --until sets Todo, gives the task back, labels it deferred and says until when", () => {
    const r = run({ stdout: linked([BOARD]), card: cardOf("In Dev", ["Questi0nM4rk"]) }, [
      "unclaim",
      "5",
      "--until",
      "2026-12-01",
    ]);
    expect(r.exit).toBe(0);
    expect(r.message).toBe("#5 In Dev -> Todo");
    expect(r.calls.slice(2).map((c) => c.split(" -f ")[0])).toEqual([
      "api graphql",
      "issue edit 5 --repo qsmark-labs/qsm-marketplace --remove-assignee Questi0nM4rk --add-label deferred",
      "issue comment 5 --repo qsmark-labs/qsm-marketplace --body-file -",
    ]);
    expect(r.posted).toBe("Deferred until 2026-12-01\n");
  });
});

describe("qsm-tasks moves a feature and a closed issue", () => {
  it("qa on a feature with an open sub-issue is blocked wrong-status, and writes nothing", () => {
    const feature = {
      issueType: { name: "Feature" },
      subIssuesSummary: { total: 3, completed: 2 },
    };
    const r = run({ stdout: linked([BOARD]), card: cardOf("Ready For Test", [], feature) }, [
      "qa",
      "5",
    ]);
    expect(r.exit).toBe(5);
    expect(r.data).toMatchObject({ reason: "wrong-status" });
    expect(r.message).toContain("has 1");
    expect(r.calls).toHaveLength(2);
  });

  it("reopen under a closed parent is blocked wrong-status, and writes nothing", () => {
    const closed = { state: "CLOSED", parent: { state: "CLOSED" } };
    const r = run({ stdout: linked([BOARD]), card: cardOf("Done", [], closed) }, ["reopen", "5"]);
    expect(r.exit).toBe(5);
    expect(r.message).toContain("parent is closed");
    expect(r.calls).toHaveLength(2);
  });
});
