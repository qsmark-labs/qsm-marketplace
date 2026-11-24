# Usage

```bash
qsm-tasks doctor [--json]
```

`doctor` says whether `gh` is on PATH: `missing` (4) when it is not, else healthy.

With `--json`, stdout is one envelope `{ code, exit, reason, message, warnings, data }`.

From a hooks module: `await $.tasks.doctor()`.
