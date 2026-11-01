## Context

The behaviour is `models/flow.bpmn` and the spec; the structure is `models/marketplace.c4`. This
file holds only the decisions and why. What exists today per step, and its gaps, was read from
the tree before writing: grilling, plan, spec-propose, spec-apply, workflow-review, review-threads
and the implementer agent are reused; nothing in `.github/` but `ci.yml` exists.

## Decisions

### 1. A feature is an OpenSpec change on its own schema, `feature`

Options: keep `spec-driven` and write tasks.md early; drop OpenSpec; a project schema. Choice: the
project schema `openspec/schemas/feature/` with proposal, models, specs, design, `apply.requires:
[design]` and `apply.tracks: null`. Reason: the owner removed pre-written task lists, and a schema
without a tasks artifact is the tool's own way to say it. Measured on openspec 1.6.0: `openspec
schema validate feature` passes, `openspec status --change feature-flow` lists the four
artifacts, and `openspec validate --strict` passes with no tasks.md. Reopens when: openspec drops
project schemas or `tracks: null`.

### 2. Models come before specs

The schema makes `specs` require `models`, so the SHALL text is written against a drawn process
and every scenario that walks a path names it (`(path p-xxxxxx)`). Reason: a scenario list written
first drifts from the picture the owner reads; a path id ties the two and the model tool checks
that every path of the cover is cited.

### 3. The change lives on `feature/<n>` and is archived there

The planning session commits the change on `feature/<n>`; task branches merge into it; after QA the
change is archived on the same branch, and the feature pull request carries code and archived specs
into main in one merge (the archive rule is specified in `tasks-on-github-issues`). Reason: main
never holds a plan for code it does not have, and a revision during the build is a commit on the
branch the code is on. When the branch is created (end of step 2 or step 3) is open decision 1
below; nothing else here depends on it.

### 4. Tasks are cut at step 3, on the board, and nowhere else

The split is a session of the owner and the agent: tasks are `qsm-tasks add --feature <n>` with
`--after` for order. A task is one concern whose pull request the owner can read in one sitting.
A fake that lets a part run before its neighbour exists carries the marker `qsm-fake: #<task>`
naming the task that replaces it, and a pull request into main is refused while a marker is
left. Reason: "fakes never reach main" is checkable only if a fake says so.

### 5. A task is consumed by a main session, which opens its pull request

Options: the implementer subagent builds and pushes; the main session builds and pushes. Choice:
the main session (spec-apply) owns the task end to end and opens the pull request into
`feature/<n>` through a new `qsm-forge gh pr-open` verb; a subagent it starts still never pushes.
Reason: one context holds the why from gathering to the pull request, and the forge stays the
one door to pull requests. The git rule's "no pull request until the person says otherwise" is
that saying: the rule changes to name the feature flow's branches.

### 6. The whiteboard is in the chat, not a file

Before code, the session shows the C4 component view of what it touches (the plugin's model when
one exists), the interfaces, where each lives, and the contract between them. When the code's
components change, the plugin's C4 model changes in the same pull request. Reason: a task plan
written to a file is the tasks.md the owner removed; the structure that outlives the task is the
model.

### 7. Review reuses workflow-review, against the feature's change

The review agent reads the task's feature change (specs and models) as what was asked. It still
posts under the owner's login; a separate identity is `agent-identity`. Reason: reuse first; the
identity needs a GitHub App, which is its own feature.

### 8. Forms, template and merge

Issue forms carry the six questions as required fields and set the issue type; the pull request
template has before, after, what it solves and `Closes #N`. GitHub closes the feature itself when
the feature pull request with `Closes #<feature>` merges into main (default branch); task pull
requests into `feature/*` are closed by the Action of `qsm-tasks-cli`. Whether an issue form can
set the issue type is unmeasured; if not, the planning session sets it with `qsm-tasks`. The merge
method of each kind of pull request is the owner's decision 7.

### 9. Which skills and agents change, which are new

Reused unchanged: grilling's interview, the implementer, researcher and runner agents (workers
that never push), `received-findings`, `review-threads`, `/simplify`, the review skill for the
self-review. Changed here: `plan` (planning and the split), `spec-propose` (the feature schema),
`spec-apply` (one task in one session, its pull request), `workflow-review` (reads the feature's
change), the git rule. Changed elsewhere: `task-tool` and `spec-archive` (`tasks-on-github-issues`).
New, elsewhere: the QA agent (`qa-agent`), the model tool's skill (`strict-visual-models`). No new
skill here: each step is a skill that exists, revised, because a second skill per step would be a
copy.

## Open decisions

1. **When is `feature/<n>` created?** At the end of step 2, when the owner approves the plan, so
   the change has a branch (recommended); or at step 3 as the agreed flow says, with the change
   landing on main in its own small pull request. The second puts plans of unbuilt code on main.
2. **How do pull requests merge?** Task pull requests squash into `feature/<n>` and the feature
   pull request merges into main with a merge commit (recommended: one commit per reviewed task,
   and main shows each feature as one merge); or every merge squashes (main has one commit per
   feature and loses the task history).
3. **Is there an issue form for feedback?** No (recommended): feedback is filed by the
   `qsm-tasks feedback` verb, which checks for private data, and a form cannot; or yes, for the
   owner in the browser, unchecked.

## Critiques

Devil's advocate:

- A custom schema ties the flow to openspec's experimental schema commands. Waived: the schema is
  one YAML file validated on every run; a break is loud at `openspec status`.
- Models before specs slows a small feature. Waived: a fix is a commit with no feature and no
  change; a feature small enough to need no model is a fix.
- The consume session pushes and opens pull requests, which the rules forbade. Fixed: the git
  rule changes in this feature (qsm-setup), and only into `feature/<n>`; main is the owner's merge.
- Path ids are hashes the owner cannot read. Fixed in part: the scenario title says the path in
  words and the id ties it to the model; the SVG shows the path.

Future archaeologist:

- Why no tasks.md? Decision 1 and the owner's removal of pre-written tasks; the plan of a task is
  its session's whiteboard, its record is the pull request.
- Why is the change archived on a branch and not on main? Decision 3.
- Why `qsm-fake:`? Decision 4: the only way the feature pull request can prove no fake is left.

Scope sniper:

- QA and the branch sync are steps of the same flow, but their sandbox is a feature of its own:
  `qa-agent`, a stub. This change specifies the steps it can be proved on now.
- A planning agent that runs alone is not built; the table in the proposal lists it as later.
