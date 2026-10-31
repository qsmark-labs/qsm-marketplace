// One place to turn a name into a commit id, and the types of a tree a comparison reads.

import { spawnSync } from "node:child_process";

declare const shaBrand: unique symbol;

/** A commit id git resolved: made only by `resolveRef`, so no other string stands for a commit. */
export type Sha = string & { readonly [shaBrand]: true };

/** One side of a comparison: the staged tree, or the tree of a commit. */
export type TreeSide = { kind: "index" } | { kind: "commit"; sha: Sha };

const isSha = (text: string): text is Sha => /^[0-9a-f]{40,64}$/.test(text);

/** `ref` as a commit id, or null when it names none (including "no commits
 * yet", which is not an error — a fresh repository has no HEAD). */
export function resolveRef(root: string, ref: string): Sha | null {
  const result = spawnSync("git", ["rev-parse", "--verify", "-q", ref], {
    cwd: root,
    encoding: "utf8",
  });
  const id = result.stdout.trim();
  return result.status === 0 && isSha(id) ? id : null;
}
