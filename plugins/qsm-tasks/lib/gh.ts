// The one place that runs `gh`.
import { onPath } from "../../../lib/outcome.ts";
import { QsmError } from "../../../lib/qsm-error.ts";

/** gh's stdout. A missing gh is `missing`; a non-zero exit is `failed` carrying gh's stderr as it
 * came. */
export function runGh(args: readonly string[]): string {
  if (!onPath("gh")) {
    throw new QsmError("missing", "gh is not on PATH");
  }
  const run = Bun.spawnSync(["gh", ...args], { stdin: "inherit" });
  if (run.exitCode !== 0) {
    throw new QsmError("failed", run.stderr.toString());
  }
  return run.stdout.toString();
}
