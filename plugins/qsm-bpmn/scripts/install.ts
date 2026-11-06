#!/usr/bin/env bun
// qsm-bpmn installs itself the way every plugin does: the shared install base installs its npm
// packages from the lockfile, compiles its binary into the user's bin directory and writes its
// completion. Everything it runs is inside the binary, so it needs no program on PATH.
import { installScript } from "../../../lib/install-base.ts";

export const install = installScript(import.meta);
