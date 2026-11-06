---
name: c4-model
description: "Use when a piece of work changes how a project is built and its C4 architecture graph must show it: a new plugin, service or container, a component that matters, a relation that changes, a codebase drawn for the first time, or the owner asking for an architecture view to change. Triggers: update the C4 model, draw the architecture, add the container, where does this plugin go in the C4 graph, the view does not say what I want, zakresli to do C4, uprav architekturu, pridej kontejner. Edits the project's one LikeC4 graph and checks it with qsm-c4. The business process graph is the bpmn-model skill; writing the spec is qsm-openspec's spec-propose; reviewing a changed graph is the model-reviewer agent."
---

# C4 model

The owner and the agents read one picture of how the project is built, so an architecture model
is a contract, not a sketch: strict, checked by tools, and the same graph for everyone. This skill
takes a piece of work of any size into the project's one C4 graph, `models/<project>.c4` (LikeC4),
and proves the result with `qsm-c4` before anyone reads it. It does not judge a design by taste,
and it never keeps a model per change or per plugin.

## Where the work goes

Structure goes into the C4 graph, and the scale of the work decides the level:

| The work | The C4 graph |
| --- | --- |
| A task | nothing, unless a relation or a part changes |
| A feature | the container it lives in, and the relations it adds |
| A plugin | a container with its code `path`, with components when its parts matter (level 3 is optional) |
| The project | the context and the container views, which the tool generates |

A change folder holds no model file; a relayed "draw it next to the feature" is a second copy, so
say so and edit the one graph.

## The rules the graph is held to

Four kinds at their levels, the vocabulary the tool supplies:

- A person and a system at the top, a container in a system, a component in a container. The
  source declares no `specification` and no `views`: the tool supplies the kinds (person, system,
  container, component) and the tags (`external`, `agent`, `shared`, `artifact`) and generates one
  view per level.
- Every relation has a title that says what it does and a technology (`exec, stdio`, `import`,
  `HTTPS, REST`); every internal container a `path`; no two elements share a title.
- Each top-level person and agent system carries its own palette `colour` (navy, purple, orange,
  green, teal, red). Metadata is `colour`, `group`, `path`, `layer` and `order`, nothing else.
- A plugin is a container, because it installs and works on its own; a group is an area of the
  system, never a workflow step.

## The loop

1. Read the graph and the view the work touches. Fix the model, never the picture: the engine
   places every box, so a bad view is changed by groups, levels and relations, not by coordinates.
2. Draft the edit in a copy of `models/` in the scratchpad, never in `models/<project>.c4` itself.
3. `qsm-c4 lint <copy>`. `likec4 validate` runs first, then the rules; every finding names the
   element and the rule. Fix the draft, run it again.
4. `qsm-c4 render <copy>`, then look at each changed view (rasterise the `.drawio.svg` and read the
   image). A label over a box, two boxes on each other or a view nobody can follow goes back to
   step 1.
5. Hand the changed views, the draft and the spec to the `model-reviewer` agent of qsm-c4. A finding
   sends the draft back to step 2, and the reviewer reads it again. Only a draft that passed lint
   and came back with no finding is written into `models/<project>.c4`; a binary cannot run the
   reviewer, so this step is yours and nothing else catches a skipped review.
6. `qsm-c4 render` writes the views beside the graph, and `qsm-c4 render --check` runs before
   every commit: a stale view is a lie in the tree. When `render` refuses a view whose layout
   measure grew, restructure the graph or ask the owner; `--accept <measure>` is the owner's to
   type, never yours.
7. `qsm-c4 pages` writes `.qsm/c4/c4.html`; the owner opens it in a browser. When he says a view
   does not say what he wants, his words go back to step 2.

Commit the graph with its views. Another tool reads the graph only through `qsm-c4 elements`;
renaming an element a BPMN graph names in `c4:element` breaks that link, so run `qsm-bpmn lint`
after a rename.

## Red flags

- About to add a `.c4` file anywhere but `models/<project>.c4`: edit the one graph.
- About to edit `models/<project>.c4` before the reviewer has read the draft: draft in a copy.
- A relation titled "uses" with no technology: say what it does and how.
- A container inside a container: the inner one is a component, or a container of the system.
- Typing `--accept`: that is the owner's choice.

## Say it in the reply

The element or view changed and why it sits at that level, the `qsm-c4` runs with their verdict,
the views looked at, and the reviewer's verdict.
