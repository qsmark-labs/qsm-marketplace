// The store: one read-only file per snapshot, holding its bytes exactly, and one append-only ledger
// per project that gives the order and the sha256 proving no snapshot ever changed.
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { isRecord, UsageError } from "../../../../lib/outcome.ts";
import type { Env } from "../../../../lib/paths.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import { type Change, changesOf } from "../kinds/change.ts";
import { kindOf } from "../kinds/kind.ts";
import { ledgerIn, projectsIn } from "./layout.ts";
import { docsDir, type Where } from "./where.ts";

/** One snapshot as its ledger line records it. */
export interface Entry {
  readonly id: string;
  readonly kind: string;
  /** the plugin that installed the kind, named when the kind is gone */
  readonly plugin: string;
  readonly ext: string;
  readonly project: string;
  readonly branch: string;
  readonly time: string;
  readonly parent: string | null;
  readonly sha256: string;
  readonly by: "page" | "cli";
}

type Line =
  | { readonly op: "create"; readonly entry: Entry }
  | { readonly op: "delete"; readonly id: string; readonly time: string };

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** A project's directory; `usage` for a name that is no single directory name. */
function projectDir(env: Env, project: string): string {
  if (project === "" || project === "." || project === ".." || project.includes("/")) {
    throw new UsageError(`"${project}" is not a project name`);
  }
  return join(projectsIn(docsDir(env)), project);
}

const ledgerOf = (env: Env, project: string): string => {
  projectDir(env, project);
  return ledgerIn(docsDir(env), project);
};

const fileOf = (env: Env, e: Entry): string => join(projectDir(env, e.project), `${e.id}.${e.ext}`);

/** A ledger line read back; `failed` names the file and the line when it is torn or no line of
 * ours. */
function lineOf(text: string, where: string): Line {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  if (
    isRecord(raw) &&
    raw.op === "delete" &&
    typeof raw.id === "string" &&
    typeof raw.time === "string"
  ) {
    return { op: "delete", id: raw.id, time: raw.time };
  }
  if (!(isRecord(raw) && raw.op === "create" && isEntry(raw))) {
    throw new QsmError("failed", `${where} is not a ledger line of qsm-docs`);
  }
  return { op: "create", entry: raw };
}

const TEXT_FIELDS = ["id", "kind", "plugin", "ext", "project", "branch", "time", "sha256"];

/** Whether a create line holds every field of an entry, each of its type. */
function isEntry(raw: Record<string, unknown>): raw is Record<string, unknown> & Entry {
  return (
    TEXT_FIELDS.every((key) => typeof raw[key] === "string") &&
    (raw.by === "page" || raw.by === "cli") &&
    (raw.parent === null || typeof raw.parent === "string")
  );
}

function readLedger(env: Env, project: string): Line[] {
  const file = ledgerOf(env, project);
  if (!existsSync(file)) {
    return [];
  }
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l !== "")
    .map((l, i) => lineOf(l, `${file}:${i + 1}`));
}

/** The snapshots of a project that were not deleted, in the order they were created. */
function liveEntries(env: Env, project: string): Entry[] {
  const lines = readLedger(env, project);
  const deleted = new Set(lines.flatMap((l) => (l.op === "delete" ? [l.id] : [])));
  return lines.flatMap((l) => (l.op === "create" && !deleted.has(l.entry.id) ? [l.entry] : []));
}

/** The projects the store holds. */
function projects(env: Env): string[] {
  const root = projectsIn(docsDir(env));
  return existsSync(root) ? readdirSync(root) : [];
}

/** Finds snapshots for one call, reading each project's ledger at most once. */
export interface Lookup {
  /** the live snapshot `id` in any project, or `missing` */
  readonly entry: (id: string) => Entry;
  /** a project's live snapshots in the order they were created */
  readonly live: (project: string) => Entry[];
}

/** A lookup that reads the projects an id starts with first, longest name first: the id is never
 * parsed, but its own project holds it, so a torn ledger of another project does not stop it. */
export function lookupIn(env: Env): Lookup {
  const read = new Map<string, Entry[]>();
  const live = (project: string): Entry[] => {
    const known = read.get(project) ?? liveEntries(env, project);
    read.set(project, known);
    return known;
  };
  const entry = (id: string): Entry => {
    const all = projects(env);
    const named = all.filter((p) => id.startsWith(`${p}-`)).toSorted((a, b) => b.length - a.length);
    for (const project of [...named, ...all.filter((p) => !named.includes(p))]) {
      const found = live(project).find((e) => e.id === id);
      if (found !== undefined) {
        return found;
      }
    }
    throw new QsmError("missing", `no snapshot ${id} in the store`, {
      next: "qsm-docs list <project> names the snapshots there are",
    });
  };
  return { entry, live };
}

/** The live snapshot `id` in any project, or `missing`. */
export const entryOf = (env: Env, id: string): Entry => lookupIn(env).entry(id);

/** A snapshot's bytes, checked against the sha256 recorded at create. */
export function readSnapshot(
  env: Env,
  entry: Entry,
): { entry: Entry; bytes: Uint8Array; file: string } {
  const { id } = entry;
  const file = fileOf(env, entry);
  if (!existsSync(file)) {
    throw new QsmError(
      "failed",
      `${id}: its file ${file} is gone, though the ledger never recorded a delete`,
    );
  }
  const bytes = readFileSync(file);
  const now = sha256(bytes);
  if (now !== entry.sha256) {
    throw new QsmError(
      "failed",
      `${id}: the file changed after create: sha256 ${now}, recorded ${entry.sha256}`,
    );
  }
  return { entry, bytes, file };
}

/** `20261104T173012345Z`: UTC to the millisecond. */
const stampOf = (d: Date): string => d.toISOString().replaceAll(/[-:.]/g, "");

export interface CreateRequest {
  readonly kind: string;
  readonly bytes: Uint8Array;
  readonly parent: Entry | null;
  readonly where: Where;
  readonly by: "page" | "cli";
}

/** Converts, then stores the bytes read-only and appends the ledger line; nothing is stored when
 * the converter refuses or the id exists. The caller resolves the parent. */
export function createSnapshot(env: Env, req: CreateRequest): Entry {
  const kind = kindOf(req.kind, env);
  kind.convert(req.bytes);
  const now = new Date();
  const entry: Entry = {
    id: `${req.where.project}-${req.where.branch.replaceAll("/", "_")}-${stampOf(now)}`,
    kind: kind.name,
    plugin: kind.plugin,
    ext: kind.ext,
    project: req.where.project,
    branch: req.where.branch,
    time: now.toISOString(),
    parent: req.parent?.id ?? null,
    sha256: sha256(req.bytes),
    by: req.by,
  };
  mkdirSync(projectDir(env, entry.project), { recursive: true });
  try {
    writeFileSync(fileOf(env, entry), req.bytes, { flag: "wx", mode: 0o444 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new QsmError("blocked", `the id ${entry.id} exists; nothing was stored`, {
        next: "run the create again",
      });
    }
    throw error;
  }
  appendFileSync(ledgerOf(env, entry.project), `${JSON.stringify({ op: "create", ...entry })}\n`);
  return entry;
}

export interface ListFilter {
  readonly branch?: string | undefined;
  readonly kind?: string | undefined;
  readonly open?: boolean;
}

/** A project's snapshots newest first; `open` keeps the page-made ones no snapshot names as parent. */
export function listSnapshots(env: Env, project: string, filter: ListFilter = {}): Entry[] {
  const live = liveEntries(env, project);
  const parents = new Set(live.map((e) => e.parent));
  return live
    .filter(
      (e) =>
        (filter.branch === undefined || e.branch === filter.branch) &&
        (filter.kind === undefined || e.kind === filter.kind) &&
        (filter.open !== true || (e.by === "page" && !parents.has(e.id))),
    )
    .toReversed();
}

/** Removes the snapshot's file and records the delete. */
export function deleteSnapshot(env: Env, id: string): Entry {
  const entry = entryOf(env, id);
  rmSync(fileOf(env, entry), { force: true });
  appendFileSync(
    ledgerOf(env, entry.project),
    `${JSON.stringify({ op: "delete", id, time: new Date().toISOString() })}\n`,
  );
  return entry;
}

/** The changes from the parent (or `other`) to `id`, through the kind of `id`. */
export function diffSnapshots(env: Env, id: string, other?: string): Change[] {
  const lookup = lookupIn(env);
  const b = readSnapshot(env, lookup.entry(id));
  const againstId = other ?? b.entry.parent;
  if (againstId === null) {
    throw new UsageError(`${id} has no parent: name a second snapshot to compare it with`);
  }
  const a = readSnapshot(env, lookup.entry(againstId));
  if (other !== undefined && a.entry.kind !== b.entry.kind) {
    throw new UsageError(
      `${other} is ${a.entry.kind} and ${id} is ${b.entry.kind}: two snapshots named must share a kind`,
    );
  }
  const kind = kindOf(b.entry.kind, env, b.entry.plugin);
  return changesOf(kind.name, kind.diff(a.file, b.file));
}
