// The flow as data (design.md decision 4): the Status and Priority options, what each Status means
// per kind, and the guard of each move, so a verb checks a move against this table and no other
// copy of a name exists in the binary.

const STATUS_NAMES = [
  "Todo",
  "In Dev",
  "Agent Review",
  "Ready For Human",
  "Human Review",
  "Ready For Test",
  "In Test",
  "Blocked",
  "Done",
] as const;
type StatusName = (typeof STATUS_NAMES)[number];

/** Task and Bug share one column; Feedback is the label `feedback`, not an issue type. */
const COLUMNS = [
  { kind: "task", label: "Task and Bug" },
  { kind: "feature", label: "Feature" },
  { kind: "feedback", label: "Feedback" },
] as const;
type Kind = (typeof COLUMNS)[number]["kind"];

interface Status {
  readonly name: StatusName;
  /** what the Status means for each kind; a kind that does not use it is absent */
  readonly means: Partial<Readonly<Record<Kind, string>>>;
}

export const STATUSES: readonly Status[] = [
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

export const PRIORITIES = [
  { name: "P0", means: "Breaks something in use or blocks the work in hand: next" },
  { name: "P1", means: "Needed for the current feature" },
  { name: "P2", means: "Worth doing, no date" },
] as const;

/** A move one verb makes: the kinds it takes, the Statuses it starts from, what else must hold. */
interface Move {
  readonly verb: string;
  readonly kinds: readonly ("task" | "bug" | "feature" | "feedback")[];
  readonly from: readonly StatusName[];
  readonly to: StatusName;
  readonly when?: string;
}

const REVIEW: readonly StatusName[] = ["Agent Review", "Ready For Human", "Human Review"];

export const MOVES: readonly Move[] = [
  {
    verb: "claim",
    kinds: ["task", "bug"],
    from: ["Todo"],
    to: "In Dev",
    when: "unassigned or the caller's",
  },
  { verb: "unclaim", kinds: ["task", "bug"], from: ["In Dev", ...REVIEW], to: "Todo" },
  {
    verb: "unclaim",
    kinds: ["task", "bug"],
    from: ["Todo"],
    to: "Todo",
    when: "labelled deferred",
  },
  {
    verb: "review",
    kinds: ["task", "bug"],
    from: ["In Dev", "Agent Review", "Human Review"],
    to: "Agent Review",
  },
  {
    verb: "human",
    kinds: ["task", "bug"],
    from: ["Agent Review"],
    to: "Ready For Human",
    when: "the PR approved and its checks green",
  },
  {
    verb: "human --started",
    kinds: ["task", "bug"],
    from: ["Ready For Human"],
    to: "Human Review",
  },
  {
    verb: "reopen",
    kinds: ["task", "bug", "feedback"],
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
export function renderFlow(): string {
  const statuses = STATUSES.flatMap((s) => [
    s.name,
    // a kind with no meaning for this Status does not use it
    ...rows(COLUMNS.map((c) => [`  ${c.label}`, s.means[c.kind] ?? "not used"])),
  ]);
  const moves = rows(
    MOVES.map((m) => [
      `  ${m.verb}`,
      m.kinds.join(", "),
      `${m.from.join(", ")} -> ${m.to}`,
      m.when === undefined ? "" : `when ${m.when}`,
    ]),
  );
  const priorities = rows(PRIORITIES.map((p) => [`  ${p.name}`, p.means]));
  return ["Statuses", ...statuses, "", "Moves", ...moves, "", "Priorities", ...priorities].join(
    "\n",
  );
}
