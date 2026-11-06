// qsm-docs' function-hooks module: the noun, `$.docs`; the line that tells the agent of a proposal
// the owner saved in the browser; and the guard that denies the agent `qsm-docs delete` and any
// write to the store's files. The
// open proposals are the `list --open` verb's; the guard's decision is deleteRefusal in lib/.

import type { EngineInterface, On } from "claude-code";
import { deleteRefusal, type Homes } from "../lib/delete-guard.ts";
import { docsIn, ledgerIn } from "../lib/store/layout.ts";
import { failure, registerNoun } from "./noun.generated.ts";

/** What this session has already named, kept in the plugin's store until the session ends. */
const named = (session: string): string => `sessions/${session}`;

/** What a session remembers: the ledger as it last read it, and the proposals it named. */
interface Seen {
  readonly ledger: string;
  readonly ids: readonly string[];
}

function seenOf(value: unknown): Seen | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const ledger: unknown = Reflect.get(value, "ledger");
  const ids: unknown = Reflect.get(value, "ids");
  return typeof ledger === "string" && Array.isArray(ids)
    ? { ledger, ids: ids.map(String) }
    : undefined;
}

/** The two variables the store's place is read from, as the session sees them. */
async function homesOf($: EngineInterface): Promise<Homes> {
  return { home: await $.env.get("HOME"), xdg: await $.env.get("XDG_DATA_HOME") };
}

/** The project's ledger as `<mtime>:<size>`, or `none` before its first snapshot: what changes
 * whenever a snapshot is created or deleted, so an unchanged one needs no `list`. The layout below
 * the data directory is the binary's own (lib/store/layout.ts); the data directory itself is root
 * lib's dataDir, which the sandbox cannot import, so its one rule is written here: `$XDG_DATA_HOME`,
 * else `~/.local/share`. */
async function ledgerMark($: EngineInterface, project: string): Promise<string> {
  const { xdg, home } = await homesOf($);
  if (xdg === undefined && home === undefined) {
    throw new Error("neither XDG_DATA_HOME nor HOME is set, so the store cannot be found");
  }
  const data = xdg ?? `${home}/.local/share`;
  const ledger = ledgerIn(docsIn(data), project);
  if (!(await $.fs.exists(ledger))) {
    return "none";
  }
  const stat = await $.fs.stat(ledger);
  return `${stat.mtimeMs}:${stat.size}`;
}

/** The id and kind of each snapshot `list --json` answered. */
function proposalsOf(data: unknown): { id: string; kind: string }[] {
  if (!Array.isArray(data)) {
    throw new TypeError(`qsm-docs list answered ${JSON.stringify(data).slice(0, 120)}, not a list`);
  }
  const rows: unknown[] = data;
  return rows.map((row) => {
    const id: unknown = typeof row === "object" && row !== null ? Reflect.get(row, "id") : null;
    const kind: unknown = typeof row === "object" && row !== null ? Reflect.get(row, "kind") : null;
    if (typeof id !== "string" || typeof kind !== "string") {
      throw new TypeError(`qsm-docs list answered a row without an id and a kind`);
    }
    return { id, kind };
  });
}

export function register(on: On): void {
  registerNoun(on);

  // The engine adds hidden context only to a prompt, so the session's first prompt carries the
  // line a start owes: every open proposal; each later prompt names only the new ones. A prompt
  // whose project ledger did not change since the last one runs no `list` and writes nothing.
  on("prompt.submit", async ($, e, next) => {
    const repo = await $.session.repo();
    if (repo === null) {
      return next(e);
    }
    const project = repo.root.split("/").at(-1) ?? repo.root;
    const key = named(await $.session.id());
    const before = seenOf(await $.store.get(key));
    const ledger = await ledgerMark($, project);
    if (before?.ledger === ledger) {
      return next(e);
    }
    const open = ledger === "none" ? [] : proposalsOf(await $.docs.list({ project, open: true }));
    const seen = new Set(before?.ids ?? []);
    const fresh = open.filter((p) => !seen.has(p.id));
    await $.store.set(key, { ledger, ids: [...seen, ...fresh.map((p) => p.id)] });
    if (fresh.length === 0) {
      return next(e);
    }
    const lines =
      before === undefined
        ? [
            `qsm-docs: open proposals of ${project}: ${fresh.map((p) => `${p.id} (${p.kind})`).join(", ")}; read each with qsm-docs get and qsm-docs diff`,
          ]
        : fresh.map(
            (p) =>
              `qsm-docs: the owner saved a proposal, ${p.id} (${p.kind}); read it with qsm-docs get ${p.id} and qsm-docs diff ${p.id}, and apply it with --parent ${p.id}`,
          );
    return next({ ...e, context: [...(e.context ?? []), ...lines] });
  }).catch(($, e, next) => {
    failure($, "prompt.submit", next.error);
    return next(e);
  });

  on("session.end", async ($, e, next) => {
    await $.store.delete(named(e.sessionId));
    return next(e);
  }).catch(($, e, next) => {
    failure($, "session.end", next.error);
    return next(e);
  });

  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    const refusal = deleteRefusal(e.command, await homesOf($));
    return refusal === null ? next(e) : { deny: refusal };
  }).catch(($, _e, next) => {
    const reason = failure($, "tool.call", next.error);
    return { deny: `qsm-docs: the delete guard failed (${reason}); the call was not run` };
  });
}
