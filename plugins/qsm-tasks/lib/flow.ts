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
    name: STATUS.todo,
    means: {
      task: "Not started",
      feature: "Being planned: intent, models, specs",
      feedback: "Filed, not yet read",
    },
  },
  {
    name: STATUS.inDev,
    means: { task: "Claimed and being built", feature: "Split into tasks, built on feature/<n>" },
  },
  {
    name: STATUS.agentReview,
    means: {
      task: "PR open: CI, the gates and the review agent run; each finding is fixed at once, with a reply in its thread and a new review asked",
    },
  },
  {
    name: STATUS.readyForHuman,
    means: { task: "The review agent approved and CI is green: waits for the owner" },
  },
  {
    name: STATUS.humanReview,
    means: {
      task: "The owner reviews and the agent fixes his comments; the review agent is not asked",
    },
  },
  {
    name: STATUS.readyForTest,
    means: { feature: "Every task closed and feature/<n> up to date with main: waits for QA" },
  },
  {
    name: STATUS.inTest,
    means: { feature: "The QA agent runs the scenarios of the cover in a sandbox" },
  },
  { name: STATUS.blocked, means: { feature: "QA found something: a fix task is open" } },
  {
    name: STATUS.done,
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

/** What a guard reads of an issue besides its kind and Status. */
export interface Facts {
  readonly number: number;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  /** the login running the verb */
  readonly caller: string;
  /** null when it has no parent */
  readonly parentOpen: boolean | null;
  readonly openSubIssues: number;
}

/** A move one verb makes: the kinds it takes, the Statuses it starts from, and what else must hold,
 * `when` in words for the table and `holds` as the check that refuses it. */
interface Move {
  readonly verb: string;
  readonly kinds: readonly Kind[];
  readonly from: readonly StatusName[];
  readonly to: StatusName;
  readonly when?: string;
  readonly holds?: (at: Facts) => Result<null>;
}

const HOLDS: Result<null> = { ok: true, value: null };
const S = STATUS;
const REVIEW: readonly StatusName[] = [S.agentReview, S.readyForHuman, S.humanReview];

const MOVES: readonly Move[] = [
  {
    verb: "claim",
    kinds: ["task"],
    from: [S.todo],
    to: S.inDev,
    when: "unassigned or the caller's",
    holds: (at) => {
      const others = at.assignees.filter((login) => login !== at.caller);
      return others.length === 0
        ? HOLDS
        : refuse("blocked", "held", `#${at.number} is held by ${others.join(", ")}`);
    },
  },
  { verb: "unclaim", kinds: ["task"], from: [S.inDev, ...REVIEW], to: S.todo },
  {
    verb: "unclaim",
    kinds: ["task"],
    from: [S.todo],
    to: S.todo,
    when: `labelled ${DEFERRED}`,
    holds: (at) =>
      at.labels.includes(DEFERRED)
        ? HOLDS
        : refuse("blocked", "wrong-status", `#${at.number} is at Todo and not ${DEFERRED}`),
  },
  {
    verb: "review",
    kinds: ["task"],
    from: [S.inDev, S.agentReview, S.humanReview],
    to: S.agentReview,
  },
  {
    verb: "human",
    kinds: ["task"],
    from: [S.agentReview],
    to: S.readyForHuman,
    when: "the PR approved and its checks green",
  },
  { verb: "human --started", kinds: ["task"], from: [S.readyForHuman], to: S.humanReview },
  {
    verb: "reopen",
    kinds: ["task", "feedback"],
    from: [S.done],
    to: S.todo,
    when: "its parent open",
    holds: (at) =>
      at.parentOpen === false
        ? refuse("blocked", "wrong-status", `#${at.number}'s parent is closed`)
        : HOLDS,
  },
  { verb: "plan", kinds: ["feature"], from: [S.inDev, S.readyForTest, S.blocked], to: S.todo },
  {
    verb: "qa",
    kinds: ["feature"],
    from: [S.readyForTest],
    to: S.inTest,
    when: "no open sub-issue",
    holds: (at) =>
      at.openSubIssues === 0
        ? HOLDS
        : refuse(
            "blocked",
            "wrong-status",
            `#${at.number} has ${at.openSubIssues} open sub-issues`,
          ),
  },
];

/** The move `verb` makes on an issue, or why it may not: the kind is not one it takes, the Status
 * is not one it starts from, or what else must hold does not. */
export function moveOf(
  verb: string,
  at: Facts & { readonly kind: Kind | null; readonly status: string | null },
): Result<Move> {
  const { kind, status } = at;
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
  const holds = row.holds?.(at) ?? HOLDS;
  return holds.ok ? { ok: true, value: row } : holds;
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
