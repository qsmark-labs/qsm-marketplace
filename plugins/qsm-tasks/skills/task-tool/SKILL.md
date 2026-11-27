---
name: task-tool
description: "Use to see open work, file a task, or change an issue's project status on GitHub. Triggers: what is open, track this, move this to Done, co je otevřené, založ issue, přesuň kartu."
---

# GitHub tasks

- Read open work with `gh issue list --json number,title,url,projectItems` when project status
  matters.
- File work with `gh issue create`. Add `--parent` when a parent is requested. Return the issue
  link.
- Set the requested status with
  `gh project item-edit <number> --owner <owner> --url <issue-url> --field Status --value "<status>"`.
  The number and owner refer to the project. If the project is ambiguous, ask which one.
