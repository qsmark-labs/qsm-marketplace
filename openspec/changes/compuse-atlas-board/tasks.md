## 1. Surface and todo grammar

- [x] 1.1 `scripts/drive-atlas`: `shot NAME @Type` / `shot-now NAME @Type` record the type as the
  sixth column of `shots.tsv` and die when the tree holds no node of it; `todo` lines are skipped
  by `atlas_steps`; the header grammar names both. Proof: a one-journey scenario with a right and a
  wrong type (passes, then dies naming the shot), and `shots.tsv` holds the type.

## 2. The board

- [x] 2.1 `scripts/atlas-board.ts build RUN`: reads `shots.tsv`, the trees (crop), the checks
  (failing rectangles), `diff-<prev>/diff.json` and the scenario's `todo` lines, writes
  `RUN/board.html` with the data inlined. Proof: built from the latest desktop run, opened from
  disk in the browser, a capture of the canvas, the fit, one focus with a FAIL, one changed frame.
  Blocked by 1.1.
- [x] 2.2 `drive atlas run` and `drive atlas diff` build the board after the report and print its
  path. Proof: a run prints both paths and the board exists.

## 3. Comments

- [x] 3.1 `scripts/atlas-board.ts serve SCENARIO_DIR` and `comments SCENARIO_DIR`; `drive atlas
  review [SCENARIO]` and `drive atlas comments SCENARIO`. Proof: a comment saved through the page
  in the browser, printed by `drive atlas comments`, shown in a board built after it, resolved
  through the page and gone from the print. Blocked by 2.1.

## 4. Docs

- [x] 4.1 `USAGE.md`: the `drive atlas run` row names the board, rows for `review` and `comments`.
