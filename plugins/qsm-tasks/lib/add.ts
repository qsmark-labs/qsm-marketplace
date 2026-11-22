// Filing an issue, and making it a sub-issue of another.
import { QsmError } from "../../../lib/qsm-error.ts";
import { runGh } from "./gh.ts";

/** The issue number at the end of the URL `gh issue create` prints. */
export function issueNumberOf(stdout: string): number {
  const match = /\/issues\/(\d+)\s*$/.exec(stdout);
  if (match?.[1] === undefined) {
    throw new QsmError("failed", `gh issue create: no issue URL in: ${stdout}`);
  }
  return Number(match[1]);
}

/** Files the issue and returns its number; with `parent`, makes it that issue's sub-issue. */
export function addIssue(title: string, bodyFile: string, parent: number | undefined): number {
  const number = issueNumberOf(
    runGh(["issue", "create", "--title", title, "--body-file", bodyFile]),
  );
  if (parent !== undefined) {
    const id = runGh(["api", `repos/{owner}/{repo}/issues/${number}`, "--jq", ".id"]).trim();
    if (!/^\d+$/.test(id)) {
      throw new QsmError("failed", `gh api issues/${number}: id is not a number: ${id}`);
    }
    runGh([
      "api",
      "-X",
      "POST",
      `repos/{owner}/{repo}/issues/${parent}/sub_issues`,
      "-F",
      `sub_issue_id=${id}`,
    ]);
  }
  return number;
}
