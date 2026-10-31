#!/usr/bin/env bun
// The desktop slot's fake machine: the kernel files a shell reads, answered from the slot's state
// (DRIVE_STATE). `prepare` lays the files out in DIR before the sandbox starts and prints the bind
// of each (SOURCE<TAB>TARGET); `serve`, inside the sandbox, keeps them answering.
//
//   proc.uptime, proc.stat.busy, proc.meminfo  ->  /proc/uptime, /proc/stat, /proc/meminfo
//   net.<if>.rx_bytes|tx_bytes|rx_rate|tx_rate  ->  /sys/class/net/<if>/statistics/{rx,tx}_bytes
//   sys.<class> (a tree of dirs and files)      ->  /sys/class/<class>, files as written
//   pipewire (defaults and nodes)               ->  the slot's own PipeWire daemon, null devices
//   dbus (objects on the system and session bus) ->  fake daemons, see fake-dbus.ts
//
// A reader that divides a counter delta by an uptime delta (a network rate) needs both read at
// one moment, so uptime and the network counters are FIFOs: every read gets content generated at
// that moment, and the reads of one burst (a sampler reading several files in a row) share it.
// Counters advance at the state's constant rates, so the rate is exactly the state's on every
// run, however the samples fall. /proc/stat is a plain file rewritten in place, because other
// programs in the slot read it too (Xwayland about ten times a second, measured), and two readers
// of one FIFO share one copy, which leaves one of them empty; CPU usage is a ratio of two
// counters that advance together, so it is exact whenever the file is read.
//
// `serve` owns the state while the slot runs: a mock (drive slot mock) arrives as DIR/mock.req,
// {"path": [...], "value": V}, and is answered in DIR/mock.res, "ok" or why not; a client's write to
// a fake D-Bus property lands in the same state. One process writes the file, so neither undoes
// the other.
//   fake-machine prepare|serve DIR
import {
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  watch,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { writeAtomic } from "../../../lib/fs.ts";
import { isRecord, messageOf } from "../../../lib/outcome.ts";
import { runtimeDir } from "../../../lib/paths.ts";
import { type Dbus, check, serveDbus, shape } from "./fake-dbus.ts";

type Proc = { uptime: number; stat: { busy: number }; meminfo: Record<string, number> };
type Net = { rx_bytes: number; tx_bytes: number; rx_rate: number; tx_rate: number };
type Tree = { [name: string]: string | number | Tree };
type PwNode = {
  "node.name": string;
  "node.description": string;
  "media.class": "Audio/Sink" | "Audio/Source";
  channelVolumes: number[];
  mute: boolean;
};
type Pipewire = { "default.audio.sink"?: string; "default.audio.source"?: string; nodes: PwNode[] };
type State = {
  clock?: string;
  proc?: Proc;
  net?: Record<string, Net>;
  sys?: Record<string, Tree>;
  pipewire?: Pipewire;
  dbus?: Dbus;
};
type Render = (s: State, proc: Proc, up: number) => string;
// fifo: generated at each read; ticking: rewritten in place every TICK_MS; fixed: written once.
type File = { path: string; target: string; kind: "fifo" | "ticking" | "fixed"; render: Render };

// Reads closer together than this are one sampler's burst and share one moment.
const BURST_SECONDS = 0.05;
// Time for a reader that got its content and EOF to close before the FIFO opens for the next one;
// a writer that reopens while the old reader is still open hands it a second copy.
const DRAIN_MS = 100;
const POLL_MS = 5;
const TICK_MS = 100;
// A fake HZ of a million keeps the rounding of busy jiffies far below what a percentage shows.
const HZ = 1_000_000;

const [verb = "", dir = ""] = process.argv.slice(2);
const statePath = process.env.DRIVE_STATE ?? "";
if (dir === "" || statePath === "" || (verb !== "prepare" && verb !== "serve"))
  throw new Error("usage: DRIVE_STATE=FILE fake-machine prepare|serve DIR");

const isState = (value: unknown): value is State => typeof value === "object" && value !== null;

// Read at start, so a failure shows before the first read; serve then owns it.
const state = (path: string): State => {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isState(value)) throw new Error(`the slot state ${path} is not a JSON object`);
  return value;
};

// Every changing file reads the one uptime, so a state with any of them names proc.
const procOf = (s: State): Proc => {
  if (s.proc === undefined)
    throw new Error("the slot state has no proc record (uptime, stat, meminfo)");
  return s.proc;
};

// Uptime is printed to the hundredth as the kernel does, and every counter advances by that
// printed uptime, so a counter delta over an uptime delta is the rate with no rounding between.
const counter =
  (name: string, bytes: "rx" | "tx"): Render =>
  (s, proc, up) => {
    const n = s.net?.[name];
    if (n === undefined) throw new Error(`the slot state has no net.${name}`);
    const start = bytes === "rx" ? n.rx_bytes : n.tx_bytes;
    const rate = bytes === "rx" ? n.rx_rate : n.tx_rate;
    return `${Math.round(start + rate * (up - proc.uptime))}\n`;
  };

// The kernel's shape: one machine-wide line, one CPU, and the counters after them.
const stat: Render = (s, proc, up) => {
  const total = Math.round(up * HZ);
  const busy = Math.round(total * proc.stat.busy);
  const cpu = `${busy} 0 0 ${total - busy} 0 0 0 0 0 0`;
  const now = s.clock === undefined ? Date.now() : new Date(s.clock.replace(" ", "T")).getTime();
  const btime = Math.round(now / 1000 - proc.uptime);
  return `cpu  ${cpu}\ncpu0 ${cpu}\nintr 0\nctxt 0\nbtime ${btime}\nprocesses 1\nprocs_running 1\nprocs_blocked 0\nsoftirq 0\n`;
};

const meminfo: Render = (_s, proc) =>
  Object.entries(proc.meminfo)
    .map(([key, kb]) => `${`${key}:`.padEnd(16)}${String(kb).padStart(8)} kB\n`)
    .join("");

const uptime: Render = (_s, _proc, up) => `${up.toFixed(2)} 0.00\n`;

// Every changing file by its path under DIR, and the kernel file the sandbox binds it over (the
// counters are bound with their whole net directory).
const files = (s: State): File[] => [
  ...(s.proc === undefined
    ? []
    : [
        { path: "proc/stat", target: "/proc/stat", kind: "ticking", render: stat } as const,
        { path: "proc/meminfo", target: "/proc/meminfo", kind: "fixed", render: meminfo } as const,
        { path: "proc/uptime", target: "/proc/uptime", kind: "fifo", render: uptime } as const,
      ]),
  ...Object.keys(s.net ?? {}).flatMap((name) =>
    (["rx", "tx"] as const).map((bytes): File => ({
      path: `net/${name}/statistics/${bytes}_bytes`,
      target: "",
      kind: "fifo",
      render: counter(name, bytes),
    })),
  ),
];

const errno = (error: unknown): string | undefined =>
  error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

// Directories and files as the state nests them; a tool may write a file back (brightnessctl).
function writeTree(path: string, tree: Tree): void {
  mkdirSync(path, { recursive: true });
  for (const [name, value] of Object.entries(tree)) {
    if (typeof value === "object") writeTree(join(path, name), value);
    else writeFileSync(join(path, name), `${value}\n`);
  }
}

const RECORDS = ["clock", "http", "ps", "df", "proc", "net", "sys", "pipewire", "dbus"];
// What the slot reads while it runs: the shims on every call, the fake D-Bus by its values.
// Everything else is laid out when the slot starts.
const LIVE = ["http", "ps", "df", "dbus"];

// What prepare refuses before the slot starts, and a mock before it lands. A record the fake
// machine does not know would leave the real one showing through (an old hwmon array).
function valid(s: State): void {
  for (const key of Object.keys(s))
    if (!RECORDS.includes(key))
      throw new Error(`the slot state has no record named ${key} (records: ${RECORDS.join(", ")})`);
  for (const key of Object.keys(s.dbus ?? {}))
    if (key !== "system" && key !== "session")
      throw new Error(`dbus.${key} is no bus; the records are dbus.system and dbus.session`);
  if (s.net !== undefined) procOf(s);
  check(s.dbus);
}

// One step of a jq path, when the state holds it: jq's path() names an object member by string
// and an array element by number.
function step(
  parent: unknown,
  key: unknown,
): { get: () => unknown; set: (value: unknown) => void } | undefined {
  if (Array.isArray(parent)) {
    const list: unknown[] = parent;
    if (typeof key !== "number" || !Number.isInteger(key) || key < 0 || key >= list.length)
      return undefined;
    return {
      get: () => list[key],
      set: (value) => {
        list[key] = value;
      },
    };
  }
  if (!isRecord(parent) || typeof key !== "string" || !(key in parent)) return undefined;
  return {
    get: () => parent[key],
    set: (value) => {
      parent[key] = value;
    },
  };
}

// A mock changes a reading the slot shows live: a shim's record, or a value the fake D-Bus serves.
function mocked(current: State, request: unknown): State {
  if (!isRecord(request) || !Array.isArray(request.path) || !("value" in request))
    throw new Error(
      `a mock request is {"path": [...], "value": V}, got ${JSON.stringify(request)}`,
    );
  const path: unknown[] = request.path;
  const [root] = path;
  if (typeof root !== "string" || !LIVE.includes(root))
    throw new Error(
      `${String(root)} is laid out when the slot starts; a mock changes ${LIVE.join(", ")}`,
    );
  const next = structuredClone(current);
  let parent: unknown = next;
  for (const key of path.slice(0, -1)) parent = step(parent, key)?.get();
  const target = step(parent, path.at(-1));
  if (target === undefined) throw new Error(`the state holds nothing at ${JSON.stringify(path)}`);
  target.set(request.value);
  valid(next);
  if (JSON.stringify(shape(next.dbus)) !== JSON.stringify(shape(current.dbus)))
    throw new Error(
      "a mock changes dbus values, never which objects, interfaces or members it serves",
    );
  return next;
}

function prepare(s: State): void {
  valid(s);
  mkdirSync(dir, { recursive: true });
  const binds: string[] = [];
  for (const file of files(s)) {
    const path = join(dir, file.path);
    mkdirSync(dirname(path), { recursive: true });
    if (file.kind === "fifo") {
      const made = Bun.spawnSync(["mkfifo", path]);
      if (made.exitCode !== 0) throw new Error(`mkfifo ${path}: ${made.stderr.toString()}`);
    } else {
      const proc = procOf(s);
      writeFileSync(path, file.render(s, proc, proc.uptime));
    }
    if (file.target !== "") binds.push(`${path}\t${file.target}`);
  }
  if (s.net !== undefined) binds.push(`${join(dir, "net")}\t/sys/class/net`);
  for (const [name, tree] of Object.entries(s.sys ?? {})) {
    writeTree(join(dir, "sys", name), tree);
    binds.push(`${join(dir, "sys", name)}\t/sys/class/${name}`);
  }
  if (s.pipewire !== undefined) {
    const conf = join(dir, "pipewire", "pipewire.conf.d", "fake.conf");
    mkdirSync(dirname(conf), { recursive: true });
    writeFileSync(conf, pipewireConf(s.pipewire));
  }
  process.stdout.write(binds.map((line) => `${line}\n`).join(""));
}

// A drop-in for the system pipewire.conf (SPA JSON takes plain JSON): the defaults as the
// `default` metadata a session manager would keep, and each node a null device. Without a session
// manager nothing links or moves them, so they stay exactly as written.
function pipewireConf(pw: Pipewire): string {
  const defaults = (["default.audio.sink", "default.audio.source"] as const).flatMap((key) => {
    const name = pw[key];
    return name === undefined ? [] : [{ key, type: "Spa:String:JSON", value: { name } }];
  });
  const nodes = pw.nodes.map((node) => {
    if (node.channelVolumes.length < 1 || node.channelVolumes.length > 2)
      throw new Error(`pipewire node ${node["node.name"]} needs one or two channelVolumes`);
    return {
      factory: "adapter",
      args: {
        "factory.name": "support.null-audio-sink",
        "node.name": node["node.name"],
        "node.description": node["node.description"],
        "media.class": node["media.class"],
        "audio.position": node.channelVolumes.length === 1 ? ["MONO"] : ["FL", "FR"],
        "object.linger": true,
        "monitor.channel-volumes": true,
      },
    };
  });
  const metadata = {
    factory: "metadata",
    args: { "metadata.name": "default", "metadata.values": defaults },
  };
  return `context.objects = ${JSON.stringify([metadata, ...nodes], null, 2)}\n`;
}

// The id of the node pw-dump lists under that node.name.
function nodeId(objects: unknown[], name: string): number {
  for (const o of objects) {
    if (typeof o !== "object" || o === null || !("id" in o) || typeof o.id !== "number") continue;
    if (!("info" in o) || typeof o.info !== "object" || o.info === null) continue;
    if (!("props" in o.info) || typeof o.info.props !== "object" || o.info.props === null) continue;
    if ("node.name" in o.info.props && o.info.props["node.name"] === name) return o.id;
  }
  throw new Error(`PipeWire has no node ${name}`);
}

// The daemon reads the drop-in from DIR (slot-desktop makes DIR this process's config home) and
// listens in the slot's runtime dir, where the shell looks; volume and mute are each node's Props,
// set once it is up.
async function startPipewire(pw: Pipewire): Promise<void> {
  const runtime = runtimeDir(process.env);
  if (runtime === undefined)
    throw new Error("the fake machine's PipeWire needs the slot's runtime dir");
  Bun.spawn(["pipewire"], { stdout: "inherit", stderr: "inherit" });
  const socket = join(runtime, "pipewire-0");
  for (let i = 0; i < 100 && !existsSync(socket); i++) await Bun.sleep(50);
  if (!existsSync(socket)) throw new Error(`PipeWire did not listen at ${socket}`);
  const dumped = Bun.spawnSync(["pw-dump"]);
  if (dumped.exitCode !== 0) throw new Error(`pw-dump: ${dumped.stderr.toString()}`);
  const objects: unknown = JSON.parse(dumped.stdout.toString());
  if (!Array.isArray(objects)) throw new Error("pw-dump did not answer a list");
  for (const node of pw.nodes) {
    const id = nodeId(objects, node["node.name"]);
    const props = `{ channelVolumes = [ ${node.channelVolumes.join(" ")} ] mute = ${node.mute} }`;
    const set = Bun.spawnSync(["pw-cli", "set-param", String(id), "Props", props]);
    if (set.exitCode !== 0)
      throw new Error(`pw-cli set-param ${node["node.name"]}: ${set.stderr.toString()}`);
  }
}

const started = performance.now();
const elapsed = (): number => (performance.now() - started) / 1000;
let burst = -Infinity;
const moment = (): number => {
  const now = elapsed();
  if (now - burst > BURST_SECONDS) burst = now;
  return burst;
};
const printed = (seconds: number): number => Math.round(seconds * 100) / 100;

// A reader blocked in open() counts as a reader, so a non-blocking open for writing succeeds once
// one is waiting and fails with ENXIO while there is none.
async function answer(path: string, render: Render, s: State, proc: Proc): Promise<never> {
  for (;;) {
    let fd: number;
    try {
      fd = openSync(path, constants.O_WRONLY | constants.O_NONBLOCK);
    } catch (error) {
      if (errno(error) !== "ENXIO") throw error;
      await Bun.sleep(POLL_MS);
      continue;
    }
    try {
      writeSync(fd, render(s, proc, printed(proc.uptime + moment())));
    } catch (error) {
      // The reader may close before it reads (head -1 needs one line); that is its business.
      if (errno(error) !== "EPIPE") throw error;
    } finally {
      closeSync(fd);
    }
    await Bun.sleep(DRAIN_MS);
  }
}

// In place at offset 0, never truncated: a reader never meets an empty file, and the counters
// only grow, so the new content is never shorter than the old.
async function tick(path: string, render: Render, s: State, proc: Proc): Promise<never> {
  const fd = openSync(path, constants.O_WRONLY);
  for (;;) {
    writeSync(fd, render(s, proc, printed(proc.uptime + elapsed())), 0);
    await Bun.sleep(TICK_MS);
  }
}

// PipeWire and the fake D-Bus do not wait for each other, so `ready` costs the slower of the two.
// Then every mock is applied, saved and emitted before its answer, so a mock that returned is
// already on the bus.
async function serve(start: State): Promise<void> {
  let live = start;
  const save = (): void => {
    writeAtomic(statePath, `${JSON.stringify(live, null, 2)}\n`);
  };
  const [, emit] = await Promise.all([
    start.pipewire === undefined ? undefined : startPipewire(start.pipewire),
    start.dbus === undefined ? undefined : serveDbus(start.dbus, save),
  ]);
  const request = join(dir, "mock.req");
  watch(dir, (_event, file) => {
    // The rename of mock.req and its removal both report the name.
    if (file !== "mock.req" || !existsSync(request)) return;
    const body = readFileSync(request, "utf8");
    rmSync(request);
    let reply = "ok";
    try {
      live = mocked(live, JSON.parse(body));
      save();
      emit?.(live.dbus ?? {});
    } catch (error) {
      reply = messageOf(error);
    }
    writeAtomic(join(dir, "mock.res"), `${reply}\n`);
  });
}

// slot-desktop starts the shell once `ready` exists: the shell connects to PipeWire, UPower and
// BlueZ once, at start.
const current = state(statePath);
if (verb === "prepare") prepare(current);
else {
  await serve(current);
  writeFileSync(join(dir, "ready"), "");
}
if (verb === "serve" && current.proc !== undefined) {
  const proc = current.proc;
  await Promise.all(
    files(current)
      .filter((file) => file.kind !== "fixed")
      .map((file) =>
        (file.kind === "fifo" ? answer : tick)(join(dir, file.path), file.render, current, proc),
      ),
  );
}
