#!/usr/bin/env bun

// qsm-docs: an immutable store of document snapshots, the kinds other plugins install, and the
// page server on 127.0.0.1 where an edit becomes a proposal.

import { readFileSync } from "node:fs";
import {
  flagArg,
  type Handler,
  optionalNumber,
  optionalString,
  requiredString,
  runCli,
} from "../../../lib/cli-base.ts";
import { checkTools, doctorVerdict, ok } from "../../../lib/outcome.ts";
import { parseManifest } from "../../../lib/qsm-manifest.ts";
import { untilStopped } from "../../../lib/loopback.ts";
import manifestJson from "../qsm.json" with { type: "json" };

const manifest = parseManifest(manifestJson, "qsm-docs/qsm.json");
const env = process.env;

/** One row per line, its fields two spaces apart. */
const table = (rows: readonly (readonly string[])[]): string =>
  rows.map((r) => r.join("  ")).join("\n");

const get: Handler = async (call) => {
  const { entryOf, readSnapshot } = await import("../lib/store/store.ts");
  const { entry, bytes } = readSnapshot(env, entryOf(env, requiredString(call, "id")));
  if (call.json) {
    return ok({ ...entry, content: new TextDecoder().decode(bytes) });
  }
  // the bytes exactly as they were created, with no newline of ours after them
  await Bun.write(Bun.stdout, bytes);
  return ok();
};

const create: Handler = async (call) => {
  const { createSnapshot, entryOf } = await import("../lib/store/store.ts");
  const { whereOf } = await import("../lib/store/where.ts");
  const file = requiredString(call, "file");
  const parent = optionalString(call, "parent");
  const where = whereOf(process.cwd(), {
    project: optionalString(call, "project"),
    branch: optionalString(call, "branch"),
  });
  const entry = createSnapshot(env, {
    kind: requiredString(call, "kind"),
    bytes: readFileSync(file),
    parent: parent === undefined ? null : entryOf(env, parent),
    where,
    by: "cli",
  });
  return ok(entry, entry.id);
};

const list: Handler = async (call) => {
  const { listSnapshots } = await import("../lib/store/store.ts");
  const project = requiredString(call, "project");
  const entries = listSnapshots(env, project, {
    branch: optionalString(call, "branch"),
    kind: optionalString(call, "kind"),
    open: flagArg(call, "open"),
  });
  const rows = entries.map((e) => [e.id, e.kind, e.branch, e.time, e.parent ?? "-", e.by]);
  return ok(entries, rows.length === 0 ? `${project}: no snapshots` : table(rows));
};

const diff: Handler = async (call) => {
  const { diffSnapshots } = await import("../lib/store/store.ts");
  const changes = diffSnapshots(env, requiredString(call, "id"), optionalString(call, "other"));
  return ok(
    changes,
    changes.length === 0 ? "no change" : changes.map((c) => `${c.op} ${c.element}`).join("\n"),
  );
};

const remove: Handler = async (call) => {
  const { deleteSnapshot } = await import("../lib/store/store.ts");
  const entry = deleteSnapshot(env, requiredString(call, "id"));
  return ok(entry, `deleted ${entry.id}`);
};

const kindAdd: Handler = async (call) => {
  const { addKind } = await import("../lib/kinds/kind.ts");
  const row = addKind(requiredString(call, "manifest"), env);
  return ok(row, `added the kind ${row.name} (${row.mediaType}) of ${row.plugin}`);
};

const kindList: Handler = async () => {
  const { listKinds } = await import("../lib/kinds/kind.ts");
  const rows = listKinds(env);
  return ok(rows, table(rows.map((r) => [r.name, r.mediaType, r.ext, r.plugin])));
};

const kindRemove: Handler = async (call) => {
  const { removeKind } = await import("../lib/kinds/kind.ts");
  const row = removeKind(requiredString(call, "name"), env);
  return ok(row, `removed the kind ${row.name}; its snapshots stay`);
};

const DEFAULT_PORT = 4748;

const serve: Handler = async (call) => {
  const { serveDocs } = await import("../lib/serve/serve.ts");
  const { whereOf } = await import("../lib/store/where.ts");
  const where = whereOf(process.cwd(), {
    project: optionalString(call, "project"),
    branch: optionalString(call, "branch"),
  });
  const served = serveDocs(env, where, optionalNumber(call, "port") ?? DEFAULT_PORT);
  // Status goes to stderr: stdout stays the outcome, as under --json.
  process.stderr.write(
    `serving ${where.project} on ${where.branch} at ${served.url} (Ctrl-C stops it)\n`,
  );
  await untilStopped();
  await served.stop();
  return ok({ url: served.url }, `stopped ${served.url}`);
};

if (import.meta.main) {
  process.exit(
    await runCli(manifest, "qsm-docs", {
      doctor: () =>
        doctorVerdict(
          "qsm-docs",
          checkTools([{ cmd: "git", hint: "install git: the project and branch come from it" }]),
        ),
      get,
      create,
      list,
      diff,
      delete: remove,
      "kind add": kindAdd,
      "kind list": kindList,
      "kind remove": kindRemove,
      serve,
    }),
  );
}
