#!/usr/bin/env bun
// The shared install base compiles qsm-tasks onto PATH from qsm.json and probes what no command
// installs unattended: gh, which every verb but flow runs, and br, which the skills still drive.

import { installScript } from "../../../lib/install-base.ts";

export const install = installScript(import.meta, {
  upstream: [
    { cmd: "gh", hint: "install the GitHub CLI, then gh auth login -s project" },
    {
      cmd: "br",
      hint: "curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh | bash",
    },
  ],
});
