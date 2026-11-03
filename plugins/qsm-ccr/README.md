# qsm-ccr

Another provider's model as a teammate or a lead inside Claude Code, with the whole marketplace,
while every Claude session stays on the subscription.

## Why it exists

Claude Code is the one harness this marketplace is built for and the only one a Claude
subscription may be used in, yet some work is better or cheaper on another provider's model, and
without a seam that model either runs in a second harness without the skills, agents and hooks, or
the harness is pointed at a router and the subscription's own traffic risks following it. This
plugin takes the stance that a non-Claude model is one more teammate or lead in the same harness,
chosen by name at launch, while every Claude session stays on the subscription, untouched and
never routed. Each upstream tool keeps what it owns: the provider's own CLI holds the credentials
and the model list, the router only forwards, and the harness is neither patched nor wrapped
beyond its launch. It refuses to carry Claude traffic, to become a second store of provider
credentials, or to grow into a harness of its own. It has no reason to exist once Claude Code can
route a teammate to another provider by itself.

## What it is

One compiled binary, `qsm-ccr`, that is both the tmux teammate launcher and a CLI with the verbs
`lead`, `sync` and `doctor`. Claude Code runs it for every teammate; a name beginning `gpt-` runs on
the `codex-api` provider through the local router, and any other name runs plain `claude` with no
router environment, on the subscription. `codex` owns the tokens and the model catalog; `sync`
copies them into CCR. A session start keeps that copy under a day old, in the background.

## Install

```bash
claude plugin install qsm-ccr@qsm-marketplace
bun plugins/qsm-ccr/scripts/install.ts
qsm-setup activate qsm-ccr
```

Install compiles the binary and probes `claude`, `ccr` and `codex`; it starts nothing. Activation
is the one step that changes files you own, and `-- --dry-run` names each change first. Details are
in [INSTALL.md](INSTALL.md).

## Use

```bash
qsm-ccr lead                       # Claude Code on the catalog's default model
qsm-ccr sync                       # make CCR's tokens and model list match codex's
qsm-ccr doctor                     # every seam, one verdict, nothing started
```

A Claude lead started with `CLAUDE_CODE_TEAMMATE_COMMAND="$(command -v qsm-ccr)" claude` routes
its teammates by name without changing user settings. A teammate is chosen by its name:
`gpt-6.1-sol-reviewer` runs on the slug the name begins with,
`gpt-reviewer` on the catalog's default. Take the slugs from `qsm-ccr doctor`. Every verb takes
`--json`. The full reference is [USAGE.md](USAGE.md).

Routed sessions use a private copy of the current Claude settings. They share login, installed
plugins, skills and team communication with the originating Claude home. Session homes and their
transcripts stay under `$XDG_STATE_HOME/qsm-ccr/homes` (default `~/.local/state/qsm-ccr/homes`);
qsm-ccr does not delete them. A model selected in a routed session is saved only in its copy.

## Caveats

- Anthropic does not support routing Claude Code to non-Claude models through a gateway. See
  [the gateway documentation](https://code.claude.com/docs/en/llm-gateway); compatibility can
  change.
- The auto permission classifier makes a separate model call per decision through whatever the
  session routes to: about 40k input tokens, measured once.
- One refresh chain, two holders end in `refresh_token_reused`: never run a second CCR on the same
  codex login.
- Router values found in `~/.claude/settings.json` are reported and block a daemon start; qsm-ccr
  never removes them.
- Activation edits `~/.codex/config.toml` only to remove what CCR wrote there, after copying it to
  `config.toml.qsm-ccr.bak`.
- Activation does not add a teammate command to Claude settings. Re-enable CCR profiles in its own
  UI if the profile guard is no longer wanted.
- OpenRouter and OpenCode Zen are not shipped: each is one more provider-prefix row once the place
  of its API key is decided.
