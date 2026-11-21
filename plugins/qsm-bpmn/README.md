# qsm-bpmn

Strict BPMN models of a project's business, checked by bpmnlint and this plugin's rules, rendered
to pictures, walked into test paths and shown as one page, so the owner, the agents and QA read one
picture of the process.

## Why it exists

A process an agent can draw but nobody checks is a picture that drifts, and a spec in text alone
leaves every reader to imagine the process differently. This plug-in holds one business process
graph per project to rules a machine checks, turns its paths into the scenarios QA runs, and shows
it as pictures and a page a person reads. It refuses to execute a process, to name code in the
business graph, or to keep a second copy of the graph per change. It would have no reason to exist
if bpmnlint and bpmn-js checked these rules and drew these pictures by themselves.

## What you get

| Kind | Name | What it does |
| --- | --- | --- |
| Tool | `qsm-bpmn lint` | bpmnlint's recommended rules and ours on the BPMN graph, and every C4 id it carries resolved through `qsm-c4` |
| Tool | `qsm-bpmn layout` | Lays out a BPMN process that has no geometry; refuses one that has |
| Tool | `qsm-bpmn render` | One SVG per process beside the graph; `--check` writes nothing and names what is stale |
| Tool | `qsm-bpmn paths` | The cover of each process: start-to-end paths with stable ids, and which of them no spec scenario cites |
| Tool | `qsm-bpmn pages` | `bpmn.html` in `.qsm/bpmn/`: one file, nothing requested outside it |
| Skill | `bpmn-model` | How a piece of work becomes a checked process, from one task to a whole project, the reviewer before the graph file |
| Agent | `model-reviewer` | Reads each changed process picture and its source against the spec and the rules, on sonnet |

## Install

```bash
claude plugin install qsm-bpmn@qsm-marketplace
```

The binary is compiled by the installer; `INSTALL.md` says how. It needs no program on PATH:
bpmnlint, bpmn-js, bpmn-auto-layout and jsdom are compiled into it.

## Use

A project keeps `models/<project>.bpmn`. After an edit:

```bash
qsm-bpmn lint
qsm-bpmn render
qsm-bpmn paths --specs openspec/
qsm-bpmn pages
```

Then open `.qsm/bpmn/bpmn.html` in a browser. `USAGE.md` holds every verb, flag and exit code.

## Caveats

- A graph that carries a C4 id (`c4:element`) needs `qsm-c4` on PATH to lint, lay out, render and
  write its page; a graph without one needs nothing else.
- `paths --compare` and the layout measure are not built yet.
