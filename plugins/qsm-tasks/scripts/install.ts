#!/usr/bin/env bun
// The shared install base compiles qsm-tasks onto PATH from qsm.json; its skills are loaded by the
// harness from the plugin, and br, which the skills still drive, is probed: no command installs it.

import { installScript } from "../../../lib/install-base.ts";

export const install = installScript(import.meta, {
  upstream: [
    {
      cmd: "br",
      hint: "curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh | bash",
    },
  ],
});
