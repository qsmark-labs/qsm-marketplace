// The forms a Bash line can delete a snapshot or write a file of the store in, and the ones that
// only look like it. The guard stops a mistake, not a deliberate evasion, so ordinary work runs.
import { describe, expect, it } from "bun:test";
import { deleteRefusal } from "./delete-guard.ts";

const ID = "demo-main-1";
/** A session whose HOME is /home/u and whose XDG_DATA_HOME points elsewhere. */
const HOMES = { home: "/home/u", xdg: "/srv/data" };
const OWNER = "only the owner deletes a snapshot";
const FILES = "only the owner changes the files of the qsm-docs store";
const STORE = "~/.local/share/qsm-docs";

const refused = (line: string): string => deleteRefusal(line, HOMES) ?? `let through: ${line}`;

/** The delete verb, run. */
const DENY_DELETE = [
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
  `cd plugins/qsm-docs && mise exec -- bun run scripts/cli.ts delete x`,
  `bun ./scripts/cli.ts delete x`,
  `sh -c "qsm-docs delete ${ID}"`,
  `zsh -lc 'qsm-docs delete ${ID}'`,
  `eval "qsm-docs delete ${ID}"`,
  `echo "$(qsm-docs delete ${ID})"`,
  `x=$(qsm-docs delete ${ID})`,
  `echo \`qsm-docs delete ${ID}\``,
  `sudo -u owner env A=1 timeout 5 nice -n 10 qsm-docs delete ${ID}`,
  `nohup command qsm-docs delete ${ID}`,
  `echo ${ID} | xargs -I {} qsm-docs delete {}`,
  `cat <<EOF\n$(qsm-docs delete ${ID})\nEOF`,
  `cat <<EOF\nnote \`qsm-docs delete ${ID}\`\nEOF`,
];

/** A write to a file of the store or a directory it lies in. */
const DENY_WRITE = [
  `rm -rf ${STORE}/projects/demo`,
  "rm /home/u/.local/share/qsm-docs/projects/demo/ledger.jsonl",
  'rm "$HOME/.local/share/qsm-docs/kinds/bpmn/manifest.json"',
  "rm -r ${HOME}/.local/share/qsm-docs",
  "rm $XDG_DATA_HOME/qsm-docs/projects/demo/x.json",
  "rm -f /srv/data/qsm-docs/projects/demo/x.json",
  `mv ${STORE}/projects/demo /tmp/gone`,
  `mv /tmp/forged.json ${STORE}/projects/demo/x.json`,
  `cp /tmp/forged.json ${STORE}/projects/demo/x.json`,
  `truncate -s 0 ${STORE}/projects/demo/ledger.jsonl`,
  `echo '{}' > ${STORE}/projects/demo/ledger.jsonl`,
  "echo x >> /srv/data/qsm-docs/projects/demo/ledger.jsonl",
  `echo x 2>${STORE}/projects/demo/ledger.jsonl`,
  `echo x >| ${STORE}/projects/demo/ledger.jsonl`,
  `chmod 644 ${STORE}/projects/demo/x.json`,
  `sed -i 's/a/b/' ${STORE}/projects/demo/x.json`,
  `sed -Ei.bak 's/a/b/' ${STORE}/projects/demo/x.json`,
  `perl -pi -e 's/a/b/' ${STORE}/projects/demo/x.json`,
  `sudo rm -rf ${STORE}`,
  `bash -c 'rm -rf ${STORE}'`,
  `echo x | tee ${STORE}/projects/demo/ledger.jsonl`,
  "echo x | tee -a /home/u/.local/share/qsm-docs/projects/demo/ledger.jsonl",
  `dd if=/dev/zero of=${STORE}/projects/demo/x.json bs=1 count=1`,
  `ln -sf /tmp/forged.json ${STORE}/projects/demo/x.json`,
  "ln -s /tmp/elsewhere $HOME/.local/share/qsm-docs/kinds/bpmn",
  "rm -rf ~/.local/share",
  "rm -rf ~/.local/share/",
  "mv $XDG_DATA_HOME /tmp/old",
  "rm -rf /srv/data",
  "chmod -R 777 ~/.local",
  "rm -rf ~",
  "rm -rf /",
  "rm -rf ~/.local/share/qsm-*",
  "rm -rf ~/.local/share/qsm-docs*",
  `rm -rf ~//.local/./share/qsm-docs/projects`,
  `unlink ${STORE}/projects/demo/x.json`,
  `shred -u ${STORE}/projects/demo/x.json`,
  `find ${STORE}/projects -name '*.json' -delete`,
  `find ~/.local/share -name x -exec rm {} +`,
  `rsync -a --delete /tmp/empty/ ${STORE}/`,
  `rsync -a --delete-after /tmp/empty/ ~/.local/share/`,
  `cp -t ${STORE}/projects/demo /tmp/x.json`,
  `cp --target-directory=${STORE}/projects/demo /tmp/x.json`,
  `cp -t${STORE}/projects/demo /tmp/x.json`,
  `install -m 644 /tmp/x ${STORE}/projects/demo/x.json`,
  `install -o owner -g owner -m 0444 /tmp/x ${STORE}/projects/demo/x.json`,
  `install -t ${STORE}/kinds/bpmn /tmp/manifest.json`,
  `mv -t ${STORE}/projects/demo /tmp/x.json`,
  `mv -t /tmp/elsewhere ${STORE}/projects/demo`,
];

/** Ordinary work that only looks like one of the above. */
const MAY_RUN = [
  "qsm-docs list demo --open",
  "qsm-docs get delete-me",
  "qsm-docs kind remove fake",
  "qsm-docs delete --help",
  `qsm-docs delete ${ID} -h`,
  "echo delete qsm-docs",
  "echo qsm-docs delete is denied",
  "qsm-docs-delete x",
  "git branch --delete qsm-docs",
  'grep -rn "qsm-docs delete" plugins',
  'git commit -m "qsm-docs: guard qsm-docs delete"',
  "git commit -m \"$(cat <<'EOF'\nqsm-docs: the guard denies qsm-docs delete <id>\nEOF\n)\"",
  "cat > /tmp/x/notes.md <<'EOF'\nrun qsm-docs delete <id>\nEOF",
  "git commit -m \"$(cat <<'EOF'\nqsm-docs: two fixes: 1) the guard, 2) the store\n\nThe owner runs `qsm-docs delete <id>` himself.\nEOF\n)\"",
  "git commit -m \"$(cat <<'EOF'\nqsm-docs: the store holds :) and more\n\nNever `rm ~/.local/share/qsm-docs/projects/x` by hand.\nEOF\n)\"",
  'git commit -m "$(cat <<\'EOF\'\nqsm-docs: a lone " quote\nqsm-docs delete demo-main-1\nEOF\n)"',
  `install -m 644 /tmp/x /tmp/y`,
  `cp -t /tmp/out ${STORE}/projects/demo/x.json`,
  "cat <<-EOF\n\trun qsm-docs delete <id>\n\tEOF",
  'cat <<< "qsm-docs delete x"',
  "echo 'qsm-docs delete x' > note.txt",
  "bun plugins/qsm-docs/scripts/cli.ts list demo",
  `cat ${STORE}/projects/demo/ledger.jsonl`,
  `ls -la ${STORE}/projects`,
  `cp ${STORE}/projects/demo/x.json /tmp/x.json`,
  `sed -n 1p ${STORE}/projects/demo/ledger.jsonl`,
  "rm -rf ~/.local/share/qsm-docs-old /tmp/qsm-docs",
  "echo x > /tmp/qsm-docs/ledger.jsonl",
  `wc -l < ${STORE}/projects/demo/ledger.jsonl`,
  `cat ${STORE}/projects/demo/x.json | tee /tmp/x.json`,
  `dd if=${STORE}/projects/demo/x.json of=/tmp/x.json`,
  `ln -s ${STORE}/projects/demo/x.json /tmp/x.json`,
  `ln -s ${STORE}`,
  "rm -rf ~/.local/share/other-app",
  "cp -r ~/.local/share /tmp/backup",
  "ls ~/.local/share",
  "chmod 644 ~/.local/share/other-app/x",
  `grep -rn rm ${STORE}/projects/demo/ledger.jsonl`,
  `rg tee ${STORE}`,
  "mv build.log ~",
  "mv dist/x ~/.local/share/",
  "rm *.log",
  "rm -rf ./build/*",
  `find ${STORE} -name '*.json'`,
  `rsync -a ${STORE}/ /tmp/backup/`,
  `perl -ne 'print' ${STORE}/projects/demo/x.json`,
];

describe("deleteRefusal", () => {
  it("refuses qsm-docs delete in any form that runs it, naming the owner's command", () => {
    for (const line of DENY_DELETE) {
      expect(refused(line)).toContain(OWNER);
    }
    expect(refused(`rtk qsm-docs delete ${ID}`)).toContain(`\`! qsm-docs delete ${ID}\``);
    expect(refused(`bun plugins/qsm-docs/scripts/cli.ts delete ${ID}`)).toContain(
      `\`! qsm-docs delete ${ID}\``,
    );
  });

  it("refuses a write to the store or a directory it lies in, naming the same command", () => {
    for (const line of DENY_WRITE) {
      expect(refused(line)).toContain(FILES);
    }
    expect(refused(`rm -rf ${STORE}/projects/demo`)).toContain(
      `\`! rm -rf ${STORE}/projects/demo\``,
    );
  });

  it("lets ordinary work run: other verbs, reads, a mention in an argument or a heredoc", () => {
    for (const line of MAY_RUN) {
      expect([line, deleteRefusal(line, HOMES)]).toEqual([line, null]);
    }
  });
});
