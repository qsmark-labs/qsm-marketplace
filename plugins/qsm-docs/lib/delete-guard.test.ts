// The forms a Bash line can delete a snapshot in, and the ones that only look like it.
import { describe, expect, it } from "bun:test";
import { deleteRefusal } from "./delete-guard.ts";

describe("deleteRefusal", () => {
  it("refuses qsm-docs delete in any position of the line, naming the owner's command", () => {
    for (const line of [
      "qsm-docs delete demo-main-1",
      "rtk qsm-docs delete demo-main-1",
      "~/.local/bin/qsm-docs delete demo-main-1 --json",
      "qsm-docs list demo && qsm-docs delete demo-main-1",
      "bash -c 'qsm-docs delete demo-main-1'",
      "id=x; (qsm-docs --no-input delete demo-main-1)",
      'for i in a b; do qsm-docs delete "$i"; done',
    ]) {
      expect(deleteRefusal(line)).toContain("only the owner deletes a snapshot");
    }
    expect(deleteRefusal("rtk qsm-docs delete demo-main-1")).toContain(
      "`! qsm-docs delete demo-main-1`",
    );
  });

  it("lets every other qsm-docs verb and a mere mention of delete run", () => {
    for (const line of [
      "qsm-docs list demo --open",
      "qsm-docs get delete-me",
      "qsm-docs kind remove fake",
      "echo delete qsm-docs",
      "qsm-docs-delete x",
      "git branch --delete qsm-docs",
    ]) {
      expect(deleteRefusal(line)).toBeNull();
    }
  });
});
