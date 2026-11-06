# qsm-c4

Strict C4 models of a project's architecture in LikeC4, checked by `likec4 validate` and this
plugin's rules, rendered per level to draw.io pictures and shown as one page, so the owner and the
agents read one picture of the structure.

## Why it exists

An architecture an agent can draw but nobody checks is a picture that drifts, and a spec in text
alone leaves every reader to imagine the structure differently. This plug-in holds one C4 graph per
project to its levels, its vocabulary and one colour per actor, and draws every level as a picture
a person reads and draw.io opens. It refuses to judge a design by taste, to let a source declare its
own kinds or views, or to keep a second copy of the graph per change. It would have no reason to
exist if LikeC4 checked these rules and drew these pictures by itself.

## What you get

| Kind | Name | What it does |
| --- | --- | --- |
| Tool | `qsm-c4 lint` | `likec4 validate`, the vocabulary, the level rules and the actor colours on the C4 graph |
| Tool | `qsm-c4 render` | One `.drawio.svg` per generated view beside the graph; `--check` writes nothing and names what is stale |
| Tool | `qsm-c4 elements` | Every element's id, kind, title and tags, and an actor's colour: the one door another tool reads the graph through |
| Tool | `qsm-c4 pages` | `c4.html` in `.qsm/c4/`: one file, nothing requested outside it |

## Install

```bash
claude plugin install qsm-c4@qsm-marketplace
```

The binary is compiled by the installer; `INSTALL.md` says how. It needs no program on PATH: LikeC4
and elkjs are compiled into it.

## Use

A project keeps `models/<project>.c4`. After an edit:

```bash
qsm-c4 lint
qsm-c4 render
qsm-c4 pages
```

Then open `.qsm/c4/c4.html` in a browser. `USAGE.md` holds every verb, flag and exit code.

## Caveats

- A C4 element's layout hints and the layout measure are not built yet.
