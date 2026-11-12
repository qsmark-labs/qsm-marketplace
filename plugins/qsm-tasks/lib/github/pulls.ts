// The pull request `human` hands over, read in one query before any write (design.md decision 14):
// GitHub does not link a task's pull request to its issue, so the agent names it.
import { isRecord } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";
import { graphql, type Run, variables } from "./gh.ts";
import { cut, nodes, text } from "./items.ts";
import type { Target } from "./target.ts";

const PULL = `query($repo:ID!,$pr:Int!){node(id:$repo){...on Repository{pullRequest(number:$pr){baseRefName body latestReviews(first:100){pageInfo{hasNextPage} nodes{state}} commits(last:1){nodes{commit{statusCheckRollup{state}}}}}}}}`;

/** Whether the body says `Closes #<n>`, and not only of a number that starts with n. */
function closes(body: string, n: number): boolean {
  const parts = body.toLowerCase().split(`closes #${n}`).slice(1);
  return parts.some((after) => !/^\d/.test(after));
}

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
  if (base !== `feature/${parent}`) {
    return `PR #${pr} is based on ${base ?? "nothing"}, not feature/${parent}`;
  }
  if (!closes(text(pull, "body") ?? "", n)) {
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
  task: { readonly number: number; readonly parent: number | null },
): Promise<Result<null>> {
  if (task.parent === null) {
    return refuse("blocked", "wrong-status", `#${task.number} is under no feature`);
  }
  const answer = await graphql(run, PULL, variables({ repo: target.repoId, pr }));
  if (!answer.ok) {
    return answer;
  }
  const pull = isRecord(answer.value.node) ? answer.value.node.pullRequest : null;
  if (!isRecord(pull)) {
    return refuse("failed", "not-found", `no PR #${pr} in ${target.repo}`);
  }
  if (cut(pull.latestReviews)) {
    return refuse("failed", "refused", `PR #${pr} has over 100 reviews: GitHub cut the list`);
  }
  const why = unready(pull, pr, task.number, task.parent);
  return why === null ? { ok: true, value: null } : refuse("blocked", "wrong-status", why);
}
