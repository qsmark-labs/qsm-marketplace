// How a qsm-tasks verb fails: an outcome code and the reason under it, from one closed set
// (design.md decision 10), so an agent branches on `data.reason` and never on the message. A reason
// enters the set with the first verb that uses it.
import { fail, type Outcome } from "../../../lib/outcome.ts";

interface Reasons {
  readonly missing: "no-gh" | "no-repo" | "no-board" | "no-file";
  readonly blocked: "wrong-kind" | "wrong-status" | "held";
  /** `not-built`: a declared verb whose issue has not landed; it leaves with the last of them */
  readonly failed: "refused" | "not-found" | "not-built";
}

interface Refusal {
  readonly reason: string;
  /** the one thing to do next, printed as `next:` */
  readonly next?: string;
}

interface Refused {
  readonly ok: false;
  readonly outcome: Outcome<Refusal>;
}

/** A value, or the outcome the verb ends with. */
export type Result<T> = { readonly ok: true; readonly value: T } | Refused;

/** A step that holds or a write that was made, with nothing to hand on. */
export const done: Result<null> = { ok: true, value: null };

/** A call that cannot go on as given, found only once GitHub answered: `usage`, with no reason. */
export function wrongCall(message: string): Refused {
  return { ok: false, outcome: fail<Refusal>("usage", message) };
}

export function refuse<C extends keyof Reasons>(
  code: C,
  reason: Reasons[C],
  message: string,
  next?: string,
): Refused {
  return {
    ok: false,
    outcome: fail(code, message, next === undefined ? { reason } : { reason, next }),
  };
}
