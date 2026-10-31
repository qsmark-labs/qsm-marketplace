## MODIFIED Requirements

### Requirement: Structure scores the architectural comparison the same way

`structure` SHALL apply the reference-versus-shipped rule to architectural
quality rather than to a checker's findings: it SHALL score the reference
tree and the tree given by `--against`, or, given `--session` and `--agent`
and no path, every tree that agent edited this session against the commit it
started from there. A failing verdict SHALL name every cross-module
dependency edge the shipped tree has that the reference tree does not. A tree
missing its architectural rules file SHALL be reported as not scored, never
as failed.

Quality SHALL score a layered architecture by the shape it declares, with the
layers and their `order` in `.sentrux/rules.toml` as the only configuration.
An import or call from a module in a higher layer into a module in a lower
layer SHALL cost nothing in modularity; an edge between two modules of one
layer, an upward edge and an edge with an unlayered end SHALL be charged as
before. A sixth root cause, `direction`, SHALL be the share of cross-module
edges between layered files that point into a lower layer, 1.0 when no layer
is declared or no such edge exists, and quality SHALL be the geometric mean of
the six. The verdict SHALL name `direction` with what lowers it: an edge into
a sibling slice or an upward edge.

#### Scenario: A change that touches only tests

- **WHEN** the shipped tree differs from the reference tree only in test
  files or test fixtures
- **THEN** `structure` SHALL pass, reporting that no product file changed
  and that the tree was not scored

#### Scenario: New tests beside a product change

- **WHEN** a change adds tests that import a shared test helper and also
  changes a product file
- **THEN** `structure` SHALL score the product change alone, list no edge
  from a test file, and say how many test files it left out

#### Scenario: A worse structural score

- **WHEN** the shipped tree's architectural quality scores lower than the
  reference tree's by more than the stated tolerance
- **THEN** `structure` SHALL fail, report the quality before and after, and
  list every newly added cross-module edge

#### Scenario: A structure agent with no recorded edit

- **WHEN** `--session` and `--agent` name an agent that edited nothing this
  session
- **THEN** `structure` SHALL pass, saying the agent edited no tree

#### Scenario: The architecture backing tool cannot be reached

- **WHEN** the structural scoring tool is missing or answers with no
  machine-readable output
- **THEN** `structure` SHALL fail and name its install command

#### Scenario: A slice imports the core

- **WHEN** a TypeScript, Python or C# change adds an import from a module in
  the higher layer into the core, the lower layer
- **THEN** modularity SHALL not fall, `direction` SHALL not fall, and
  `structure` SHALL pass

#### Scenario: A slice imports a sibling slice

- **WHEN** a TypeScript, Python or C# change adds an import from one module of
  the higher layer into another module of the same layer
- **THEN** `direction` SHALL fall, and the verdict SHALL name the new edge

#### Scenario: No layers declared

- **WHEN** `.sentrux/rules.toml` declares no `[[layers]]`
- **THEN** modularity SHALL be computed over every edge as before, and
  `direction` SHALL be 1.0

### Requirement: Install builds the structural checker when it is missing

Install SHALL compile this plugin's binary and its classic hook through
the shared install base, and SHALL handle the structural checker as one extra
step: `already` when the checker on PATH reports the version this plugin's patch
builds (`0.5.7-qsm.3`), so an older patched build is rebuilt;
otherwise it SHALL run this plugin's build script and report `installed` on
success, `error` with the build command on failure, and `missing-prereq`
naming `cargo` when `cargo` is not on PATH. A dry run SHALL name the build
command and run nothing.

#### Scenario: No compatible checker present

- **WHEN** install runs, `cargo` is on PATH, and no checker reporting a
  qsm-patched version is on PATH
- **THEN** install SHALL run the build script and report `installed`

#### Scenario: The build fails

- **WHEN** the build script exits non-zero
- **THEN** install SHALL report `error` carrying the command to run by hand

#### Scenario: No cargo

- **WHEN** no compatible checker and no `cargo` is on PATH
- **THEN** install SHALL report `missing-prereq` naming `cargo` and build
  nothing

#### Scenario: A compatible checker is already present

- **WHEN** the checker on PATH reports a qsm-patched version
- **THEN** install SHALL report `already` and build nothing
