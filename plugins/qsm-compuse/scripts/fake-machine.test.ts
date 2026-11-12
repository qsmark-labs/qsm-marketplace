// The fake machine's PipeWire daemon ends with the fake machine, through the real script and
// shimmed pipewire tools.
import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fakeBin } from "../../../lib/fixtures/bin.ts";
import { isolatedEnv } from "../../../lib/fixtures/cli.ts";
import { ended } from "../../../lib/fixtures/dead-run.ts";
import { atTestEnd, sandboxDir } from "../../../lib/fixtures/sandbox.ts";

const FAKE_MACHINE = resolve(import.meta.dir, "fake-machine.ts");

test("a served fake machine that is stopped takes its PipeWire daemon with it", async () => {
  const home = sandboxDir("qsm-fake-machine-");
  const runtime = join(home, "run");
  const dir = join(home, "fake");
  const pidFile = join(home, "pipewire.pid");
  mkdirSync(runtime);
  mkdirSync(dir);
  fakeBin(
    home,
    "pipewire",
    `echo $$ > "${pidFile}"; touch "${runtime}/pipewire-0"; exec sleep 300`,
  );
  fakeBin(home, "pw-dump", `echo '[{"id":1,"info":{"props":{"node.name":"n"}}}]'`);
  fakeBin(home, "pw-cli", "exit 0");
  const node = { "node.name": "n", "node.description": "d", "media.class": "Audio/Sink" };
  const state = join(home, "state.json");
  writeFileSync(
    state,
    JSON.stringify({ pipewire: { nodes: [{ ...node, channelVolumes: [1], mute: false }] } }),
  );
  const serve = Bun.spawn(["bun", FAKE_MACHINE, "serve", dir], {
    env: isolatedEnv(home, {
      PATH: `${home}:${process.env.PATH ?? ""}`,
      XDG_RUNTIME_DIR: runtime,
      DRIVE_STATE: state,
    }),
    stdout: "inherit",
    stderr: "inherit",
  });
  atTestEnd(() => {
    serve.kill("SIGKILL");
    try {
      process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL");
    } catch {
      // ended: the fake machine did its job
    }
  });
  for (let i = 0; i < 200 && !existsSync(join(dir, "ready")); i++) await Bun.sleep(50);
  expect(existsSync(join(dir, "ready"))).toBe(true);

  serve.kill("SIGTERM");
  await serve.exited;

  expect(await ended(Number(readFileSync(pidFile, "utf8")))).toBe(true);
});
