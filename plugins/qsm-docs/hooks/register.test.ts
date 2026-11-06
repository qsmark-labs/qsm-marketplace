// `claude plugin test plugins/qsm-docs` drives register.tsx against the engine itself: which prompt
// carries which proposal line, the session's store and its removal, and the delete guard.
// `qsm-docs list` itself is proved by scripts/serve.test.ts and the guard's line forms by
// lib/delete-guard.test.ts. `process.run`, `session.*`, `store.*`, `env.get`, `fs.*` and `ui.*`
// are host operations,
// so the test supplies them with `on(<name>, ...)` returning `{ value }`.
import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";
import { printed, recordingHost } from "./host.generated.ts";

interface Row {
  readonly id: string;
  readonly kind: string;
}

/** The host: a checkout of `demo`, session `s1`, an in-memory store, the project's ledger at
 * `/data/qsm-docs/projects/demo/ledger.jsonl` with the size in `ledger` (none at 0), and `qsm-docs list`
 * answering whatever `open` holds when it runs, or failing when `fails`. */
function host(on: On, open: Row[], { inRepo = true, fails = false } = {}) {
  const store = new Map<string, unknown>();
  const seen = Object.assign(
    recordingHost(on, () =>
      fails ? printed("missing", 4, "qsm-docs is not on PATH") : printed("ok", 0, "", open),
    ),
    { store, tools: 0, ledger: { size: 100 } },
  );
  on("env.get", (_$, e) => ({ value: e.name === "XDG_DATA_HOME" ? "/data" : undefined }));
  on("fs.exists", (_$, e) => ({
    value: e.path === "/data/qsm-docs/projects/demo/ledger.jsonl" && seen.ledger.size > 0,
  }));
  on("fs.stat", () => ({
    value: { kind: "file", size: seen.ledger.size, mtimeMs: seen.ledger.size, isLink: false },
  }));
  on("prompt.submit", (_$, e) => ({ text: e.text, context: e.context }));
  on("session.end", (_$, e) => ({ sessionId: e.sessionId }));
  on("tool.call", () => {
    seen.tools += 1;
    return { result: "ran" };
  });
  on("session.id", () => ({ value: "s1" }));
  on("session.repo", () => ({
    value: inRepo ? { root: "/src/demo", remote: null, internal: false, name: null } : null,
  }));
  on("store.get", (_$, e) => ({ value: store.get(e.key) }));
  on("store.set", (_$, e) => {
    store.set(e.key, e.value);
    return { value: undefined };
  });
  on("store.delete", (_$, e) => {
    store.delete(e.key);
    return { value: undefined };
  });
  return seen;
}

/** What a person typing a prompt submits. */
const PROMPT = { text: "hello", wait: false, origin: { kind: "composer" } } as const;

const A = { id: "demo-main-20261104T173012345Z", kind: "json" };
const B = { id: "demo-main-20261104T180000000Z", kind: "json" };

test("the first prompt names every open proposal in one line; a later prompt with none adds nothing", async ($, on) => {
  const seen = host(on, [A]);

  const first = await $.prompt.submit(PROMPT);
  const second = await $.prompt.submit(PROMPT);

  expect(seen.runs).toEqual(["qsm-docs list demo --open --json"]);
  expect(first.context).toEqual([
    `qsm-docs: open proposals of demo: ${A.id} (json); read each with qsm-docs get and qsm-docs diff`,
  ]);
  expect(second.context).toBeUndefined();
});

test("a proposal saved while the session runs is named once on the next prompt", async ($, on) => {
  const open: Row[] = [];
  const seen = host(on, open);

  const before = await $.prompt.submit(PROMPT);
  open.push(B);
  seen.ledger.size += 200;
  const next = await $.prompt.submit(PROMPT);
  const after = await $.prompt.submit(PROMPT);

  expect(before.context).toBeUndefined();
  expect(next.context).toHaveLength(1);
  expect(next.context?.[0]).toContain(`saved a proposal, ${B.id} (json)`);
  expect(after.context).toBeUndefined();
  expect(seen.runs).toHaveLength(2);
});

test("a project with no ledger yet runs no list and is named as new once it has one", async ($, on) => {
  const open: Row[] = [];
  const seen = host(on, open);
  seen.ledger.size = 0;

  const first = await $.prompt.submit(PROMPT);
  open.push(A);
  seen.ledger.size = 100;
  const next = await $.prompt.submit(PROMPT);

  expect(first.context).toBeUndefined();
  expect(seen.runs).toEqual(["qsm-docs list demo --open --json"]);
  expect(next.context?.[0]).toContain(`saved a proposal, ${A.id} (json)`);
});

test("a session outside a repository runs nothing and says nothing", async ($, on) => {
  const seen = host(on, [A], { inRepo: false });

  const r = await $.prompt.submit(PROMPT);

  expect(seen.runs).toEqual([]);
  expect(r.context).toBeUndefined();
});

test("the session's end removes what it named", async ($, on) => {
  const seen = host(on, [A]);

  await $.prompt.submit(PROMPT);
  expect([...seen.store.keys()]).toEqual(["sessions/s1"]);
  await $.session.end({
    reason: "other",
    sessionId: "s1",
    resume: { id: "s1" },
  });

  expect([...seen.store.keys()]).toEqual([]);
});

test("a list that fails toasts the error and the prompt goes on unchanged", async ($, on) => {
  const seen = host(on, [A], { fails: true });

  const r = await $.prompt.submit(PROMPT);

  expect(r.context).toBeUndefined();
  expect(seen.toasts[0]).toMatch(/^qsm-docs ERROR: prompt\.submit:/);
});

test("a delete over Bash is denied before it runs, an rtk prefix included, and names the owner's command", async ($, on) => {
  const seen = host(on, []);

  const denied = await $.tool.call({ tool: "Bash", command: `rtk qsm-docs delete ${A.id}` });
  const listed = await $.tool.call({ tool: "Bash", command: "qsm-docs list demo --open" });

  expect(denied.deny).toContain(`! qsm-docs delete ${A.id}`);
  expect(listed.result).toBe("ran");
  expect(seen.tools).toBe(1);
});

test("a write under the session's store is denied naming the same command; a read runs", async ($, on) => {
  const seen = host(on, []);
  const rm = "rm -rf /data/qsm-docs/projects/demo";

  const denied = await $.tool.call({ tool: "Bash", command: rm });
  const read = await $.tool.call({ tool: "Bash", command: "cat /data/qsm-docs/projects/demo/x" });

  expect(denied.deny).toContain(`! ${rm}`);
  expect(read.result).toBe("ran");
  expect(seen.tools).toBe(1);
});
