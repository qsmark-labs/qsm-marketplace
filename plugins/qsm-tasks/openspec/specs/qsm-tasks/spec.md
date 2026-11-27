# qsm-tasks Specification

## Purpose

Guide the agent through everyday task work in GitHub Issues and Projects.

## Requirements

### Requirement: A skill guides task work through GitHub CLI

The plugin SHALL provide the `task-tool` skill. It SHALL show how to list open issues, create an
issue with a parent when requested, and set a project item's status with `gh`.

#### Scenario: Change a task's status

- **WHEN** the user asks the agent to move an issue to a status on an identified project
- **THEN** the skill directs the agent to update the project's Status field with
  `gh project item-edit`

### Requirement: Dependencies

The plugin SHALL declare no plugin dependencies. The skill uses the GitHub CLI.
