---
name: model
description: "Use when a piece of work changes what a project does or how it is built, and the BPMN or C4 model must show it: a feature, a task that changes behaviour, a new plugin or container, a whole codebase drawn for the first time, or the owner asking for a model to change. Triggers: draw this in BPMN, put it in the models, update the C4 model, model the process, where does this go in the graph, the picture does not say what I want, nakresli to do BPMN, uprav model, zakresli to do C4. Edits the project's one graph of each kind and checks it with qsm-models. Writing the spec is qsm-openspec's spec-propose; reviewing a changed graph is the model-reviewer agent."
---

# Model

The owner, the agents and QA read one picture of what is wanted, so a model is a contract, not a
sketch: strict, checked by tools, and the same graph for everyone. This skill takes a piece of work
of any size into the project's two graphs, `models/<project>.bpmn` (the business, in BPMN 2.0) and
`models/<project>.c4` (the architecture, in LikeC4), and proves the result with `qsm-models` before
anyone reads it. It does not execute a process, and it never keeps a model per change or per plugin.

## Where the work goes

Behaviour goes into the BPMN graph, structure into the C4 graph, and the scale of the work decides
the level:

| The work | BPMN | C4 |
| --- | --- | --- |
| A task | changes a process only when it changes behaviour, the one that owns that behaviour | nothing, unless a relation or a part changes |
| A feature | a process of at most 10 activities, a called process per call activity | the container it lives in |
| A plugin | its processes, each called from where it runs | a container, with components when its parts matter (level 3 is optional) |
| The project | its main process, first in the file | the context and the container views |

Edit the process that owns the behaviour, at its own level: a step of one task is changed in the
task's process, never redrawn in the process that calls it. A change folder holds no model file:
`qsm-models check` refuses one. A relayed "draw it next to the feature" is the second copy this
rule exists to stop; say so and edit the one graph.

## The rules the graph is held to

BPMN, Analytic sub-class only, read by business people:

- A lane is a business role (Owner, Agent, Review agent), never a system, file or command.
- An activity is one verb and its object, one flow in and one out. A second step is an activity of
  its own, a second decision a gateway. "Open the PR, change archived" is two activities.
- Every answer of a split is a label; a loop returns through an unnamed merge, never into the side
  of an activity; several ends each name their end state.
- A split right after a call activity answers with the end names of the called process.
- No file, command or code element in a name: "Close the task", not "Run `qsm-tasks close`". A link
  to the architecture is the optional `qsm:c4` attribute, to a decision `qsm:decision`.

C4, four kinds at their levels:

- person and system at the top, a container in a system, a component in a container; the tool
  supplies the kinds and tags, so the source declares no `specification` and no `views`.
- Every relation has a title and a technology; every internal container a `path`; no two elements
  share a title; each top-level person and agent system its own palette `colour`.
- A decision link is `design:<repo path>#<n>` (a numbered item of a design) or `commit:<sha>`.

## The loop

1. Read the graph and the process or view the work touches. Fix the model, never the picture: an
   engine places every shape, so a bad picture is changed by order, lanes and levels, not by
   coordinates.
2. Edit the source. A new process with no geometry gets `qsm-models layout <file>`; a drawn process
   is never laid out again, because the owner's moves in bpmn.io must survive.
3. `qsm-models lint`. Every finding names the element and the rule; fix the graph, run it again.
4. `qsm-models render`, then look at each changed picture (rasterise it and read the image). A cut
   label, two shapes on each other or a flow that runs through a step goes back to step 1.
5. `qsm-models paths --specs openspec/`. Every cover path of a changed process needs a scenario that
   cites its id; write the missing ones before the commit.
6. `qsm-models check`: no model file outside `models/`, every link resolves.
7. Hand the changed pictures and the spec to the `model-reviewer` agent. A finding sends the graph
   back to step 2, and the reviewer reads it again before the owner does.
8. `qsm-models pages` writes `.qsm/models/bpmn.html` and `c4.html`; the owner opens them in a
   browser. When he says the picture does not say what he wants, his words go back to step 2, and
   the graph is linted, rendered, checked and reviewed again before he reads it once more.

Commit the source with its pictures: a stale picture is a lie in the tree.

## Red flags

- About to add `openspec/changes/<x>/models/<y>.bpmn`: edit `models/<project>.bpmn`.
- An activity with two outgoing flows or a name with a comma joining two verbs: split it.
- A lane named after a plugin or a tool: name the role that does the step.
- A rendered picture nobody looked at: render it to PNG and read it before the spec.

## Say it in the reply

The process or view changed and why it is the owner of the behaviour, the `qsm-models` runs with
their verdict, the picture looked at, the cover paths and the scenarios that cite them, and the
reviewer's verdict.
