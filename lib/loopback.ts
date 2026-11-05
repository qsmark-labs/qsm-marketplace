// A page server on 127.0.0.1 that answers only its own pages: the loopback Host and Origin checks,
// the listen that names a taken port, and the wait for Ctrl-C a serving verb ends with.
import { serve } from "bun";
import { QsmError } from "./qsm-error.ts";

/** The hosts a server on `port` answers to; any other Host is a DNS name rebound to 127.0.0.1. */
function loopbackHosts(port: number): ReadonlySet<string> {
  return new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
}

/** Whether the request's Host is this server's own, since a page on a rebound DNS name reaches
 * 127.0.0.1 too. */
export function fromLoopbackHost(req: Request, port: number): boolean {
  return loopbackHosts(port).has(req.headers.get("host")?.toLowerCase() ?? "");
}

/** Whether a write came from a page this server sent: a JSON content type and a loopback Origin,
 * because any web page in the browser can post to 127.0.0.1. */
export function fromOwnPage(req: Request, port: number): boolean {
  const origin = req.headers
    .get("origin")
    ?.toLowerCase()
    .replace(/^http:\/\//, "");
  return (
    req.headers.get("content-type")?.split(";")[0] === "application/json" &&
    origin !== undefined &&
    loopbackHosts(port).has(origin)
  );
}

/** Listens on 127.0.0.1 only; a taken port is a `failed` QsmError naming it and `--port`. */
export function listenLoopback(
  port: number,
  fetch: (req: Request) => Response | Promise<Response>,
  options: { readonly idleTimeout?: number } = {},
): ReturnType<typeof serve> {
  try {
    return serve({ hostname: "127.0.0.1", port, fetch, ...options });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new QsmError("failed", `port ${port} is taken; choose another with --port <number>`, {
        cause: error,
      });
    }
    throw error;
  }
}

/** Resolves when the process is told to stop: Ctrl-C or a TERM. */
export function untilStopped(): Promise<void> {
  return new Promise<void>((done) => {
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}
