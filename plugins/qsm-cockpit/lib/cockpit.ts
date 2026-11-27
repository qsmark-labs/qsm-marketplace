// The cockpit's rules, apart from its wiring: the six stages and what each asks, how a model maps to
// its tier and colour, how a tool call is said short, and what an answered question records.
import type { Decision, Stage, StageStep, Task } from "../types/state.d.ts";

export const STAGES: Stage[] = ["LOAD", "PLAN", "EXECUTE", "VERIFY", "LEARN", "CLOSE"];

/** The chip colour of each model tier; its keys are the tiers. */
export const TIER_COLOR: Readonly<Record<string, string>> = Object.fromEntries([
  ["haiku", "green"],
  ["sonnet", "cyan"],
  ["opus", "magenta"],
  ["fable", "yellow"],
]);

/** How an agent's turn ended, said as the pane says it. */
export const OUTCOME_WORD: Readonly<Record<string, string>> = {
  answer: "done",
  aborted: "stopped",
  refusal: "refused",
  error: "failed",
};

/** Each stage as the one sentence its switch answers: what the stage is, and where the loop goes next. */
const GUIDE: Record<Stage, { does: string; next: Stage }> = {
  LOAD: {
    does: "read the notes for this tree, the ready tasks and the governing spec",
    next: "PLAN",
  },
  PLAN: { does: "settle what to build; a fix goes straight to EXECUTE", next: "EXECUTE" },
  EXECUTE: { does: "make the change", next: "VERIFY" },
  VERIFY: {
    does: "run the real path and read its output; a failure goes back to EXECUTE",
    next: "LEARN",
  },
  LEARN: { does: "fix the cause of each retry and each correction where it lives", next: "CLOSE" },
  CLOSE: { does: "close the task and push when the work is done", next: "LOAD" },
};

// differs: hooks sandbox (the hooks module imports this file, and root lib/ is out of its reach)
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The tasks in a list of issues: each entry that has an id and a title. */
export function tasksOf(issues: unknown): Task[] {
  return Array.isArray(issues)
    ? issues.flatMap((issue: unknown) =>
        isRecord(issue) && typeof issue.id === "string" && typeof issue.title === "string"
          ? [{ id: issue.id, title: issue.title }]
          : [],
      )
    : [];
}

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as string[]).includes(value);
}

/** The tier word of a model alias or id (`claude-sonnet-5-5` is sonnet), else the model itself. */
export function tierOf(model: string): string {
  return Object.keys(TIER_COLOR).find((tier) => model.includes(tier)) ?? model;
}

/** What the stage tool answers: the stage's one sentence. */
export function guideText(stage: Stage): string {
  const { does, next } = GUIDE[stage];
  return `You are in ${stage}: ${does}; next ${next}.`;
}

/** The one line every prompt carries, so the main chat always knows where it stands. */
export function reminderText(step: StageStep | undefined, now: number): string {
  if (step === undefined) {
    return "qsm stage: not said yet.";
  }
  const note = step.why === "" ? "" : `, ${step.why}`;
  return `qsm stage: ${step.stage} (${seconds(now - step.at)}${note}); next ${GUIDE[step.stage].next}.`;
}

/** A duration said short: `42s`, `3m05s`. */
export function seconds(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

/** The column the current stage starts at in the stage line (` LOAD ›` is seven), so its note sits under it. */
export function offsetOf(current: Stage | undefined): number {
  const at = current === undefined ? 0 : STAGES.indexOf(current);
  return STAGES.slice(0, at).reduce((sum, stage) => sum + stage.length + 3, 0) + 1;
}

/** A path said by its last part, anything else as it is. */
function shortArg(value: string): string {
  return value.includes("/") && !value.includes(" ") ? (value.split("/").pop() ?? value) : value;
}

/** A tool call said short, as the state of whoever made it: `Bash sleep 30`, `Edit register.tsx`. */
export function doingOf(tool: string, args: Record<string, unknown>): string {
  const pick = ["command", "file_path", "pattern", "skill", "description", "url", "query"]
    .map((key) => args[key])
    .find((value): value is string => typeof value === "string");
  const name = tool.includes("__") ? (tool.split("__").pop() ?? tool) : tool;
  if (pick === undefined) {
    return name;
  }
  const short = tool === "Bash" ? bare(pick) : shortArg(pick);
  return `${name} ${short.replaceAll(/\s+/g, " ").slice(0, 48)}`;
}

/**
 * A shell command without what only frames it: a leading `cd <dir> &&`, `set -o …;`, a wrapping
 * subshell, and trailing `2>&1`, `| tee …` or `> file`. `cd /tmp && (sleep 30 && echo done) 2>&1 |
 * tee x.log` is `sleep 30 && echo done`.
 */
function bare(command: string): string {
  let rest = command.trim();
  for (let before = ""; before !== rest;) {
    before = rest;
    rest = rest
      .replace(/^cd\s+\S+\s*(&&|;)\s*/, "")
      .replace(/^set\s+[-+]\S+(\s+\S+)?\s*(&&|;)\s*/, "")
      .replace(/\s*\|\s*tee\s+\S+\s*$/, "")
      .replace(/\s*\d?>&\d\s*$/, "")
      .replace(/\s*\d?>>?\s*\S+\s*$/, "")
      .replace(/^\((.*)\)$/, "$1")
      .trim();
  }
  return rest;
}

/** The decisions one AskUserQuestion call made: each question it asked that has an answer. */
export function decisionsOf(
  args: Record<string, unknown>,
  result: unknown,
  ask: string,
  at: number,
): Decision[] {
  const answers = isRecord(result) && isRecord(result.answers) ? result.answers : {};
  const asked: unknown[] = Array.isArray(args.questions) ? args.questions : [];
  return asked.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.question !== "string") {
      return [];
    }
    const { question } = entry;
    const answer = answers[question];
    return typeof answer === "string" ? [{ ask, question, answer, at }] : [];
  });
}

/** The task ids a shell command closes with `br close`. */
export function closedIds(command: string): string[] {
  return [...command.matchAll(/\bbr close\s+([\w.-]+(?:\s+[\w.-]+)*)/g)]
    .flatMap((match) => (match[1] ?? "").split(/\s+/))
    .filter((id) => /^[a-z]+-\w/.test(id));
}

/** A typed prompt said as the title of its decisions. */
export function askTitle(text: string): string {
  return text.trim().replaceAll(/\s+/g, " ").slice(0, 200);
}
