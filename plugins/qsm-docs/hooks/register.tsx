// qsm-docs' function-hooks module: the noun, `$.docs`; the line that tells the agent of a proposal
// the owner saved in the browser; and the guard that denies the agent a snapshot delete. The
// open proposals are the `list --open` verb's; the guard's decision is deleteRefusal in lib/.

import type { On } from "claude-code";
import { deleteRefusal } from "../lib/delete-guard.ts";
import { failure, registerNoun } from "./noun.generated.ts";

/** What this session has already named, kept in the plugin's store until the session ends. */
const named = (session: string): string => `sessions/${session}`;

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
  // line a start owes: every open proposal; each later prompt names only the new ones.
  on("prompt.submit", async ($, e, next) => {
    const repo = await $.session.repo();
    if (repo === null) {
      return next(e);
    }
    const project = repo.root.split("/").at(-1) ?? repo.root;
    const open = proposalsOf(await $.docs.list({ project, open: true }));
    const key = named(await $.session.id());
    const before: unknown = await $.store.get(key);
    const seen = new Set(Array.isArray(before) ? before.map(String) : []);
    const fresh = open.filter((p) => !seen.has(p.id));
    await $.store.set(key, [...seen, ...fresh.map((p) => p.id)]);
    if (fresh.length === 0) {
      return next(e);
    }
    const lines = Array.isArray(before)
      ? fresh.map(
          (p) =>
            `qsm-docs: the owner saved a proposal, ${p.id} (${p.kind}); read it with qsm-docs get ${p.id} and qsm-docs diff ${p.id}, and apply it with --parent ${p.id}`,
        )
      : [
          `qsm-docs: open proposals of ${project}: ${fresh.map((p) => `${p.id} (${p.kind})`).join(", ")}; read each with qsm-docs get and qsm-docs diff`,
        ];
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

  on("tool.call", { tool: "Bash" }, ($, e, next) => {
    const refusal = deleteRefusal(e.command);
    return refusal === null ? next(e) : { deny: refusal };
  }).catch(($, _e, next) => {
    const reason = failure($, "tool.call", next.error);
    return { deny: `qsm-docs: the delete guard failed (${reason}); the call was not run` };
  });
}
