// A serving binary under test: started, its announced URL read from stderr, and stopped with the
// Ctrl-C a person would press.
import { spawn } from "bun";

/** A running server; `await using` stops it when the test's block ends. */
export interface Running extends AsyncDisposable {
  readonly url: string;
  readonly stop: () => Promise<void>;
}

/** Starts `argv` and waits for the `http://127.0.0.1:<port>/` line it writes to stderr; a server
 * that exits or never names one is stopped and the test fails naming what it said. */
export async function startServer(
  argv: readonly string[],
  opts: { readonly cwd?: string; readonly env?: Record<string, string> } = {},
): Promise<Running> {
  const proc = spawn([...argv], { ...opts, stdout: "pipe", stderr: "pipe" });
  const stop = async () => {
    proc.kill("SIGINT");
    await proc.exited;
  };
  const reader = proc.stderr.getReader();
  const at = /http:\/\/127\.0\.0\.1:\d+\//;
  let text = "";
  for (let n = 0; n < 50 && !at.test(text); n += 1) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    text += new TextDecoder().decode(value);
  }
  reader.releaseLock();
  const url = at.exec(text)?.[0];
  if (url === undefined) {
    await stop();
    throw new Error(`the server did not announce a URL: ${text}`);
  }
  return { url, stop, [Symbol.asyncDispose]: stop };
}
