#!/usr/bin/env bun
// qsm-bpmn installs itself the way every plugin does: the shared install base installs its npm
// packages from the lockfile, compiles its binary into the user's bin directory and writes its
// completion. Everything it runs is inside the binary, so it needs no program on PATH. Its one
// extra step removes the qsm-models binary and completion an older install left.
import { installScript, removeRetiredBin } from "../../../lib/install-base.ts";

export const install = installScript(import.meta, {
  extra: (ctx) => removeRetiredBin(ctx, "qsm-models"),
});
