## Build order

Each line can be shown working alone; the proof is the run named after it.

- [x] 1. The plugin: README with `## Why it exists`, `plugin.json`, the marketplace entry,
      `qsm.json` with the nine verbs, `scripts/install.ts`, the noun. Files: `plugins/qsm-docs/**`,
      `.claude-plugin/marketplace.json`. Proof: `bun run validate`, `qsm-docs --help` lists nine
      verbs.
- [x] 2. The store: `create`, `get`, `list`, `delete`, the ledger, the project and branch from git,
      the built-in `json` kind's converter and diff. Files: `plugins/qsm-docs/lib/store/`,
      `lib/kinds/json.ts`, `scripts/cli.ts`. Proof: `runBin` test in a `lib/fixtures/git.ts` repo
      with two worktrees: create, get byte for byte, the sha after every verb, list newest first.
      Blocked by 1.
- [x] 3. The kind registry: `kind add`, `kind list`, `kind remove`, `diff` through a kind's command.
  Files: `plugins/qsm-docs/lib/kinds/`. Proof: a test kind whose commands are `fakeBin` scripts;
  `create` refused when its converter fails. Blocked by 2.
- [x] 4. `serve`: the page shell, `/<kind>` and `/<kind>/<id>`, the API the kind pages call, the
  content security policy, edit mode saving a proposal, the `json` page. Files:
  `plugins/qsm-docs/lib/serve/`, `plugins/qsm-docs/pages/json/`. Proof: design Verify 1, then a
  scripted browser run that edits a `json` snapshot, saves, and finds the proposal in
  `list --open`. Blocked by 3.
- [ ] 5. The hooks: the proposal line at session start and on a prompt, the per-session state and
  its removal, the delete guard in `lib/`. Files: `plugins/qsm-docs/hooks/`,
  `plugins/qsm-docs/lib/delete-guard.ts`. Proof: `bun run test:hooks`, and a real session where a
  save in the browser shows one line on the next prompt. Blocked by 4. Note: the hook tests under
  `claude plugin test` cover the next-prompt line; the real two-prompt run belongs to test-it
  (qsm-vgw0.5).
- [x] 6. The gate that no skill, agent, command or hook calls `qsm-docs delete` or `$.docs.delete`.
      Files: `.gates/validate-no-docs-delete.ts`, `package.json` validate script. Proof: the gate
      fails on a fixture skill that holds the line, and passes on the tree, where the guard's own
      refusal text in qsm-docs is not a call. Blocked by 1.
