## ADDED Requirements

### Requirement: A feature's Status is derived, and the Action is its only writer

Apart from `plan` and `qa`, a feature's Status SHALL change only by the rule of
`feature_status_process` of `models/marketplace.bpmn`, applied by `.github/workflows/qsm-tasks.yml`
when a sub-issue of a Feature opens, closes or reopens. It SHALL use `gh` and the secret
`PROJECT_TOKEN`, and serialise two events under one parent.

#### Scenario: The split starts development (path p-e4f7c4)

- **WHEN** the first sub-issue is added under a feature at Todo
- **THEN** the feature is In Dev

#### Scenario: A late event while nothing is open at Todo (path p-86757e)

- **WHEN** an event of a closed sub-issue reaches a feature at Todo with no sub-issue open
- **THEN** the feature stays Todo

#### Scenario: A task merges and others are open (path p-083513)

- **WHEN** a sub-issue of a feature at In Dev closes and another is open
- **THEN** the Status is unchanged

#### Scenario: A task is added to a feature that waits for QA (path p-fd1c94)

- **WHEN** an open sub-issue appears under a feature at Ready For Test
- **THEN** the Action sets In Dev

#### Scenario: An event with nothing open while QA waits (path p-3daef6)

- **WHEN** a sub-issue event reaches a feature at Ready For Test with no sub-issue open
- **THEN** the Status stays Ready For Test

#### Scenario: QA files a finding (path p-17fcd1)

- **WHEN** QA runs `add --feature 3 "export drops the last row"` on a feature In Test
- **THEN** a task exists under feature 3 and the Action sets Blocked

#### Scenario: An event under test with nothing open (path p-98bc6e)

- **WHEN** a sub-issue of a feature In Test is closed and none is open
- **THEN** the Status stays In Test until the owner merges the feature pull request

#### Scenario: A late event on a done feature (path p-2ecc9b)

- **WHEN** a sub-issue of a closed feature is edited, closed or reopened
- **THEN** the feature's Status is unchanged

### Requirement: The last closed task merges main into the feature branch

When the last open task closes and at least one task of the feature closed as completed, the
workflow SHALL merge main into `feature/<n>` and set Ready For Test only when that is clean; on a
conflict it SHALL file one task `Resolve the conflict of feature/<n> with main` under the feature.

#### Scenario: The last task closes and main merges in clean (path p-b8fc2e)

- **WHEN** the last open sub-issue of a feature at In Dev or Blocked closes, one of them completed,
  and main merges into `feature/<n>` without a conflict
- **THEN** the feature is Ready For Test within a minute

#### Scenario: The last task closes and main conflicts (path p-d90e26)

- **WHEN** the last open sub-issue closes, one of them completed, and merging main into
  `feature/<n>` conflicts
- **THEN** a conflict task is open under the feature, the Status stays In Dev, and Ready For Test
  follows the merge of its resolution pull request

#### Scenario: Every task was dropped (path p-afc6b3)

- **WHEN** the last open sub-issue of a feature at In Dev closes and none closed as completed
- **THEN** the Status is unchanged, and the owner or an agent closes the feature with
  `close --not-planned`

### Requirement: Done is GitHub's, and the Action closes what a feature-branch merge names

"Item closed" SHALL set Done for every closed issue, never a verb. GitHub SHALL close a feature when
the feature pull request with `Closes #<feature>` merges into main. When a pull request merges
into `feature/*`, `.github/workflows/qsm-tasks.yml` SHALL close as completed each issue its body
names with `Closes #N`, because GitHub does that only for the default branch.

#### Scenario: A task pull request merges into the feature branch

- **WHEN** a pull request with `Closes #12` merges into `feature/3`
- **THEN** task 12 is closed as completed within a minute and `show 12` prints Status Done

#### Scenario: A pull request into a feature branch is closed unmerged

- **WHEN** a pull request into `feature/3` that names `Closes #12` is closed unmerged
- **THEN** task 12 stays open

### Requirement: The Action derives with the flow table's names

The Action's script SHALL hold the derivation of `feature_status_process` of
`models/marketplace.bpmn` with the Status names of `lib/flow.ts` and no other, because GitHub runs
only what is in `.github/`.

#### Scenario: The Action's copy of a name drifts

- **WHEN** the Action's file names a Status that `lib/flow.ts` does not hold
- **THEN** `qsm-tasks doctor` reports that line as `failed`

### Requirement: doctor checks the Action and its token

`qsm-tasks doctor` SHALL check `.github/workflows/qsm-tasks.yml` and the secret the Action writes
with.

#### Scenario: The Action's file is missing

- **WHEN** `.github/workflows/qsm-tasks.yml` does not exist in the repository
- **THEN** `doctor` prints that check as `failed`
