// feedback files a finding about the marketplace as a plain issue of its repository, whatever the
// checkout it runs in: abstract, in the template's sections, with no private data and no fix.

import { join } from "node:path";
import { type Call, requiredString } from "../../../lib/cli-base.ts";
import { isRecord, type Outcome, ok, UsageError } from "../../../lib/outcome.ts";
import { refuse, type Result } from "../lib/failure.ts";
import { FEEDBACK_KINDS, FROM, MARKETPLACE, privateData, sectionsWrong } from "../lib/feedback.ts";
import { readText } from "../lib/files.ts";
import { comment, file } from "../lib/github/board.ts";
import { connect, gh, type Run } from "../lib/github/gh.ts";
import { text } from "../lib/github/items.ts";

/** The checkout feedback lands in, the one QSM_MARKETPLACE names: gh runs in it. */
function checkout(): Result<string> {
  const path = process.env.QSM_MARKETPLACE;
  return path === undefined || path === ""
    ? refuse("missing", "no-repo", "QSM_MARKETPLACE is unset", "set QSM_MARKETPLACE")
    : { ok: true, value: path };
}

/** The plugins of the checkout's marketplace.json, by name; a file that is missing, no JSON, or
 * lists no plugins says the path is no marketplace checkout. */
async function pluginsOf(path: string): Promise<Result<string[]>> {
  const at = join(path, ".claude-plugin", "marketplace.json");
  const parsed: unknown = await Bun.file(at)
    .json()
    .catch(() => null);
  const plugins: unknown = isRecord(parsed) ? parsed.plugins : null;
  return Array.isArray(plugins)
    ? { ok: true, value: plugins.flatMap((p: unknown) => text(p, "name") ?? []) }
    : refuse("missing", "no-repo", `${at} lists no plugins`, "set QSM_MARKETPLACE");
}

/** The labels' values a feedback names: where, what and who. */
type Values = Readonly<Record<"area" | "kind" | "from", string>>;

/** The values the call gives, each one feedback's rules allow, or a wrong call. */
function valuesOf(call: Call, plugins: readonly string[]): Values {
  const [area, kind, from] = [
    requiredString(call, "area"),
    requiredString(call, "kind"),
    requiredString(call, "from"),
  ];
  const wrong: [string, string, readonly string[]][] = [
    ["--area", area, [MARKETPLACE, ...plugins]],
    ["--kind", kind, FEEDBACK_KINDS],
    ["--from", from, FROM],
  ];
  for (const [flag, value, allowed] of wrong) {
    if (!allowed.includes(value)) {
      throw new UsageError(`${flag} ${value}: one of ${allowed.join(", ")}`);
    }
  }
  return { area, kind, from };
}

/** The body, read and checked: the template's sections and no other, and no private data. */
async function bodyOf(call: Call): Promise<Result<string>> {
  const body = await readText(requiredString(call, "bodyFile"));
  if (!body.ok) {
    return body;
  }
  const sections = sectionsWrong(body.value);
  if (sections !== null) {
    throw new UsageError(sections);
  }
  const found = privateData(body.value);
  return found === null
    ? body
    : refuse("blocked", "private-data", `the body carries private data: ${found}`);
}

/** The number of the open feedback of exactly this title, or "": the query names the title. */
function sameOpen(run: Run, repo: string, title: string): Promise<Result<string>> {
  const exact = JSON.stringify(title);
  const list = ["issue", "list", "--repo", repo, "--state", "open", "--label", "feedback"];
  const jq = `map(select(.title == ${exact}))[0].number // empty`;
  return gh(run, [...list, "--search", `${exact} in:title`, "--json", "number,title", "--jq", jq]);
}

/** The same feedback still open gets the body as a comment; a new one is filed with its labels, of
 * which it makes only its area's: setup makes `feedback`, `kind:*` and `from:*`. */
async function post(run: Run, repo: string, title: string, given: Given): Promise<Result<string>> {
  const { body, values } = given;
  const same = await sameOpen(run, repo, title);
  if (!same.ok) {
    return same;
  }
  if (same.value !== "") {
    const said = await comment(run, { repo }, Number(same.value), body);
    return said.ok
      ? { ok: true, value: `#${same.value} commented: the same feedback is open` }
      : said;
  }
  const labels = ["feedback", `kind:${values.kind}`, `from:${values.from}`];
  const [flags, make] = [labels.flatMap((name) => ["--label", name]), [`area:${values.area}`]];
  const filed = await file(run, { repo }, { kind: "feedback", title, body, flags, make });
  return filed.ok ? { ok: true, value: `#${filed.value} filed: ${title}` } : filed;
}

type Given = Readonly<{ path: string; values: Values; body: string }>;

/** Everything the call names, checked before any gh call: the checkout, the values, the body. */
async function prepare(call: Call): Promise<Result<Given>> {
  const path = checkout();
  if (!path.ok) {
    return path;
  }
  const plugins = await pluginsOf(path.value);
  if (!plugins.ok) {
    return plugins;
  }
  const values = valuesOf(call, plugins.value);
  const found = privateData(requiredString(call, "title"));
  if (found !== null) {
    return refuse("blocked", "private-data", `the title carries private data: ${found}`);
  }
  const body = await bodyOf(call);
  return body.ok ? { ok: true, value: { path: path.value, values, body: body.value } } : body;
}

/** Checks the call, then runs gh in the marketplace checkout on its repository; no board. */
export async function feedback(call: Call): Promise<Outcome> {
  const given = await prepare(call);
  if (!given.ok) {
    return given.outcome;
  }
  const run = connect(given.value.path);
  if (!run.ok) {
    return run.outcome;
  }
  const view = ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"];
  const repo = await gh(run.value, view);
  if (!repo.ok) {
    return repo.outcome;
  }
  const title = requiredString(call, "title");
  const posted = await post(run.value, repo.value, title, given.value);
  return posted.ok ? ok({ title }, posted.value) : posted.outcome;
}
