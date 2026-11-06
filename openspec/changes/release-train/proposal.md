Parked: the owner deferred versions and releases until an app has a full release flow; the
marketplace has none yet (feature-flow design, the owner's answer 4). This change holds the Why,
the What and the open decisions only, and no requirement until it is designed with its own
grilling.

## Why

Done features pile up with no version, no release note and no point at which they leave the board.
The owner: "i want to a add full release versions, so released is what we pick into the 2weeks
release, and from there after 2weeks it gets archived." About the Iron Law of AGENTS.md that
forbids versioning in the tree: "that rule is relevant for local not releasing projects ... normal
versioning and releasing for a proper project is okay, and wanned."

## What

- **Versions and a two-week release**: Done items are picked into a release; a Status Released is
  set then.
- **Release notes** built from the items in Released.
- **Archive** two weeks after the release.
- **The Iron Law on versioning** is reconciled in AGENTS.md for a releasing project.

## Open decisions

1. **Tools**: GitHub's Iteration field, GitHub Releases and the board's built-in auto-archive are
   the candidates; which of them, before any of ours.
2. **What is versioned**: the marketplace as one version, or each plugin.
