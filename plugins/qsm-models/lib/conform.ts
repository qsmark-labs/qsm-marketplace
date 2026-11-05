// check: a project has one graph of each kind under models/, and every link its graphs carry
// resolves. A model file anywhere else is a copy that drifts.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fail, ok, type Outcome } from "../../../lib/outcome.ts";
import { QsmError } from "../../../lib/qsm-error.ts";
import { readGraph } from "./bpmn/model.ts";
import { readC4OrThrow } from "./c4/model.ts";
import { GRAPH_FILE, graphIn, MODELS_DIR } from "./graphs.ts";
import { bpmnLinkFindings, c4LinkFindings, type LinkContext } from "./links.ts";

/** Directories that hold no project model: tooling, dependencies, and the archive of changes. */
const SKIP = new Set([".git", "node_modules", ".claude", ".qsm", "openspec/changes/archive"]);

/** The repository the working directory is in. */
export function repoRoot(cwd: string = process.cwd()): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new QsmError("failed", `${cwd} is not inside a git repository`, {
      next: "run qsm-models in the project's checkout",
    });
  }
  return r.stdout.trim();
}

/** Every `.bpmn` and `.c4` file of the repository outside `models/`. */
function strayModels(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    for (const d of readdirSync(dir, { withFileTypes: true }).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const rel = relative(root, join(dir, d.name));
      if (d.isDirectory() && !SKIP.has(d.name) && !SKIP.has(rel) && rel !== MODELS_DIR) {
        visit(join(dir, d.name));
      } else if (d.isFile() && GRAPH_FILE.test(d.name)) {
        out.push(rel);
      }
    }
  };
  visit(root);
  return out;
}

const commitIn =
  (root: string) =>
  (sha: string): boolean =>
    spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root }).status === 0;

export async function checkProject(root: string): Promise<Outcome<{ findings: string[] }>> {
  const models = join(root, MODELS_DIR);
  const bpmnFile = graphIn(models, ".bpmn");
  const c4File = graphIn(models, ".c4");
  const home = (ext: string): string => {
    const own = ext === ".c4" ? c4File : bpmnFile;
    return own === undefined ? `${MODELS_DIR}/<project>${ext}` : relative(root, own);
  };
  const findings = strayModels(root).map(
    (f) =>
      `${f} is a model outside ${MODELS_DIR}/: the change edits ${home(f.endsWith(".c4") ? ".c4" : ".bpmn")}`,
  );
  const ctx: LinkContext = { root, commitExists: commitIn(root) };
  const c4 = c4File === undefined ? undefined : await readC4OrThrow(c4File);
  if (c4 !== undefined) {
    findings.push(...c4LinkFindings(c4, ctx));
  }
  if (bpmnFile !== undefined) {
    findings.push(...bpmnLinkFindings(await readGraph(bpmnFile), c4, ctx));
  }
  if (findings.length > 0) {
    return fail("worse", findings.join("\n"), { findings });
  }
  return ok({ findings }, `${MODELS_DIR}/: one graph of each kind, every link resolves`);
}
