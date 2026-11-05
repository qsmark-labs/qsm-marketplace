# qsm-langdev

Per-language quality checks for one developer and their agent: did this change make the tree's
findings worse than the reference commit.

## Why it exists

An agent cannot see the quality of what it wrote until something outside it
measures it, and by then the session is usually over. qsm-langdev exists so
the measurement happens inside the session, at the moment a file lands and
again before the agent hands the work back, for the language of the file and
for the shape of the whole tree. It never scores a tree alone; it compares the
tree being shipped against the tree it replaces, so the only question it ever
answers is whether this change made things worse. It refuses to be a linter
run for its own sake, a stored score, or a gate that blocks without saying
where. It is the floor under every other plugin's promise of quality; without
it, "the agent checked its work" is a sentence, not a fact.

## What you get

| Kind | Name | What it does |
| --- | --- | --- |
| CLI | `qsm-langdev` | 10 verbs, see [USAGE.md](USAGE.md) |
| Hook | `tool.call` on Bash | Denies `git commit --no-verify`, `git push --no-verify`, and an agent's `QSM_LANGDEV_ALLOW` |
| Hook | `tool.call` on Write, Edit, NotebookEdit | Fixes the file, then checks it in place against the project's rules and tells the model that file's findings. No tree, no HEAD, no branch. Never blocks |
| Hook | `Stop`, `SubagentStop` | Blocks the stop of the main agent or a subagent when the staged tree got worse than the agent's start commit, at most 3 times; names unstaged and untracked files |
| MCP server | `sentrux` | Architecture queries over the tree: scan, health, dsm, check_rules, test_gaps |

## Install

```bash
claude plugin install qsm-langdev@qsm-marketplace
qsm-setup install qsm-langdev
qsm-langdev init --profile general
```

`qsm-setup install` compiles `qsm-langdev` and the stop gate hook, and builds a patched `sentrux`
with `cargo` (minutes) when it is absent. Details in [INSTALL.md](INSTALL.md). `init` writes the
profile's per-tool configs and records the repository's languages in `.qsm-langdev/gates.json`.

## Use

```bash
qsm-langdev doctor                                   # which checker binaries are missing
qsm-langdev check                                    # the staged content against HEAD
qsm-langdev check --against main --at pre-push       # the commits since main, at the pre-push targets
qsm-langdev install                                  # write the pre-commit and pre-push git hooks
```

The edit hook, the stop gate, and the installed git hooks do nothing in a repository that never ran
`qsm-langdev init`. `check` there says so and exits.

Which languages a repository gates on is that repository's choice, kept in
`.qsm-langdev/gates.json`: `qsm-langdev languages add py` opts one in, `languages remove py` takes
it out. A language plugin such as qsm-langdev-py is only the skill that teaches an agent the
language; uninstalling it changes no gate, so stay installed and remove the language from the
project that does not need it.

## Caveats

- Every point has a target per checker, and a timeout that stops a run: edit 5 s and 7.5 s (one
  shared deadline inside the engine's 10 s hook budget), pre-commit 30 s and 5 min, pre-push 1 min
  and 5 min, ci 10 min and 20 min. A run over target prints `slow: <checker> X s at <point>,
  target Y s` and never fails; `qsm-langdev doctor` names a checker whose median over its last 10
  runs is over target.
- Every comparison scores staged and committed content only, never an unstaged change. The commit
  gate compares the index against HEAD, the stop gate against the agent's start commit, and a push
  compares each pushed commit against the code it lands on (the branch's remote tip, or where a new
  branch was cut from).
- A commit or push blocks on a worse tree, a missing checker or config, and a run that could not be
  measured; the stop gate blocks only on a worse tree and warns on the others. A checker with
  nothing to compare against is skipped and reported, never blocking.
- Every checker with a safe fix mode is fixed before the check, on an edit and on staged files at
  commit. A staged file with unstaged changes is not fixed at commit; the block names it.
- A file `.gitattributes` marks `linguist-generated` or `export-ignore` is not scored by the quality
  checkers or `structure`; the security scanners and the secrets, entropy and denylist gates still
  read it.
- No warnings and no suppression comments: a rule fails or is off.
- A missing checker binary or missing scaffolded config fails `check`; `qsm-langdev doctor` names
  what to install.
- To let one measured regression pass, type it yourself in the prompt:
  `! QSM_LANGDEV_ALLOW="<why>" git commit`. An agent's allow and `--no-verify` are denied in a
  session.
- semgrep scans the changed files with its community engine at every point; the Pro engine's
  cross-file run belongs to the `ci` point, whose CI job is not built yet: nothing runs `ci`
  today, and `check --at` takes `pre-commit` and `pre-push`.
- Everything else: `qsm-langdev --help`.
