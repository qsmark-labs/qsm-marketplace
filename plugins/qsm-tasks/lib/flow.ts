// The flow as data (design.md decision 4): the Status and Priority options, what each Status means
// per kind, and the guard of each move, so a verb checks a move against this table and no other
// copy of a name exists in the binary.
import { type Outcome, ok } from "../../../lib/outcome.ts";
import { refuse, type Result } from "./failure.ts";

/** The Status options by what a verb asks for; the rows below name them with the same words. */
export const STATUS = {
  todo: "Todo",
  inDev: "In Dev",
  agentReview: "Agent Review",
  readyForHuman: "Ready For Human",
  humanReview: "Human Review",
  readyForTest: "Ready For Test",
  inTest: "In Test",
  blocked: "Blocked",
  done: "Done",
} as const;
type StatusName = (typeof STATUS)[keyof typeof STATUS];

/** The label that keeps a task out of `ready` until it is brought back. */
export const DEFERRED = "deferred";

/** The label that binds a feature to its change (design.md decision 7). */
export function changeLabel(id: string): string {
  return `change:${id}`;
}

/** The kinds the flow tells apart: an issue of type Task or Bug is the kind `task`, because the
 * flow treats them alike; Feedback is the label `feedback`, not an issue type. */
const KIND_LABELS = { task: "Task and Bug", feature: "Feature", feedback: "Feedback" } as const;
export type Kind = keyof typeof KIND_LABELS;
/** the order of the table's columns */
const KINDS: readonly Kind[] = ["task", "feature", "feedback"];

interface Status {
  readonly name: StatusName;
  /** what the Status means for each kind; a kind that does not use it is absent */
  readonly means: Partial<Readonly<Record<Kind, string>>>;
}

const STATUSES: readonly Status[] = [
  {
    name: "Todo",
    means: {
      task: "Not started",
      feature: "Being planned: intent, models, specs",
      feedback: "Filed, not yet read",
    },
  },
  {
    name: "In Dev",
    means: { task: "Claimed and being built", feature: "Split into tasks, built on feature/<n>" },
  },
  {
    name: "Agent Review",
    means: {
      task: "PR open: CI, the gates and the review agent run; each finding is fixed at once, with a reply in its thread and a new review asked",
    },
  },
  {
    name: "Ready For Human",
    means: { task: "The review agent approved and CI is green: waits for the owner" },
  },
  {
    name: "Human Review",
    means: {
      task: "The owner reviews and the agent fixes his comments; the review agent is not asked",
    },
  },
  {
    name: "Ready For Test",
    means: { feature: "Every task closed and feature/<n> up to date with main: waits for QA" },
  },
  {
    name: "In Test",
    means: { feature: "The QA agent runs the scenarios of the cover in a sandbox" },
  },
  { name: "Blocked", means: { feature: "QA found something: a fix task is open" } },
  {
    name: "Done",
    means: {
      task: "Merged into feature/<n> by the owner with Closes #N",
      feature: "The owner merged the feature pull request into main",
      feedback: "Read and settled",
    },
  },
];

const PRIORITIES = [
  { name: "P0", means: "Breaks something in use or blocks the work in hand: next" },
  { name: "P1", means: "Needed for the current feature" },
  { name: "P2", means: "Worth doing, no date" },
] as const;

/** Where a Priority sorts: P0 first, an issue with none after P2. */
export function priorityRank(name: string | null): number {
  const at = PRIORITIES.findIndex((p) => p.name === name);
  return at === -1 ? PRIORITIES.length : at;
}

/** A move one verb makes: the kinds it takes, the Statuses it starts from, what else must hold. */
interface Move {
  readonly verb: string;
  readonly kinds: readonly Kind[];
  readonly from: readonly StatusName[];
  readonly to: StatusName;
  readonly when?: string;
}

const REVIEW: readonly StatusName[] = ["Agent Review", "Ready For Human", "Human Review"];

const MOVES: readonly Move[] = [
  {
    verb: "claim",
    kinds: ["task"],
    from: ["Todo"],
    to: "In Dev",
    when: "unassigned or the caller's",
  },
  { verb: "unclaim", kinds: ["task"], from: ["In Dev", ...REVIEW], to: "Todo" },
  {
    verb: "unclaim",
    kinds: ["task"],
    from: ["Todo"],
    to: "Todo",
    when: "labelled deferred",
  },
  {
    verb: "review",
    kinds: ["task"],
    from: ["In Dev", "Agent Review", "Human Review"],
    to: "Agent Review",
  },
  {
    verb: "human",
    kinds: ["task"],
    from: ["Agent Review"],
    to: "Ready For Human",
    when: "the PR approved and its checks green",
  },
  {
    verb: "human --started",
    kinds: ["task"],
    from: ["Ready For Human"],
    to: "Human Review",
  },
  {
    verb: "reopen",
    kinds: ["task", "feedback"],
    from: ["Done"],
    to: "Todo",
    when: "its parent open",
  },
  { verb: "plan", kinds: ["feature"], from: ["In Dev", "Ready For Test", "Blocked"], to: "Todo" },
  {
    verb: "qa",
    kinds: ["feature"],
    from: ["Ready For Test"],
    to: "In Test",
    when: "no open sub-issue",
  },
];

/** The move `verb` makes on an issue of `kind` at `status`, or why it may not: the kind is not
 * one it takes, or the Status is not one it starts from. What `when` adds the verb checks. */
export function moveOf(verb: string, kind: Kind | null, status: string | null): Result<Move> {
  const moves = MOVES.filter((m) => m.verb === verb);
  if (kind === null || !moves.some((m) => m.kinds.includes(kind))) {
    const takes = [...new Set(moves.flatMap((m) => m.kinds))].map((k) => KIND_LABELS[k]);
    const is = kind === null ? "an issue of no kind" : KIND_LABELS[kind];
    return refuse("blocked", "wrong-kind", `${verb} takes ${takes.join(", ")}, not ${is}`);
  }
  const row = moves.find((m) => m.kinds.includes(kind) && m.from.some((from) => from === status));
  if (row === undefined) {
    const from = [...new Set(moves.flatMap((m) => m.from))].join(", ");
    return refuse(
      "blocked",
      "wrong-status",
      `${verb} needs ${from}; it is at ${status ?? "no Status"}`,
    );
  }
  return { ok: true, value: row };
}

function rows(table: readonly (readonly string[])[]): string[] {
  const widths = table.reduce<number[]>(
    (w, row) => row.map((cell, i) => Math.max(w[i] ?? 0, cell.length)),
    [],
  );
  return table.map((row) =>
    row
      .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0)))
      .join("  ")
      .trimEnd(),
  );
}

/** The table as a person reads it: each Status per kind, each move with its guard, the Priorities. */
function renderFlow(): string {
  const statuses = STATUSES.flatMap((s) => [
    s.name,
    // a kind with no meaning for this Status does not use it
    ...rows(KINDS.map((kind) => [`  ${KIND_LABELS[kind]}`, s.means[kind] ?? "not used"])),
  ]);
  const moves = rows(
    MOVES.map((m) => [
      `  ${m.verb}`,
      m.kinds.map((kind) => KIND_LABELS[kind]).join(", "),
      `${m.from.join(", ")} -> ${m.to}`,
      m.when === undefined ? "" : `when ${m.when}`,
    ]),
  );
  const priorities = rows(PRIORITIES.map((p) => [`  ${p.name}`, p.means]));
  return ["Statuses", ...statuses, "", "Moves", ...moves, "", "Priorities", ...priorities].join(
    "\n",
  );
}

/** What `flow` ends with: the tables as data, and as text for a person. */
export function flowOutcome(): Outcome {
  return ok({ statuses: STATUSES, moves: MOVES, priorities: PRIORITIES }, renderFlow());
}
