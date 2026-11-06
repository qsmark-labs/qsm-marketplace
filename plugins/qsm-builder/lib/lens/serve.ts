// The local server behind `qsm-builder lens`: the page rendered from the repository on every
// request, and one event stream that says when a file of the marketplace changed. It listens on
// 127.0.0.1 only.

import {
  fromLoopbackHost,
  fromOwnPage,
  jsonResponse as json,
  listenLoopback,
} from "../../../../lib/loopback.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";
import { createEditTask, EditError, parseEdit } from "./edits.ts";
import { readMarketplace } from "./model.ts";
import { pluginRoute, renderDocument } from "./page.ts";
import { sha256Of } from "./tasks.ts";
import { watchMarketplace } from "./watch.ts";

export interface Served {
  readonly url: string;
  readonly port: number;
  readonly stop: () => Promise<void>;
}

const encoder = new TextEncoder();

type Stream = ReadableStreamDefaultController<Uint8Array>;

/** The open event streams: a response for each client, a way to tell all, a way to end all. */
function eventStreams(): {
  open: () => Response;
  tell: () => void;
  end: () => void;
} {
  const streams = new Set<Stream>();
  const send = (s: Stream, text: string) => {
    try {
      s.enqueue(encoder.encode(text));
    } catch {
      streams.delete(s);
    }
  };
  return {
    open() {
      let mine: Stream | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          mine = controller;
          streams.add(controller);
          send(controller, ": open\n\n");
        },
        cancel() {
          if (mine !== undefined) {
            streams.delete(mine);
          }
        },
      });
      return new Response(body, {
        headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
      });
    },
    tell() {
      for (const s of streams) {
        send(s, "data: change\n\n");
      }
    },
    end() {
      for (const s of streams) {
        try {
          s.close();
        } catch {
          // already closed by the client
        }
      }
      streams.clear();
    },
  };
}

/** The overview (`plugin` null) or one plugin, read from the repository now; 404 for another name. */
function page(root: string, plugin: string | null): Response {
  try {
    // The sha256 a pen carries is the file as this render read it.
    const sha = (rel: string) => sha256Of(root, rel);
    const market = readMarketplace(root);
    const only =
      plugin === null ? null : market.plugins.find((p) => pluginRoute(p) === plugin)?.name;
    if (only === undefined) {
      return new Response("not found\n", { status: 404 });
    }
    return new Response(
      renderDocument(market, { live: true, only, edit: { sha, transport: "server" } }),
      {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof QsmError) {
      return new Response(`${error.code}: ${error.message}\n`, { status: 500 });
    }
    throw error;
  }
}

/**
 * A saved edit: one task, no file. Only the page this server sent may post it: a request without a
 * loopback Origin or without a JSON content type is refused, since any web page can reach 127.0.0.1.
 */
async function saveEdit(req: Request, root: string, port: number): Promise<Response> {
  if (!fromOwnPage(req, port)) {
    return json(403, { error: "edits come from the page this server sent" });
  }
  try {
    return json(200, await createEditTask(root, parseEdit(await req.json(), root)));
  } catch (error) {
    if (error instanceof EditError) {
      return json(error.status, { error: error.message });
    }
    if (error instanceof SyntaxError) {
      return json(400, { error: "the edit is not JSON" });
    }
    throw error;
  }
}

/** One request: a loopback Host only, since a page on a rebound DNS name reaches 127.0.0.1 too. */
function route(
  req: Request,
  root: string,
  streams: ReturnType<typeof eventStreams>,
  port: number,
): Response | Promise<Response> {
  if (!fromLoopbackHost(req, port)) {
    return new Response("forbidden\n", { status: 403 });
  }
  const path = new URL(req.url).pathname;
  // The name is matched against the plugins by equality in page(); no pattern reads it.
  const plugin = path.startsWith("/p/") ? path.slice(3) : undefined;
  const routes: Record<string, () => Response | Promise<Response>> = {
    "GET /": () => page(root, null),
    ...(plugin === undefined ? {} : { [`GET ${path}`]: () => page(root, plugin) }),
    "GET /events": () => streams.open(),
    "POST /edit": () => saveEdit(req, root, port),
  };
  const handle = routes[`${req.method} ${path}`];
  return handle === undefined ? new Response("not found\n", { status: 404 }) : handle();
}

/** Starts the server; throws a `failed` QsmError naming the port when it cannot listen there. */
export function serveLens(root: string, port: number): Served {
  const streams = eventStreams();
  // An event stream is idle between changes; the default would cut it after ten seconds.
  const server = listenLoopback(port, (req, at) => route(req, root, streams, at), {
    idleTimeout: 0,
  });
  const unwatch = watchMarketplace(root, streams.tell);
  return {
    url: `http://127.0.0.1:${server.port}/`,
    port: server.port ?? port,
    async stop() {
      unwatch();
      streams.end();
      await server.stop(true);
    },
  };
}
