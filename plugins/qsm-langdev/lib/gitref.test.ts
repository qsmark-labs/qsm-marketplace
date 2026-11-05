// A git call has a limit like every process: a hung git fails loud with the plugin's error.

import { expect, test } from "bun:test";
import { fakeBin } from "../../../lib/fixtures/bin.ts";
import { isolatedEnv } from "../../../lib/fixtures/cli.ts";
import { sandboxDir } from "../../../lib/fixtures/sandbox.ts";
import { QsmError } from "../../../lib/qsm-error.ts";
import { git } from "./gitref.ts";

test("a git that does not finish within its limit fails with the named error", () => {
  const bin = sandboxDir("qsm-langdev-gitref-bin-");
  fakeBin(bin, "git", "exec sleep 30");
  const env = isolatedEnv(bin, { PATH: `${bin}:${process.env.PATH ?? ""}` });

  const hung = (): unknown => git(bin, ["status"], { env, timeoutMs: 200 });

  expect(hung).toThrow(QsmError);
  expect(hung).toThrow("git status did not finish within 0.2s");
});
