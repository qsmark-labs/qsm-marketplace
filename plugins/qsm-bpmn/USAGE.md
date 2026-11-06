# Usage

```bash
qsm-bpmn lint [path] [--json]
qsm-bpmn layout <file.bpmn> [--json]
qsm-bpmn render [path] [--check] [--json]
qsm-bpmn paths [file.bpmn] [--process <id>] [--all] [--specs <dir>] [--json]
qsm-bpmn pages [--out <dir>] [--json]
qsm-bpmn doctor [--json]
```

`doctor` is healthy wherever the binary runs: bpmnlint, bpmn-js, bpmn-auto-layout and jsdom are
compiled into it, so it needs no program on PATH.

A project keeps one BPMN graph, `models/<project>.bpmn`. `path` is a `.bpmn` file or the directory
that holds it, `models` by default; a directory with no `.bpmn` or with two fails (1). `pages` works
on the repository the working directory is in.

| Verb | Does | Exit |
| --- | --- | --- |
| `lint` | bpmnlint's recommended rules, warnings raised to errors, and this plugin's rules (below) | `worse` (3) per finding, each naming the file, the element and the rule |
| `layout` | Writes the geometry, pool and lanes included, of each process that has none, by bpmn-auto-layout | `blocked` (5) and nothing written when a process already has geometry |
| `render` | `<project>.<process>.svg` per process, beside the graph; `--check` writes nothing | `worse` (3) under `--check`, naming each picture that differs |
| `paths` | The cover of each process, `--process` of one, `--all` every path; `--specs` names each cover path no scenario under the directory cites, and each cited id the graph lacks | `worse` (3) for a step with no way to an end, or a `--specs` finding |
| `pages` | Runs `lint`, then writes `bpmn.html` into `.qsm/bpmn/`, replacing an earlier run | `worse` (3) and no page written when lint fails; `failed` (1) when `models/` holds no BPMN graph |

## The rules

| Rule | Refuses |
| --- | --- |
| `analytic-only` | an element outside the BPMN 2.0.2 Analytic sub-class |
| `split-flows-labelled` | a flow out of an exclusive or inclusive split without a label |
| `lanes-hold-every-node` | a step in no lane or in two |
| `max-activities` | a process level with more than 10 activities |
| `one-flow-out`, `one-flow-in` | an activity with more than one outgoing or incoming flow |
| `merge-unnamed` | a merge gateway with a name |
| `end-events-named` | a level with several end events of which one has no name |
| `called-process-exists` | a call activity whose `calledElement` names no process of the graph |
| `split-after-call` | a split right after a call activity whose answers are not the end events of the called process |
| `no-dead-end` | a step with no way to an end event |
| `no-code-in-name` | a name with a path or a command in backticks |

## The C4 link

A BPMN element may name an element of the project's C4 graph, and nothing else outside the graph:
`c4:element="<id>"`, the prefix bound to the namespace `https://c4model.com`. The link is optional.

With `--json`, stdout is one envelope `{ code, exit, reason, message, warnings, data }`; `data`
holds the findings, the written files or the paths.

From a hooks module: `await $.bpmn.lint({ path })`, `$.bpmn.paths({ file, process })`, and so on
for each verb.
