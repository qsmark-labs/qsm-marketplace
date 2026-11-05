// The page server behind `qsm-docs serve`: the page shell, each kind's page in a frame, and the API
// those pages read and save through. It listens on 127.0.0.1 only, answers only a loopback Host,
// takes a save only from its own pages, and every response forbids the browser anything else.

import { existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import {
  fromLoopbackHost,
  fromOwnPage,
  jsonResponse as json,
  listenLoopback,
  reply,
} from "../../../../lib/loopback.ts";
import { isRecord, type OutcomeCode, UsageError } from "../../../../lib/outcome.ts";
import type { Env } from "../../../../lib/paths.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import { kindOf } from "../kinds/kind.ts";
import {
  createSnapshot,
  entryOf,
  listSnapshots,
  readSnapshot,
  readStore,
  type Entry,
} from "../store/store.ts";
import type { Where } from "../store/where.ts";
import { JSON_PAGE, SHELL_ASSETS, shellPage, indexPage, notFoundPage } from "./shell.ts";

export interface Served {
  readonly url: string;
  readonly stop: () => Promise<void>;
}

/** What every request of one server reads: the store, the checkout a page without an id opens,
 * and each snapshot's converter output, kept for the server's life because a snapshot never
 * changes. */
interface Context {
  readonly env: Env;
  readonly where: Where;
  readonly converted: Map<string, string>;
}

/** Nothing but this origin: no script, style, frame, image or request from anywhere else. */
const CSP =
  "default-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";

const HTTP_STATUS: Readonly<Record<Exclude<OutcomeCode, "ok">, number>> = {
  usage: 400,
  missing: 404,
  blocked: 409,
  failed: 422,
  worse: 500,
  partial: 500,
};

const html = (status: number, body: string): Response =>
  reply(status, body, "text/html; charset=utf-8");

/** A store error as the API answers it: `{code, message}` with the status of its code. */
function apiError(error: unknown): Response {
  if (error instanceof QsmError) {
    return json(HTTP_STATUS[error.code], { code: error.code, message: error.message });
  }
  if (error instanceof UsageError) {
    return json(400, { code: "usage", message: error.message });
  }
  throw error;
}

/** A store error as a page says it. */
function pageError(error: unknown): Response {
  if (error instanceof QsmError) {
    const next = error.next === undefined ? "" : ` Next: ${error.next}.`;
    return html(HTTP_STATUS[error.code], notFoundPage(`${error.code}: ${error.message}.${next}`));
  }
  throw error;
}

/** A save from a kind page: a new snapshot whose parent is the one that was open, made by a page,
 * in the parent's project and branch. */
async function save(env: Env, req: Request, port: number): Promise<Response> {
  if (!fromOwnPage(req, port)) {
    return json(403, { code: "blocked", message: "a save comes from a page this server sent" });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { code: "usage", message: "the body is not JSON" });
  }
  if (
    !isRecord(body) ||
    typeof body.kind !== "string" ||
    typeof body.parent !== "string" ||
    typeof body.content !== "string"
  ) {
    return json(400, {
      code: "usage",
      message: 'a save is {"kind", "parent", "content"}, each a string',
    });
  }
  try {
    const parent = entryOf(env, body.parent);
    const entry = createSnapshot(env, {
      kind: body.kind,
      bytes: new TextEncoder().encode(body.content),
      parent,
      where: { project: parent.project, branch: parent.branch },
      by: "page",
    });
    return json(201, { id: entry.id });
  } catch (error) {
    return apiError(error);
  }
}

/** `GET /api/snapshots/<id>`: the stored bytes with the kind's media type; `/json` the converter's
 * output, converted once per server. */
function snapshotApi({ env, converted }: Context, rest: string): Response {
  const asJson = rest.endsWith("/json");
  const id = decodeURIComponent(asJson ? rest.slice(0, -"/json".length) : rest);
  const kept = asJson ? converted.get(id) : undefined;
  if (kept !== undefined) {
    return reply(200, kept, "application/json");
  }
  try {
    const { entry, bytes } = readSnapshot(env, entryOf(env, id));
    const kind = kindOf(entry.kind, env, entry.plugin);
    if (!asJson) {
      return reply(200, new Uint8Array(bytes), kind.mediaType);
    }
    const out = kind.convert(bytes);
    converted.set(id, out);
    return reply(200, out, "application/json");
  } catch (error) {
    return apiError(error);
  }
}

/** A file of a kind's page: json's from the binary, an installed kind's from its kept copy. */
function kindFile(env: Env, kindName: string, rel: string): Response {
  try {
    const kind = kindOf(kindName, env);
    if (kind.pages === null) {
      const asset = JSON_PAGE[rel];
      return asset === undefined
        ? html(404, notFoundPage(`json has no page file ${rel}`))
        : new Response(asset.body, { headers: { "content-type": asset.type } });
    }
    const file = resolve(join(kind.pages, rel));
    if (!file.startsWith(kind.pages + sep) || !existsSync(file) || !statSync(file).isFile()) {
      return html(404, notFoundPage(`${kindName} has no page file ${rel}`));
    }
    return new Response(Bun.file(file));
  } catch (error) {
    return pageError(error);
  }
}

/** The snapshot a page opens and the snapshots of its branch, newest first, each ledger read once:
 * `id`, or the newest of the kind on the server's branch when there is none. */
function located(
  env: Env,
  where: Where,
  kindName: string,
  id: string | null,
): { entry: Entry | undefined; siblings: Entry[] } {
  if (id === null) {
    const siblings = listSnapshots(env, where.project, { branch: where.branch });
    return { entry: siblings.find((e) => e.kind === kindName), siblings };
  }
  const store = readStore(env);
  const entry = entryOf(env, id, store);
  const siblings = [...store.values()]
    .filter((e) => e.project === entry.project && e.branch === entry.branch)
    .toReversed();
  return { entry, siblings };
}

/** `/<kind>/<id>`, or `/<kind>` for the newest snapshot of the kind on the server's branch. */
function shell(env: Env, where: Where, kindName: string, id: string | null): Response {
  try {
    kindOf(kindName, env);
    const { entry, siblings } = located(env, where, kindName, id);
    if (entry === undefined) {
      return html(
        404,
        notFoundPage(`no ${kindName} snapshot of ${where.project} on ${where.branch} yet`),
      );
    }
    if (entry.kind !== kindName) {
      return html(404, notFoundPage(`${entry.id} is ${entry.kind}, not ${kindName}`));
    }
    return html(200, shellPage(entry, siblings));
  } catch (error) {
    return pageError(error);
  }
}

/** One request: a loopback Host only, since a page on a rebound DNS name reaches 127.0.0.1 too. */
function route(ctx: Context, req: Request, port: number): Response | Promise<Response> {
  if (!fromLoopbackHost(req, port)) {
    return new Response("forbidden\n", { status: 403 });
  }
  const path = new URL(req.url).pathname;
  if (req.method === "POST") {
    return path === "/api/snapshots" ? save(ctx.env, req, port) : html(404, notFoundPage(path));
  }
  return req.method === "GET"
    ? read(ctx, path)
    : new Response("method not allowed\n", { status: 405 });
}

/** A GET: the shell's own files, the index, the API, a kind's page file, or a shell page. */
function read(ctx: Context, path: string): Response {
  const { env, where } = ctx;
  const asset = SHELL_ASSETS[path];
  if (asset !== undefined) {
    return new Response(asset.body, { headers: { "content-type": asset.type } });
  }
  if (path === "/") {
    return html(200, indexPage(where, env));
  }
  if (path.startsWith("/api/snapshots/")) {
    return snapshotApi(ctx, path.slice("/api/snapshots/".length));
  }
  const kindAt = /^\/kinds\/([^/]+)\/(.+)$/.exec(path);
  if (kindAt !== null) {
    return kindFile(env, kindAt[1] ?? "", decodeURIComponent(kindAt[2] ?? ""));
  }
  const page = /^\/([^/]+)(?:\/([^/]+))?$/.exec(path);
  if (page !== null) {
    const id = page[2] === undefined ? null : decodeURIComponent(page[2]);
    return shell(env, where, decodeURIComponent(page[1] ?? ""), id);
  }
  return html(404, notFoundPage(path));
}

/** Starts the server; throws a `failed` QsmError naming the port when it cannot listen there. */
export function serveDocs(env: Env, where: Where, port: number): Served {
  const ctx: Context = { env, where, converted: new Map() };
  const server = listenLoopback(port, async (req, at) => {
    const res = await route(ctx, req, at);
    res.headers.set("content-security-policy", CSP);
    return res;
  });
  return { url: `http://127.0.0.1:${server.port}/`, stop: () => server.stop(true) };
}
