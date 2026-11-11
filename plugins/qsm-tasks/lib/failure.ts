// How a qsm-tasks verb fails: an outcome code and the reason under it, from one closed set
// (design.md decision 10), so an agent branches on `data.reason` and never on the message.
import { fail, type Outcome } from "../../../lib/outcome.ts";

interface Reasons {
  readonly missing: "no-gh" | "no-repo" | "no-board" | "no-file";
  readonly blocked: "wrong-kind" | "wrong-status" | "held" | "private-data";
  readonly failed: "refused" | "not-found";
}

export interface Refusal {
  readonly reason: string;
  /** the one thing to do next, printed as `next:` */
  readonly next?: string;
}

/** A value, or the outcome the verb ends with. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly outcome: Outcome<Refusal> };

export function refuse<C extends keyof Reasons>(
  code: C,
  reason: Reasons[C],
  message: string,
  next?: string,
): { readonly ok: false; readonly outcome: Outcome<Refusal> } {
  return {
    ok: false,
    outcome: fail(code, message, next === undefined ? { reason } : { reason, next }),
  };
}
