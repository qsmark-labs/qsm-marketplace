// feedback files a finding about the marketplace as a plain issue of its repository, whatever the
// checkout it runs in: abstract, in the template's sections, with no private data and no fix.

import { join } from "node:path";
import { type Call, requiredString } from "../../../lib/cli-base.ts";
import { isRecord, type Outcome, ok, UsageError } from "../../../lib/outcome.ts";
import { refuse, type Result } from "../lib/failure.ts";
import { FROM, KINDS, labelsOf, MARKETPLACE, privateData, sectionsWrong } from "../lib/feedback.ts";
import { comment, file, label } from "../lib/github/board.ts";
import { connect, type Run } from "../lib/github/gh.ts";
import { search } from "../lib/github/items.ts";
import { resolveTarget, type Target } from "../lib/github/target.ts";
import { readText } from "./create.ts";

/** The checkout feedback lands in, the one QSM_MARKETPLACE names. */
function checkout(): Result<string> {
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

/** The plugins of the checkout's marketplace.json, by name. */
async function pluginsOf(path: string): Promise<Result<string[]>> {
  const listed = await readText(join(path, ".claude-plugin", "marketplace.json"));
  if (!listed.ok) {
    return listed;
  }
  const parsed: unknown = JSON.parse(listed.value);
  const plugins = isRecord(parsed) && Array.isArray(parsed.plugins) ? parsed.plugins : [];
  return {
    ok: true,
    value: plugins.flatMap((p) => (isRecord(p) && typeof p.name === "string" ? [p.name] : [])),
  };
}

/** The values the call gives, each one feedback's rules allow, or a wrong call. */
function valuesOf(
  call: Call,
  plugins: readonly string[],
): { area: string; kind: string; from: string } {
  const [area, kind, from] = [
    requiredString(call, "area"),
    requiredString(call, "kind"),
    requiredString(call, "from"),
  ];
  const wrong: [string, string, readonly string[]][] = [
    ["--area", area, [MARKETPLACE, ...plugins]],
    ["--kind", kind, KINDS],
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

/** The same feedback still open gets the body as a comment; a new one is filed with its labels. */
async function post(
  run: Run,
  target: Target,
  title: string,
  body: string,
  labels: string[],
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
  for (const name of labels) {
    const made = await label(run, target, name);
    if (!made.ok) {
      return made;
    }
  }
  const flags = labels.flatMap((name) => ["--label", name]);
  const filed = await file(run, target, { kind: "feedback", title, body, flags });
  return filed.ok ? { ok: true, value: `#${filed.value} filed: ${title}` } : filed;
}

/** Everything the call names, checked before any gh call: the checkout, the values, the body. */
async function prepare(
  call: Call,
): Promise<Result<{ path: string; labels: string[]; body: string }>> {
  const path = checkout();
  if (!path.ok) {
    return path;
  }
  const plugins = await pluginsOf(path.value);
  if (!plugins.ok) {
    return plugins;
  }
  const { area, kind, from } = valuesOf(call, plugins.value);
  const body = await bodyOf(call);
  return body.ok
    ? {
        ok: true,
        value: { path: path.value, labels: labelsOf(area, kind, from), body: body.value },
      }
    : body;
}

export async function feedback(call: Call): Promise<Outcome> {
  const given = await prepare(call);
  if (!given.ok) {
    return given.outcome;
  }
  const { path, labels, body } = given.value;
  const gh = connect(path);
  if (!gh.ok) {
    return gh.outcome;
  }
  const target = await resolveTarget(gh.value, { repo: undefined, project: undefined });
  if (!target.ok) {
    return target.outcome;
  }
  const title = requiredString(call, "title");
  const posted = await post(gh.value, target.value, title, body, labels);
  return posted.ok ? ok({ title }, posted.value) : posted.outcome;
}
