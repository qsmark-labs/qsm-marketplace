## Context

The structure is the qsm-docs container of `../feature-flow/models/marketplace.c4`; the behaviour is
`models/qsm-docs/proposal.bpmn` and `delete.bpmn`. The lens of qsm-builder already serves one page
on 127.0.0.1 (`plugins/qsm-builder/lib/lens/serve.ts`) and turns a saved edit into a task; qsm-docs
takes that server's shape for every kind, and the lens moves onto it as the next piece.

## Decisions

1. **A plugin of its own.** Options: verbs in qsm-builder, verbs in qsm-models, a new plugin, doing
   nothing. Choice: a new plugin. Reason: it is installed alone (the lens and qsm-models both stand
   on it) and must know nothing of BPMN or C4; in qsm-models the lens would depend on a model tool.
   Reopens when: a second plugin never comes, and the lens stays where it is.
2. **One file per snapshot plus one append-only ledger per project.** Options: one JSON envelope per
   snapshot holding the bytes and the metadata; a SQLite file; a git repository; files plus a
   ledger. Choice: `<data>/qsm-docs/<project>/<id>.<ext>` holds the bytes exactly, written
   read-only, and `<data>/qsm-docs/<project>/ledger.jsonl` gets one line per create (id, kind,
   project, branch, time, parent, sha256, made by a page or the CLI) and per delete. Reason: `get`
   returns the file untouched, the ledger gives order and the hash that proves no update (criterion
   2), and an append never rewrites a line. SQLite hides the bytes; an envelope makes `get`
   reassemble them. Reopens when: a project holds so many snapshots that reading the ledger is slow
   (measure first).
3. **The id is `<project>-<branch>-<timestamp>`, the branch with `/` as `_`, UTC to the
   millisecond.** Options: a hash, a counter, the epic's form. Choice: the epic's form. Reason: an
   id says where and when it was made, and sorts by time within a branch. The id is never parsed:
   the ledger holds the true project and branch, so a `_` in a real branch name costs nothing.
   Reopens when: two creates in one millisecond happen in practice (today: `blocked`, run again).
4. **The project is the main worktree's directory name.** Options: the remote's repository name, the
   current directory's name, a name in a config file. Choice: the parent of
   `git rev-parse --git-common-dir`. Reason: every worktree of one repository is one project, it
   needs no network and no remote, and another project is found by the same name on this machine.
   Reopens when: two repositories on one machine share a directory name.
5. **A kind is a manifest; `create` converts before it stores.** Options: kinds as code imported by
   qsm-docs, kinds as manifests with commands. Choice: a manifest with `convert` and `diff` as argv
   templates (`{file}`, `{a}`, `{b}`) and a page directory; qsm-models installs it with `kind add`
   from its installer. Reason: a plugin reaches another only through its CLI (AGENTS.md), so the
   converter is a command, and a snapshot no page can open never enters the store. The C4 model
   draws only qsm-models to qsm-docs: the call back through a manifest's command is the port, not
   a dependency. Reopens when: running a command per page load is too slow (measure first).
6. **A proposal is a page-made snapshot that no later snapshot names as its parent.** Options: a
   status field on the snapshot, a separate proposals list, the parent link. Choice: the parent
   link. Reason: a status is an update, which the store refuses; the applied snapshot already names
   its parent, so "open" is derived. A proposal the owner no longer wants is deleted by him.
   Reopens when: the owner wants to decline a proposal without deleting it.
7. **The hook keeps per session what it named.** Options: name every open proposal on every prompt,
   keep a global seen mark, keep it per session. Choice: at session start every open proposal of
   the project, then on each prompt only what is new since this session's last line, kept in
   `stateDir/qsm-docs/sessions/<session>` and removed at session end. Reason: two sessions of one
   project each hear of a proposal once, and one line per prompt is the most a hook may add.
   Reopens when: the owner wants a proposal named in every prompt until it is applied.
8. **The delete guard is a pure function of the command line in `lib/`.** Options: a guard in the
   hook, a guard in the binary that asks who called it. Choice: the qsm-forge pattern, a
   `tool.call` hook on Bash calling a function of `lib/` that reads every command of the line. The
   binary cannot know whether a person or an agent runs it; the hook can, and a `!` command of the
   owner never reaches it. Reopens when: a harness without hooks runs the agent.
9. **The server takes the lens's shape.** Options: write a new server, reuse the lens's server. The
   lens code is qsm-builder's and may not be imported (AGENTS.md: a plugin imports root `lib/` and
   itself only). Choice: write qsm-docs' server on Bun's `serve`, as the lens does, and move the
   lens onto it later. A content security policy of `'self'` on every response makes the browser
   refuse anything else, which is stronger than trusting each kind's page. Reopens when: a kind
   needs a resource it cannot bundle.

## Verify, each proved before the first task that depends on it

1. **A page served by the binary requests nothing outside 127.0.0.1**: a scripted browser run that
   opens `/json` and records every request.

## Critiques

The three critique passes are in the proposal, under `## Critiques`.
