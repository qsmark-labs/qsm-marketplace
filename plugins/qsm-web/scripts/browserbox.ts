// qsm-web browserbox: the last rung.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { isAlive, spawnDetached } from "../../../lib/detach.ts";
import { home } from "../../../lib/paths.ts";
import { join } from "node:path";
import {
  type Call,
  flagArg,
  type Handler,
  optionalNumber,
  optionalString,
  requiredNumber,
  requiredString,
} from "../../../lib/cli-base.ts";
import { fail, isRecord, type Outcome, ok, onPath } from "../../../lib/outcome.ts";
import { QsmError } from "../../../lib/qsm-error.ts";
import {
  buildDefinition,
  chooseRuntime,
  contextHash,
  execDefinition,
  imageSourceDefinition,
  type Instance,
  instanceName,
  listDefinition,
  orphanedInstances,
  liveViewLink,
  liveViewUrl,
  outDir,
  pinnedBrowser,
  parseInstances,
  pickPort,
  type Runtime,
  renderCommand,
  runDefinition,
  stopDefinition,
  tokenDefinition,
} from "../lib/browserbox.ts";
import { NO_ROOT, pluginRoot } from "../lib/doctor.ts";
import { readScript, type Script, ScriptError, secretSteps, withSecrets } from "../lib/steps.ts";
import { chooseVaultCli, readValue, VaultError } from "../lib/vault.ts";

const READY_TRIES = 120;
const READY_PAUSE_MS = 500;
const POLL_PAUSE_MS = 3000;
const DEFAULT_WAIT_MS = 300_000;
/** How long ctl.py, the driver's client inside the box, waits on the driver's socket. */
const CTL_SOCKET_LIMIT_MS = 600_000;

/** The longest a healthy driver takes to answer one call; `QSM_BROWSERBOX_REPLY_MS` shortens it
 * for a test. */
function replyLimitMs(env: Readonly<Record<string, string | undefined>>): number {
  const value = Number(env.QSM_BROWSERBOX_REPLY_MS);
  return Number.isInteger(value) && value > 0 ? value : CTL_SOCKET_LIMIT_MS + POLL_PAUSE_MS;
}

/** A synchronous pause, with no runtime-specific helper behind it. */
function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** One call's container runtime and the commands it ran or would run. */
class Box {
  readonly dryRun: boolean;
  readonly commands: string[] = [];
  private chosen: Runtime | null = null;

  constructor(dryRun: boolean) {
    this.dryRun = dryRun;
  }

  /** The runtime, chosen on first use, so a verb that needs no container
   * never fails on a machine that has none. */
  runtime(): Runtime {
    this.chosen ??= chooseRuntime(process.env, (cmd) => (this.dryRun ? true : onPath(cmd)));
    if (this.chosen === null) {
      throw new QsmError(
        "missing",
        "no container runtime reachable; install docker or podman, or set QSM_CONTAINER_RUNTIME",
      );
    }
    return this.chosen;
  }

  /** Run one runtime command. Under --dry-run it is collected, not run. Uncaptured output, such as
   * a build's, goes to stderr, so stdout carries only the verb's answer. */
  run(args: readonly string[], capture = true): { status: number; stdout: string } {
    if (this.dryRun) {
      this.commands.push(renderCommand(this.runtime(), args));
      return { status: 0, stdout: "" };
    }
    const { status, stdout } = spawnSync(this.runtime(), args, {
      encoding: "utf8",
      stdio: ["ignore", capture ? "pipe" : process.stderr, "inherit"],
    });
    return { status: status ?? 1, stdout: stdout ?? "" };
  }

  /** Send one job to an instance's driver over its standard input, so a
   * secret in the job never reaches an argument vector. */
  send(name: string, job: Record<string, unknown>, quiet = false): Record<string, unknown> {
    const args = execDefinition(name);
    if (this.dryRun) {
      this.commands.push(
        `${renderCommand(this.runtime(), args)} <<< ${JSON.stringify(redact(job))}`,
      );
      return { ok: true, dryRun: true };
    }
    // A driver that never answers must not hold this process, whose signal handlers run only
    // between synchronous calls. ctl.py, the driver's client inside the box, gives up on the
    // driver after 600 s whatever the job is (a script's waits and a fetch's settle and capture
    // all fit inside it), so that plus one poll pause is the longest a healthy driver takes.
    const limitMs = replyLimitMs(process.env);
    const { status, stdout, error } = spawnSync(this.runtime(), args, {
      encoding: "utf8",
      input: `${JSON.stringify(job)}\n`,
      stdio: ["pipe", "pipe", quiet ? "ignore" : "inherit"],
      timeout: limitMs,
    });
    if (error !== undefined && "code" in error && error.code === "ETIMEDOUT") {
      return {
        ok: false,
        error: { kind: "driver", message: `the driver did not answer within ${limitMs} ms` },
      };
    }
    return driverAnswer(status, stdout ?? "");
  }
}

/** What a driver's exit status and standard output say: its JSON object, or an error naming
 * what was wrong with the reply. */
function driverAnswer(status: number | null, stdout: string): Record<string, unknown> {
  const reply = stdout.trim();
  if (status !== 0 && reply.length === 0) {
    return { ok: false, error: { kind: "driver", message: `the driver exited ${status ?? 1}` } };
  }
  let answer: unknown;
  try {
    answer = JSON.parse(reply);
  } catch {
    return { ok: false, error: { kind: "driver", message: "the driver answered with non-JSON" } };
  }
  return isRecord(answer)
    ? answer
    : { ok: false, error: { kind: "driver", message: "the driver answered with non-object JSON" } };
}

/** A job as it may be printed: a filled value is replaced by its marker. */
function redact(job: Record<string, unknown>): Record<string, unknown> {
  const { steps } = job;
  if (!Array.isArray(steps)) {
    return job;
  }
  const shown = steps.map((s: unknown) =>
    isRecord(s) && s.redact === true ? { ...s, value: "[redacted]" } : s,
  );
  return { ...job, steps: shown };
}

/**
 * Open one instance's live view, password included, in the person's own browser. The password is
 * read from the instance at this moment and goes only to the opener's argument vector, never to
 * the answer, so nothing that reads the CLI's output ever holds it. With nothing to open it, the
 * failure names the address without the password and how to get the password by hand. Answers the
 * address and the opener's pid, which a dry run has none of.
 */
function openLiveView(box: Box, name: string): { address: string; pid?: number } {
  const port = Number(name.replace(/^bbox-/, ""));
  const address = liveViewUrl(port);
  if (box.dryRun) {
    box.run(tokenDefinition(name));
    box.commands.push(`xdg-open ${liveViewLink(port, "<token>")}`);
    return { address };
  }
  if (!instances(box).some((i) => i.name === name)) {
    throw new QsmError(
      "missing",
      `no instance named ${name}; browserbox ls lists the running ones`,
    );
  }
  const { status, stdout } = box.run(tokenDefinition(name));
  const token = stdout.trim();
  if (status !== 0 || token.length === 0) {
    throw new QsmError("failed", `${name} has no live-view password (exit ${status})`);
  }
  // Detached, because a cold browser keeps xdg-open in the foreground until it exits.
  const opened = spawnDetached(
    "xdg-open",
    [liveViewLink(port, token)],
    { file: "/dev/null", append: true },
    process.env,
  );
  if (!opened.ok) {
    throw new QsmError(
      "failed",
      `could not open a browser for ${address} (${opened.reason}); the person can read the ` +
        `password with: docker exec ${name} cat /run/bbox.token, and add it as ?password=`,
    );
  }
  return { address, pid: opened.pid };
}

function instances(box: Box): Instance[] {
  const { status, stdout } = box.run(listDefinition());
  if (status !== 0) {
    throw new QsmError("failed", `listing the running instances failed (exit ${status})`);
  }
  const lines = stdout.split("\n").map((line) => {
    const name = line.trim().split(/\s+/)[0] ?? "";
    const port = name.startsWith("bbox-") ? name.slice("bbox-".length) : "";
    return port.length > 0 ? `${name} ${port}` : "";
  });
  return parseInstances(lines.join("\n"));
}

/** Builds the image when there is none or its docker context changed since it was built. */
function ensureImage(box: Box): void {
  const root = pluginRoot(process.env);
  if (root === undefined) {
    throw new QsmError("missing", NO_ROOT);
  }
  const context = join(root, "docker");
  const pins = join(root, "mise.toml");
  const browser = existsSync(pins) ? pinnedBrowser(readFileSync(pins, "utf8")) : null;
  if (browser === null) {
    throw new QsmError("missing", `${pins} pins no Camoufox browser build`, {
      next: 'add "github:daijro/camoufox" = "v<full release>" under [tools] of a valid mise.toml',
    });
  }
  // The pin is part of what the image was built from, so a new pin rebuilds it.
  const source = `${contextHash(context)}-${browser}`;
  const image = box.run(imageSourceDefinition());
  if (image.status === 0 && image.stdout.trim() === source && !box.dryRun) {
    return;
  }
  const why =
    image.status === 0 ? "its docker context or browser pin changed" : "there is none yet";
  process.stderr.write(`qsm-web browserbox: building the image from ${context}, ${why}\n`);
  const built = box.run(buildDefinition(context, source, browser), false);
  if (built.status !== 0) {
    throw new QsmError("failed", `the image build failed (exit ${built.status})`);
  }
}

function ready(box: Box, name: string): boolean {
  for (let i = 0; i < READY_TRIES; i += 1) {
    if (box.dryRun) {
      return true;
    }
    if (box.send(name, { cmd: "ping" }, true).ok === true) {
      return true;
    }
    pause(READY_PAUSE_MS);
  }
  return false;
}

/** Removes the instances whose run died before it removed them (killed, timed out), naming each
 * on stderr. An instance that lives until `browserbox stop` carries no owner and is never swept. */
function sweepOrphans(box: Box): void {
  if (box.dryRun) {
    return;
  }
  const { status, stdout } = box.run(listDefinition());
  if (status !== 0) {
    throw new QsmError("failed", `listing the running instances failed (exit ${status})`);
  }
  for (const name of orphanedInstances(stdout, isAlive)) {
    const removed = box.run(stopDefinition(name));
    if (removed.status !== 0) {
      throw new QsmError(
        "failed",
        `${name} is left by a dead run and could not be removed (exit ${removed.status})`,
      );
    }
    process.stderr.write(`qsm-web browserbox: removed ${name}, left by a run that ended\n`);
  }
}

/** Start one instance. An ephemeral one is labelled with this run's pid, so a later run can remove
 * it if this one dies; a persistent one carries no owner. */
function startInstance(
  box: Box,
  ephemeral: boolean,
  out?: string,
): Instance & { readonly out: string } {
  ensureImage(box);
  const port = pickPort(instances(box).map((i) => i.port));
  if (port === null) {
    throw new QsmError("failed", "every live-view port in the block is taken");
  }
  const name = instanceName(port);
  const where = out ?? outDir(process.env, home(process.env), name);
  if (!box.dryRun) {
    mkdirSync(where, { recursive: true });
  }
  const liveView = liveViewUrl(port);
  const started = box.run(
    runDefinition({
      name,
      port,
      outDir: where,
      liveView,
      user: `${process.getuid?.()}:${process.getgid?.()}`,
      ownerPid: ephemeral ? process.pid : null,
    }),
  );
  if (started.status !== 0) {
    throw new QsmError("failed", `the instance would not start (exit ${started.status})`);
  }
  if (!ready(box, name)) {
    const removed = box.run(stopDefinition(name));
    if (removed.status !== 0) {
      throw new QsmError(
        "failed",
        `${name} started but its browser never answered; its removal exited ${removed.status}; check for a possible leftover container`,
      );
    }
    throw new QsmError(
      "failed",
      `${name} started but its browser never answered; its container was removed`,
    );
  }
  return { name, port, liveView, out: where };
}

function start(call: Call, box: Box): Outcome {
  sweepOrphans(box);
  const instance = startInstance(box, false, optionalString(call, "out"));
  return ok(instance, JSON.stringify(instance));
}

function ls(_call: Call, box: Box): Outcome {
  sweepOrphans(box);
  const live = instances(box);
  return ok(live, JSON.stringify(live));
}

function stop(call: Call, box: Box): Outcome {
  const name = optionalString(call, "name");
  const all = flagArg(call, "all");
  if (all === (name !== undefined)) {
    return fail("usage", "stop takes exactly one of an instance name and --all");
  }
  if (name === undefined) {
    for (const i of instances(box)) {
      const { status } = box.run(stopDefinition(i.name));
      if (status !== 0) {
        throw new QsmError("failed", `${i.name} could not be stopped (exit ${status})`);
      }
    }
    return ok({ stopped: "all" }, "stopped every instance");
  }
  const { status } = box.run(stopDefinition(name));
  if (status !== 0) {
    throw new QsmError("failed", `${name} could not be stopped (exit ${status})`);
  }
  return ok({ stopped: name }, `stopped ${name}`);
}

/** Removes the container a fetch started for itself. A failed removal is named on stderr and the
 * fetch's own result or error stands, because the next call sweeps what a dead run left. */
function removeEphemeral(box: Box, name: string): void {
  const { status } = box.run(stopDefinition(name));
  if (status !== 0) {
    const left = `${name} could not be removed after the fetch (exit ${status})`;
    process.stderr.write(`qsm-web browserbox: ${left}\n`);
  }
}

/** One address, one result. */
function fetchOne(call: Call, box: Box): Outcome {
  const given = optionalString(call, "in");
  const keep = flagArg(call, "keep");
  const url = requiredString(call, "url");
  sweepOrphans(box);
  const ephemeral = given === undefined && !keep;
  const name = given ?? startInstance(box, ephemeral).name;
  // A signal handler runs only between the synchronous calls below, so it can be late; the
  // finally covers every other end, and the owner label covers the one nothing can catch (SIGKILL).
  const ends = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  const onSignal = (signal: NodeJS.Signals): void => {
    removeEphemeral(box, name);
    process.exit(128 + (signal === "SIGINT" ? 2 : signal === "SIGTERM" ? 15 : 1));
  };
  if (ephemeral) {
    for (const s of ends) {
      process.on(s, onSignal);
    }
  }
  try {
    return fetchIn(call, box, name, url, keep);
  } finally {
    if (ephemeral) {
      for (const s of ends) {
        process.off(s, onSignal);
      }
      removeEphemeral(box, name);
    }
  }
}

function fetchIn(call: Call, box: Box, name: string, url: string, keep: boolean): Outcome {
  const job: Record<string, unknown> = {
    cmd: "fetch",
    url,
    html: flagArg(call, "html"),
    screenshot: flagArg(call, "screenshot"),
    cookies: flagArg(call, "cookies"),
    keep,
  };
  const settle = optionalNumber(call, "settle");
  if (settle !== undefined) {
    job.settle = settle;
  }
  const timeout = optionalNumber(call, "timeout");
  if (timeout !== undefined) {
    job.timeout = timeout;
  }
  const answer = box.send(name, job);
  const result: Record<string, unknown> = { ...answer, instance: name };
  return answer.ok === true
    ? ok(result, JSON.stringify(result))
    : fail("failed", `${url} could not be fetched`, result);
}

/** Resolve every fill-secret step from the user's vault. The values exist
 * only in the job written to the driver's standard input. */
function fillSecrets(box: Box, script: Script): Script {
  const needed = secretSteps(script);
  if (needed.length === 0) {
    return script;
  }
  if (box.dryRun) {
    // A dry run never opens the vault: it shows the shape of the job, and
    // the value would be redacted in that output anyway.
    return withSecrets(script, new Map(needed.map(({ index }) => [index, "[dry-run]"])));
  }
  const cli = chooseVaultCli(process.env, onPath);
  if (cli === null) {
    throw new QsmError("missing", "a fill-secret step needs the rbw or bw client on PATH");
  }
  const values = new Map<number, string>();
  for (const { index, step } of needed) {
    const value = readValue(
      cli,
      (cmd, args) => {
        const r = spawnSync(cmd, args, { encoding: "utf8" });
        return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
      },
      step.item ?? "",
      step.field,
    );
    values.set(index, value);
  }
  return withSecrets(script, values);
}

function readJob(box: Box, file: string | undefined, steps: string | undefined): Script {
  const raw = file === undefined ? (steps ?? "") : readFileSync(file, "utf8");
  try {
    return fillSecrets(box, readScript(JSON.parse(raw)));
  } catch (err: unknown) {
    if (err instanceof ScriptError) {
      const where = err.index === null ? "" : `step ${err.index}: `;
      throw new QsmError("failed", `${where}${err.message}`, { cause: err });
    }
    if (err instanceof VaultError) {
      throw new QsmError("failed", err.message, { cause: err });
    }
    throw err;
  }
}

function runScript(call: Call, box: Box): Outcome {
  const file = optionalString(call, "file");
  const steps = optionalString(call, "steps");
  if ((file === undefined) === (steps === undefined)) {
    return fail("usage", "script takes exactly one of --file and --steps");
  }
  const job = readJob(box, file, steps);
  const result = box.send(requiredString(call, "name"), { cmd: "script", ...job });
  return result.ok === true
    ? ok(result, JSON.stringify(result))
    : fail("failed", "the script did not finish", result);
}

/** Polls the armed wait until the human cleared the wall (true), or it timed out or the caller's
 * timeout passed (false). */
function cleared(box: Box, name: string, tab: number, timeoutMs: number): boolean {
  const deadline = Date.now() + timeoutMs + POLL_PAUSE_MS;
  while (Date.now() < deadline) {
    pause(POLL_PAUSE_MS);
    const status = box.send(name, { cmd: "wait_status", tab }, true);
    if (status.state === "cleared") {
      return true;
    }
    if (status.state === "timeout") {
      return false;
    }
  }
  return false;
}

/**
 * Hand one tab to a human: arm the wait, name the page to open, and poll until the wall is gone or
 * the caller's timeout passes.
 */
function takeover(call: Call, box: Box): Outcome {
  const name = requiredString(call, "name");
  const tab = requiredNumber(call, "tab");
  const timeoutMs = optionalNumber(call, "timeout") ?? DEFAULT_WAIT_MS;
  const view = openLiveView(box, name).address;
  const armed = box.send(name, {
    cmd: "wait_for_human",
    tab,
    reason: optionalString(call, "reason") ?? "a wall the agent cannot clear",
    timeout: timeoutMs,
  });
  if (armed.ok !== true) {
    return fail("failed", `${name} would not arm the wait`, armed);
  }
  process.stderr.write(`qsm-web browserbox: opened ${view}; clear the wall there\n`);
  if (box.dryRun) {
    return ok({ liveView: view }, view);
  }
  if (cleared(box, name, tab, timeoutMs)) {
    return ok({ resumed: true, liveView: view }, `${name} tab ${tab} was cleared`);
  }
  return fail("failed", `nobody cleared ${name} tab ${tab} in time`, {
    resumed: false,
    liveView: view,
  });
}

function viewVerb(call: Call, box: Box): Outcome {
  const { address, pid } = openLiveView(box, requiredString(call, "name"));
  return ok({ liveView: address, pid }, `opened ${address}`);
}

type BoxHandler = (call: Call, box: Box) => Outcome;

/**
 * Every verb gets its own Box, and under --dry-run answers with the commands it collected instead
 * of the data it never produced. A QsmError thrown below reaches the CLI base.
 */
function handler(run: BoxHandler): Handler {
  return (call) => {
    const box = new Box(flagArg(call, "dryRun"));
    const outcome = run(call, box);
    if (!box.dryRun || outcome.code !== "ok") {
      return outcome;
    }
    return ok({ dryRun: true, commands: box.commands }, box.commands.join("\n"));
  };
}

export const handlers: Readonly<Record<string, Handler>> = {
  "browserbox start": handler(start),
  "browserbox ls": handler(ls),
  "browserbox stop": handler(stop),
  "browserbox fetch": handler(fetchOne),
  "browserbox script": handler(runScript),
  "browserbox takeover": handler(takeover),
  "browserbox view": handler(viewVerb),
};
