---
name: ui-palette-monochrome-shell
tags: [scenario]
runs: 3
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

Use the ui-palette skill.

My desktop shell (a Quickshell panel) runs on one theme. It feels vibecoded to me and I cannot say
why. These are its colour tokens, verbatim:

bandFill #160D20, background #1B1027, backgroundMid #23182F, backgroundEnd #2C203B,
surface #2E203C, text #F6F1FB, textMuted #BCAECA, accent #C7A8EB, secondary #DEC0EF,
info #B7AECF, success #91D6C2, warning #E8C58A, danger #FF8B94.

Surfaces are flat fills with no shadow; every panel edge also carries a 2 px light hairline, and
each inner card a 1 px border.

The shell's files are not in this sandbox, so work from these values alone. Tell me what is wrong
with the palette, in terms of hue and lightness, and what it should change to. Reply in this shape:

Approach: <how you read the palette and what you check first, and why>
Flow: <numbered steps of the fix, with the values or structure you would set>
Next step: one next action
