// MD013 (line length) is the one markdown rule fixed by rewriting, so it is never reported: rumdl
// reflows the prose of the files it is given. It reads the repository's own markdownlint config for
// the length, the code blocks and the tables, so what it wraps to is what markdownlint then checks.
// Every other markdown rule is left to markdownlint-cli2, which reports it as before.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnAsync } from "./process.ts";

export const isMarkdown = (path: string): boolean => /\.(md|markdown)$/i.test(path);

// OpenSpec reads a rename from one line, so a `- FROM:` or `- TO:` line must never be wrapped. Both
// rumdl and markdownlint honour this marker, which is how a delta spec already keeps such a line whole.
const KEEP_WHOLE =
  "<!-- markdownlint-disable-next-line MD013 -- OpenSpec reads the rename from one line -->";
const isRename = (line: string): boolean => {
  const item = line.trimStart();
  return item.startsWith("- FROM: ") || item.startsWith("- TO: ");
};
const isFence = (line: string): boolean => {
  const item = line.trimStart();
  return item.startsWith("```") || item.startsWith("~~~");
};

/** `text` with the KEEP_WHOLE marker above every OpenSpec rename line that lacks one; a line in a
 * fenced code block is an example, not a rename. */
function keepRenamesWhole(text: string): string {
  const lines = text.split("\n");
  let fenced = false;
  return lines
    .flatMap((line, index) => {
      if (isFence(line)) {
        fenced = !fenced;
      }
      const held = lines[index - 1]?.includes("markdownlint-disable-next-line MD013") === true;
      return !fenced && !held && isRename(line) ? [KEEP_WHOLE, line] : [line];
    })
    .join("\n");
}

/** Rewraps `files` (relative to `root`) in place. False when rumdl is not on PATH: nothing was
 * rewrapped, and markdownlint reports the long lines as it always did. */
export async function rewrapMarkdown(
  root: string,
  files: readonly string[],
  timeoutMs: number,
): Promise<boolean> {
  if (files.length === 0) {
    return false;
  }
  for (const file of files) {
    const path = join(root, file);
    const text = readFileSync(path, "utf8");
    const held = keepRenamesWhole(text);
    if (held !== text) {
      writeFileSync(path, held);
    }
  }
  const result = await spawnAsync(
    root,
    "rumdl",
    [
      "check",
      "--fix",
      "--quiet",
      "--no-cache",
      "--enable",
      "MD013",
      "--config",
      "MD013.reflow = true",
      ...files,
    ],
    timeoutMs,
  );
  return result.error === undefined;
}
