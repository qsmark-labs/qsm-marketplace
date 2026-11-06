## 1. Surface and todo grammar

- [x] 1.1 `scripts/drive-atlas`: `shot NAME @Type` / `shot-now NAME @Type` record the type as the
  sixth column of `shots.tsv` and die when the tree holds no node of it; `todo` lines are skipped
  by `atlas_steps`; the header grammar names both. Proof: a one-journey scenario with a right and a
  wrong type (passes, then dies naming the shot), and `shots.tsv` holds the type.

- [x] 1.2 `scripts/drive-atlas` and `scripts/atlas-board.ts mask`: `~@PATH` on a shot, `Type[n]`
  in a path, the masked wait and compare, the seventh `shots.tsv` column, the badge. Proof: the
  desktop's network-states journey, run twice with its connecting glyph pulsing, gives still
  shots and no changed frame.

## 2. The board

- [x] 2.1 `scripts/atlas-board.ts build RUN`: reads `shots.tsv`, the trees (crop), the checks
  (failing rectangles), `diff-<prev>/diff.json` and the scenario's `todo` lines, writes
  `RUN/board.html` with the data inlined. Proof: built from the latest desktop run, opened from
  disk in the browser, a capture of the canvas, the fit, one focus with a FAIL, one changed frame.
  Blocked by 1.1.
- [x] 2.2 `drive atlas run` and `drive atlas diff` build the board in place of the report and print
  its path; `atlas_report` and `summary.tsv` go. Proof: `drive atlas diff` on two kept runs prints
  one path, writes no `index.html`, and the board shows the changed frames.

- [x] 2.3 `scripts/atlas-board.ts` layout and `atlas-board.html`: labels in canvas px, cells as
  wide as their label, wrapping badge rows, no zoom threshold, wheel zoom floored at the whole-board
  fit. Proof: the latest desktop run's board in the browser at the fit, at a section and at 100 %,
  captured: no clipped label, no label over another.
- [x] 2.4 `scripts/atlas-board.ts`: each changed area named by the deepest tree node holding its
  centre, or as outside the shell; the badge names the compared run by date. Proof: the focus of
  `rest--rest` in the run of 4 Nov against 1 Nov lists the cursor area as outside the shell.

## 3. Comments

- [x] 3.1 `scripts/atlas-board.ts serve SCENARIO_DIR` and `comments SCENARIO_DIR`; `drive atlas
  review [SCENARIO]` and `drive atlas comments SCENARIO`. Proof: a comment saved through the page
  in the browser, printed by `drive atlas comments`, shown in a board built after it, resolved
  through the page and gone from the print. Blocked by 2.1.

## 4. Docs

- [x] 4.1 `USAGE.md`: the `drive atlas run` row names the board, rows for `review` and `comments`.

## 5. Recordings

- [x] 5.1 `scripts/drive-atlas`: `record NAME [@Type]` / `stop`, WebM and `recordings.tsv`, a
  missing pair stops the run. Proof: a one-journey scenario that records typing in the launcher
  writes the WebM and its cadence; one with `record` and no `stop` exits non-zero naming it.
- [x] 5.2 `scripts/atlas-board.ts` and `atlas-board.html`: recording frames, looping, focus beside
  the previous run's with both cadences. Proof: two runs of that scenario, the board in the
  browser, focus on the recording plays both. Blocked by 5.1.
- [x] 5.3 `scripts/drive-atlas`, `atlas-board.ts`, `atlas-board.html`: a masked shot records 2 s and
  its frame plays it. Proof: the network-states journey's connecting shots play the pulse on the
  board. Blocked by 5.1.
  `USAGE.md`: the scenario grammar row names `record` and `stop`.
