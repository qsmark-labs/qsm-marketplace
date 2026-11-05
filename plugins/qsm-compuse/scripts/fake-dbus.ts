// The fake machine's D-Bus services: every object of the state's `dbus` record, served on the
// slot's own bus under its well-known name, so a shell talks to them as to the real daemons.
//
//   dbus.<system|session>.<bus name>.<object path>.<interface>.<member>: value
//
// A member is a property (its value) or a method (the value its one out argument returns). The
// types come from dbus/<interface>.xml, introspected from the real daemon, because a client checks
// each property's signature and refuses another (Quickshell does). A value in a variant is plain
// JSON, or busctl's {"type": T, "data": V} where the plain guess would be wrong. An interface named
// org.freedesktop.DBus.ObjectManager makes that path report the objects below it (BlueZ at /).
// The caller owns the state: it hands a mock in through the returned emit, which clients see as
// PropertiesChanged, and hears of a client's write through onWrite.
import { createClient, defineInterface, Variant } from "dbus-native";
import type { DefinedInterface, MessageBus } from "dbus-native";
import marshall from "dbus-native/lib/marshall.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isRecord, messageOf } from "../../../lib/outcome.ts";

type Members = Record<string, unknown>;
type Objects = Record<string, Record<string, Members>>;
export type Dbus = { system?: Record<string, Objects>; session?: Record<string, Objects> };

type Arg = { name: string; type: string };
type Iface = {
  properties: Map<string, { type: string; access: "read" | "write" | "readwrite" }>;
  methods: Map<string, { in: Arg[]; out: Arg[] }>;
};

const OBJECT_MANAGER = "org.freedesktop.DBus.ObjectManager";
// DO_NOT_QUEUE: a name another connection holds is a failure, not a wait.
const DO_NOT_QUEUE = 4;

// The attributes of one XML tag, in any order.
const attributes = (tag: string): Record<string, string> =>
  Object.fromEntries(
    [...tag.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)].map((m): [string, string] => [
      m[1] ?? "",
      m[2] ?? "",
    ]),
  );

const interfaces = new Map<string, Iface>();
function iface(name: string): Iface {
  const known = interfaces.get(name);
  if (known !== undefined) return known;
  const path = join(import.meta.dir, "dbus", `${name}.xml`);
  let xml: string;
  try {
    xml = readFileSync(path, "utf8");
  } catch {
    throw new Error(`no recorded interface ${name} (gdbus introspect --xml it into ${path})`);
  }
  const parsed: Iface = { properties: new Map(), methods: new Map() };
  let method: { in: Arg[]; out: Arg[] } | undefined;
  for (const [, close, kind = "", body = ""] of xml.matchAll(
    /<(\/?)(method|property|arg|signal)\b([^>]*)>/g,
  )) {
    const a = attributes(body);
    // Only a method's own close ends it: each <arg> may have one too.
    if ((close === "/" && kind === "method") || kind === "signal") {
      method = undefined;
      continue;
    }
    if (close === "/") continue;
    if (kind === "property") {
      const access = a.access === "write" || a.access === "readwrite" ? a.access : "read";
      parsed.properties.set(a.name ?? "", { type: a.type ?? "", access });
    } else if (kind === "method") {
      method = { in: [], out: [] };
      parsed.methods.set(a.name ?? "", method);
      if (body.trimEnd().endsWith("/")) method = undefined;
    } else if (method !== undefined) {
      const list = a.direction === "out" ? method.out : method.in;
      list.push({ name: a.name ?? `arg${list.length}`, type: a.type ?? "" });
    }
  }
  interfaces.set(name, parsed);
  return parsed;
}

// The end of the one complete type that starts at i.
function typeEnd(sig: string, i: number): number {
  const c = sig[i];
  if (c === "a") return typeEnd(sig, i + 1);
  if (c === "(" || c === "{") {
    const close = c === "(" ? ")" : "}";
    let j = i + 1;
    while (j < sig.length && sig[j] !== close) j = typeEnd(sig, j);
    return j + 1;
  }
  return i + 1;
}

const types = (sig: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < sig.length; i = typeEnd(sig, i)) out.push(sig.slice(i, typeEnd(sig, i)));
  return out;
};

// The JSON type of each basic D-Bus type the marshaller takes as is (x and t take a bigint).
const BASIC: Record<string, "number" | "boolean" | "string"> = {
  y: "number",
  n: "number",
  q: "number",
  i: "number",
  u: "number",
  d: "number",
  h: "number",
  b: "boolean",
  s: "string",
  o: "string",
  g: "string",
};

// JSON in the shape the marshaller takes for that signature.
function wire(sig: string, value: unknown): unknown {
  if (sig === "x" || sig === "t") {
    if (typeof value !== "number" || !Number.isInteger(value))
      throw new Error(`a ${sig} needs an integer, got ${JSON.stringify(value)}`);
    return BigInt(value);
  }
  if (sig === "v") return variant(value);
  if (sig.startsWith("a{")) {
    if (!isRecord(value)) throw new Error(`a ${sig} needs an object, got ${JSON.stringify(value)}`);
    const [, inner = ""] = types(sig.slice(2, -1));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, wire(inner, v)]));
  }
  if (sig.startsWith("a")) {
    if (!Array.isArray(value))
      throw new Error(`a ${sig} needs an array, got ${JSON.stringify(value)}`);
    return value.map((v) => wire(sig.slice(1), v));
  }
  if (sig.startsWith("(")) {
    const fields = types(sig.slice(1, -1));
    if (!Array.isArray(value) || value.length !== fields.length)
      throw new Error(`a ${sig} needs an array of ${fields.length}, got ${JSON.stringify(value)}`);
    return fields.map((f, i) => wire(f, value[i]));
  }
  const json = BASIC[sig];
  if (json === undefined) throw new Error(`the fake has no JSON form for the D-Bus type ${sig}`);
  if (typeof value !== json)
    throw new Error(`a ${sig} needs a ${json}, got ${JSON.stringify(value)}`);
  return value;
}

function variant(value: unknown): unknown {
  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length === 2 && typeof value.type === "string" && "data" in value)
      return new Variant(value.type, wire(value.type, value.data));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, variant(v)]));
  }
  return value;
}

const KINDS = ["system", "session"] as const;
type Kind = (typeof KINDS)[number];

// The bus's own marshaller decides, so a value it would refuse (an unsigned -1, an object path
// without a leading slash) is refused here and never thrown inside a served call.
const marshalled = (where: string, sig: string, value: unknown): void => {
  try {
    marshall(sig, [wire(sig, value)]);
  } catch (error) {
    throw new Error(`${where} (${sig}): ${messageOf(error)}`, { cause: error });
  }
};

// Every member of a dbus record is one its recorded interface has, in that interface's type, so
// prepare and a mock refuse a state before a client could meet it.
export function check(dbus: Dbus | undefined): void {
  for (const kind of KINDS)
    for (const objects of Object.values(dbus?.[kind] ?? {}))
      for (const ifaces of Object.values(objects))
        for (const [name, members] of Object.entries(ifaces)) {
          if (name === OBJECT_MANAGER) continue;
          const known = iface(name);
          for (const [member, value] of Object.entries(members)) {
            const property = known.properties.get(member);
            const method = known.methods.get(member);
            if (property !== undefined) marshalled(`${name}.${member}`, property.type, value);
            else if (method === undefined)
              throw new Error(`${name} has no member ${member} (dbus/${name}.xml)`);
            else if (method.out.length > 1)
              throw new Error(
                `${name}.${member} answers ${method.out.length} values; the fake answers one`,
              );
            else if (method.out[0] !== undefined)
              marshalled(`${name}.${member}`, method.out[0].type, value);
          }
        }
}

// The objects, interfaces and members a record holds. The fake serves exactly these from the
// start, so a mock may change their values and never this.
export const shape = (dbus: Dbus | undefined): string[] =>
  KINDS.flatMap((kind) =>
    Object.entries(dbus?.[kind] ?? {}).flatMap(([name, objects]) =>
      Object.entries(objects).flatMap(([path, ifaces]) =>
        Object.entries(ifaces).flatMap(([i, members]) => [
          `${kind} ${name} ${path} ${i}`,
          ...Object.keys(members).map((m) => `${kind} ${name} ${path} ${i} ${m}`),
        ]),
      ),
    ),
  );

// One served interface and the types of the properties the state gives it.
type Served = {
  path: string;
  iface: string;
  properties: Map<string, string>;
  def: DefinedInterface;
};
type Write = (path: string, iface: string, member: string, value: unknown) => void;

// The interfaces of one bus name, answering from `current` and handing a client's write to `write`.
function definitions(objects: Objects, current: () => Objects, write: Write): Served[] {
  const served: Served[] = [];
  for (const [path, ifaces] of Object.entries(objects)) {
    for (const [name, members] of Object.entries(ifaces)) {
      if (name === OBJECT_MANAGER) continue;
      const known = iface(name);
      const live = (member: string): unknown => current()[path]?.[name]?.[member];
      const signatures = new Map<string, string>();
      const properties: Parameters<typeof defineInterface>[0]["properties"] = {};
      for (const member of Object.keys(members)) {
        const property = known.properties.get(member);
        if (property === undefined) continue;
        signatures.set(member, property.type);
        const get = (): unknown => wire(property.type, live(member));
        const set = (value: unknown): void => {
          write(path, name, member, value);
        };
        properties[member] = {
          type: property.type,
          access: property.access,
          get,
          ...(property.access !== "read" && { set }),
        };
      }
      const methods: Parameters<typeof defineInterface>[0]["methods"] = {};
      for (const [member, method] of known.methods) {
        const out = method.out[0];
        methods[member] = {
          in: Object.fromEntries(method.in.map((a) => [a.name, a.type])),
          out: Object.fromEntries(method.out.map((a) => [a.name, a.type])),
          handler: (): unknown => {
            if (out !== undefined && !(member in (current()[path]?.[name] ?? {})))
              throw new Error(`the fake ${name} has no answer for ${member}`);
            return out === undefined ? undefined : wire(out.type, live(member));
          },
        };
      }
      served.push({
        path,
        iface: name,
        properties: signatures,
        def: defineInterface({ name, properties, methods }),
      });
    }
  }
  return served;
}

const objectsOf = (dbus: Dbus, kind: Kind, name: string): Objects => dbus[kind]?.[name] ?? {};

// JSON of a value as the marshaller handed it over (x and t arrive as bigint).
const plain = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_key, v: unknown) => (typeof v === "bigint" ? Number(v) : v)));

// Owns every name on its bus (one connection each: two MPRIS players share an object path) and
// answers until the slot ends. A client's write changes `dbus` in place and calls onWrite; the
// returned emit takes the record's next values and sends each changed property.
export async function serveDbus(dbus: Dbus, onWrite: () => void): Promise<(next: Dbus) => void> {
  let state = dbus;
  const latest = (): Dbus => state;
  // dbus-native emits PropertiesChanged for the write itself.
  const write = (
    kind: Kind,
    name: string,
    ...[path, i, member, value]: Parameters<Write>
  ): void => {
    const target = state[kind]?.[name]?.[path]?.[i];
    if (target === undefined) throw new Error(`the fake ${name} serves no ${i} at ${path}`);
    target[member] = plain(value);
    onWrite();
  };
  const owned: { bus: MessageBus; kind: Kind; name: string; served: Served[] }[] = [];
  for (const kind of KINDS) {
    const address =
      kind === "system"
        ? process.env.DBUS_SYSTEM_BUS_ADDRESS
        : process.env.DBUS_SESSION_BUS_ADDRESS;
    for (const [name, objects] of Object.entries(state[kind] ?? {})) {
      if (address === undefined)
        throw new Error(`the fake ${name} needs the slot's ${kind} bus address`);
      const bus = createClient({ busAddress: address });
      const reply = await bus.ownName(name, DO_NOT_QUEUE);
      if (!reply.isPrimaryOwner)
        throw new Error(`${name} is already owned on the slot's ${kind} bus`);
      for (const [path, ifaces] of Object.entries(objects))
        if (OBJECT_MANAGER in ifaces) bus.exportObjectManager(path);
      const served = definitions(
        objects,
        () => objectsOf(latest(), kind, name),
        (...args) => {
          write(kind, name, ...args);
        },
      );
      for (const s of served) await bus.export(s.path, s.def);
      owned.push({ bus, kind, name, served });
    }
  }
  return (next) => {
    const before = state;
    state = next;
    for (const { bus, kind, name, served } of owned) {
      for (const s of served) {
        const old = objectsOf(before, kind, name)[s.path]?.[s.iface] ?? {};
        const now = objectsOf(state, kind, name)[s.path]?.[s.iface] ?? {};
        const changed = [...s.properties].filter(
          ([m]) => JSON.stringify(old[m]) !== JSON.stringify(now[m]),
        );
        if (changed.length > 0)
          bus.emitPropertiesChanged(
            s.path,
            s.iface,
            Object.fromEntries(changed.map(([m, type]) => [m, wire(type, now[m])])),
          );
      }
    }
  };
}
