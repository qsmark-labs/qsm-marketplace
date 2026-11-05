// The page server behind `qsm-docs serve`: the page shell, each kind's page in a frame, and the API
// those pages read and save through. It listens on 127.0.0.1 only, answers only a loopback Host,
// takes a save only from its own pages, and every response forbids the browser anything else.

import { existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fromLoopbackHost, fromOwnPage, listenLoopback } from "../../../../lib/loopback.ts";
import { isRecord, type OutcomeCode, UsageError } from "../../../../lib/outcome.ts";
import type { Env } from "../../../../lib/paths.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import { kindOf } from "../kinds/kind.ts";
import { createSnapshot, entryOf, listSnapshots, readSnapshot } from "../store/store.ts";
import type { Where } from "../store/where.ts";
import { JSON_PAGE, SHELL_ASSETS, shellPage, indexPage, notFoundPage } from "./shell.ts";

export interface Served {
  readonly url: string;
  readonly port: number;
  readonly stop: () => Promise<void>;
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

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const html = (status: number, body: string): Response =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });

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
      parent: parent.id,
      where: { project: parent.project, branch: parent.branch },
      by: "page",
    });
    return json(201, { id: entry.id });
  } catch (error) {
    return apiError(error);
  }
}

/** `GET /api/snapshots/<id>`: the stored bytes with the kind's media type; `/json` the converter's
 * output. */
function snapshotApi(env: Env, rest: string): Response {
  const asJson = rest.endsWith("/json");
  const id = decodeURIComponent(asJson ? rest.slice(0, -"/json".length) : rest);
  try {
    const { entry, bytes } = readSnapshot(env, id);
    const kind = kindOf(entry.kind, env, entry.plugin);
    return asJson
      ? new Response(kind.convert(bytes), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        })
      : new Response(new Uint8Array(bytes), {
          headers: { "content-type": kind.mediaType, "cache-control": "no-store" },
        });
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

/** `/<kind>/<id>`, or `/<kind>` for the newest snapshot of the kind on the server's branch. */
function shell(env: Env, where: Where, kindName: string, id: string | null): Response {
  try {
    kindOf(kindName, env);
    const entry =
      id === null
        ? listSnapshots(env, where.project, { branch: where.branch, kind: kindName })[0]
        : entryOf(env, id);
    if (entry === undefined) {
      return html(
        404,
        notFoundPage(`no ${kindName} snapshot of ${where.project} on ${where.branch} yet`),
      );
    }
    if (entry.kind !== kindName) {
      return html(404, notFoundPage(`${entry.id} is ${entry.kind}, not ${kindName}`));
    }
    const siblings = listSnapshots(env, entry.project, { branch: entry.branch });
    return html(200, shellPage(entry, siblings));
  } catch (error) {
    return pageError(error);
  }
}

/** One request: a loopback Host only, since a page on a rebound DNS name reaches 127.0.0.1 too. */
function route(env: Env, where: Where, req: Request, port: number): Response | Promise<Response> {
  if (!fromLoopbackHost(req, port)) {
    return new Response("forbidden\n", { status: 403 });
  }
  const path = new URL(req.url).pathname;
  if (req.method === "POST") {
    return path === "/api/snapshots" ? save(env, req, port) : html(404, notFoundPage(path));
  }
  return req.method === "GET"
    ? read(env, where, path)
    : new Response("method not allowed\n", { status: 405 });
}

/** A GET: the shell's own files, the index, the API, a kind's page file, or a shell page. */
function read(env: Env, where: Where, path: string): Response {
  const asset = SHELL_ASSETS[path];
  if (asset !== undefined) {
    return new Response(asset.body, { headers: { "content-type": asset.type } });
  }
  if (path === "/") {
    return html(200, indexPage(where, env));
  }
  if (path.startsWith("/api/snapshots/")) {
    return snapshotApi(env, path.slice("/api/snapshots/".length));
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
  // The real port is known only after listen; a `--port 0` server learns it here.
  const at = { port };
  const server = listenLoopback(port, async (req) => {
    const res = await route(env, where, req, at.port);
    res.headers.set("content-security-policy", CSP);
    return res;
  });
  at.port = server.port ?? port;
  return {
    url: `http://127.0.0.1:${at.port}/`,
    port: at.port,
    async stop() {
      await server.stop(true);
    },
  };
}
