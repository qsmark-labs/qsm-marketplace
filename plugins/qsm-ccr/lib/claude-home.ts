// A routed session must not let Claude's /model write into the person's settings. Keep each
// session home, including its transcript, and share only the inputs and team communication.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, chmodSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { claudeDir, claudeJsonPath, type Env, withClaudeDirAt } from "../../../lib/paths.ts";
import type { Places } from "./places.ts";

const SOURCE_DIR = "QSM_CCR_SOURCE_CLAUDE_DIR";
const SOURCE_JSON = "QSM_CCR_SOURCE_CLAUDE_JSON";
const SHARED = [
  ".credentials.json",
  "CLAUDE.md",
  "rules",
  "skills",
  "plugins",
  "output-styles",
  "statusline.sh",
];

export function isIsolated(env: Env): boolean {
  return env[SOURCE_DIR] !== undefined;
}

/** Make a private settings copy, retaining the source and team directories across launches. */
export function isolatedHome(env: Env, places: Places): Record<string, string> {
  const source = env[SOURCE_DIR] ?? claudeDir(env);
  const sourceJson = env[SOURCE_JSON] ?? claudeJsonPath(env);
  const teamHome = claudeDir(env);
  const root = join(places.stateDir, "homes");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const dir = mkdtempSync(join(root, "session-"));
  for (const [from, name] of [
    [join(source, "settings.json"), "settings.json"],
    [sourceJson, ".claude.json"],
  ] as const) {
    if (existsSync(from)) {
      const dest = join(dir, name);
      copyFileSync(from, dest);
      chmodSync(dest, 0o600);
    }
  }
  for (const name of SHARED) {
    const from = join(source, name);
    if (existsSync(from)) {
      symlinkSync(from, join(dir, name));
    }
  }
  for (const name of ["teams", "tasks"]) {
    const from = join(teamHome, name);
    if (existsSync(from)) {
      symlinkSync(from, join(dir, name));
    }
  }
  const out = withClaudeDirAt(env, dir);
  out[SOURCE_DIR] = source;
  out[SOURCE_JSON] = sourceJson;
  return out;
}
