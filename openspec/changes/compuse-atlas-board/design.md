## Context

`drive atlas run` already keeps, per run, `shots/NAME.png` (device px), `trees/NAME.json` (the item
tree, logical px, `width` and `height` of the screen at its root), `checks/NAME.txt` (the
consumer's check lines, a failing item written `Type[x,y wxh]`), `shots.tsv` (journey, shot, step,
still, fails) and, against the run before, `diff-<prev>/diff.json` (per shot: changed areas in
device px and changed tree measures). Everything the board shows is already measured; the board
is a view of one run directory, plus comments, which are the one new state.

## Goals / Non-Goals

Goals: one page per run that shows every surface in every state the inventory names, the frames
cropped to their surface, each carrying what the run measured about it; comments the agent reads
without copying.

Non-goals: editing, design tooling, a canvas library, publishing anywhere, a second
measurement. The board never computes a diff or a check; it shows the ones the run wrote.

## Decisions

- **The surface is named in the scenario, found in the tree.** `shot NAME @Type` keeps the shot's
  name (`journey--NAME`) and records `Type` as a sixth column of `shots.tsv`. The crop is the first
  node of that type with a size in the shot's tree (depth first, the order geom dumps; a collapsed
  popout of the same type is 0x0), padded by 32 logical px, because a popout's title sits above its
  content item, and clamped to the screen. `@A/B` is the first B inside the first A, for a surface
  whose own type is generic (`PanelSurface/FocusScope`). A type the tree does not hold stops the run
  naming the shot, because a crop that silently shows the whole screen hides a renamed component. A
  shot without `@Type` is a full-screen frame in a section named by its journey.
- **Holes are declared, never guessed.** `todo @Type STATE` lines may stand anywhere in the
  scenario; the steps reader skips them. The board shows each as an empty frame titled STATE in
  the Type's section, because an inventory nobody can see is no inventory.
- **One builder, one page, data inlined.** `scripts/atlas-board.ts build RUN` reads the run and
  writes `RUN/board.html`: one file of HTML, CSS and vanilla JS with the board's data as one JSON
  block, the images referenced relatively (`shots/`, and `../<prev>/shots/` for the before image),
  so the page opens from disk with no server and no network. `drive atlas run` calls it after the
  report, and `drive atlas diff` after its report.
- **Pan and zoom is one transform.** The canvas is one absolutely placed layer moved by
  `translate()` and `scale()`: drag pans, the wheel zooms about the pointer, `F` fits everything,
  a section title fits that section, `0` resets. Frames are laid out by the builder (sections top
  to bottom, frames left to right, wrapping at 6), so the page does no layout work of its own.
- **Focus is the frame, the screen and its record.** A click opens one frame: the crop and the
  full screen side by side, the check lines with the failing rectangles drawn on both, the changed
  areas, a before / after / overlay switch when the frame changed, the changed measures, and the
  arrows (or `←` `→`) to the neighbour frames of its section. `Esc` returns.
- **Comments belong to the scenario, keyed by shot.** `<scenario dir>/comments.json` is an array of
  `{id, shot, x, y, text, run, at, resolved}`, `x` and `y` in logical px of the screen. A comment
  outlives the run it was made on: every later board shows it on the same shot until it is
  resolved, because the fix lands in a later run. `scripts/atlas-board.ts serve SCENARIO_DIR`
  (`drive atlas review`) serves the scenario directory on `127.0.0.1` (a free port, printed), the
  latest run's board at `/`, and `GET /comments`, `POST /comments`, `POST /comments/<id>/resolve`;
  it is the only writer of `comments.json`. `drive atlas comments SCENARIO` prints the open ones
  as `shot<TAB>x,y<TAB>text`. Opened from disk the board shows comments it was built with and says
  that adding one needs `drive atlas review`.
- **Errors are the drive's.** The builder and the server fail with one line on stderr and a
  non-zero exit, the way every `drive` verb does (`die`); a run whose board fails to build still
  keeps its shots and fails the run, because a report that silently did not appear is a lie.

- **A mask removes the item from the shot's tree, and its rect from the pixel comparison.** An
  item that animates by design (the connecting pulse) changes pixels, its opacity in the tree and
  the contrast the consumer's check measures from the pixels, in a different phase every run.
  Removing the node keeps every check and the tree diff off it without a flag each of them must
  honour; the rect, kept in `shots.tsv`, is all the wait, the comparison and the board need. An
  index in a path (`RailEntry[4]`) exists because the tree's nodes carry no names, and the fifth
  rail cell is otherwise unreachable.

## Risks / Trade-offs

- Two reports while the owner decides; the old one goes when he says so.
- A board of a hundred full-resolution PNGs is a few hundred MB of decoded images, all of them
  decoded once the canvas is fitted; the frames load lazily (`loading="lazy"`) and nothing more,
  which this machine carries.
- The comment's point is in logical px of the screen, so it survives a crop change but not a
  moved surface: a comment on a surface that moved points beside it, and the owner resolves it.
