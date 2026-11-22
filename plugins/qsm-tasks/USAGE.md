# Usage

```bash
qsm-tasks doctor [--json]
qsm-tasks list [--json]
```

`doctor` says whether `gh` is on PATH: `missing` (4) when it is not, else healthy.

`list` prints every open issue of the repository of the current directory, one per line,
tab-separated: `#<number>`, its Status on the board (`no status` when the issue is on none), the
title. A line break in a title becomes a space. It runs one call,
`gh issue list --state open --limit 1000`. Without `gh` on PATH the exit is `missing` (4); a `gh`
that fails is `failed` (1) and its stderr is the message.

With `--json`, stdout is one envelope `{ code, exit, reason, message, warnings, data }`; for `list`,
`data` is an array of `{ number, title, status }`, `status` null for an issue on no board.

From a hooks module: `await $.tasks.doctor()`, `await $.tasks.list()`.
