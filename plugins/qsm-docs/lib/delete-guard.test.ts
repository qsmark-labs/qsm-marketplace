// The forms a Bash line can delete a snapshot or write a file of the store in, and the ones that
// only look like it.
import { describe, expect, it } from "bun:test";
import { deleteRefusal } from "./delete-guard.ts";

const ID = "demo-main-1";
/** A session whose HOME is /home/u and whose XDG_DATA_HOME points elsewhere. */
const HOMES = { home: "/home/u", xdg: "/srv/data" };
const OWNER = "only the owner deletes a snapshot";
const FILES = "only the owner changes the files of the qsm-docs store";

const refused = (line: string): string => deleteRefusal(line, HOMES) ?? `let through: ${line}`;

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
      expect(refused(line)).toContain(OWNER);
    }
    expect(refused(`rtk qsm-docs delete ${ID}`)).toContain(`\`! qsm-docs delete ${ID}\``);
    expect(refused(`bun plugins/qsm-docs/scripts/cli.ts delete ${ID}`)).toContain(
      `\`! qsm-docs delete ${ID}\``,
    );
  });

  it("refuses a write to a file under the store in every way the line can name it", () => {
    for (const line of [
      "rm -rf ~/.local/share/qsm-docs/projects/demo",
      "rm /home/u/.local/share/qsm-docs/projects/demo/ledger.jsonl",
      'rm "$HOME/.local/share/qsm-docs/kinds/bpmn/manifest.json"',
      "rm -r ${HOME}/.local/share/qsm-docs",
      "rm $XDG_DATA_HOME/qsm-docs/projects/demo/x.json",
      "rm -f /srv/data/qsm-docs/projects/demo/x.json",
      "mv ~/.local/share/qsm-docs/projects/demo /tmp/gone",
      "mv /tmp/forged.json ~/.local/share/qsm-docs/projects/demo/x.json",
      "cp /tmp/forged.json ~/.local/share/qsm-docs/projects/demo/x.json",
      "truncate -s 0 ~/.local/share/qsm-docs/projects/demo/ledger.jsonl",
      "echo '{}' > ~/.local/share/qsm-docs/projects/demo/ledger.jsonl",
      "echo x >> /srv/data/qsm-docs/projects/demo/ledger.jsonl",
      "echo x 2>~/.local/share/qsm-docs/projects/demo/ledger.jsonl",
      "chmod 644 ~/.local/share/qsm-docs/projects/demo/x.json",
      "sed -i 's/a/b/' ~/.local/share/qsm-docs/projects/demo/x.json",
      "sed -Ei.bak 's/a/b/' ~/.local/share/qsm-docs/projects/demo/x.json",
      "sudo rm -rf ~/.local/share/qsm-docs",
      "bash -c 'rm -rf ~/.local/share/qsm-docs'",
    ]) {
      expect(refused(line)).toContain(FILES);
    }
    expect(refused("rm -rf ~/.local/share/qsm-docs/projects/demo")).toContain(
      "`! rm -rf ~/.local/share/qsm-docs/projects/demo`",
    );
  });

  it("lets every other verb, a read of the store, and a mention in an argument run", () => {
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
      "cat ~/.local/share/qsm-docs/projects/demo/ledger.jsonl",
      "ls -la ~/.local/share/qsm-docs/projects",
      "cp ~/.local/share/qsm-docs/projects/demo/x.json /tmp/x.json",
      "sed -n 1p ~/.local/share/qsm-docs/projects/demo/ledger.jsonl",
      "rm -rf ~/.local/share/qsm-docs-old /tmp/qsm-docs",
      "echo x > /tmp/qsm-docs/ledger.jsonl",
      "wc -l < ~/.local/share/qsm-docs/projects/demo/ledger.jsonl",
    ]) {
      expect([line, deleteRefusal(line, HOMES)]).toEqual([line, null]);
    }
  });
});
