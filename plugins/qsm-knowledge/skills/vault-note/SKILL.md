---
name: vault-note
description: "Use when the person asks to save distilled knowledge into a markdown vault: a TIL, an atomic concept, a project note, a debug note, or a research summary. Triggers: write this to my vault, add a TIL, save this as a note, atomic note, create a vault note about X, validate this note. Writes one note with the frontmatter the vault needs, links it, and validates it. Not research (grounded-research, source-notebook)."
---

# Vault note

This skill saves one concept as one note, where the vault already keeps that kind of note, and
validates it. It does not import in bulk, reorganise a vault, or research.

## Inputs

- The vault path and the note type (`til`, `concept`, `project`, `debug`, `research-summary`,
  `index`): take them from the person's words or the vault; ask only what is missing.
- Put the note where notes of that type already live.

## The note

- Write your conclusion in plain words, with a pointer to the source. Pasted output is a pile.
- One concept per note.
- Link with `[[wikilinks]]`.

| Frontmatter | Required | Holds |
| --- | --- | --- |
| `title` | yes | matches the H1 and the file name |
| `created` | yes | `YYYY-MM-DD` |
| `type` | yes | one of the six |
| `tags` | yes, one or more | lowercase, hyphenated, in the form the vault already uses |
| `aliases`, `source` | no | other names; where the material came from |

## Validate

```bash
qsm-knowledge validate <path-to-note.md>
```

On exit 1, fix every listed error and run it again. A missing wikilink target is only a warning.

## Say it in the reply

The note's path, one line on what it says, and the validation output as printed.
