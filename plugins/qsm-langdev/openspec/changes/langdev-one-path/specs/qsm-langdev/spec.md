## ADDED Requirements

### Requirement: The commit gate and the stop gate judge with one rule

The commit and push gates and the session-stop gate SHALL classify every
verdict through one judgement with one policy: a measured checker that is
worse blocks all of them; a missing binary, a missing config or a checker
that was not measured blocks the commit and the push (nothing proved the tree
no worse) and is a warning at a stop; a skipped checker is reported and
decides nothing.

#### Scenario: A missing config at a commit and at a stop

- **WHEN** a selected checker's config file is absent
- **THEN** the commit gate SHALL block naming the file, and the stop gate
  SHALL pass with a warning naming the same file

#### Scenario: A worse checker at a commit and at a stop

- **WHEN** a measured checker is worse on the staged side
- **THEN** the commit gate and the stop gate SHALL both block with the same
  description of the checker

### Requirement: The gates config fails loud

Reading `.qsm-langdev/gates.json` SHALL fail with the project's `failed`
error, naming the file and the field, when it does not parse, is not an
object, or names a language or a gate this tool does not know. An absent
file SHALL read as the default configuration.

#### Scenario: An unknown language in the config

- **WHEN** `gates.json` lists `"languages": ["nope"]`
- **THEN** every verb and gate that reads it SHALL fail naming `languages`,
  `nope` and the known languages

#### Scenario: A config that does not parse

- **WHEN** `gates.json` is not valid JSON
- **THEN** every verb and gate that reads it SHALL fail naming the file,
  never run as if no language were selected

### Requirement: The first commit of a repository is reported, never blocked

When there is no commit to compare against, the commit gate SHALL report the
staged side's totals and pass, as `check` does, because no reference exists
for anything to be worse than.

#### Scenario: The first commit with a finding

- **WHEN** a fresh repository with langdev installed commits its first file,
  which carries a finding
- **THEN** the commit gate SHALL pass and report the finding's total

## MODIFIED Requirements

### Requirement: The checker deadline terminates its owned process group

One process runner SHALL start every process a run starts (a checker, a
presence probe, a fixer, the structural checker, the secrets scanners, the
rule pack fetch and the semgrep login probe) in its own process group and
terminate that group at the limit, including engine children started by a
launcher. The limit SHALL be the run's point's timeout from the point table,
or at the edit point what is left of its deadline; no process SHALL carry a
limit of its own and none SHALL run without one. A process that hits the
limit SHALL be reported not measured. It SHALL NOT identify
processes for termination by executable name or terminate unrelated user processes.

#### Scenario: A timed-out launcher has a running engine child

- **WHEN** a checker launcher starts an engine child and the checker exceeds its outer deadline
- **THEN** the runner SHALL terminate the owned launcher and engine group, report not measured,
  and leave no running engine from that invocation after cleanup

#### Scenario: The structural checker hangs

- **WHEN** the structural checker does not exit before the point's timeout
- **THEN** its process group SHALL be terminated and the structure verdict
  SHALL be not measured, naming the limit

### Requirement: A missing binary or a missing config fails, never a skip

`check` SHALL fail, naming the checker and its install command, when a selected checker's binary is
not resolvable. `check` SHALL also fail, naming the missing file and that it must be created or the
checker removed from selection, when a selected language has no scaffolded config in the repository,
or a selected checker that names a config file of its own lacks that file, since scoring both sides
at a tool's defaults would let nothing ever regress. A binary whose `--version` presence probe does
not answer in time (five minutes, the limit for any process the gate starts) is not missing: `check`
SHALL report that checker as not measured, naming the probe and its limit and asking for a retry,
and SHALL NOT tell the person to install it.

#### Scenario: A checker's binary is absent

- **WHEN** a selected checker's binary cannot be found
- **THEN** `check` SHALL fail and print that checker's install command

#### Scenario: A checker's presence probe times out

- **WHEN** a selected checker's binary does not answer `--version` within the
  probe limit
- **THEN** `check` SHALL report the checker as not measured with the limit
  named, and SHALL NOT say it is not installed

#### Scenario: A selected language has no config in the repository

- **WHEN** a language is selected and none of its config files exist in the
  repository
- **THEN** `check` SHALL fail, naming the missing file and `init` as the
  remedy

#### Scenario: A checker's own config is missing

- **WHEN** Python is selected, `ruff.toml` exists and `bandit.yaml` does not
- **THEN** `check` SHALL fail naming `bandit.yaml`, and bandit SHALL NOT run
  at its defaults

### Requirement: Every run computes its file sets once

Before any checker runs, the run SHALL compute two file sets, `changed` and
`given`, and hand each checker the one it declares. They are computed once per run, never per
checker, and the run reports each set's size.

#### Scenario: A commit that touches two files

- **WHEN** the index differs from `HEAD` in `a.ts` and `b.ts` and a
  per-file checker covers TypeScript
- **THEN** that checker SHALL be handed exactly `a.ts` and `b.ts`, and the
  report SHALL say `changed: 2 files`

#### Scenario: The whole project on request

- **WHEN** the caller names no files and a checker declares `given`
- **THEN** that checker SHALL be handed every file under the repository root
  that git does not ignore

### Requirement: The session-stop gate blocks a worsened tree, capped

At an agent's session stop, one gate SHALL compare every tree that agent
edited against the commit that was current there when the agent first edited
it, keyed to that agent's own edit record rather than to the directory the
gate runs in. One agent edits one tree: the gate attributes a tree's
regression to the agent that edited there and does not split a tree between
agents. The gate SHALL score both the per-language finding comparison,
through the same rule as `check`, and the architectural quality comparison,
through the same rule as `structure`, in one run. A regression in either
comparison SHALL block the stop, reporting the changed files and, for the
comparison that regressed, the totals or the quality before and after. The
gate SHALL allow the stop when both comparisons held or improved. The edited
tree's side is its index, as for `check`: an edit the agent did not stage is
not scored, and the gate SHALL name each file with an unstaged change in a
warning (`unstaged changes not scored:`) and each untracked file in a warning
(`untracked, not scored:`) rather than pass over it in silence; a file staged
and then edited again is scored as staged and named too. The gate SHALL run
at a subagent's stop and at the main agent's stop alike, with one cap per
session and agent. When a tree
has no ruleset to score one comparison under, or the checker that comparison
needs is unavailable, the gate SHALL allow the stop and report a warning for
that comparison rather than a block. The gate SHALL run at the pre-commit
point, with that point's target and timeout for every checker.

#### Scenario: A checker slower than the commit target at a stop

- **WHEN** a checker takes 45 seconds in the stop gate
- **THEN** the gate SHALL score it, report it slow against the 30-second
  target, and SHALL NOT report it not measured

#### Scenario: A worktree agent is judged on its own tree

- **WHEN** an agent edited only its own worktree while another agent edited
  the main checkout, and the gate runs with the main checkout as its
  directory
- **THEN** the gate SHALL judge the first agent only on its worktree against
  its own start commit there

#### Scenario: An edit the agent did not stage

- **WHEN** the stopping agent edited a tracked file and staged none of it
- **THEN** the gate SHALL pass without scoring that edit and SHALL warn
  `unstaged changes not scored:` naming the file

#### Scenario: An agent with no recorded edit

- **WHEN** the stopping agent has no recorded edit anywhere
- **THEN** the gate SHALL pass, saying the agent edited no tree

#### Scenario: Either comparison regressed

- **WHEN** an agent's edited tree carries a new finding, scores lower
  architectural quality, or both, relative to the commit it started from
- **THEN** the gate SHALL block the stop once and report every comparison
  that regressed

#### Scenario: The block cap is reached

- **WHEN** the same standing regression has already blocked the same agent's
  stop a bounded number of times
- **THEN** the gate SHALL allow the stop, record the regression instead of
  blocking again, and SHALL NOT block that agent for the same regression
  again in the session

#### Scenario: The main agent stops with a worse staged tree

- **WHEN** the main agent of a session staged a change that makes a checker
  worse and its turn ends
- **THEN** the gate SHALL block that stop as it blocks a subagent's

### Requirement: Installing and removing the git hooks is reversible

`install` SHALL wire the reference-versus-shipped comparison into the repository's commit and push
points, appending to an existing hook script rather than replacing it, each calling
`qsm-langdev hook <pre-commit|pre-push>`, and marking exactly what it added. The pre-push call
carries the remote name git hands the hook as its first argument. `install` SHALL bring a hook or
block it wrote earlier up to the current call, so a repository is never left on a stale one, by
replacing only its earlier call line: whatever the person added to a hook `install` wrote whole
stays as it was. A hook `install` wrote whole that holds neither the current nor the earlier call
line SHALL be left untouched and named with the line to add by hand. An existing hook
that is not a shell script SHALL be left untouched and named with the line
to add by hand. `uninstall` SHALL remove exactly what `install` added and
nothing the repository already had.

#### Scenario: Installing beside an existing hook

- **WHEN** the repository already has its own pre-commit hook
- **THEN** `install` SHALL append its own marked block rather than replacing
  the file

#### Scenario: Uninstall restores the prior hook

- **WHEN** `uninstall` runs after `install` appended to an existing hook
- **THEN** the repository's original hook content SHALL remain and the
  appended block SHALL be gone

#### Scenario: Reinstalling over a hook written before the remote name was passed

- **WHEN** `install` runs and the pre-push hook or block it wrote earlier lacks the remote name
- **THEN** that hook or block SHALL be rewritten to the current call, and a second `install` SHALL
  change nothing

#### Scenario: Reinstalling over a hook the person extended

- **WHEN** `install` runs and the pre-push hook it wrote whole has the earlier call line followed by
  lines the person added
- **THEN** only the call line SHALL change, and every added line SHALL stay

### Requirement: Doctor reports each checker's binary as present or missing

`doctor` SHALL report, for every checker in the languages currently selected
and the always-on languages, whether its
binary resolves and, when it does not, the command to install it. `doctor`
SHALL also report whether the structural checker on the machine reports a
qsm-patched version, distinguishing that from an unpatched upstream checker
and from none present at all. A binary that does not answer `--version` within the probe limit is
not missing: `doctor` SHALL report it as not measured, as `check` does. `doctor` SHALL install
nothing.

#### Scenario: A backing linter is missing

- **WHEN** a selected checker's binary does not resolve
- **THEN** `doctor` SHALL list it as missing together with its install
  command, and run no install itself

#### Scenario: Doctor meets a checker whose presence probe times out

- **WHEN** a selected checker's binary does not answer `--version` within the probe limit
- **THEN** `doctor` SHALL list it as not measured and ask for a retry, SHALL NOT list it as
  missing or give its install command, and SHALL end `blocked` rather than `missing` when no
  binary is truly absent

#### Scenario: An unpatched structural checker is present

- **WHEN** the structural checker on PATH reports a plain upstream version
- **THEN** `doctor` SHALL report it as not ready, distinguishing this from no
  structural checker being present at all

## REMOVED Requirements

### Requirement: The import graph is one module every language feeds

**Reason**: no checker declares the `changed+N` file set it feeds; 502 lines and a cache directory
served nothing.

**Migration**: none; a checker that needs importers declares `given`.
