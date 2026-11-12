// The pull request `human` hands over, read in one query before any write (design.md decision 14):
// GitHub does not link a task's pull request to its issue, so the agent names it.
import { isRecord } from "../../../../lib/outcome.ts";
import { refuse, type Result } from "../failure.ts";
import { featureBranch } from "../flow.ts";
import { graphql, type Run, variables } from "./gh.ts";
import { nodes, text, whole } from "./items.ts";
import type { Target } from "./target.ts";

// latestReviews holds one review per reviewer, so twenty is more than a task's PR ever has; a list
// that is cut is refused all the same, as a change request past it would go unseen
const PULL = `query($repo:ID!,$pr:Int!){node(id:$repo){...on Repository{pullRequest(number:$pr){state baseRefName body headRefOid latestReviews(first:20){pageInfo{hasNextPage} nodes{state commit{oid}}} commits(last:1){nodes{commit{statusCheckRollup{state}}}}}}}}`;

/** Whether a review asks for changes on the head; one on an older commit was answered by the
 * commits after it, and stays in latestReviews until its author reviews again (decision 14). */
function changesAsked(pull: Record<string, unknown>): boolean {
  const head = text(pull, "headRefOid");
  return nodes(pull.latestReviews).some(
    (r) =>
      text(r, "state") === "CHANGES_REQUESTED" && isRecord(r) && text(r.commit, "oid") === head,
  );
}

/** What keeps PR `pr` from being task `n`'s ready pull request, the first of them, or null when
 * nothing does. No approval is asked for: nobody approves on GitHub before Ready For Human. */
function unready(
  pull: Record<string, unknown>,
  pr: number,
  n: number,
  parent: number,
): string | null {
  const [state, base] = [text(pull, "state"), text(pull, "baseRefName")];
  const branch = featureBranch(parent);
  // every number the body closes, whole: `Closes #50` is 50, never 5
  const closed = [...(text(pull, "body") ?? "").matchAll(/\bcloses #(\d+)/gi)].map((m) => m[1]);
  const commit: unknown = nodes(pull.commits)[0];
  const rollup =
    isRecord(commit) && isRecord(commit.commit) ? commit.commit.statusCheckRollup : null;
  const checks = text(rollup, "state") ?? "not reported";
  const faults: [boolean, string][] = [
    [state !== "OPEN", `PR #${pr} is ${state?.toLowerCase() ?? "in no state"}, not open`],
    [base !== branch, `PR #${pr} is based on ${base ?? "nothing"}, not ${branch}`],
    [!closed.includes(String(n)), `PR #${pr} does not say Closes #${n}`],
    [checks !== "SUCCESS", `PR #${pr}'s checks are ${checks}, not green`],
    [changesAsked(pull), `PR #${pr} has a review asking for changes on its head`],
  ];
  return faults.find(([fails]) => fails)?.[1] ?? null;
}

/** PR `pr` is open, task `n`'s under feature `parent`, green, with no changes asked on its head;
 * else `blocked`. */
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
  if (!whole(pull.latestReviews)) {
    return refuse(
      "failed",
      "refused",
      `the reviews of PR #${pr} came back cut or without their page check`,
    );
  }
  const why = unready(pull, pr, n, parent);
  return why === null ? { ok: true, value: null } : refuse("blocked", "wrong-status", why);
}
