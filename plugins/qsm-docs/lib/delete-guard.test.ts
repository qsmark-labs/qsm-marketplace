// The forms a Bash line can delete a snapshot in, and the ones that only look like it.
import { describe, expect, it } from "bun:test";
import { deleteRefusal } from "./delete-guard.ts";

const ID = "demo-main-1";

describe("deleteRefusal", () => {
  it("refuses qsm-docs delete in any form that runs it, naming the owner's command", () => {
    for (const line of [
      `qsm-docs delete ${ID}`,
      `rtk qsm-docs delete ${ID}`,
      `~/.local/bin/qsm-docs delete ${ID} --json`,
      `qsm-docs list demo && qsm-docs delete ${ID}`,
      `bash -c 'qsm-docs delete ${ID}'`,
      `id=x; (qsm-docs --no-input delete ${ID})`,
      `for i in ${ID}; do qsm-docs delete "$i"; done`,
      `"qsm-docs" delete ${ID}`,
      `"$HOME/.local/bin/qsm-docs" delete ${ID}`,
      `qsm-docs "delete" ${ID}`,
      `bun plugins/qsm-docs/scripts/cli.ts delete ${ID}`,
      `mise exec -- bun ./plugins/qsm-docs/scripts/cli.ts --json delete ${ID}`,
      `sh -c "qsm-docs delete ${ID}"`,
      `zsh -lc 'qsm-docs delete ${ID}'`,
      `eval "qsm-docs delete ${ID}"`,
      `echo "$(qsm-docs delete ${ID})"`,
      `x=$(qsm-docs delete ${ID})`,
      `echo \`qsm-docs delete ${ID}\``,
    ]) {
      expect(deleteRefusal(line) ?? `let through: ${line}`).toContain(
        "only the owner deletes a snapshot",
      );
    }
    expect(deleteRefusal(`rtk qsm-docs delete ${ID}`)).toContain(`\`! qsm-docs delete ${ID}\``);
    expect(deleteRefusal(`bun plugins/qsm-docs/scripts/cli.ts delete ${ID}`)).toContain(
      `\`! qsm-docs delete ${ID}\``,
    );
  });

  it("lets every other verb, and a mention of delete in an argument, run", () => {
    for (const line of [
      "qsm-docs list demo --open",
      "qsm-docs get delete-me",
      "qsm-docs kind remove fake",
      "echo delete qsm-docs",
      "qsm-docs-delete x",
      "git branch --delete qsm-docs",
      'grep -rn "qsm-docs delete" plugins',
      'git commit -m "qsm-docs: guard qsm-docs delete"',
      "echo 'qsm-docs delete x' > note.txt",
      "bun plugins/qsm-docs/scripts/cli.ts list demo",
    ]) {
      expect([line, deleteRefusal(line)]).toEqual([line, null]);
    }
  });
});
