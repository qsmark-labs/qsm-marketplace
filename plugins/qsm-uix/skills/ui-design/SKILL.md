---
name: ui-design
description: "Use when a UI is to be designed, specified, or restyled before it is built: choosing colours, spacing, type or a look, setting up dark mode, writing down what two products must share, or deciding what a new panel, page, or CLI output should follow. Triggers: design the UI, decide colours and spacing, dark mode, design tokens, style guide, make it look like the rest, same look on web and desktop, navrhni vzhled, design system, jak ma vypadat. Writes the design source that builds and audits read. Measuring a running UI is ui-audit and ux-audit; accessibility criteria are a11y-audit; syntax is the stack skills."
---

# UI Design

A UI built from taste drifts: every component picks its own grey, its own gap, its own dark
values, and the first person to find out is the one who cannot read it. This skill serves the
person who builds and publishes interfaces and answers for their accessibility. Its outcome is one
written design source, made before the first component, that every build follows and every audit
measures against. It does not audit a running UI, name a framework, or ship palettes, font
pairings, or a catalogue of looks: it produces the numbers and constraints, and the maintainer's
taste picks the hues.

## Decide in this order

Work top-down, because a late concern costs a rebuild and an early one costs a sentence.

1. **Accessibility floor.** What every user must be able to do (keyboard only, screen reader,
   reduced motion, larger text, no reliance on colour). It goes into `## Requirements` first, so
   every later choice is made inside it.
2. **Interaction.** The one primary action per surface, how states read, target sizes, feedback.
3. **Tokens and scales.** The values everything traces to.
4. **Layout and hierarchy.** Grouping, rhythm, reserved space.
5. **Style.** The look, last, because it is the cheapest to change and the easiest to argue about.

## Detect before you ask

Never assume the stack. Look for an existing `design/` folder, a theme file, tokens in code, a
screenshot. If a design source exists, read it whole before writing: extend it, do not regenerate
it. Ask one question only when the answer changes the source: the surfaces (bar, page, CLI), the
audience, any fixed brand colour. If the stack is unknown, the source stays stack-neutral anyway;
the stack skill maps it later. Do not stop at the question: state the
assumption and still write the source with tokens, pairs and ratios, because a draft the person
can correct is worth more than a questionnaire.

## The design source

One markdown set: `design/MASTER.md` for everything global, `design/pages/<surface>.md` for what
one surface changes. The page file wins on conflict, so a surface can differ without forking the
master. Read both before editing either, and never overwrite a file the person wrote without
their say-so, because the source is their decision record, not output.

Use these headings, because the audits and the stack skills look for them:

| Heading | Holds |
| --- | --- |
| `## Tokens` | the palette (named values with their light and dark value: a neutral ladder and named hues), then the roles: name, meaning, light, dark, each value a palette name. Roles, not hues: `surface`, `primary`, `danger`, `border` |
| `## Pairs` | fill, on-fill, ratio in light, ratio in dark |
| `## Scales` | space, type, radius, elevation, layer, icon size, motion, density |
| `## Style` | the one separation mechanism, constraints, the requirements it brings, do not use for |
| `## Requirements` | the accessibility floor the source commits to |

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
- **Every colour is a role, and a fill role never travels alone.** Define `primary` with
  `on-primary` and record the ratio per theme: 4.5 for text, 3 for large text, icons, borders and
  focus indicators (WCAG 1.4.3, 1.4.11). Why: contrast belongs to a pair, so a colour checked alone
  is checked against nothing. Compute the ratio with the WCAG relative-luminance formula, never
  estimate it (`qsm-uix contrast` reads pixels of an image, so it verifies the built pair later).
- **Design each theme on its own column.** Write dark values by choosing them against dark
  surfaces, then check them; an inverted light palette fails because shadows vanish, saturated
  fills glare, and light borders turn into holes. Parity means every pair passes in each theme
  and a border, divider, or state visible in one is visible in the other. High contrast, if
  wanted, is a third column.
- **Every dimension is a scale, and a component picks a step.** Space on a 4/8 grid with two to
  four clusters in use; type steps of about 1.125; one set each for radius, elevation, layer
  (z-order), icon size, motion (duration and easing, exit shorter than enter), density. Why: a
  literal in a component is a decision nobody reviewed, and a scale is how one change reaches
  every surface. Density is an axis of the scale (compact, regular), not a second design.
- **Palette, roles, components, surfaces: one component per concept.** A component reads roles
  only; a surface composes components and overrides a role only in its page file, with the reason.
  Why: a second component for one concept drifts one grey at a time, and so does a value a surface
  sets for itself.
- **A theme derived from an image keeps the ladder and moves the hues.** The lightness ladder is
  fixed per polarity (dark when the image's median OKLCH lightness is under 0.5) and judged once.
  The neutral tint is the chroma-weighted circular mean hue (vector sum of C cos h and C sin h,
  then atan2) of the pixels above OKLCH C 0.02; the `accent` role takes the hue of the most
  chromatic cluster of those pixels, moved to the distances above; under 10 percent of pixels
  qualifying, both take the default hues the source records and the source says the image gave
  none. Every pair is then recomputed, because a new hue is a new column. Why: fixed lightness
  steps keep each pair's relative luminance within about 10 percent across hues, so the ladder is
  designed once and the image supplies only colour.
- **One separation mechanism for containers.** Panels, cards and sections separate by a lightness
  step, or a border (3:1, the Pairs rule), or a shadow; `## Style` names the one, and every
  container edge uses only it. A control whose edge identifies it (a field, a checkbox) keeps its
  3:1 border, a divider inside a container is a row rule, and a focus ring is a state. For example,
  a panel and its cards separated by lightness alone, with no hairline on any container edge. Why:
  two marks on one edge leave the eye unsure which one the design means, and the UI reads as two
  products.
- **State changes colour, opacity, or elevation, never bounds.** Hover, press, focus and disabled
  stay in the same box. Adjacent states of a control differ by a contrast ratio of at least 1.2,
  and the focus indicator reaches 3:1 against its neighbours. Why: a state that moves layout
  jitters the neighbours and a state that cannot be told apart is not a state.
- **Sizes carry a floor.** Target 24 px minimum (WCAG 2.5.8), 32 px for anything used often;
  icon box at least 12 px, text at least 10 px. These are defaults, and the source records any
  override per project with its reason, because a threshold silently changed is a regression
  nobody can find.
- **One primary action per surface.** Secondary actions are visibly subordinate and a destructive
  one is separated and named as such. Why: when two things shout, the user has to decide what
  the design should have decided.
- **A style is a constraint set, never a name.** Write what the look requires (for example "thin
  borders at 1 px, 3:1 against the surface; no shadow-only separation"), the accessibility it
  brings, and where it must not be used (dense data, small text, high-contrast users). Why: a
  named fad such as "glass" says nothing the audit can measure; a constraint can fail a pair.
- **The source changes by principle and holds only what is true now.** When a finding or a wish
  comes back to the source, it is traced to the principle it broke, and the token or rule that
  carries that principle changes: "the sidebar warning is too loud" breaks "a status colour marks
  a state, never a region", so the `warning` value changes, not a sidebar exception. A superseded
  line is replaced, never kept beside a dated amendment. Why: a line per complaint stacks until
  each new one breaks an older rule it never met, and git already holds what the source used to
  say.

## Output

Write `design/MASTER.md` (and a page file only when a surface differs). When no file can be written,
give the same content in the reply. Keep it short: tokens in a table, not prose. Mark each threshold
as default or override. Close with `## Requirements`, then tell the person what to do next: build
with the stack skill, then run ui-audit against this file, which is the expected column.

## Red flags

- When a colour appears in the draft with no `on-` partner, add the pair and compute its ratio,
  because an unpaired colour will be placed on something unmeasured.
- When the dark column equals the light one inverted, redesign it against dark surfaces, because
  inversion keeps light's mistakes and adds new ones.
- When you reach for a hex literal in a component description, name a token instead, because the
  literal is invisible to the audit and to the next theme.
- When the draft names a framework, a CSS property, or a QML type, move it to the stack skill,
  because the source must survive a change of stack.
- When you are about to list palettes, font pairings, or "styles for SaaS", stop and write the
  token roles and constraints, because the person picks the look and the source holds its rules.
- When a surface's page file contradicts the master, keep the page file and note the override
  and its reason, because the page wins by design.
- When the person gives no accessibility requirement, write the floor above anyway and say so,
  because silence in the source becomes a defect in the product.

## Say it in the reply

- The path of the design source written, and which parts are defaults versus the person's
  choices.
- The contrast ratio per pair and theme, computed, with the tool or formula used.
- What was assumed and what was asked, and the open decisions left for the person.
- What is not covered: no running UI was measured, so nothing here is verified until ui-audit
  runs against it.
