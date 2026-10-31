// Per-project git hooks: wiring `qsm-langdev hook <name>` into pre-commit and pre-push, reversibly.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { HOOK_POINTS, type HookPoint } from "./registry.ts";

/** The call a hook makes. git hands pre-push the remote's name as its first argument, and the
 * gate needs it to know which remote's refs are not news, so the shim passes it on. */
function hookCallLine(name: HookPoint): string {
  return callLine(name, name === "pre-push");
}

/** The call line a hook written before the remote name was passed holds, or null when it is the
 * current one, so a reinstall can replace that one line and keep what the person added. */
function earlierCallLine(name: HookPoint): string | null {
  return name === "pre-push" ? callLine(name, false) : null;
}

function callLine(name: HookPoint, push: boolean): string {
  return `qsm-langdev hook ${name}${push ? ' "${1:-}"' : ""} || exit 1`;
}

/** True when an existing hook's first line names a shell: the only script a call line and a
 * marked block can be appended to. */
function isShellScript(body: string): boolean {
  const first = body.split("\n", 1)[0] ?? "";
  return first.startsWith("#!") && /\b(bash|sh|zsh|dash|ksh)$/.test(first);
}

const MARKER = "installed by qsm-langdev";
const BLOCK_BEGIN = "--- qsm-langdev gate (added by qsm-langdev install) ---";
const BLOCK_END = "--- end qsm-langdev gate ---";

const gateBlock = (name: HookPoint): string =>
  `\n# ${BLOCK_BEGIN}\n${hookCallLine(name)}\n# ${BLOCK_END}\n`;

/** Where our marked block sits in a hook, or null when it has none. */
function ownBlock(body: string): { start: number; end: number } | null {
  const start = body.indexOf(`# ${BLOCK_BEGIN}`);
  const endMarker = `# ${BLOCK_END}`;
  const end = body.indexOf(endMarker);
  return start !== -1 && end > start ? { start, end: end + endMarker.length } : null;
}

function hookBody(name: HookPoint): string {
  return [
    "#!/usr/bin/env bash",
    `# ${MARKER}`,
    "# Remove with: qsm-langdev uninstall",
    "set -euo pipefail",
    "",
    hookCallLine(name),
    "",
  ].join("\n");
}

/** True when this file is one we wrote whole and may therefore remove. */
function isOurs(path: string): boolean {
  return existsSync(path) && readFileSync(path, "utf8").includes(MARKER);
}

export type HookAction =
  | { hook: HookPoint; kind: "written"; path: string }
  | { hook: HookPoint; kind: "already"; path: string }
  | { hook: HookPoint; kind: "appended"; path: string; backup: string }
  | { hook: HookPoint; kind: "unappended"; path: string }
  | { hook: HookPoint; kind: "manual"; path: string; line: string; why: string }
  | { hook: HookPoint; kind: "removed"; path: string }
  | { hook: HookPoint; kind: "absent"; path: string };

/** Where git itself looks for hooks. */
function hooksDir(repoRoot: string): string {
  const result = spawnSync("git", ["rev-parse", "--git-path", "hooks"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const path = result.status === 0 ? result.stdout.trim() : join(".git", "hooks");
  return isAbsolute(path) ? path : join(repoRoot, path);
}

/** Brings a hook we wrote whole up to the current call by replacing only its earlier call line, so
 * whatever the person added to it stays. */
function refreshOwnHook(name: HookPoint, path: string): HookAction {
  const current = readFileSync(path, "utf8");
  const line = hookCallLine(name);
  if (current.includes(line)) {
    return { hook: name, kind: "already", path };
  }
  const earlier = earlierCallLine(name);
  if (earlier === null || !current.includes(earlier)) {
    return {
      hook: name,
      kind: "manual",
      path,
      line,
      why: "it holds no call line install wrote, so rewriting it would drop what was added by hand",
    };
  }
  writeFileSync(path, current.replace(earlier, line), { mode: 0o755 });
  return { hook: name, kind: "written", path };
}

/** Writes our hooks into the repository, adding to an existing one rather than replacing it. */
export function installHooks(
  repoRoot: string,
  names: readonly HookPoint[] = HOOK_POINTS,
): HookAction[] {
  const dir = hooksDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  return names.map((name): HookAction => {
    const path = join(dir, name);
    if (isOurs(path)) {
      return refreshOwnHook(name, path);
    }
    if (!existsSync(path)) {
      writeFileSync(path, hookBody(name), { mode: 0o755 });
      return { hook: name, kind: "written", path };
    }

    const body = readFileSync(path, "utf8");
    if (!isShellScript(body)) {
      return {
        hook: name,
        kind: "manual",
        path,
        line: hookCallLine(name),
        why: "it is not a shell script, so appending a shell call would risk breaking it",
      };
    }
    if (body.includes(hookCallLine(name))) {
      return { hook: name, kind: "already", path };
    }
    const stale = ownBlock(body);
    if (stale !== null) {
      const fresh = body.slice(0, stale.start) + gateBlock(name).trim() + body.slice(stale.end);
      writeFileSync(path, fresh, { mode: 0o755 });
      return { hook: name, kind: "appended", path, backup: `${path}.qsm-backup` };
    }
    const backup = `${path}.qsm-backup`;
    if (!existsSync(backup)) {
      writeFileSync(backup, body);
    }
    writeFileSync(path, body.replace(/\n*$/, "") + gateBlock(name), { mode: 0o755 });
    return { hook: name, kind: "appended", path, backup };
  });
}

/** Takes out exactly what `installHooks` put in. */
export function uninstallHooks(
  repoRoot: string,
  names: readonly HookPoint[] = HOOK_POINTS,
): HookAction[] {
  return names.map((name) => {
    const path = join(hooksDir(repoRoot), name);
    if (isOurs(path)) {
      unlinkSync(path);
      return { hook: name, kind: "removed", path };
    }
    if (!existsSync(path)) {
      return { hook: name, kind: "absent", path };
    }

    const body = readFileSync(path, "utf8");
    const block = ownBlock(body);
    if (block !== null) {
      const without =
        body.slice(0, block.start).replace(/\n*$/, "\n") +
        body.slice(block.end).replace(/^\n+/, "");
      writeFileSync(path, without, { mode: 0o755 });
      return { hook: name, kind: "unappended", path };
    }
    if (body.includes(hookCallLine(name))) {
      return {
        hook: name,
        kind: "manual",
        path,
        line: hookCallLine(name),
        why: "the line was added by hand, outside our block",
      };
    }
    return { hook: name, kind: "absent", path };
  });
}
