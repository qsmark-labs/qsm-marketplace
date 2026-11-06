# Usage

```bash
qsm-c4 lint [path] [--json]
qsm-c4 render [path] [--check] [--json]
qsm-c4 elements [path] [--json]
qsm-c4 pages [--out <dir>] [--json]
qsm-c4 doctor [--json]
```

`doctor` is healthy wherever the binary runs: LikeC4 and elkjs are compiled into it, so it needs no
program on PATH.

A project keeps one C4 graph, `models/<project>.c4`. `path` is a `.c4` file or the directory that
holds it, `models` by default; a directory with no `.c4` or with two fails (1). `pages` works on the
repository the working directory is in.

| Verb | Does | Exit |
| --- | --- | --- |
| `lint` | `likec4 validate` with the vocabulary the tool supplies, then the vocabulary, the levels and the colours (below) | `worse` (3) per finding, each naming the file, the element and the rule |
| `render` | `<project>.<view>.drawio.svg` per generated view, beside the graph; `--check` writes nothing | `worse` (3) under `--check`, naming each view that differs |
| `elements` | Every element: its id, kind, title and tags, and for an actor its palette colour by name and hex; the one door another tool reads the graph through | `worse` (3) when LikeC4 refuses the source |
| `pages` | Runs `lint`, then writes `c4.html` into `.qsm/c4/`, replacing an earlier run | `worse` (3) and no page written when lint fails; `failed` (1) when `models/` holds no C4 graph |

## The rules

The tool supplies the kinds (person, system, container, component) and the tags (`external`,
`agent`, `shared`, `artifact`); a source that declares its own `specification` or `views` is
refused. Metadata keys are `colour`, `group`, `path`, `project`, `verified`, `decision`, `layer`
and `order`. A person or a system
has no parent, a container sits in a system and a component in a container; every relation has a
title and a technology; no two elements share a title; an internal container names its code
`path`. Every top-level person and every system tagged `agent` carries a `colour` of the palette
(navy, purple, orange, green, teal, red), no two the same.

With `--json`, stdout is one envelope `{ code, exit, reason, message, warnings, data }`; `data`
holds the findings, the written files or the elements.

From a hooks module: `await $.c4.lint({ path })`, `$.c4.elements({ path })`, and so on for each
verb.
