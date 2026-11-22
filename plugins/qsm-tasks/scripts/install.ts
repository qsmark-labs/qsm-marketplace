#!/usr/bin/env bun
// The shared install base compiles the qsm-tasks bin and links it onto PATH, and probes br, which
// no command can install unattended.

import { installScript } from "../../../lib/install-base.ts";

export const install = installScript(import.meta, {
  upstream: [
    {
      cmd: "br",
      hint: "curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh | bash",
    },
  ],
});
