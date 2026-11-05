---
name: css-tokens
description: "Use when a set of colours is to be wired into CSS or Tailwind: palette values behind role custom properties, a theme swap that must touch no component, brand themes, Tailwind v4 or v3 theme config, greens that drift between developers, dark values per element instead of once. Triggers: Tailwind colours consistent, Tailwind theme config, @theme inline, role custom properties, data-theme, brand theme in CSS, dark: classes everywhere, slightly different greens, bg-[#hex], tokeny v CSS, tailwind barvy. How the palette is built is ui-palette; plain CSS and HTML rules are css-ui; the design source is ui-design."
---

# CSS Tokens

A palette pasted into components drifts: `--mauve` in a button that must turn teal in another
theme, a `dark:` colour on one element and a different one on the next, a hex in a badge. This
skill is for the person who ships web UI on custom properties or Tailwind. It makes every colour
a role that points at a palette value, so a theme swap or a dark block changes values in one place
and no component. Out of scope: how the palette and roles are chosen (ui-palette, ui-design),
the rest of the stylesheet (css-ui, whose rules 2, 3, 4 and 7 this skill builds on).

## Rules

1. **The palette holds values, roles point at them, components read roles.** The palette is the
   named values of css-ui's theme blocks (`--mauve: #8839ef` in light, `#cba6f7` in the dark
   block); a role is a custom property on `:root` that points at one (`--primary: var(--mauve);
   --on-primary: var(--crust)`), redeclared in the dark block only where ui-design's dark column
   names another palette value, and redeclared in any subtree that switches appearance on its own,
   because a `var()` is resolved where the role is declared. A component reads roles only
   (`background: var(--primary); color: var(--on-primary)`). Reason: a component that names
   `--mauve` stays mauve in a theme that should be teal. Check: grep the component styles for
   palette names; zero hits.
2. **A brand or wallpaper theme is a block under its own selector** (`:root[data-theme="forest"]`)
   that sets the palette values it changes and repoints a role together with its `--on-` partner,
   because contrast is proven on the pair. How an image becomes those values is ui-palette's.
3. **Tailwind is the same tokens in another syntax.** Put tokens in `@theme` (v4) or
   `theme.extend` (v3) and nowhere else. Define the pair names (`--color-primary`,
   `--color-on-primary`) so `bg-primary text-on-primary` is the only way to colour a fill.
4. **Dark values are defined once.** Define the values as plain custom properties flipped by the
   `prefers-color-scheme` block of css-ui's rule 3, and reference them with `@theme inline {
   --color-canvas: var(--canvas) }`. Then no `dark:` variant is needed on each element; a
   component with a `dark:` colour is a second place the dark value lives.
5. **No arbitrary values** (`bg-[#1a1a1a]`, `p-[13px]`, `duration-[240ms]`): they are literals. A
   missing step means a missing token; add it to the design source first.
6. **`motion-reduce:` and `focus-visible:` on every animation and every control**, as css-ui's
   rules 4 and 7.
7. **Build class names whole** (`{ red: 'bg-red-500' }`), never `bg-${color}-500`: the scanner
   cannot see the second.

## Red flags

- A `dark:` colour class, or a `bg-[#...]`, in a component: move the value into the theme and use
  the role.
- A component rule naming a palette value (`var(--mauve)`): point it at the role.
- A role declared once on `:root` and read inside a subtree that sets its own appearance: redeclare
  it there, because the `var()` already resolved.

## Say it in the reply

Name the palette values and roles written, which dark values differ and why, and the grep that
found no palette name in a component. Never claim a contrast ratio you did not compute;
ui-audit measures it.

Sources: Tailwind syntax, [theme variables](https://tailwindcss.com/docs/theme) and
[class detection](https://tailwindcss.com/docs/detecting-classes-in-source-files). The token-only
policy is ui-design's, not a Tailwind restriction.
