// qsm-tasks as a shell meets it, through the real entry. Where a live repository cannot show a
// case, a recording fake gh answers what the real gh answered.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bareRuntimePath, fakeBin } from "../../../lib/fixtures/bin.ts";
import { envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";

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
  /** what it answers the read of one issue */
  readonly issue?: string;
  /** what it answers doctor's one read of the repository and the board */
  readonly health?: string;
  /** what it answers the read of a move's card */
  readonly card?: string;
  /** refuse the first `gh issue edit`, as GitHub refuses a write */
  readonly refuseEditOnce?: true;
  /** what it answers adding an issue to the board */
  readonly added?: string;
  /** what it answers `gh issue list`: the number of the open feedback of a title, or nothing */
  readonly list?: string;
  /** what it answers the read of the pull request `human` names */
  readonly pull?: string;
  /** the address it answers an issue create with */
  readonly created?: string;
  /** the checkout QSM_MARKETPLACE names */
  readonly marketplace?: string;
}

/** Runs `qsm-tasks <argv> --json` with a gh that answers `gh` and records each call; a run in the
 * same `dir` meets the same fake again. */
/** Which call each answer of the fake goes to, by a piece of its arguments. */
const ANSWERS = [
  ["search", "*search\\(*"],
  ["card", "*viewer\\{login\\}*"],
  ["added", "*addProjectV2ItemById*"],
  ["issue", "*comments\\(first*"],
  ["health", "*issueTypes*"],
  ["list", "*issue\\ list*"],
  ["pull", "*pullRequest\\(number*"],
] as const;

/** The fake's case arms: a refused first edit when asked, then the named answers. */
function arms(gh: FakeGh, refused: string): string {
  const edit = `*"issue edit"*) [ -e "${refused}" ] && exit 0; : > "${refused}"; printf 'refused' >&2; exit 1 ;; `;
  const named = ANSWERS.flatMap(([key, pattern]) => {
    const answer = gh[key];
    return answer === undefined ? [] : [`${pattern}) printf '%s' '${answer}' ;; `];
  });
  return [...(gh.refuseEditOnce === undefined ? [] : [edit]), ...named].join("");
}

function run(gh: FakeGh, argv: readonly string[] = ["ready"], dir = sandboxDir("qsm-tasks-")) {
  const calls = join(dir, "calls");
  // builtins only: the PATH holds the fake and the runtime, no cat
  const answer = `printf '%s' '${gh.stdout}'; printf '%s' '${gh.stderr ?? ""}' >&2; exit ${gh.exit ?? 0}`;
  const search = arms(gh, join(dir, "refused"));
  const stdin = join(dir, "stdin");
  // a body gh reads on stdin is kept; a create answers the new issue's address
  const comment = `*"--input"*) while IFS= read -r l || [ -n "$l" ]; do printf '%s\\n' "$l"; done >> "${stdin}"; printf '%s' '{"data":{}}' ;; *"issue comment"*|*"issue create"*) while IFS= read -r l || [ -n "$l" ]; do printf '%s\\n' "$l"; done > "${stdin}"; printf '%s' '${gh.created ?? ""}' ;; `;
  const body = `printf '%s\\n' "$*" >> "${calls}"\ncase "$*" in ${search}${comment}*) ${answer} ;; esac`;
  fakeBin(dir, "gh", body);
  const marketplace = gh.marketplace === undefined ? {} : { QSM_MARKETPLACE: gh.marketplace };
  const env = isolatedEnv(dir, { PATH: `${dir}:${bareRuntimePath()}`, ...marketplace });
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
    blockedBy: {
      pageInfo: { hasNextPage: false },
      nodes: blockedBy.map((n) => ({ number: n, state: "OPEN" })),
    },
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

  it("list --spec refuses an id that cannot be a label, before any gh call", () => {
    for (const spec of ['a" is:open type:Task', "x".repeat(60)]) {
      expect(run({ stdout: linked([BOARD]) }, ["list", "--spec", spec]).calls).toEqual([]);
    }
  });

  it("ready lists an open task the board has not added yet, as claim takes it", () => {
    const off = { ...task(8, null), projectItems: { nodes: [] } };
    expect(run({ stdout: linked([BOARD]), search: found([off]) }).message).toStartWith("#8 ");
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
  const statuses = ["Todo", "In Dev", "Agent Review", "Ready For Human"];
  const field = { id: "PVTSSF_1", options: statuses.map((name, i) => ({ id: `opt${i}`, name })) };
  const issue = {
    ...task(5, null, [], status),
    id: "I_5",
    assignees: { nodes: assignees.map((login) => ({ login })) },
    ...more,
  };
  return JSON.stringify({
    data: {
      viewer: { login: "Questi0nM4rk" },
      board: { fields: { nodes: [{ ...field, name: "Status" }] } },
      repo: { issue },
    },
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

  it("unclaim --until refused at its first write writes nothing else, and a rerun finishes it", () => {
    const dir = sandboxDir("qsm-tasks-");
    const gh = { stdout: linked([BOARD]), card: cardOf("In Dev", ["Questi0nM4rk"]) };
    const argv = ["unclaim", "5", "--until", "2026-12-01"];
    const first = run({ ...gh, refuseEditOnce: true }, argv, dir);
    expect(first.exit).toBe(1);
    expect(first.calls).toHaveLength(3);
    const again = run({ ...gh, refuseEditOnce: true }, argv, dir);
    expect(again.exit).toBe(0);
    expect(again.message).toBe("#5 In Dev -> Todo");
    expect(again.calls.slice(5).map((c) => c.split(" -f ")[0])).toEqual([
      "issue edit 5 --repo qsmark-labs/qsm-marketplace --remove-assignee Questi0nM4rk --add-label deferred",
      "api graphql",
      "issue comment 5 --repo qsmark-labs/qsm-marketplace --body-file -",
    ]);
    expect(again.posted).toBe("Deferred until 2026-12-01\n");
  });
});

describe("qsm-tasks human hands a task over", () => {
  const card = cardOf("Agent Review", [], { parent: { number: 3, state: "OPEN" } });
  const rollup = (state: string) => ({ nodes: [{ commit: { statusCheckRollup: { state } } }] });
  const review = (state: string, oid: string) => ({ nodes: [{ state, commit: { oid } }] });
  /** The PR read as GitHub answers it, for task 5 under feature 3, ready unless `more` says not;
   * its head is the commit `c2`. */
  const run5 = (more: object) => {
    const ready = {
      state: "OPEN",
      baseRefName: "feature/3",
      body: "Builds the verb.\n\nCloses #5",
      headRefOid: "c2",
      latestReviews: review("COMMENTED", "c2"),
      commits: rollup("SUCCESS"),
    };
    const pull = JSON.stringify({ data: { node: { pullRequest: { ...ready, ...more } } } });
    return run({ stdout: linked([BOARD]), card, pull }, ["human", "5", "--pr", "9"]);
  };

  it.each([
    ["a base that is not feature/3", { baseRefName: "main" }, "based on main, not feature/3"],
    ["no Closes #5", { body: "Closes #50" }, "does not say Closes #5"],
    ["a failing check", { commits: rollup("FAILURE") }, "checks are FAILURE, not green"],
    ["a merged PR", { state: "MERGED" }, "is merged, not open"],
    ["a closed PR", { state: "CLOSED" }, "is closed, not open"],
    [
      "a review asking for changes on its head",
      { latestReviews: review("CHANGES_REQUESTED", "c2") },
      "asking for changes on its head",
    ],
  ])("with %s is blocked and writes nothing", (_, more, said) => {
    const r = run5(more);
    expect(r.data).toMatchObject({ reason: "wrong-status" });
    expect(r.message).toContain(said);
    expect(r.calls.some((c) => c.includes("mutation"))).toBe(false);
  });

  it("on a task under no feature is blocked before the PR is read", () => {
    const gh = { stdout: linked([BOARD]), card: cardOf("Agent Review", []) };
    const r = run(gh, ["human", "5", "--pr", "9"]);
    expect(r.message).toBe("#5 is under no feature");
    expect(r.calls).toHaveLength(2);
  });

  it.each([
    ["approved by nobody", {}],
    ["with changes asked on an older commit", { latestReviews: review("CHANGES_REQUESTED", "c1") }],
  ])("with its ready PR, %s, moves the task to Ready For Human", (_, more) => {
    const r = run5(more);
    expect(r.message).toBe("#5 Agent Review -> Ready For Human");
    expect(r.calls.some((c) => c.includes("updateProjectV2ItemFieldValue"))).toBe(true);
  });

  it.each([[["human", "5"]], [["human", "5", "--pr", "9", "--started"]]])(
    "%p is a usage before any gh call",
    (argv) => {
      expect(run({ stdout: linked([BOARD]) }, argv).calls).toEqual([]);
    },
  );
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

  it("reopen on a closed issue off the board takes it as Done, adds the card and sets Todo", () => {
    const off = { state: "CLOSED", projectItems: { nodes: [] } };
    const added = JSON.stringify({ data: { addProjectV2ItemById: { item: { id: "PVTI_5" } } } });
    const r = run({ stdout: linked([BOARD]), card: cardOf("Done", [], off), added }, [
      "reopen",
      "5",
    ]);
    expect(r.message).toBe("#5 Done -> Todo");
    expect(r.calls.slice(2).map((c) => c.split(" -f ")[0])).toEqual([
      "issue reopen 5 --repo qsmark-labs/qsm-marketplace",
      "api graphql",
      "api graphql",
    ]);
    expect(r.calls[3]).toContain("addProjectV2ItemById");
  });
});

describe("qsm-tasks files the work", () => {
  const feature = { issueType: { name: "Feature" } };
  /** show's read of one issue as GitHub answers it. */
  const issueOf = (more: object) => {
    const family = { body: "", parent: null, subIssuesSummary: { total: 0, completed: 0 } };
    return JSON.stringify({ data: { node: { issue: { ...task(3, null), ...family, ...more } } } });
  };
  const created = "https://github.com/qsmark-labs/qsm-marketplace/issues/77";

  it("add files a sub-issue of an open feature with its body on stdin, unchanged", () => {
    const dir = sandboxDir("qsm-tasks-");
    const body = 'Write the "CSV"\nwith two lines';
    writeIn(dir, "body.md", body);
    const gh = { stdout: linked([BOARD]), issue: issueOf(feature), created };
    const argv = ["add", "Write the CSV", "--feature", "3", "--body-file", join(dir, "body.md")];
    const r = run(gh, argv, dir);
    expect(r.message).toBe("#77 filed: Write the CSV");
    expect(r.calls[2]).toBe(
      "issue create --repo qsmark-labs/qsm-marketplace --title Write the CSV --type Task --body-file - --parent 3",
    );
    expect(r.posted).toBe(`${body}\n`);
  });

  it("add under a closed feature is blocked wrong-status and files nothing", () => {
    const closed = { ...feature, state: "CLOSED" };
    const gh = { stdout: linked([BOARD]), issue: issueOf(closed), created };
    const r = run(gh, ["add", "Write the CSV", "--feature", "3"]);
    expect(r.data).toMatchObject({ reason: "wrong-status" });
    expect(r.calls).toHaveLength(2);
  });

  it("add --priority on a board with no such option is not-found and files nothing", () => {
    // the field read gets the resolution's answer, which holds no Priority field
    const r = run({ stdout: linked([BOARD]) }, ["add", "Write", "--priority", "P1"]);
    expect(r.data).toMatchObject({ reason: "not-found" });
    expect(r.calls.some((c) => c.startsWith("issue create"))).toBe(false);
  });

  it.each([
    [["feature", "Export", "--intent", "x.md", "--spec", "x".repeat(60)]],
    [["add", "Write", "--priority", "P5"]],
  ])("%p is a usage before any gh call", (argv) => {
    const r = run({ stdout: linked([BOARD]) }, argv);
    expect(r.exit).toBe(2);
    expect(r.calls).toEqual([]);
  });
});

describe("qsm-tasks show", () => {
  it("refuses an issue whose blockers GitHub cut, as ready and list do", () => {
    const cutBlockers = { pageInfo: { hasNextPage: true }, nodes: [] };
    const family = { parent: null, subIssuesSummary: { total: 0, completed: 0 } };
    const node = { ...task(5, null), blockedBy: cutBlockers, body: "", ...family };
    const issue = JSON.stringify({ data: { node: { issue: node } } });
    const r = run({ stdout: linked([BOARD]), issue }, ["show", "5"]);
    expect(r.exit).toBe(1);
    expect(r.message).toContain("over 100 blockers");
  });
});

describe("qsm-tasks edits and closes the work", () => {
  const feature = { issueType: { name: "Feature" } };

  it("close --not-planned on a feature with an open sub-issue is blocked and changes nothing", () => {
    const open = { ...feature, subIssuesSummary: { total: 2, completed: 1 } };
    const argv = ["close", "3", "--reason", "dropped", "--not-planned"];
    const r = run({ stdout: linked([BOARD]), card: cardOf("In Dev", [], open) }, argv);
    expect(r.data).toMatchObject({ reason: "wrong-status" });
    expect(r.calls).toHaveLength(2);
  });

  it("close posts the reason on stdin, then closes as not planned; a rerun posts it once", () => {
    const argv = ["close", "5", "--reason", "dropped: the API went away", "--not-planned"];
    const r = run({ stdout: linked([BOARD]), card: cardOf("Todo", []) }, argv);
    expect(r.message).toBe("#5 closed as not planned");
    expect(r.posted).toBe("dropped: the API went away\n");
    expect(r.calls[3]).toBe(
      "issue close 5 --repo qsmark-labs/qsm-marketplace --reason not planned",
    );
    const said = { comments: { nodes: [{ body: "dropped: the API went away" }] } };
    const again = run({ stdout: linked([BOARD]), card: cardOf("Todo", [], said) }, argv);
    expect(again.calls.filter((c) => c.startsWith("issue comment"))).toEqual([]);
  });

  it("edit --spec on a task is blocked wrong-kind and changes nothing", () => {
    const argv = ["edit", "12", "--spec", "x"];
    const r = run({ stdout: linked([BOARD]), card: cardOf("Todo", []) }, argv);
    expect(r.data).toMatchObject({ reason: "wrong-kind" });
    expect(r.calls).toHaveLength(2);
  });

  it("edit refused by GitHub, as a cycle is, exits failed with GitHub's words", () => {
    const gh = { stdout: linked([BOARD]), card: cardOf("Todo", []), refuseEditOnce: true } as const;
    const r = run(gh, ["edit", "1", "--after", "2"]);
    expect(r.exit).toBe(1);
    expect(r.message).toContain("refused");
  });

  it.each([[["edit", "3", "--spec", "x".repeat(60)]], [["edit", "3"]]])(
    "%p is a usage before any gh call",
    (argv) => {
      expect(run({ stdout: linked([BOARD]) }, argv).calls).toEqual([]);
    },
  );
});

describe("qsm-tasks feedback", () => {
  const sections = (what: string) =>
    `## What happened\n${what}\n## Where\nqsm-tasks\n## How to reproduce\nRun a verb.\n## Expected behaviour\nIt works.\n`;

  /** A marketplace checkout with one plugin, and the feedback body, both in the test's own dir. */
  function setup(body: string): { dir: string; argv: string[] } {
    const dir = sandboxDir("qsm-tasks-");
    writeIn(
      dir,
      "market/.claude-plugin/marketplace.json",
      JSON.stringify({ plugins: [{ name: "qsm-tasks" }] }),
    );
    writeIn(dir, "body.md", body);
    const flags = ["--area", "qsm-tasks", "--kind", "tool-broken", "--from", "subagent"];
    return {
      dir,
      argv: ["feedback", "ready skips a task", ...flags, "--body-file", join(dir, "body.md")],
    };
  }

  /** gh in the checkout: it answers the repository's name, and `more`. */
  const fake = (dir: string, more: object = {}) => ({
    stdout: "qsmark-labs/qsm-marketplace",
    marketplace: join(dir, "market"),
    ...more,
  });
  // built from pieces, so no secret scanner reads this file as holding one
  const armour = (edge: string) => `-----${edge} OPENSSH PRIVATE KEY-----`;
  const key = [armour("BEGIN"), "A".repeat(60), "A".repeat(60), armour("END")].join("\n");

  it.each([
    ["home path", "It broke in /home/someone/work."],
    ["email", "Mail someone@example.com."],
    ["github-pat", `The token ghp_${"a".repeat(36)} leaked.`],
    ["private-key", key],
  ])(
    "refuses a body with a %s by kind and line, never the text, before any gh call",
    (kind, what) => {
      const { dir, argv } = setup(sections(what));
      const r = run(fake(dir), argv, dir);
      expect(r.message).toBe(`the body carries private data: ${kind} on line 2`);
      expect(r.calls).toEqual([]);
    },
  );

  it("refuses a suggested fix, and an area that names no plugin, as usage before any gh call", () => {
    const fix = setup(`${sections("x")}## Suggested fix\nx\n`);
    expect(run(fake(fix.dir), fix.argv, fix.dir).calls).toEqual([]);
    const area = setup(sections("x"));
    const argv = area.argv.map((a) => (a === "qsm-tasks" ? "no-such-plugin" : a));
    const r = run(fake(area.dir), argv, area.dir);
    expect(r.exit).toBe(2);
    expect(r.calls).toEqual([]);
  });

  it("comments on the same feedback while it is open, found by its title, and files none", () => {
    const { dir, argv } = setup(sections("ready skipped task 5."));
    const r = run(fake(dir, { list: "9" }), argv, dir);
    expect(r.message).toBe("#9 commented: the same feedback is open");
    expect(r.calls[1]).toContain('--search "ready skips a task" in:title');
    expect(r.calls.some((c) => c.startsWith("issue create"))).toBe(false);
  });

  it("files a new one as a plain issue with its four labels, making only its area's", () => {
    const { dir, argv } = setup(sections("ready skipped task 5."));
    const created = "https://github.com/qsmark-labs/qsm-marketplace/issues/91";
    const r = run(fake(dir, { list: "", created }), argv, dir);
    expect(r.message).toBe("#91 filed: ready skips a task");
    const made = r.calls.filter((c) => c.startsWith("label create"));
    expect(made).toEqual(["label create area:qsm-tasks --repo qsmark-labs/qsm-marketplace"]);
    expect(r.calls.at(-1)).toBe(
      "issue create --repo qsmark-labs/qsm-marketplace --title ready skips a task --body-file - --label area:qsm-tasks --label feedback --label kind:tool-broken --label from:subagent",
    );
  });
});

describe("qsm-tasks doctor", () => {
  const url = "https://github.com/orgs/qsmark-labs/projects/1";
  const statuses = ["Todo", "In Dev", "Agent Review", "Ready For Human", "Human Review"];
  const allStatuses = [...statuses, "Ready For Test", "In Test", "Blocked", "Done"];
  const labels = [
    "deferred",
    "feedback",
    "kind:tool-broken",
    "kind:tool-missing",
    "kind:wrong-output",
  ];
  const allLabels = [
    ...labels,
    "kind:guidance",
    "kind:agent-mistake",
    "from:user",
    "from:main-agent",
    "from:subagent",
  ];
  const workflows = [
    "Auto-add to project",
    "Auto-add sub-issues to project",
    "Item added to project",
    "Item closed",
    "Pull request linked to issue",
  ];

  /** doctor's read as GitHub answers it, in the shape a recorded answer has. */
  function healthOf(
    fields: { name: string; options: string[] }[],
    more: { template?: boolean } = {},
  ): string {
    const nodes = (list: readonly string[]) => ({ nodes: list.map((name) => ({ name })) });
    const repo = {
      issueTypes: nodes(["Task", "Bug", "Feature"]),
      labels: { pageInfo: { hasNextPage: false }, ...nodes(allLabels) },
      template: more.template === false ? null : { byteSize: 925 },
    };
    const board = {
      url,
      fields: {
        nodes: fields.map((f) => ({
          id: `PVTSSF_${f.name}`,
          name: f.name,
          options: f.options.map((name) => ({ id: name, name, color: "GRAY", description: "" })),
        })),
      },
      workflows: { nodes: workflows.map((name) => ({ name, enabled: true })) },
      views: nodes(["Tasks", "Features"]),
    };
    return JSON.stringify({ data: { repo, board } });
  }

  it("is partial when only what the API cannot read is left", () => {
    const fields = [
      { name: "Status", options: allStatuses },
      { name: "Priority", options: ["P0", "P1", "P2"] },
    ];
    const r = run({ stdout: linked([BOARD]), health: healthOf(fields) }, ["doctor"]);
    expect(r.exit).toBe(0);
    expect(r.message).toContain("manual  workflow Item closed: check it sets Done");
    expect(r.message).not.toContain("failed");
  });

  it("fails a leftover by the web page, never setup, and a missing template", () => {
    const fields = [
      { name: "Status", options: [...allStatuses, "In Progress"] },
      { name: "Priority", options: ["P0", "P1", "P2"] },
      { name: "Epic stage", options: [] },
    ];
    const r = run({ stdout: linked([BOARD]), health: healthOf(fields, { template: false }) }, [
      "doctor",
    ]);
    expect(r.exit).toBe(1);
    expect(r.message).toContain(`failed  field Status: remove In Progress in ${url}/settings`);
    expect(r.message).toContain(`failed  field Epic stage: delete it in ${url}/settings`);
    expect(r.message).toContain("failed  feedback template");
  });
});

describe("qsm-tasks setup", () => {
  const option = (name: string, i: number) => ({
    id: `opt${i}`,
    name,
    color: "GRAY",
    description: "kept",
  });
  /** The read setup shares with doctor, as GitHub answers it: the fields with option ids, labels. */
  function fieldsOf(statuses: string[], priority: string[] | null, labels: string[]): string {
    const status = { id: "PVTSSF_status", name: "Status", options: statuses.map(option) };
    const prio =
      priority === null
        ? []
        : [{ id: "PVTSSF_prio", name: "Priority", options: priority.map(option) }];
    const repo = { labels: { nodes: labels.map((name) => ({ name })) } };
    return JSON.stringify({ data: { repo, board: { fields: { nodes: [status, ...prio] } } } });
  }
  const statuses = ["Todo", "In Dev", "Agent Review", "Ready For Human", "Human Review", "Done"];
  const all = [...statuses.slice(0, 5), "Ready For Test", "In Test", "Blocked", "Done"];
  const labels = [
    "deferred",
    "feedback",
    "kind:tool-broken",
    "kind:tool-missing",
    "kind:wrong-output",
    "kind:guidance",
    "kind:agent-mistake",
    "from:user",
    "from:main-agent",
    "from:subagent",
  ];

  it("adds the missing options keeping each by id, creates Priority and the labels", () => {
    const r = run({ stdout: linked([BOARD]), health: fieldsOf(statuses, null, []) }, ["setup"]);
    expect(r.message).toContain("added to Status: Ready For Test, In Test, Blocked");
    expect(r.message).toContain("created field Priority with P0, P1, P2");
    expect(r.posted).toContain('"id":"opt0","name":"Todo"');
    expect(r.posted).toContain("createProjectV2Field");
    expect(r.calls).toContain("label create deferred --repo qsmark-labs/qsm-marketplace");
  });

  it("creates nothing on a second run and says so", () => {
    const health = fieldsOf(all, ["P0", "P1", "P2"], labels);
    const r = run({ stdout: linked([BOARD]), health }, ["setup"]);
    expect(r.message).toContain("nothing to create");
    expect(r.calls.some((c) => c.includes("--input") || c.startsWith("label create"))).toBe(false);
  });
});
