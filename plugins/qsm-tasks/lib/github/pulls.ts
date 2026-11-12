// The pull request `human` hands over, read in one query before any write (design.md decision 14):
// GitHub does not link a task's pull request to its issue, so the agent names it.
import { isRecord } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";
import { featureBranch } from "../flow.ts";
import { graphql, type Run, variables } from "./gh.ts";
import { nodes, text } from "./items.ts";
import type { Target } from "./target.ts";

// latestReviews holds one review per reviewer, so twenty is more than a task's PR ever has
const PULL = `query($repo:ID!,$pr:Int!){node(id:$repo){...on Repository{pullRequest(number:$pr){baseRefName body latestReviews(first:20){nodes{state}} commits(last:1){nodes{commit{statusCheckRollup{state}}}}}}}}`;

/** What keeps PR `pr` from being task `n`'s ready pull request, or null when nothing does. */
function unready(
  pull: Record<string, unknown>,
  pr: number,
  n: number,
  parent: number,
): string | null {
  const base = text(pull, "baseRefName");
  const states = nodes(pull.latestReviews).map((r) => text(r, "state"));
  const commit: unknown = nodes(pull.commits)[0];
  const rollup =
    isRecord(commit) && isRecord(commit.commit) ? commit.commit.statusCheckRollup : null;
  const checks = text(rollup, "state") ?? "not reported";
  if (base !== featureBranch(parent)) {
    return `PR #${pr} is based on ${base ?? "nothing"}, not ${featureBranch(parent)}`;
  }
  // every number the body closes, whole: `Closes #50` is 50, never 5
  const closed = [...(text(pull, "body") ?? "").matchAll(/\bcloses #(\d+)/gi)].map((m) => m[1]);
  if (!closed.includes(String(n))) {
    return `PR #${pr} does not say Closes #${n}`;
  }
  if (checks !== "SUCCESS") {
    return `PR #${pr}'s checks are ${checks}, not green`;
  }
  // no approval is asked for: nobody approves on GitHub before Ready For Human (decision 14)
  return states.includes("CHANGES_REQUESTED") ? `PR #${pr} has a review asking for changes` : null;
}

/** PR `pr` is task `n`'s, under feature `parent`, green, with no changes asked; else `blocked`. */
export async function readyPull(
  run: Run,
  target: Target,
  pr: number,
  n: number,
  parent: number,
): Promise<Result<null>> {
  const answer = await graphql(run, PULL, variables({ repo: target.repoId, pr }));
  if (!answer.ok) {
    return answer;
  }
  const pull = isRecord(answer.value.node) ? answer.value.node.pullRequest : null;
  if (!isRecord(pull)) {
    return refuse("failed", "not-found", `no PR #${pr} in ${target.repo}`);
  }
  const why = unready(pull, pr, n, parent);
  return why === null ? { ok: true, value: null } : refuse("blocked", "wrong-status", why);
}
