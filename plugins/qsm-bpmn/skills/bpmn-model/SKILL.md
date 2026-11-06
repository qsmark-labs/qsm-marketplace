---
name: bpmn-model
description: "Use when a piece of work changes what a project does and its BPMN process graph must show it: a feature, a task that changes behaviour, a process drawn for the first time, or the owner asking for a process picture to change. Triggers: draw this in BPMN, put it in the process model, model the process, where does this go in the graph, the picture does not say what I want, nakresli to do BPMN, uprav proces, uprav model. Edits the project's one BPMN graph and checks it with qsm-bpmn. The architecture graph is the c4-model skill; writing the spec is qsm-openspec's spec-propose; reviewing a changed graph is the model-reviewer agent."
---

# BPMN model

The owner, the agents and QA read one picture of what the business does, so a process model is a
contract, not a sketch: strict, checked by tools, and the same graph for everyone. This skill takes
a piece of work of any size into the project's one BPMN graph, `models/<project>.bpmn` (BPMN 2.0,
Analytic sub-class), and proves the result with `qsm-bpmn` before anyone reads it. It does not
execute a process, and it never keeps a model per change or per plugin.

## Where the work goes

Behaviour goes into the BPMN graph, and the scale of the work decides the level:

| The work | The BPMN graph |
| --- | --- |
| A task | changes a process only when it changes behaviour, the one that owns that behaviour |
| A feature | a process of at most 10 activities, a called process per call activity |
| A plugin | its processes, each called from where it runs |
| The project | its main process, first in the file |

Edit the process that owns the behaviour, at its own level: a step of one task is changed in the
task's process, never redrawn in the process that calls it. A change folder holds no model file. A
relayed "draw it next to the feature" is the second copy this rule exists to stop; say so and edit
the one graph.

## The rules the graph is held to

Analytic sub-class only, read by business people:

- A lane is a business role (Owner, Agent, Review agent), never a system, file or command.
- An activity is one verb and its object, one flow in and one out. A second step is an activity of
  its own, a second decision a gateway. "Open the PR, change archived" is two activities.
- Every answer of a split is a label; a loop returns through an unnamed merge, never into the side
  of an activity; several ends each name their end state.
- A split right after a call activity answers with the end names of the called process, and a call
  activity calls a process of the same graph.
- No file, command or code element in a name: "Close the task", not "Run `qsm-tasks close`". The
  one link to the architecture is the optional `c4:element="<id>"` (namespace
  `https://c4model.com`); a graph that carries one needs `qsm-c4` on PATH, and a lane linked to an
  actor takes its colour.

## The loop

1. Read the graph and the process the work touches. Fix the model, never the picture: an engine
   places every shape, so a bad picture is changed by order, lanes and levels, not by coordinates.
2. Draft the edit in a copy of `models/` in the scratchpad, never in `models/<project>.bpmn`
   itself. A new process with no geometry gets `qsm-bpmn layout <copy>`; a drawn process is never
   laid out again, because the owner's moves in bpmn.io must survive.
3. `qsm-bpmn lint <copy>`. Every finding names the element and the rule; fix the draft, run it
   again.
4. `qsm-bpmn render <copy>`, then look at each changed picture (rasterise it and read the image). A
   cut label, two shapes on each other or a flow through a step goes back to step 1.
5. `qsm-bpmn paths <copy> --specs openspec/`. Every cover path of a changed process needs a scenario
   that cites its id; write the missing ones before the commit.
6. Hand the changed pictures, the draft and the spec to the `model-reviewer` agent of qsm-bpmn. A
   finding sends the draft back to step 2, and the reviewer reads it again. Only a draft that
   passed lint and came back with no finding is written into `models/<project>.bpmn`; a binary
   cannot run the reviewer, so this step is yours and nothing else catches a skipped review.
7. `qsm-bpmn render` writes the pictures beside the graph, and `qsm-bpmn render --check` runs
   before every commit: a stale picture is a lie in the tree. When `render` refuses a picture whose
   layout measure grew, restructure the graph or ask the owner; `--accept <measure>` is the
   owner's to type, never yours.
8. `qsm-bpmn pages` writes `.qsm/bpmn/bpmn.html`; the owner opens it in a browser. When he says the
   picture does not say what he wants, his words go back to step 2, and the graph is linted with its
   C4 ids, rendered and reviewed again before he reads it once more.

Commit the graph with its pictures.

## Red flags

- About to add `openspec/changes/<x>/models/<y>.bpmn`: edit `models/<project>.bpmn`.
- About to edit `models/<project>.bpmn` before the reviewer has read the draft: draft in a copy.
- An activity with two outgoing flows or a name with a comma joining two verbs: split it.
- A lane named after a plugin or a tool: name the role that does the step.
- A rendered picture nobody looked at: render it to PNG and read it before the spec.
- Typing `--accept`: that is the owner's choice.

## Say it in the reply

The process changed and why it is the owner of the behaviour, the `qsm-bpmn` runs with their
verdict, the picture looked at, the cover paths and the scenarios that cite them, and the reviewer's
verdict.
