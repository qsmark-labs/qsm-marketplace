// The lint verb: each graph of a path through the checks of its kind.
import { fail, ok, type Outcome } from "../../../lib/outcome.ts";
import { type Finding, formatFinding, lintBpmn } from "./bpmn/lint.ts";
import { readGraph } from "./bpmn/model.ts";
import { graphFiles } from "./graphs.ts";

async function lintFile(file: string): Promise<Finding[]> {
  return lintBpmn(file, (await readGraph(file)).defs);
}

export async function lintPath(path: string): Promise<Outcome<{ findings: Finding[] }>> {
  const files = graphFiles(path);
  const findings: Finding[] = [];
  for (const file of files) {
    findings.push(...(await lintFile(file)));
  }
  if (findings.length > 0) {
    return fail("worse", findings.map(formatFinding).join("\n"), { findings });
  }
  return ok({ findings }, `${files.join(", ")}: clean`);
}
