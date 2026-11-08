## ADDED Requirements

### Requirement: Agents open pull requests as the organization's App

A pull request an agent opens SHALL be opened as the organization's GitHub App, with the owner as
its assignee and requested reviewer, so the owner's approval can be the one GitHub requires before
a merge into main or into `feature/*`. Every other write an agent makes SHALL stay the owner's own.

#### Scenario: An agent opens a pull request

- **WHEN** an agent runs `qsm-forge gh pr-open` for a pushed branch
- **THEN** GitHub shows the App as the author, the owner as assignee and requested reviewer, and
  the pull request needs the owner's approval to merge

#### Scenario: An agent replies to a review finding

- **WHEN** an agent replies in a review thread or files an issue
- **THEN** the reply or the issue is made from the owner's own login, not the App's
