// feedback files a finding about the marketplace as a plain issue of its repository, whatever the
// checkout it runs in: abstract, in the template's sections, with no private data and no fix.

import { join } from "node:path";
import { type Call, requiredString } from "../../../lib/cli-base.ts";
import { isRecord, type Outcome, ok, UsageError } from "../../../lib/outcome.ts";
import { refuse, type Result } from "../lib/failure.ts";
import { FEEDBACK_KINDS, FROM, MARKETPLACE, privateData, sectionsWrong } from "../lib/feedback.ts";
import { readText } from "../lib/files.ts";
import { comment, file } from "../lib/github/board.ts";
import type { Run } from "../lib/github/gh.ts";
import { search } from "../lib/github/items.ts";
import type { Target } from "../lib/github/target.ts";

/** The checkout feedback lands in, the one QSM_MARKETPLACE names: gh runs in it. */
export function checkout(): Result<string> {
  const path = process.env.QSM_MARKETPLACE;
  return path === undefined || path === ""
    ? refuse(
        "missing",
        "no-repo",
        "QSM_MARKETPLACE names no marketplace checkout",
        "set QSM_MARKETPLACE",
      )
    : { ok: true, value: path };
}

/** The plugin names a marketplace.json lists, or null when it is no JSON with a plugins list. */
function namesIn(text: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const plugins = isRecord(parsed) && Array.isArray(parsed.plugins) ? parsed.plugins : null;
    return (
      plugins?.flatMap((p) => (isRecord(p) && typeof p.name === "string" ? [p.name] : [])) ?? null
    );
  } catch {
    return null;
  }
}

/** The plugins of the checkout's marketplace.json, by name. */
async function pluginsOf(path: string): Promise<Result<string[]>> {
  const at = join(path, ".claude-plugin", "marketplace.json");
  const listed = await readText(at);
  if (!listed.ok) {
    return listed;
  }
  const names = namesIn(listed.value);
  return names === null
    ? refuse("missing", "no-repo", `${at} lists no plugins`, "set QSM_MARKETPLACE")
    : { ok: true, value: names };
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

/** The same feedback still open gets the body as a comment; a new one is filed with its labels, of
 * which it makes only its area's: setup makes `feedback`, `kind:*` and `from:*`. */
async function post(
  run: Run,
  target: Target,
  title: string,
  body: string,
  { area, kind, from }: Values,
): Promise<Result<string>> {
  const open = await search(run, target, { open: true, label: "feedback" });
  if (!open.ok) {
    return open;
  }
  const same = open.value.find((item) => item.title === title);
  if (same !== undefined) {
    const said = await comment(run, target, same.number, body);
    return said.ok
      ? { ok: true, value: `#${same.number} commented: the same feedback is open` }
      : said;
  }
  const flags = ["feedback", `kind:${kind}`, `from:${from}`].flatMap((name) => ["--label", name]);
  const make = [`area:${area}`];
  const filed = await file(run, target, { kind: "feedback", title, body, flags, make });
  return filed.ok ? { ok: true, value: `#${filed.value} filed: ${title}` } : filed;
}

/** The call checked against the checkout onBoard ran gh in: its values, then its body. */
async function prepare(call: Call): Promise<Result<{ values: Values; body: string }>> {
  const path = checkout();
  const plugins = path.ok ? await pluginsOf(path.value) : path;
  if (!plugins.ok) {
    return plugins;
  }
  const values = valuesOf(call, plugins.value);
  const body = await bodyOf(call);
  return body.ok ? { ok: true, value: { values, body: body.value } } : body;
}

export async function feedback(
  call: Call,
  { run, target }: { run: Run; target: Target },
): Promise<Outcome> {
  const given = await prepare(call);
  if (!given.ok) {
    return given.outcome;
  }
  const title = requiredString(call, "title");
  const posted = await post(run, target, title, given.value.body, given.value.values);
  return posted.ok ? ok({ title }, posted.value) : posted.outcome;
}
