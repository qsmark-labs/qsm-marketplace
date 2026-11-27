---
name: react-ui
description: "Use when building or fixing the interactive behaviour of a React UI: a modal or dialog that loses focus or lets the screen reader read the page behind, focus after a route change, signup or checkout form errors, loading and skeleton states, live announcements. Triggers: React modal focus, screen reader reads background, React focus lost after close, React route change focus, form validation errors in React, React spinner flashes, React skeleton while loading, aria-live in React, modal v Reactu, formular chyby. React-specific only: CSS and tokens are css-ui, why a rule exists is a11y-audit and ux-audit."
---

# React UI

What React leaves to you: moving focus, announcing changes, timing a loading state. Hooks, state,
data fetching and API signatures are not here (Context7). Colours, spacing and motion values are
css-ui and the design source; criteria are a11y-audit, feedback and forms are ux-audit, motion is
animate. To make the page readable by the audits, follow css-ui "Make it checkable".

## Rules

1. **Use the platform element before a custom one.** A modal is `<dialog>` opened with
   `ref.current.showModal()` in an effect; a button is `<button>`. `showModal` makes the rest of
   the page inert, traps Tab, closes on Escape and returns focus to the opener, which a hand-built
   `div` modal reimplements badly. Wire the `close` event (not only your own button) to state, or
   Escape leaves React believing the dialog is open.
2. **Where the platform does not do it, move focus yourself, once, on purpose.** After a client
   route change, focus the new page's `h1` (`tabIndex={-1}`, `ref.focus()` in an effect keyed on
   the location); a route change is silent to assistive tech and drops focus on a removed node.
   When a popover or custom modal closes, restore focus to the element that opened it. Do not
   focus in an effect that runs on every render: it steals focus from what the person is doing.
3. **A background behind a custom overlay gets `inert`**, not `aria-hidden` plus a focus trap
   library. `inert` removes the subtree from focus, pointer and the accessibility tree in one
   attribute (a boolean prop in React 19), so the two cannot drift apart.
4. **A live region exists before its content does.** Render `<div role="status">` (or
   `role="alert"` for errors that block) empty at mount and change its text later; a region that
   mounts together with its message is often not announced. Keep one region per surface, not one
   per toast.
5. **A form wires its errors in React.** Ids come from `useId`, never hand-typed (they collide
   when a component renders twice); `<label htmlFor>` and the error element share it, and the
   input gets `aria-invalid` and `aria-describedby` pointing at the error. After a failed submit,
   focus the first invalid field in an effect. With `useActionState`, return the submitted values
   in the state and render them as `defaultValue`, so a failed submit does not erase what was
   typed. What the label, the error text and the validation timing must say is ux-audit.
6. **Loading keeps old content on screen.** Wrap navigation and refetch in `startTransition` so a
   `Suspense` fallback does not replace content already on screen; the old content staying visible
   is the loading state. No busy state for a wait under 150 to 300 ms, feedback for every wait
   over 1 s, and a shown indicator stays 300 to 500 ms (a `Suspense` fallback does this); a known
   length past about 10 s gets `<progress value max>` with a count. Skeleton thresholds are
   ux-audit.
7. **A custom control carries name, role and state.** `div onClick` is a defect: use the native
   element. When a custom widget is unavoidable (combobox, tabs), give it the role, `aria-*`
   state, arrow-key handling and visible focus, in that order. Icons follow ui-design's icon rule:
   an icon-only button gets `aria-label`, an icon beside text gets `aria-hidden`. Prefer a
   maintained headless library (pick-ui-library) over writing the pattern: the keyboard contract
   is the hard part.
8. **JS-driven motion honours reduced motion.** CSS handles its own (css-ui). For animation run
   from JS, read `matchMedia("(prefers-reduced-motion: reduce)")` and subscribe to `change`; with
    an animation library follow web-motion's reduced-motion form. Replace movement with an instant
    state change or a fade, never remove the state change itself. How the motion is written and
    kept fast is web-motion.
9. **A hover card or popover opens by click and by keyboard too.** It still opens on hover and
   closes after the delay in ux-audit (the owner's ruling), but the trigger is a `button` with
   `aria-expanded`, Enter and Space open it, Escape closes it and returns focus, and every action
   and fact inside is reachable that way. Reason: touch and keyboard users never hover.

## Libraries

A maintained library beats a hand-rolled one, and the project's own `package.json` decides first.
The picks are pick-ui-library's, which loads only when the user invokes it.

## Conventions

From the Vercel web interface guidelines, in our words:

- **Forms.** Enter submits a focused input, and in a `textarea` Cmd or Ctrl plus Enter. Accept free
  text and validate after, never block typing, and let an incomplete form submit so validation can
  show. Never block paste (password managers and 2FA codes depend on it); trim values; use
  `autocomplete`, a meaningful `name`, the right `type` and `inputmode`. Disable spellcheck on
  emails, codes and usernames, give a placeholder an example ending in `…`, and set
  `autocomplete="off"` on non-auth fields so a password manager stays out. Show the error inline
  next to its field. Keep submit enabled until the request starts, then disable it with a spinner
  and keep the original label; a loading label ends in `…`. Warn before navigating away from unsaved
  changes.
- **State lives in the URL.** Filters, tabs, pagination and an expanded panel are deep-linkable;
  Back and Forward restore scroll. Navigation is `<a>` or the router's `Link`, so Cmd, Ctrl and
  middle click work; never a `div` with `onClick`.
- **Feedback.** Update optimistically and reconcile on the response, rolling back or offering Undo
  on failure. Destructive actions follow ux-audit's reversibility rule; React renders Undo in a
  toast or inline action and uses a dialog only when that rule requires one.
  Routine status and non-blocking validation use a polite live region; errors that block use the
  pre-mounted alert region from rule 4. Do not announce the same message through both.
- **Hydration.** An input with `value` needs `onChange`, or use `defaultValue`; guard date and time
  rendering against a server and client mismatch; `suppressHydrationWarning` only where truly
  needed.
- **Performance.** Virtualize a long list (the library is pick-ui-library's). No layout read in
  render (`getBoundingClientRect`, `offsetHeight`, `scrollTop`); batch DOM reads then writes.
  Prefer uncontrolled inputs; a controlled one must be cheap per keystroke. The CSS and HTML
  performance rules are css-ui's Conventions.
- **Interaction.** `autoFocus` only on desktop and on the single primary input. Locale and
  captions are css-ui's Conventions.
- **Gestures.** A drag or swipe has a click and keyboard alternative; during a drag, disable text
  selection and set `inert` on dragged elements, as the Vercel rule says.

## Say it in the reply

Where focus goes on open, close, route change and failed submit, and what was run.

Sources: vercel-labs/web-interface-guidelines (MIT); emilkowalski/skills pick-ui-library (MIT).
