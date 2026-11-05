// The kinds a snapshot can be: the built-in json, and every kind another plugin installed from a
// manifest. qsm-docs knows nothing of a kind's format; it runs the kind's commands.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { isRecord, messageOf, UsageError } from "../../../../lib/outcome.ts";
import type { Env } from "../../../../lib/paths.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import { docsDir } from "../store/where.ts";
import { convertJson, diffJson } from "./json.ts";

export interface Kind {
  readonly name: string;
  /** the plugin that installed it, named when it is gone */
  readonly plugin: string;
  readonly mediaType: string;
  readonly ext: string;
  /** the kept copy of its page directory; null for json, whose page is inside the binary */
  readonly pages: string | null;
  /** the document as JSON text; throws `failed` with the converter's message */
  readonly convert: (bytes: Uint8Array) => string;
  /** what the kind's diff printed for the files `a` and `b`, not yet checked */
  readonly diff: (a: string, b: string) => unknown;
}

/** What `kind add` reads; `convert` and `diff` are argv with `{file}`, `{a}` and `{b}` in them. */
interface Manifest {
  readonly name: string;
  readonly plugin: string;
  readonly mediaType: string;
  readonly ext: string;
  readonly pages: string;
  readonly convert: readonly string[];
  readonly diff: readonly string[];
}

const JSON_KIND: Kind = {
  name: "json",
  plugin: "qsm-docs",
  mediaType: "application/json",
  ext: "json",
  pages: null,
  convert: (bytes) => {
    try {
      return convertJson(new TextDecoder().decode(bytes));
    } catch (error) {
      throw new QsmError("failed", `json: the file is not JSON: ${messageOf(error)}`);
    }
  },
  diff: (a, b) => diffJson(readFileSync(a, "utf8"), readFileSync(b, "utf8")),
};

const kindsDir = (env: Env): string => join(docsDir(env), ".kinds");

/** One of a kind's commands, with its placeholders filled; its stdout, or a throw naming it. */
function run(kind: string, argv: readonly string[], fill: Record<string, string>): string {
  const args = argv.map((a) =>
    Object.entries(fill).reduce((s, [key, value]) => s.replaceAll(`{${key}}`, value), a),
  );
  const [cmd = "", ...rest] = args;
  const r = spawnSync(cmd, rest, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.error !== undefined) {
    throw new QsmError("missing", `${kind}: ${cmd} could not run: ${r.error.message}`, {
      next: `install what provides ${cmd}, or add the kind ${kind} again`,
    });
  }
  if (r.status !== 0) {
    const said = (r.stderr.trim() || r.stdout.trim()).slice(0, 2000);
    throw new QsmError("failed", `${kind}: ${args.join(" ")} exited ${r.status}: ${said}`);
  }
  return r.stdout;
}

/** What a kind's command printed, parsed; `failed` names the kind and the command when it is no
 * JSON. */
function parsedJson(kind: string, what: string, out: string): unknown {
  try {
    const parsed: unknown = JSON.parse(out);
    return parsed;
  } catch (error) {
    throw new QsmError(
      "failed",
      `${kind}: the ${what} printed no JSON: ${messageOf(error)}: ${out.slice(0, 200)}`,
    );
  }
}

function installedKind(m: Manifest, pages: string): Kind {
  return {
    name: m.name,
    plugin: m.plugin,
    mediaType: m.mediaType,
    ext: m.ext,
    pages,
    convert: (bytes) => {
      const dir = mkdtempSync(join(tmpdir(), "qsm-docs-convert-"));
      try {
        const file = join(dir, `snapshot.${m.ext}`);
        writeFileSync(file, bytes);
        const out = run(m.name, m.convert, { file });
        parsedJson(m.name, "converter", out);
        return out;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    diff: (a, b) => parsedJson(m.name, "diff", run(m.name, m.diff, { a, b })),
  };
}

const NAME = /^[a-z][a-z0-9-]*$/;

/** A manifest's fields, each checked; `usage` names the first that is wrong. */
function parseManifest(raw: unknown, file: string): Manifest {
  if (!isRecord(raw)) {
    throw new UsageError(`${file}: a kind manifest is a JSON object`);
  }
  const text = (key: string, shape = /./): string => {
    const value = raw[key];
    if (typeof value !== "string" || !shape.test(value)) {
      throw new UsageError(`${file}: "${key}" is missing or not a ${shape.source} string`);
    }
    return value;
  };
  const argv = (key: string): string[] => {
    const value = raw[key];
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every((v): v is string => typeof v === "string")
    ) {
      throw new UsageError(`${file}: "${key}" is missing or not a list of argv strings`);
    }
    return value;
  };
  return {
    name: text("name", NAME),
    plugin: text("plugin"),
    mediaType: text("mediaType", /^[\w.+-]+\/[\w.+-]+$/),
    ext: text("ext", /^[a-z0-9]+$/),
    pages: text("pages"),
    convert: argv("convert"),
    diff: argv("diff"),
  };
}

/** The kind named, or `missing` naming it and, when known, the plugin that installs it. */
export function kindOf(name: string, env: Env, plugin?: string): Kind {
  if (name === JSON_KIND.name) {
    return JSON_KIND;
  }
  const dir = join(kindsDir(env), name);
  const file = join(dir, "manifest.json");
  let text: string | null = null;
  try {
    text = name.includes("/") || name.startsWith(".") ? null : readFileSync(file, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  if (text === null) {
    throw new QsmError("missing", `the kind ${name} is not installed`, {
      next:
        plugin === undefined
          ? `install the plugin that adds the kind ${name}; qsm-docs kind list shows what is installed`
          : `install ${plugin}, whose installer adds the kind ${name}`,
    });
  }
  return installedKind(parseManifest(JSON.parse(text), file), join(dir, "pages"));
}

export interface KindRow {
  readonly name: string;
  readonly plugin: string;
  readonly mediaType: string;
  readonly ext: string;
}

const rowOf = (k: Kind): KindRow => ({
  name: k.name,
  plugin: k.plugin,
  mediaType: k.mediaType,
  ext: k.ext,
});

/** Installs the manifest's kind with its own copy of the page directory, replacing an earlier one. */
export function addKind(file: string, env: Env): KindRow {
  const path = resolve(file);
  if (!existsSync(path)) {
    throw new UsageError(`${file}: no such manifest`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new UsageError(`${file}: not JSON: ${messageOf(error)}`);
  }
  const manifest = parseManifest(raw, file);
  if (manifest.name === JSON_KIND.name) {
    throw new UsageError(`${file}: json is built in and cannot be replaced`);
  }
  const pages = resolve(dirname(path), manifest.pages);
  if (!existsSync(join(pages, "index.html"))) {
    throw new UsageError(`${file}: the page directory ${pages} holds no index.html`);
  }
  const dir = join(kindsDir(env), manifest.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(pages, join(dir, "pages"), { recursive: true });
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify({ ...manifest, pages: "pages" })}\n`);
  return rowOf(kindOf(manifest.name, env));
}

/** json, then every installed kind by name. */
export function listKinds(env: Env): KindRow[] {
  const dir = kindsDir(env);
  const names = existsSync(dir) ? readdirSync(dir).toSorted() : [];
  return [JSON_KIND, ...names.map((name) => kindOf(name, env))].map(rowOf);
}

/** Removes an installed kind and its page files; its snapshots stay. */
export function removeKind(name: string, env: Env): KindRow {
  if (name === JSON_KIND.name) {
    throw new UsageError("json is built in and cannot be removed");
  }
  const row = rowOf(kindOf(name, env));
  rmSync(join(kindsDir(env), name), { recursive: true, force: true });
  return row;
}
