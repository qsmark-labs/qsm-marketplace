#!/usr/bin/env bun
// qsm-docs installs itself the way every plugin does: the shared install base compiles its binary
// into the user's bin directory and writes its completion. The shell and the json page are inside
// the binary, so it needs only git on PATH.
import { installScript } from "../../../lib/install-base.ts";

export const install = installScript(import.meta);
