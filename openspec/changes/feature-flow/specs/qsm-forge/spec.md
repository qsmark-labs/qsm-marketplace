## ADDED Requirements

### Requirement: Open a pull request into a feature branch

`qsm-forge gh pr-open --base <branch> --title <title> --body-file <file>` SHALL push nothing and
open one pull request from the current branch into the base, with the body read from the file,
and print its number and URL. It SHALL exit `usage` when the body lacks a section of the
repository's pull request template or a `Closes #N` line, and `failed` with GitHub's words when
GitHub refuses.

#### Scenario: A task pull request is opened

- **WHEN** a session on branch `task/12` runs `pr-open --base feature/3` with a body that has the
  four template sections and `Closes #12`
- **THEN** one pull request from `task/12` into `feature/3` exists and its number and URL print

#### Scenario: A body without its close line

- **WHEN** the body has no `Closes #N` line
- **THEN** it exits `usage` naming the missing line and opens nothing
