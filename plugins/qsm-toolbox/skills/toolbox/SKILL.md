---
name: toolbox
description: "CLI tools on this machine, invoke for caveats. Third-party: ast-grep (AST code rewrite), acli (Jira Confluence CLI), br (beads issue tracker), comby (structural rewrite), graphify (dependency graph), git-cliff (changelog), gitingest (repository to one file), gws (Google Workspace), hurl (HTTP test files), instaloader (Instagram download), jc (CLI output to JSON), lightrag-server (graph RAG), lizard (complexity ranking), mlr (CSV JSON reshaping), opencli (websites as CLIs), opensrc (dependency source), readable (page to article), scc (code size), semble (semantic search), semgrep (pattern code scan), usql (all databases), yq (YAML TOML jq). qsm: qsm-book-to-skill (document to skill), qsm-forge (PR, MR threads), qsm-index (code index), qsm-knowledge (knowledge checks), qsm-langdev (language gates), qsm-memory (past sessions), qsm-openspec (OpenSpec doctor), qsm-secrets (secrets without values), qsm-statusline (status line), qsm-uix (screen measurements), qsm-usage (usage report, TOON), qsm-web (fetch, search, browser)."
---

# Toolbox

Without a shared list, each session rediscovers which command-line tools this machine has, or
never learns that one exists. The description above is that list and is always in context. This
page holds the one thing per tool the agent cannot guess from `--help`, which is where an hour
goes when it is missed. Nothing here says what a tool does or how to call it: run its `--help`,
because a transcription drifts and the help does not. Every tool is optional.

## Caveats

A tool not in this table has none.

| Tool | Our caveat |
| --- | --- |
| `ast-grep` | the short alias `sg` is an unrelated system command, never use it |
| `acli` | invoke Confluence as `confluence-cli`, never the `confluence` alias the same package installs, a local script may already own that name |
| `br` | `br` is the Rust tracker; the Go tool of the same name is `bd`, never mix them |
| `comby` | on Arch, `libpcre.so.3` is absent; install `libpcre` and symlink `.so.1` to `.so.3` |
| `git-cliff` | preview the range (`--unreleased`) before writing a file, and never commit a `cliff.toml` into this marketplace; a repository that wants one owns it |
| `gitingest` | name the output with `-o` outside the working tree, because the default writes `digest.txt` into the current directory; a private repository takes its token from `GITHUB_TOKEN`, never from `-t`, which puts the token into the transcript |
| `lightrag-server` | a multi-GB footprint and no query succeeds until an LLM backend key or endpoint is configured |
| `semble` | a grep-trained agent tends to re-search after semble answers; trust the ranked chunks first |
| `semgrep` | `--autofix` rewrites source, never run it against an uncommitted tree; registry rules pull metrics |
| `yq` | this is mikefarah/yq (Go); kislyuk/yq (Python) shares the name and has a different syntax |

## Adding a tool

Edit `lib/catalog.ts` and paste the table `bun test` expects into this page. A missing tool: run
`qsm-toolbox doctor` for its install line and carry on.
