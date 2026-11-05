# Usage

```bash
qsm-models lint [path] [--json]
qsm-models layout <file.bpmn> [--json]
qsm-models render [path] [--check] [--json]
qsm-models paths [file.bpmn] [--process <id>] [--all] [--specs <dir>] [--json]
qsm-models check [--json]
qsm-models pages [--out <dir>] [--json]
qsm-models doctor [--json]
```

`doctor` is healthy wherever the binary runs: bpmnlint, bpmn-js, elkjs and LikeC4 are compiled into
it, so it needs no program on PATH.

A project keeps one BPMN graph, `models/<project>.bpmn`, and one C4 graph, `models/<project>.c4`.
`path` is a `.bpmn` or `.c4` file or the directory that holds them, `models` by default. `check`
and `pages` work on the repository the working directory is in.

| Verb | Does | Exit |
| --- | --- | --- |
| `lint` | BPMN: bpmnlint's recommended rules, warnings raised to errors, and this plugin's rules (below). C4: `likec4 validate` with the vocabulary the tool supplies, then the vocabulary, the levels and the colours | `worse` (3) per finding, each naming the file, the element and the rule |
| `layout` | Writes the geometry, pool and lanes included, of each process that has none, by bpmn-auto-layout | `blocked` (5) and nothing written when a process already has geometry |
| `render` | `<project>.<process>.svg` per BPMN process and `<project>.<view>.drawio.svg` per generated C4 view, beside the graph; `--check` writes nothing | `worse` (3) under `--check`, naming each picture that differs |
| `paths` | The cover of each process, `--process` of one, `--all` every path; `--specs` names each cover path no scenario under the directory cites, and each cited id the graph lacks | `worse` (3) for a step with no way to an end, or a `--specs` finding |
| `check` | A `.bpmn` or `.c4` file outside `models/` (the OpenSpec archive left out); a `qsm:c4` link to a missing C4 element; a `qsm:decision` or `decision` link whose file, numbered item or commit does not exist; a call activity to a process the graph lacks | `worse` (3) per finding; `missing` (4) naming qsm-docs for a link into another project |
| `pages` | Runs `lint`, then writes `bpmn.html` and `c4.html` into `.qsm/models/`, replacing an earlier run; one graph present writes its page alone | `worse` (3) and no page written when lint fails; `failed` (1) when `models/` holds no graph |

## The BPMN rules

| Rule | Refuses |
| --- | --- |
| `analytic-only` | an element outside the BPMN 2.0.2 Analytic sub-class |
| `split-flows-labelled` | a flow out of an exclusive or inclusive split without a label |
| `lanes-hold-every-node` | a step in no lane or in two |
| `max-activities` | a process level with more than 10 activities |
| `one-flow-out`, `one-flow-in` | an activity with more than one outgoing or incoming flow |
| `merge-unnamed` | a merge gateway with a name |
| `end-events-named` | a level with several end events of which one has no name |
| `split-after-call` | a split right after a call activity whose answers are not the end events of the called process |
| `no-dead-end` | a step with no way to an end event |
| `no-code-in-name` | a name with a path or a command in backticks |

## The C4 rules

The tool supplies the kinds (person, system, container, component) and the tags (`external`,
`agent`, `shared`, `artifact`); a source that declares its own `specification` or `views` is
refused. Metadata keys are `colour`, `group`, `path`, `project`, `verified`, `decision`, `layer` and
`order`. A person or a system has no parent, a container sits in a system and a component in a
container; every relation has a title and a technology; no two elements share a title; an internal
container names its code `path`. Every top-level person and every system tagged `agent` carries a
`colour` of the palette (navy, purple, orange, green, teal, red), no two the same.

## Links

A link is optional and, when present, must resolve: `qsm:c4="<element id>"` on a BPMN element,
`qsm:decision="design:<repo path>#<n>"` or `"commit:<sha>"` on a BPMN element (namespace
`urn:qsm:models`), and `decision` in a C4
element's metadata. `<n>` is a numbered item of that file.

With `--json`, stdout is one envelope `{ code, exit, reason, message, warnings, data }`; `data`
holds the findings, the written files or the paths.

From a hooks module: `await $.models.lint({ path })`, `$.models.paths({ file, process })`, and so
on for each verb.
