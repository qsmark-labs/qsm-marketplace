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
  honour; the rect, kept in `shots.tsv` in device px (the slot's scale), the units the captures
  are compared in, is all the wait, the comparison and the board need. An
  index in a path (`RailEntry[5]`) exists because the tree's nodes carry no names, and the sixth
  rail cell is otherwise unreachable.

- **Labels live in the canvas, not on the screen.** The first board kept names and badges at their
  screen size while the frames scaled, so a frame narrower than its label clipped it (`FAI`), and
  the labels slid against their frames while zooming and vanished below a zoom threshold. Now every
  label is sized in canvas px and scales with its frame like one image: nothing slides, nothing
  pops. The builder knows every label, so it gives each frame a cell as wide as the longer of the
  frame and its label (a width estimated from the character count), and a badge row wraps instead
  of clipping. At the fit of the whole board the names are too small to read and the coloured ring
  of a changed or failing frame carries its state; a section title is large enough to read there,
  and a click on it fits the section. The wheel stops at that fit, because a board smaller than the
  window shows nothing more.
- **A changed area is named by the tree.** The builder maps each changed area (device px, divided
  by the shot's scale) to the deepest node of the shot's tree with a size whose rectangle holds the
  area's centre, and the badge names the run it was compared with by date (`changed vs 1 Nov
  05:02`). The cursor, the wallpaper and a client window are in no tree, so an area there says so
  instead of borrowing the name of whatever item lies beneath.
- **A recording is a separate kind of frame.** `record NAME [@Type]` starts wf-recorder on the
  slot's output in the background and `stop` ends it with SIGINT, the way `drive record` does, so
  the frames keep their capture timestamps. After `stop` the run reads the tree (for the crop),
  transcodes to WebM (VP9, passthrough timing, since the browser plays no Matroska H.264
  reliably) and writes the cadence `drive cadence` prints into `recordings.tsv` (journey, name,
  surface, cadence). Recordings are never compared by pixels: an animation lands on another phase
  every run. The board compares the cadence numbers with the previous run's recording of the same
  name and plays both side by side. The canvas frame is a muted looping `<video>` cropped like an
  image; only the focused frame and its neighbours play, so a board of many recordings decodes few.

## Risks / Trade-offs

- An index names a position: a rail that gains a cell before the network one masks the wrong glyph.
  The pulse is then unmasked, so the shot reads moving and changed, and the run says so.

- Two reports while the owner decides; the old one goes when he says so.
- A board of a hundred full-resolution PNGs is a few hundred MB of decoded images, all of them
  decoded once the canvas is fitted; the frames load lazily (`loading="lazy"`) and nothing more,
  which this machine carries.
- The comment's point is in logical px of the screen, so it survives a crop change but not a
  moved surface: a comment on a surface that moved points beside it, and the owner resolves it.
