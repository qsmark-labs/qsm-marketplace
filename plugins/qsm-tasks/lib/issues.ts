// gh's issue list as the verb prints it.
import { isRecord } from "../../../lib/outcome.ts";
import { QsmError } from "../../../lib/qsm-error.ts";

export interface Issue {
  readonly number: number;
  readonly title: string;
  /** the Status on the first board the issue is on, null when on none */
  readonly status: string | null;
}

function issueOf(row: unknown, at: string): Issue {
  if (
    !isRecord(row) ||
    typeof row.number !== "number" ||
    typeof row.title !== "string" ||
    !Array.isArray(row.projectItems)
  ) {
    throw new QsmError("failed", `gh issue list: ${at} is not { number, title, projectItems }`);
  }
  const first: unknown = row.projectItems[0];
  if (first === undefined) {
    return { number: row.number, title: row.title, status: null };
  }
  const status = isRecord(first) ? first.status : undefined;
  if (!isRecord(status) || typeof status.name !== "string") {
    throw new QsmError("failed", `gh issue list: ${at}.projectItems[0].status.name is not text`);
  }
  return { number: row.number, title: row.title, status: status.name };
}

/** The issues in the stdout of `gh issue list --json number,title,projectItems`. */
export function parseIssues(stdout: string): Issue[] {
  const rows: unknown = JSON.parse(stdout);
  if (!Array.isArray(rows)) {
    throw new QsmError("failed", "gh issue list: output is not an array");
  }
  return rows.map((row, i) => issueOf(row, `[${i}]`));
}

/** One line: `#<number>`, the Status or `no status`, the title, tab-separated. */
export function lineOf(issue: Issue): string {
  return `#${issue.number}\t${issue.status ?? "no status"}\t${issue.title}`.replaceAll(
    /[\r\n]+/g,
    " ",
  );
}
