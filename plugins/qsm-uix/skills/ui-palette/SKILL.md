---
name: ui-palette
description: "Use when a colour palette is to be built or fixed: a UI that feels monochrome, foggy or vibecoded, accents that mark nothing, surfaces that blur into each other, panels edged three ways at once, deriving a theme from a wallpaper or an image, or deciding what role each colour plays. Triggers: all one hue, the accent does not stand out, surfaces look like fog, too many borders and shadows, theme from wallpaper, derive colours from an image, neutral ladder, role colours, why does my palette feel off, paleta, barvy z tapety. Stack-neutral: how the palette is built and why. The design source file is ui-design; wiring it in CSS is css-tokens, in QML qml-ui; measuring a running UI is ui-audit."
---

# UI Palette

A palette chosen colour by colour drifts to one hue and one grey: every token a different shade of
the same violet, surfaces a few percent of lightness apart, an edge drawn three ways. This skill is
for the person who owns a product's colours and cannot say why they feel wrong. It says how a
coherent palette is built, so `## Tokens` of the design source can be written and `ui-audit` can
check it. It picks no brand colour and writes no stack syntax. The measured case behind it: a
desktop shell whose thirteen tokens sat at one hue, with surface steps of 1.03 to 1.21:1 and three
edge treatments at once.

## Rules

- **A role gets its sentence before its value.** Each role in `## Tokens` says what it is for
  ("accent: what is current now, the active tab or the selected row, nothing else"; `primary`
  stays the one action) and its palette value is chosen after that sentence. Why: a hue with no
  job gets reused for whatever looks good, so the accent ends up marking nothing and the audit has
  no role to check a use against.
- **Neutrals carry structure, hues carry meaning.** The neutrals are a ladder of low-chroma steps;
  with lightness as the separation (below), a container sits at least 1.3:1 (default, WCAG
  formula, computed) on its parent, so the two read as two. The named hues share one lightness per
  theme (default: dark OKLCH L 0.80, light L 0.55) at the largest chroma sRGB holds for every hue
  there (about C 0.10 dark, C 0.09 light), so they read as one set. A role's hue sits more than
  15 degrees (OKLCH, chroma above 0.02) from the neutral tint, and the status roles sit at least
  30 degrees from each other and from `accent` (defaults). Why: a hue within 15 degrees of its
  ground differs from it only by lightness and marks nothing. The instance is Catppuccin's
  structure, not its values: red, peach, green and sky for danger, warning, success and info; a
  second brand hue is one more named hue, and the role that uses it gets its sentence.
- **Palette, roles, components, surfaces: one component per concept.** A component reads roles
  only; a surface composes components and overrides a role only in its page file, with the reason.
  Why: a second component for one concept drifts one grey at a time, and so does a value a surface
  sets for itself.
- **One separation mechanism for containers.** Panels, cards and sections separate by a lightness
  step, or a border (3:1, ui-design's Pairs rule), or a shadow; `## Style` names the one, and
  every container edge uses only it. A control whose edge identifies it (a field, a checkbox)
  keeps its 3:1 border, a divider inside a container is a row rule, a focus ring is a state, and a
  raised overlay's soft shadow and dark-theme edge are ui-design's overlay rule, not a container
  edge. For example, a panel and its cards separated by lightness alone, with no hairline on any
  container edge. Why: two marks on one edge leave the eye unsure which one the design means, and
  the UI reads as two products.
- **A theme derived from an image keeps the ladder and moves the hues.** The lightness ladder is
  fixed per polarity (dark when the image's median OKLCH lightness is under 0.5) and judged once.
  The neutral tint is the chroma-weighted circular mean hue (vector sum of C cos h and C sin h,
  then atan2) of the pixels above OKLCH C 0.02; the `accent` role takes the hue of the most
  chromatic cluster of those pixels, moved to the distances above; under 10 percent of pixels
  qualifying, both take the default hues the source records and the source says the image gave
  none. Every pair is then recomputed, because a new hue is a new column. Why: fixed lightness
  steps keep each pair's relative luminance within about 10 percent across hues, so the ladder is
  designed once and the image supplies only colour.

## In a stack

The rules above do not change; the stack skill holds the syntax. CSS and Tailwind: css-tokens.
Quickshell: qml-ui.

## Red flags

- When every named hue of a draft lies within 15 degrees of the neutral tint, the accent cannot
  mark anything: move it, then recompute its pairs.
- When two kinds of edge (hairline, border, shadow) appear on one container, keep one and delete
  the others.
- When a component names a palette value instead of a role, a theme swap will miss it.

## Say it in the reply

- The role list with each sentence, and the palette values with their OKLCH lightness and hue.
- The container step ratios and the one separation mechanism, computed, not estimated.
- For an image theme: the median lightness, the tint hue, the accent hue, or that the image gave
  no hue.
