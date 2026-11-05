# qsm-models

Strict BPMN and C4 models of a project, checked by their own standard tools and shown as pages, so
the owner, the agents and QA read one picture of what is wanted.

## Why it exists

A model an agent can draw but nobody checks is a picture that drifts, and a spec in text alone
leaves every reader to imagine the process and the architecture differently. This plug-in holds one
business process graph and one architecture graph per project to rules a machine checks, and shows
them as pictures and pages a person reads. It refuses to execute a process, to judge a design by
taste, or to keep a second copy of a graph per change. It would have no reason to exist if the
standard tools of BPMN and C4 checked these rules and drew these pictures by themselves.

## What you get

| Kind | Name | What it does |
| --- | --- | --- |
| Tool | `qsm-models lint` | bpmnlint's recommended rules and ours on the BPMN graph; `likec4 validate`, the vocabulary and the level rules on the C4 graph |
| Tool | `qsm-models layout` | Lays out a BPMN process that has no geometry; refuses one that has |
| Tool | `qsm-models render` | One SVG per process and one `.drawio.svg` per generated C4 view beside the graph; `--check` writes nothing and names what is stale |
| Tool | `qsm-models paths` | The cover of each process: start-to-end paths with stable ids, and which of them no spec scenario cites |
| Tool | `qsm-models check` | Model files outside `models/`, and every link the graphs carry |
| Tool | `qsm-models pages` | `bpmn.html` and `c4.html` in `.qsm/models/`: one file each, nothing requested outside it |
| Skill | `model` | How a piece of work becomes checked models, from one task to a whole codebase |
| Agent | `model-reviewer` | Reads each changed picture and its source against the spec and the rules, on sonnet |

## Install

```bash
claude plugin install qsm-models@qsm-marketplace
```

The binary is compiled by the installer; `INSTALL.md` says how. It needs no program on PATH:
bpmnlint, bpmn-js, elkjs and LikeC4 are compiled into it.

## Use

A project keeps `models/<project>.bpmn` and `models/<project>.c4`. After an edit:

```bash
qsm-models lint
qsm-models render
qsm-models check
qsm-models pages
```

Then open `.qsm/models/bpmn.html` and `.qsm/models/c4.html` in a browser. `USAGE.md` holds every
verb, flag and exit code.

## Caveats

- The graphs live in the repository only; local mode in the qsm-docs store, links to another
  project's graph and the commit gate come later.
- A C4 element's layout hints, `paths --compare` and the check against the code are not built yet.
