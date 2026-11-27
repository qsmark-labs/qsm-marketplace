---
name: add-skill
description: "Use when building a skill, an agent or a command inside a plugin that exists: which file it is, where it goes, the size cap, the description that makes it fire, and the eval that must pass before it is done. Triggers: add a skill, new skill, create a skill, add an agent, new subagent, add a slash command, pridej skill, pridej agenta, udelej novy skill. A new plugin is add-plugin, a hook is add-hook, a CLI verb is add-tool; whether a skill is any good is skill-standards."
---

# Add Skill

A skill, an agent and a command are the three prompt files a plugin ships. This is the build order
and the hard rules for adding one, because a skill added by feel loads never, loads on everything,
or duplicates a neighbour, and none of that shows until it is used. How to write the prose is
skill-standards; a whole new plugin is add-plugin.

## Steps

1. Search first: `qsm-memory search <concept>`, then grep skill descriptions and agent files. A
   skill that covers it gets edited, and you stop here.
2. Pick the kind. A skill is knowledge or a procedure the main agent loads on a trigger. An agent
   is one bounded job in its own context that returns a briefing. A command is a prompt the person
   types by name.
3. Pick the plugin that owns the subject. Paths: `plugins/<plugin>/skills/<name>/SKILL.md`,
   `plugins/<plugin>/agents/<name>.md`, `plugins/<plugin>/commands/<name>.md`.
4. Write the description from what a user types, then the body to the shape skill-standards gives.
5. Run Done means.

## Hard rules

1. The file lives under the plugin that owns the subject, never in root `lib/` or another plugin,
   because a plugin owns its content. Gate: `validate-no-cross-plugin-import`.
2. Frontmatter carries `name` and `description` (skill), plus `model` (agent), or `description`
   (command), because a malformed file is dropped silently. Gate: `validate-plugin-contracts`.
3. An agent names its cheapest fitting model, because an unnamed one inherits the session's most
   expensive. Gate: `validate-plugin-contracts`.
4. A `SKILL.md` or agent stays under 12 KB, aims for 8, with no `references/`; over the cap is two
   skills, because a second subject loads where it is not needed. Gate: `validate-file-size`.
5. The description opens with the key case, carries Czech and English triggers, stays under 1,024
   characters, and names the neighbour that owns the rest, because two matching descriptions are a
   coin flip.
6. A skill names a CLI verb on PATH, never a path into this repository or another plugin's files,
   because a binary runs with no checkout in the room (add-tool owns the rule).

## Done means

Every command exits 0, as `mise exec -- ...`:

- `bun run validate`
- `bun run lint`
- `bun run typecheck`
- `bun test --parallel ./ ./.gates`

## Red flags

- When the description is written after the body, rewrite it from what users type, because the
  harness matches it.
- When an agent is one nobody delegates to, make it a skill, because an agent costs a context and a
  model name.
