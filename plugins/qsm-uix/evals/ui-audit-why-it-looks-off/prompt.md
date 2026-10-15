---
name: ui-audit-why-it-looks-off
tags: [scenario]
runs: 3
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the ui-audit skill.

My desktop shell looks off and I cannot say why. It is a Quickshell bar along the bottom, a
notification card in a right-hand column, and a volume popup over the top right. The app is not in
this sandbox and there is no screenshot file, so here is what I have: a description, and the
numbers the region-stats and contrast tools printed on the running shell.

On screen: the bottom bar (the band), a notification card in the right column, the active-workspace
pill on the bar, the panel surface behind the cards, and the volume popup.

Region stats (dominant colour, hue in OKLCH degrees, lightness in percent):
- band: #1A1226, hue 264.0, lightness 11.0%
- card: #262038, hue 255.0, lightness 17.3%
- accent pill: #B9A0E0, hue 263.4, lightness 75.3%

Contrast: card #262038 against the panel surface #221834 is 1.08:1.

Separation, as the design source and the item tree describe it: a 2 px light hairline (white at
12%) on every edge of the bar (tree id `band`) and of each popup (`volumePopup`, `notifyPopup`),
a 1 px border on each card (`notifyCard`), and a drop shadow (0 6px 18px rgba(0,0,0,0.4)) on the
volume popup only (`volumePopup`).

To my eye the band, the card and the pill are all violet. Why does this look off? Answer with
Approach:, Flow: and Next step:, and put the findings in a table with three columns: the finding,
its number, and what it means.
