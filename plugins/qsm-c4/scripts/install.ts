#!/usr/bin/env bun
// qsm-c4 installs itself the way every plugin does: the shared install base installs its npm
// packages from the lockfile, compiles its binary into the user's bin directory and writes its
// completion. LikeC4 and elkjs are inside the binary, so it needs no program on PATH. Its one
// extra step removes the qsm-models binary and completion an older install left, the plugin it
// was split from.
import { installScript, removeRetiredBin } from "../../../lib/install-base.ts";

export const install = installScript(import.meta, {
  extra: (ctx) => removeRetiredBin(ctx, "qsm-models"),
});
