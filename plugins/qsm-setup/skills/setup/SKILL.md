---
name: setup
description: "Use when the user wants qsm on a machine or wants to change what is installed or asks what to add: set up qsm, install the plugins, which plugins do I have, reconfigure qsm, doctor says, fix my Claude Code install, which qsm tools are new on main, the bin farm is stale, add a plugin to this machine, nastav qsm, nainstaluj pluginy."
---

# Setup

qsm-setup is the marketplace's proactive installer. A user who knows what they want names the verb;
one who does not gets a guided run that picks the arguments. Install changes no file the user
owns; only an activation writes into the Claude home, so each one waits for its own answer.

## Direct

Run the verb the user named, read the per-plugin lines, report them.

- `qsm-setup install --all`, `qsm-setup install <plugin...>`, or `qsm-setup install --profile
  general`: exactly one of the three; dependency order is the tool's job.
- `qsm-setup doctor [<plugin>] [--verbose]`: one line per installed plugin, orphans as warnings,
  the built-binaries check, the activation state of each plugin, then the `claude ...` lines for
  the Claude Code installation.
- `qsm-setup activate <plugin> -- <options>`: the activation step of one plugin, see Guided.
- `qsm-setup relink [--check]`: completions regenerated, undeclared binaries and completions
  pruned; `--check` writes nothing and exits 1 when stale.
- `qsm-setup build-bins`: every plugin's own build step, then the record doctor compares against.
- `qsm-setup tools [--fetch]`: the qsm binaries on `origin/main` against this machine, verbs added
  and removed. Without `--fetch` it says how old main is and stays offline.

## Guided

1. Ask which plugins, with the general profile as the recommended answer: general, everything, or
   a named list. `qsm-setup install --all --dry-run` lists every plugin and what its installer
   would do. qsm-builder is not in the general profile and installs at project scope inside the
   marketplace checkout only, so offer it only there.
2. Run one install call and read every status line. `suggested` means the
   installer left a command for the user; `blocked` means a requirement failed first;
   `missing-prereq` names a tool to install by hand.
3. Then the activations, one question each, `--dry-run` first, then the user's choice, because an
   activation writes into the Claude home. Doctor shows which plugins are activated.
   - qsm-setup: `qsm-setup activate qsm-setup -- --instructions <replace|overwrite|skip>`. Replace
     is the default: the plugin is the source of the instructions, and the activation rewrites only
     its own marked area in every file it writes (CLAUDE.md, the rules, the output style), keeping
     everything outside the markers, where text specific to this device lives. Overwrite rewrites
     the whole file and runs only when the person asks for it.
   - qsm-memory, when installed: "Use the qsm session archive as the one memory? Claude Code's own
     memory is then turned off (`autoMemoryEnabled: false`) and its transcripts are kept for good
     (`cleanupPeriodDays: 36500`; the default deletes them after 30 days); the MCP is already
     connected by the plugin." Yes: `qsm-setup activate qsm-memory -- --memory qsm`. No:
     `--memory claude`, which records the choice and leaves Claude Code's own retention in force:
     it deletes transcripts after 30 days and qsm-memory packs nothing.
4. Run doctor and report PASS / FAIL / SKIP per plugin, the `claude ...` lines and the summary
   line. A FAIL is a finding for the user, not something to retry.

## Claude Code health

Doctor's `claude ...` lines only report. Each FAIL names its fix; show the line and the exact fix,
apply the fix, then run doctor again.

- Removals (`claude installs`): run the command the line names.
- PATH (`claude path`): add the line to the shell profile the user names.
- A file that does not parse (`claude config`): read only the lines around the named line and
  column and fix the JSON there.
- One key (`installMethod`): read and write that key alone, `jq '.installMethod' ~/.claude.json`.
  Settings files and `.claude.json` hold tokens and paths, so never `cat` one or print its content
  in the reply; name the file, the key and the position.
- Agents and skills: add the missing `description:` line, rename one of the shared `name:` values,
  or fix the frontmatter YAML at the named lines, showing the user the change.
- Version (`claude version`): `claude update`.

## Red flags

- `--all` and plugin names in one call: pick one, the tool refuses both.
- Overwrite deletes the device-specific text outside the markers: choose it only when asked.
- A `suggested` status is not installed: the user still has a command to run.
