## ADDED Requirements

### Requirement: CI runs the ci point on every push to main

`.github/workflows/ci.yml` SHALL hold a `langdev` job that, on a push to `main`, installs the
checkers `qsm-langdev doctor` names, builds the bin, and runs
`qsm-langdev check --at ci --against <the commit the push replaced>`, with `timeout-minutes: 30`.
When the replaced commit is all zeros or not in the clone's history, the job SHALL report the run
skipped with that reason and pass, as the push gate does on a first push. `SEMGREP_APP_TOKEN` SHALL
come from the repository's secrets.

#### Scenario: A push to main

- **WHEN** a push moves `main` from `A` to `B`
- **THEN** the `langdev` job SHALL compare `B` against `A` at the `ci` point
  and fail when a checker is worse

#### Scenario: The first push

- **WHEN** the replaced commit is all zeros
- **THEN** the job SHALL print `skipped` with the reason and pass

## MODIFIED Requirements

### Requirement: Semgrep scans the changes at a commit and at a push, and asks for a login

Semgrep's community engine analyses each file on its own: a flow from one file into another is not
found even when both files are scanned together. Every semgrep checker SHALL scan the `changed` set
with the community engine at the pre-commit point (the commit hook, the stop gate, and `check`,
whose default is pre-commit) and the pre-push point (the push hook and `check --at pre-push`) alike,
whatever the login, and SHALL NOT ask for the login. No semgrep checker SHALL run at the edit point:
one file alone took 9.0 s, most of the 10 s the engine gives the edit hook. The Pro engine's
cross-file run over the whole tree is not a gate on a person's machine: measured on this repository,
both sides at once took 128 s quiet, 373 s with every core busy, and past 600 s at a load of 15, and
a run cut short blocks a push for nothing it proved. That run SHALL be every semgrep checker's form
at the `ci` point: `semgrep scan --pro` over the whole tree, logged in by `SEMGREP_APP_TOKEN` in the
environment; at `ci` a missing `SEMGREP_APP_TOKEN` SHALL fail the checker, naming the variable, and
never fall back to the community engine. Nothing SHALL run `semgrep ci`, which uploads.
`doctor` and `install` SHALL report, as a warning and never a failure, when the semgrep CLI is not
logged in: `semgrep is not logged in: run semgrep login to use qsm-langdev at its fullest`, asking
the CLI, never reading its token file: `semgrep show identity` exiting 0, or a `SEMGREP_APP_TOKEN`
in the environment, is logged in; exiting 2 is logged out; any other answer SHALL be warned as
unknown, never taken for logged out. An absent semgrep is its missing binary, never a login warning.
A free login adds the Pro engine (cross-file analysis for TypeScript, JavaScript, Python and C#),
the Pro rules, and supply-chain scanning. A checker that runs past its time limit SHALL be reported
as not measured, naming the limit and the retry, and SHALL NOT be reported as worse. So SHALL a
checker whose run ended with output its parser cannot read, a tool error rather than findings:
`<checker>: not measured: <cause>; retry`, the cause the tool's own words (semgrep's JSON `errors`,
else the first line of stderr that says something, or the last when a Python traceback opens it,
else the exit code), and it SHALL NOT be stored. Output the parser reads is measured whatever the
exit code: semgrep exiting 1 with results is findings. A run with a checker not measured and none
worse answers `blocked`, never `ok`: nothing proved the tree no worse. A worse checker in the same
run answers `worse`. The stop gate logs a checker not measured as a warning and does not hold the
agent.

#### Scenario: A bash script piping a download into bash

- **WHEN** a changed `.sh` file runs `curl -fsSL https://x | bash`
- **THEN** `semgrep-bash` SHALL report
  `bash.curl.security.curl-pipe-bash.curl-pipe-bash` on that line

#### Scenario: A Dockerfile with a suffix

- **WHEN** a commit changes `deploy/Dockerfile.prod`
- **THEN** `semgrep-dockerfile` SHALL scan it, and no other semgrep checker
  SHALL

#### Scenario: A commit

- **WHEN** a commit changes 3 of 376 TypeScript files, whether semgrep is
  logged in or not
- **THEN** semgrep SHALL scan those 3 files only, with the community engine

#### Scenario: A push

- **WHEN** a push runs, whether semgrep is logged in or not
- **THEN** every semgrep checker SHALL scan the changed files with the
  community engine, as a commit does

#### Scenario: An edit

- **WHEN** the edit hook checks a written `.ts` file
- **THEN** no semgrep checker SHALL run, and `semgrep-ts` SHALL scan the file
  at the next commit

#### Scenario: A CI run

- **WHEN** `qsm-langdev check --at ci` runs with `SEMGREP_APP_TOKEN` set
- **THEN** every selected semgrep checker SHALL run `semgrep scan --pro` over
  the whole tree, and nothing SHALL run `semgrep ci`

#### Scenario: A CI run without the token

- **WHEN** `qsm-langdev check --at ci` runs with no `SEMGREP_APP_TOKEN`
- **THEN** every selected semgrep checker SHALL fail naming
  `SEMGREP_APP_TOKEN`, and SHALL NOT scan with the community engine

#### Scenario: Not logged in

- **WHEN** semgrep is on PATH and `semgrep show identity` exits 2
- **THEN** `doctor` and `install` SHALL warn `semgrep is not logged in: run
  semgrep login to use qsm-langdev at its fullest` and their exit codes
  SHALL NOT change

#### Scenario: A timeout

- **WHEN** semgrep does not finish within its limit
- **THEN** the report SHALL say `semgrep-ts: not measured: timed out after 60s;
  retry` and the verdict SHALL NOT call it worse

#### Scenario: A real finding at a non-zero exit

- **WHEN** semgrep exits 1 with a result in its JSON on a changed file
- **THEN** that result SHALL count as a finding, and the verdict SHALL be
  worse when the reference side does not hold it
