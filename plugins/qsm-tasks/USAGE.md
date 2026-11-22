# Usage

```bash
qsm-tasks doctor [--json]
qsm-tasks list [--json]
qsm-tasks add <title> --body-file <file> [--parent <n>] [--json]
```

`doctor` says whether `gh` is on PATH: `missing` (4) when it is not, else healthy.

`list` prints every open issue of the repository of the current directory, one per line,
tab-separated: `#<number>`, its Status on the board (`no status` when the issue is on none), the
title. A line break in a title becomes a space. It runs one call,
`gh issue list --state open --limit 1000`. Without `gh` on PATH the exit is `missing` (4); a `gh`
that fails is `failed` (1) and its stderr is the message.

`add` runs `gh issue create --title <title> --body-file <file>`, reads the issue number from the URL
gh prints and prints the number. `--body-file` is required. With `--parent <n>` it then makes the
new issue a sub-issue of `<n>` through `gh api`. A gh that fails is `failed` (1) with its stderr; an
output without an issue URL, or an issue id that is not a number, is `failed` too.

With `--json`, stdout is one envelope `{ code, exit, reason, message, warnings, data }`; for `list`,
`data` is an array of `{ number, title, status }`, `status` null for an issue on no board; for
`add`, `data` is the new issue's number.

From a hooks module: `await $.tasks.doctor()`, `await $.tasks.list()`, `await $.tasks.add(...)`.
