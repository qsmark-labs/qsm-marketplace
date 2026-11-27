---
name: tools-review
description: "Use when the user asks whether a better tool exists for what the agent does: which qsm tools should I use, am I doing this the long way, tools I installed but never use, new qsm tools on main, cheaper way to read this output, tool recommendations. Compares work done the long way in the ledger and transcripts against qsm-setup tools and the qsm-toolbox catalog, with evidence per recommendation."
---

# Tools review

Finds long-way calls and names the tool that does the job in fewer tokens. It installs nothing: an
install is listed for the person to run. Shared reading and apply rules are in the `usage` skill.

## Look at

- `qsm-setup tools --json`: qsm binaries, installed or new on main, every verb. It reads main as
  last fetched; add `--fetch` only when the person wants the network.
- `qsm-toolbox doctor --json`: third-party tools, present or missing with the install line. Caveats
  per tool are in the `toolbox` skill.
- `mcp__qsm-usage__ledger` over the window: tool uses and TOON savings. Command text and output
  sizes are only in the transcripts (`Bash` inputs, `Read` targets, `WebFetch` calls).
- A binary not on PATH: say so, name `qsm-setup install <plugin>`.

## Long way, short way

| Long way | Tool |
| --- | --- |
| large JSON, YAML or TOML read whole | `qsm-usage toon encode` |
| noisy test or build output read in full | the qsm-usage Bash output filter |
| guessing a payload size | `qsm-usage count` |
| grep loops for a symbol or callers | `qsm-index`, `ast-grep` |
| whole web page for one section | `qsm-web browserbox fetch` |
| raw `gh api` for review threads | `qsm-gh` |
| same question researched again | `qsm-memory` |

The verbs and the catalog win over this table.

## Evidence

- Recommend a tool only with 3 or more calls behind it, because one call is an anecdote.
- Per recommendation give: call count, one quoted command, total output tokens, and the saving per
  session (tokens times the tool's `qsm-usage toon size` ratio), labelled an estimate.
- A missing tool gets its install command. An installed unused tool gets one rule line, such as
  "Read JSON over 1k tokens through `qsm-usage toon encode`", with its own token cost subtracted,
  because that line is resident.
- Findings: install is `change.kind: "command"`, a rule line is `change.kind: "edit"`; both
  `verdict: "fix"`, `question: "cleanup"`.

## Say it in the reply

The table `| Tool | Installed | Replaces | Calls in window | Est. saving per session | Next step |`,
biggest saving first, and for each row the quoted command that justifies it.
