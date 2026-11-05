## ADDED Requirements

### Requirement: A shot names the surface it shows

A scenario's `shot NAME @Type` and `shot-now NAME @Type` SHALL record `Type` as the shot's surface,
keep `journey--NAME` as the shot's name, and stop the run naming the shot when the shot's item tree
holds no node of that type.

#### Scenario: A popout shot is cropped to its popout

- **WHEN** a journey hovers the rail's network cell and runs `shot network @NetworkPopoutContent`
- **THEN** the run's board shows a frame `network` in the section `NetworkPopoutContent`, cropped to
  that node's rectangle from the shot's tree, padded by 32 logical px

#### Scenario: A type the tree does not hold stops the run

- **WHEN** a shot names `@NetworkPopup` and the tree holds no `NetworkPopup`
- **THEN** `drive atlas run` exits non-zero naming the shot and the type

### Requirement: A shot masks what animates by design

A shot's `~@PATH` words SHALL each name an item, found as a surface is, with `Type[n]` the nth
node of that type with a size. The shot SHALL wait for a still screen outside the masked items,
the comparison with the previous run SHALL count no changed area inside them, the shot's item
tree SHALL hold them no more, and the board SHALL mark the frame `animates`. A mask the tree does
not hold SHALL stop the run naming the shot.

#### Scenario: A pulsing glyph neither blocks the shot nor reads as a change

- **WHEN** a journey shoots `shot rail-connecting @Rail ~@RailEntry[5]/SvgIcon` while that glyph
  pulses, twice on unchanged code
- **THEN** both shots are still, the second run shows no changed frame, and the frame carries
  `animates` with the glyph's rect drawn in focus

### Requirement: A journey records what moves

A scenario's `record NAME [@Type]` SHALL start a real-frame recording of the slot's screen, and
`stop` SHALL end it; the steps between them run as usual. The run SHALL keep the recording as WebM
with the frame timestamps as captured, plus its cadence: frames, span, effective fps, max gap and
the gaps over 1.5 periods of 60 fps. A `record` without its `stop`, or a `stop` with no `record`,
SHALL stop the run.

#### Scenario: Typing into the launcher is recorded

- **WHEN** a journey runs `record typing @LauncherSurface`, `type foot`, `stop`
- **THEN** the run holds `recordings/<journey>--typing.webm` and its cadence

#### Scenario: A recording left open stops the run

- **WHEN** a journey runs `record typing` and ends without `stop`
- **THEN** `drive atlas run` exits non-zero naming the journey and the recording

### Requirement: The board plays recordings beside the previous run's

The board SHALL show a recording as a looping frame in the Type's section, cropped to the Type's
rectangle in the tree read at `stop`. Focus SHALL play it beside the previous run's recording of the
same name with both cadences. A recording SHALL NOT be compared by pixels.

#### Scenario: The owner compares two runs of a typing recording

- **WHEN** two runs recorded `typing` in the launcher and the owner focuses the frame
- **THEN** both recordings play side by side, each with its frames, effective fps and max gap

### Requirement: The inventory shows its holes

A scenario's `todo @Type STATE` SHALL put an empty frame titled STATE in the Type's section of the
board, and the steps of a journey SHALL ignore the line.

#### Scenario: A state no journey shoots yet

- **WHEN** the scenario holds `todo @NetworkPopoutContent portal`
- **THEN** the board's `NetworkPopoutContent` section holds an empty frame titled `portal`, and the
  run passes

### Requirement: Every run writes its board

`drive atlas run` SHALL write `board.html` in the run directory and print its path, and SHALL fail
when the board cannot be built. The page SHALL open from disk with no server and no network.

#### Scenario: The board opens from the run directory

- **WHEN** a run finishes and the owner opens `RUN/board.html` in a browser from disk
- **THEN** every shot of the run is a frame on a canvas that pans by drag, zooms by wheel about the
  pointer, and fits all frames on `F`

### Requirement: The board reads the same at every zoom

Every name, badge and section title SHALL scale with the canvas like the frames it labels, SHALL
show whole, never clipped, and SHALL keep its place against its frame at every zoom. The board
SHALL give each frame a cell at least as wide as its label as drawn, and wheel zoom SHALL stop
where the whole board fills the window.

#### Scenario: A narrow frame keeps its whole label

- **WHEN** a rail cell's frame is 60 px wide and carries `FAIL · 1` and `changed · 1`
- **THEN** both badges and the state name show whole at every zoom, and no label covers another
  frame's label

#### Scenario: Zooming out stops at the whole board

- **WHEN** the owner keeps turning the wheel out
- **THEN** the zoom stops at the fit of the whole board, which `F` also gives

### Requirement: A frame carries what the run measured

A frame SHALL show a badge when the shot changed against the previous run, when its check failed,
and when its screen never stilled. Focus on a frame SHALL show the crop and the full screen, the
check's failing lines with each failing item's rectangle drawn, the changed areas, a before, after
and overlay switch for a changed shot, the changed tree measures, and the neighbour frames by arrow.

#### Scenario: A failed contrast check is visible on its frame

- **WHEN** a shot's check printed `contrast Prose[24,48 32x16] ... = 1.00:1 >= 4.5: FAIL`
- **THEN** the frame carries a FAIL badge, and its focus draws the rectangle 24,48 32x16 on the
  screen and lists the line

#### Scenario: A changed shot shows before and after

- **WHEN** the run's `diff-<prev>/diff.json` lists changed areas for a shot
- **THEN** the frame carries a changed badge, and its focus switches between the previous run's
  image, this run's image and an overlay with the areas boxed

### Requirement: A change says what changed and against what

A changed frame's badge SHALL name the run it was compared with by its date and time. Its focus
SHALL list each changed area with its size, its place and the deepest item of the shot's tree that
holds it, or say that no item of the shell holds it (the cursor, the wallpaper, a client window).

#### Scenario: A cursor change is named as outside the shell

- **WHEN** only the cursor's shape changed in `rest--rest` against the run of 1 Nov 05:02
- **THEN** the badge reads `changed vs 1 Nov 05:02`, and focus lists one area with its size and
  place, held by no item of the shell

### Requirement: Comments land where the agent reads them

`drive atlas review [SCENARIO]` SHALL serve the latest run's board on 127.0.0.1 and print its
address; a comment pinned to a point of a frame SHALL be saved to the scenario's `comments.json` and
shown on that shot in every later board until it is resolved. `drive atlas comments [SCENARIO]`
SHALL print the open comments one per line as `shot<TAB>x,y<TAB>text`; without SCENARIO both verbs
take the scenario run last.

#### Scenario: The owner comments and the agent reads it

- **WHEN** the owner clicks a point in the focused frame `rail--network` under `drive atlas review`
  and saves "the glyph should warn"
- **THEN** `drive atlas comments desktop.atlas` prints `rail--network`, the point and the text, and
  the next run's board shows the comment on the same frame

#### Scenario: A board opened from disk says how to comment

- **WHEN** the board is opened from disk and the owner tries to add a comment
- **THEN** the page says that commenting needs `drive atlas review` and saves nothing
