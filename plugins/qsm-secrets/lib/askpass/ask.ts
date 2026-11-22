// One question to the person: the provider says what to show, the pane shows it, the answer comes
// back on a socket only this call listens on, and the provider turns it into the consumer's result.

import { readFileSync } from "node:fs";
import { type Outcome, fail as stop } from "../../../../lib/outcome.ts";
import type { Env } from "../../../../lib/paths.ts";
import { callerOf } from "./caller.ts";
import { providerOf } from "./index.ts";
import { dismissPane, showPane } from "./pane.ts";
import { openReplySocket, type ReplySocket } from "./socket.ts";
import type { Input } from "./types.ts";

const SIGNALS = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 } as const;

/** How long the person has before the call fails, matching the pane's own clock. */
export const TIMEOUT_MS = 120_000;

export interface AskOptions {
  readonly env: Env;
  readonly namespace: string;
  readonly timeoutMs?: number;
  /** who the pane names as asking; the parent of this process unless a test says otherwise */
  readonly callerPid?: number;
  readonly stdin?: () => string;
}

export async function ask(
  kind: string,
  argv: readonly string[],
  options: AskOptions,
): Promise<Outcome> {
  const provider = providerOf(kind);
  let text: string | undefined;
  const read = options.stdin ?? (() => readFileSync(0, "utf8"));
  const input: Input = {
    argv,
    env: options.env,
    namespace: options.namespace,
    stdin: () => {
      text ??= read();
      return text;
    },
  };
  const request = provider.request(input);
  // ssh kills its askpass after a notice, and Ctrl-C reaches it at a prompt: the request leaves the
  // screen and the socket directory goes, as on any other exit. The signals are taken before the
  // socket directory is made, because a signal that arrives in between ends the process by the
  // default action and the directory stays.
  let socket: ReplySocket | undefined;
  const timeout = options.timeoutMs ?? TIMEOUT_MS;
  const cleanup = (): void => {
    if (socket !== undefined) {
      dismissPane(options.env, socket.nonce);
      socket.close();
    }
  };
  const stops = Object.entries(SIGNALS).map(([name, number]) => {
    const onSignal = (): void => {
      cleanup();
      process.exit(128 + number);
    };
    process.on(name, onSignal);
    return () => process.off(name, onSignal);
  });
  try {
    socket = openReplySocket(options.env);
    const caller = callerOf(options.callerPid ?? process.ppid);
    await showPane(options.env, {
      ...request,
      nonce: socket.nonce,
      socketPath: socket.path,
      timeoutMs: timeout,
      requestedBy: caller,
    });
    const reply = await socket.wait(timeout);
    return reply === null
      ? stop("failed", "timed out waiting for the person")
      : provider.finish(input, reply);
  } finally {
    for (const release of stops) {
      release();
    }
    cleanup();
  }
}
