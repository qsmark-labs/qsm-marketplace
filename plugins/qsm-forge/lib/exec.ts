// Every call that leaves this process goes through one function type, so a test hands the code a
// recorded answer where production hands it a forge CLI.

import { execFile } from "node:child_process";
import { messageOf } from "../../../lib/outcome.ts";
import type { Guard } from "./shape.ts";

/** Runs `command` with `args`, resolves with its stdout, rejects with an
 * Error carrying what the command said. `env` is added to this process's
 * environment for that one child only. */
export type Run = (
  command: string,
  args: readonly string[],
  stdin?: string,
  env?: Readonly<Record<string, string>>,
) => Promise<string>;

/**
 * A review payload with inline comments is the largest thing that crosses this boundary; a pull
 * request's threads are the largest thing coming back.
 */
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

function firstNonEmpty(candidates: readonly string[]): string {
  return candidates.map((c) => c.trim()).find((c) => c.length > 0) ?? "";
}

export const runCommand: Run = (command, args, stdin, env) =>
  new Promise<string>((resolve, reject) => {
    const child = execFile(
      command,
      [...args],
      {
        maxBuffer: MAX_OUTPUT_BYTES,
        env: env === undefined ? process.env : { ...process.env, ...env },
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve(stdout);
          return;
        }
        const said = firstNonEmpty([stderr, stdout, error.message]);
        reject(new Error(`${command}: ${said}`));
      },
    );
    if (stdin !== undefined) {
      child.stdin?.end(stdin);
    }
  });

/** Parses what a forge CLI printed. */
export function parseJson(raw: string, what: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new Error(`${what} did not answer with JSON: ${messageOf(cause)}`, { cause });
  }
}

/** Parses what a forge CLI printed and checks it has the shape the caller reads. */
export function parseAs<T>(raw: string, what: string, guard: Guard<T>): T {
  const parsed = parseJson(raw, what);
  if (guard(parsed)) {
    return parsed;
  }
  const found = guard.mismatch(parsed, "");
  if (found === null) {
    throw new Error(`${what} answered with an unexpected shape`);
  }
  const place = found.path === "" ? "the top level" : found.path;
  throw new Error(
    `${what} answered with an unexpected shape at ${place}: expected ${found.expected}, got ${found.found}`,
  );
}
