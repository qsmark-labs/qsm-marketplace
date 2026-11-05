// The change record: the one shape every kind's diff prints, so the CLI, the hook and the pages read
// changes without knowing a kind.
import { isRecord } from "../../../../lib/outcome.ts";
import { QsmError } from "../../../../lib/qsm-error.ts";

const CHANGE_OPS = ["added", "removed", "changed", "renamed", "moved", "commented"] as const;

/** One change a diff names. */
export interface Change {
  readonly op: (typeof CHANGE_OPS)[number];
  readonly element: string;
  readonly detail?: string;
}

/** A kind's diff output checked against the change record; `failed` names the first misfit. */
export function changesOf(kind: string, raw: unknown): Change[] {
  if (!Array.isArray(raw)) {
    throw new QsmError(
      "failed",
      `${kind}: the diff printed ${JSON.stringify(raw).slice(0, 200)}, not a list of change records`,
    );
  }
  const records: unknown[] = raw;
  return records.map((record) => {
    const op = isRecord(record) ? CHANGE_OPS.find((o) => o === record.op) : undefined;
    if (
      !isRecord(record) ||
      op === undefined ||
      typeof record.element !== "string" ||
      !(record.detail === undefined || typeof record.detail === "string") ||
      !Object.keys(record).every((key) => ["op", "element", "detail"].includes(key))
    ) {
      throw new QsmError(
        "failed",
        `${kind}: the diff printed a record that is not {"op", "element", "detail"?}: ${JSON.stringify(record).slice(0, 200)}`,
      );
    }
    return {
      op,
      element: record.element,
      ...(typeof record.detail === "string" ? { detail: record.detail } : {}),
    };
  });
}
