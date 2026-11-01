## Why

The owner judges the desktop one item at a time in a live window, and the atlas report
(`index.html`) is a list of shots by journey with diff images: it answers "what changed since the
last run", not "what does every surface look like in every state". A Figma page answers that, but
for a design; the atlas can answer it for the real shell, rendered deterministically from the fake
machine, and nothing leaves the machine.

## What Changes

- A scenario's `shot NAME @Type` names the surface a shot is about: the item type in the shot's
  item tree whose rectangle the board crops to. A type the tree does not hold fails the run.
- A scenario's `todo @Type STATE` names a state the inventory knows and no journey shoots yet.
- Every `drive atlas run` writes `board.html` in the run: a pan and zoom canvas with one section
  per surface and one frame per state, each frame the shot cropped to its surface; a click opens
  the frame in focus with the crop, the full screen, and arrows to its neighbours.
- A frame carries what the run measured: changed against the previous run (a badge; in focus
  before, after and an overlay of the changed areas, plus the changed measures of the tree), a
  failed check (a badge; in focus the check's lines and the failing item's rectangle), a screen
  that never stilled (a badge), and an inventory hole (an empty frame with its name).
- `drive atlas review [SCENARIO]` serves the latest run's board on localhost, so a comment pinned
  to a point in a frame lands in the scenario's `comments.json`; `drive atlas comments SCENARIO`
  prints the open comments for an agent, which marks one resolved in the board.
- `drive atlas run` prints the board's path after the report's. Whether `board.html` replaces
  `index.html` is the owner's decision, open until he has used the board; both are written until
  then.

## Capabilities

### New Capabilities

- `atlas-review-board`: the board a run writes, the surface and todo grammar it reads, the review
  server and the comments store.

### Modified Capabilities

(none: qsm-compuse has no spec yet; the atlas grammar this extends lives in `scripts/drive-atlas`.)

## Impact

- `plugins/qsm-compuse/scripts/drive-atlas`: the `@Type` and `todo` grammar, the surface column in
  `shots.tsv`, the board build in place of `atlas_report`, the `review` and `comments` verbs.
- New `plugins/qsm-compuse/scripts/atlas-board.ts` (Bun): builds `board.html` from a run, serves
  it, and owns `comments.json`.
- `plugins/qsm-compuse/USAGE.md`: the `drive atlas run` row, two new rows.
- qsm-desktop `atlas/desktop.atlas`: `@Type` on its shots (a separate change in that repository).

## Critiques

- Devil's advocate: "the existing `index.html` already shows every shot; a second report is a
  second copy." Open for the owner: the board is built to replace it, and the old report is
  deleted once he says so, because a second report nobody reads is a second path.
- Devil's advocate: "a crop from the tree is wrong when two items share the type." Waived with a
  reason: the board crops to the first item of the type in tree order, the shot names which one
  it means by its type, and a desktop whose surfaces share a type names a narrower one.
- Future archaeologist: "why does a comment live beside the scenario and not the run?" Answered in
  the design: a comment outlives the run it was made on until someone resolves it.
- Scope sniper: "a local server only for comments." Kept: the owner chose comments the agent reads
  without copying, and a file page cannot write a file; the server is one Bun process with three
  routes. Without it the board still opens from disk, read-only, and says so.
- Scope sniper: "pan and zoom is a canvas library." Waived: one CSS transform and a wheel handler,
  no library.
