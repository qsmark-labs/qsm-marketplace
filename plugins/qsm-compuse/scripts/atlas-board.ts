#!/usr/bin/env bun
// The atlas review board: one page per run that shows every surface in every state the scenario
// names, each frame the shot cropped to its surface, carrying what the run measured about it.
//
//   build RUN [PREV]      RUN/board.html from the run's shots, trees, checks and diff against PREV
//   serve SCENARIO_DIR    the scenario's runs on 127.0.0.1, the latest board at /, and comments
//   comments SCENARIO_DIR the open comments, one per line: shot<TAB>x,y<TAB>text
//   surface TREE PATH     exits 0 when the item tree holds the surface PATH names (drive's check)
//   mask TREE SCALE PATH... takes the items the PATHs name out of TREE, prints their device rects
//
// The board never measures: a crop comes from the shot's item tree, a change from the run's
// diff-<PREV>/diff.json, a failure from the check's lines. Comments are the one state it owns,
// in SCENARIO_DIR/comments.json, written only by `serve`.
import { existsSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { tryFlock, writeAtomic } from "../../../lib/fs.ts";
import { isRecord, messageOf } from "../../../lib/outcome.ts";

type Rect = { x: number; y: number; w: number; h: number };
// A changed area (device px) and the item of the shot's tree that holds it, "" when none of the
// shell's items does (the cursor, the wallpaper, a client window).
type Area = Rect & { item: string };
type Badge = { kind: string; text: string; title?: string };
type Change = { key: string; before: string; after: string };
type Frame = {
  name: string;
  state: string;
  journey: string;
  surface: string;
  still: string;
  todo: boolean;
  screen: { w: number; h: number };
  scale: number;
  crop: Rect;
  at: { x: number; y: number };
  checks: string[];
  checkError: boolean;
  failing: Rect[];
  // Items that animate by design (device px): the run neither waits for nor compares them.
  masks: Rect[];
  changed: { areas: Area[]; changes: Change[] } | null;
  // The labels the builder sized the frame's cell by; the page adds only the notes badge.
  badges: Badge[];
};
type Section = { title: string; at: { x: number; y: number }; w: number; frames: Frame[] };
type NewComment = { shot: string; x: number; y: number; text: string; run: string };
type Comment = {
  id: string;
  shot: string;
  x: number;
  y: number;
  text: string;
  run: string;
  at: string;
  resolved: boolean;
};

// Logical px around a surface: its edge, its focus ring and the chrome its holder draws around it
// (a popout's title sits above its content item) stay in the frame.
const PAD = 32;
// The canvas grid: frames left to right, a row wraps after PER_ROW; sections flow in rows ROW_W wide.
// Every label is sized in canvas px and scales with its frame, as atlas-board.html draws it: a
// strip of STRIP_PX type above each frame, a title of TITLE_PX type with its count below it.
const PER_ROW = 6;
const ROW_W = 9000;
const GAP_X = 80;
const GAP_Y = 140;
const STRIP_PX = 28;
const TITLE_PX = 96;
// Room above a section's first row: the title and its count (1.4 lines each, the count at 0.4 of
// the title) stand on the first row's strips (1.4 lines plus their padding).
const TITLE_H = Math.ceil(TITLE_PX * 1.4 * 1.4 + STRIP_PX * 1.8 + 24);
// A character of the UI sans is at most this share of its size wide, digits and capitals included.
const CHAR_EM = 0.62;
const SECTION_GAP = 240;
// An empty frame for a state no journey shoots yet, when its section has no shot to size it by.
const TODO_SIZE = { w: 320, h: 240 };

const fail = (message: string): never => {
  process.stderr.write(`atlas-board: ${message}\n`);
  process.exit(1);
};

const num = (value: unknown): number => (typeof value === "number" ? value : 0);

// The nth node of a type with a size (0 the first), depth first: the order geom dumps the tree
// in. A collapsed popout of the same type (0x0) shows nothing, so it is never the surface.
function findType(node: unknown, type: string, nth: number): Record<string, unknown> | undefined {
  let left = nth;
  const walk = (at: unknown): Record<string, unknown> | undefined => {
    if (!isRecord(at)) return undefined;
    if (at.type === type && num(at.w) > 0 && num(at.h) > 0 && left-- === 0) return at;
    if (!Array.isArray(at.children)) return undefined;
    for (const child of at.children) {
      const found = walk(child);
      if (found) return found;
    }
    return undefined;
  };
  return walk(node);
}

// A path of types, each with an optional index: "PanelSurface/FocusScope" is the first
// FocusScope inside the first PanelSurface, "RailEntry[5]/SvgIcon" the glyph of the sixth cell.
function findNode(tree: unknown, path: string): Record<string, unknown> | undefined {
  const node = path.split("/").reduce<unknown>((at, segment) => {
    const [, type = "", nth = "0"] = /^(\w+)(?:\[(\d+)\])?$/u.exec(segment) ?? [];
    return findType(at, type, Number(nth));
  }, tree);
  return isRecord(node) ? node : undefined;
}

const rectOf = (node: Record<string, unknown>): Rect => ({
  x: num(node.x),
  y: num(node.y),
  w: num(node.w),
  h: num(node.h),
});

function findSurface(tree: unknown, path: string): Rect | undefined {
  const node = findNode(tree, path);
  return node ? rectOf(node) : undefined;
}

// Takes the masked items out of a shot's tree, so the consumer's checks and the tree diff never
// read a value the animation moves, and prints their rects as x,y,w,h;... in device px (SCALE per
// logical px, grown to whole pixels) for shots.tsv, the units the captures are compared in.
function mask(path: string, scale: number, paths: string[]): void {
  if (!(scale > 0)) fail(`mask needs the screen's scale, got ${scale}`);
  const tree = readJson(path);
  if (!isRecord(tree)) return fail(`${path} is not an item tree`);
  const nodes = paths.map(
    (p) => findNode(tree.tree, p) ?? fail(`${path} holds no ${p} with a size`),
  );
  const prune = (at: unknown): void => {
    if (!isRecord(at) || !Array.isArray(at.children)) return;
    const kept: unknown[] = at.children.filter((child: unknown) => !nodes.some((n) => n === child));
    at.children = kept;
    kept.forEach(prune);
  };
  prune(tree.tree);
  writeAtomic(path, JSON.stringify(tree));
  const rects = nodes.map(rectOf).map((r) => {
    const x = Math.floor(r.x * scale);
    const y = Math.floor(r.y * scale);
    return `${x},${y},${Math.ceil((r.x + r.w) * scale) - x},${Math.ceil((r.y + r.h) * scale) - y}`;
  });
  process.stdout.write(`${rects.join(";")}\n`);
}

const masksOf = (field: string): Rect[] =>
  field === ""
    ? []
    : field.split(";").map((r) => {
        const [x = 0, y = 0, w = 0, h = 0] = r.split(",").map(Number);
        return { x, y, w, h };
      });

// A PNG's size is in its header, so the builder needs no image tool.
function pngSize(path: string): { w: number; h: number } {
  const head = readFileSync(path).subarray(0, 24);
  if (head.toString("latin1", 1, 4) !== "PNG") fail(`${path} is not a PNG`);
  return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return fail(`${path}: ${messageOf(error)}`);
  }
}

const isComment = (v: unknown): v is Comment =>
  isRecord(v) &&
  typeof v.id === "string" &&
  typeof v.shot === "string" &&
  typeof v.x === "number" &&
  typeof v.y === "number" &&
  typeof v.text === "string" &&
  typeof v.resolved === "boolean";

const isComments = (v: unknown): v is Comment[] => Array.isArray(v) && v.every(isComment);
const isNewComment = (v: unknown): v is NewComment =>
  isRecord(v) &&
  typeof v.shot === "string" &&
  typeof v.x === "number" &&
  typeof v.y === "number" &&
  typeof v.text === "string" &&
  v.text.trim() !== "" &&
  typeof v.run === "string";

const commentsPath = (scenarioDir: string): string => join(scenarioDir, "comments.json");

function readComments(scenarioDir: string): Comment[] {
  const path = commentsPath(scenarioDir);
  if (!existsSync(path)) return [];
  const value = readJson(path);
  return isComments(value) ? value : fail(`${path} is not a list of comments`);
}

function writeComments(scenarioDir: string, comments: Comment[]): void {
  writeAtomic(commentsPath(scenarioDir), `${JSON.stringify(comments, null, 2)}\n`);
}

// "contrast Prose[24,48 32x16] ink ... : FAIL" names the failing item and its logical rectangle.
const RECT = /\[(-?[\d.]+),(-?[\d.]+) ([\d.]+)x([\d.]+)\]/u;
function failingOf(lines: string[]): Rect[] {
  const rects: Rect[] = [];
  for (const line of lines) {
    const m = RECT.exec(line);
    if (m) rects.push({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) });
  }
  return rects;
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

// One shot of diff.json: its changed areas (device px) and its changed tree measures.
function changedOf(entry: Record<string, unknown>): Frame["changed"] {
  const areas = records(entry.areas).map((a) => ({
    x: num(a.x),
    y: num(a.y),
    w: num(a.w),
    h: num(a.h),
    item: "",
  }));
  const changes = records(entry.changes).map((c) => ({
    key: str(c.key),
    before: str(c.before),
    after: str(c.after),
  }));
  return areas.length === 0 && changes.length === 0 ? null : { areas, changes };
}

function diffOf(run: string, prev: string): Map<string, Frame["changed"]> {
  const diffs = new Map<string, Frame["changed"]>();
  const path = join(run, `diff-${prev}`, "diff.json");
  if (prev === "" || !existsSync(path)) return diffs;
  const value = readJson(path);
  if (!Array.isArray(value)) return fail(`${path} is not a list`);
  for (const entry of records(value)) {
    const changed = changedOf(entry);
    if (changed) diffs.set(str(entry.name), changed);
  }
  return diffs;
}

// The fields a frame holds before the run's measures fill it; a hole in the inventory keeps them.
const blankFrame = (name: string, state: string, surface: string): Frame => ({
  name,
  state,
  journey: "",
  surface,
  still: "",
  todo: false,
  screen: { w: 0, h: 0 },
  scale: 1,
  crop: { x: 0, y: 0, w: 0, h: 0 },
  at: { x: 0, y: 0 },
  checks: [],
  checkError: false,
  failing: [],
  masks: [],
  changed: null,
  badges: [],
});

// The frame's crop: its surface padded by PAD and clipped to the screen, else the whole screen.
function cropOf(
  tree: Record<string, unknown>,
  screen: { w: number; h: number },
  surface: string,
): Rect {
  if (surface === "") return { x: 0, y: 0, w: screen.w, h: screen.h };
  const item = findSurface(tree.tree, surface) ?? fail(`a tree holds no ${surface}`);
  const x = Math.max(0, item.x - PAD);
  const y = Math.max(0, item.y - PAD);
  return {
    x,
    y,
    w: Math.min(screen.w, item.x + item.w + PAD) - x,
    h: Math.min(screen.h, item.y + item.h + PAD) - y,
  };
}

// Qt's own types say how an item is drawn, never which part of the shell it is.
const GENERIC = new Set([
  "Item",
  "Rectangle",
  "Row",
  "Column",
  "RowLayout",
  "ColumnLayout",
  "GridLayout",
  "Flickable",
  "Loader",
  "MouseArea",
  "FocusScope",
  "Text",
  "Image",
  "MultiEffect",
  "ShaderEffect",
  "QGfxSourceProxyME",
  "ProxyWindowContentItem",
]);

const holdsPoint = (r: Rect, px: number, py: number): boolean =>
  r.w > 0 && r.h > 0 && px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h;

// An item named by the nearest shell component above it (OWNER), its own type unless Qt's, and
// the first words of its text: PopoutRow › Prose "Wi-Fi".
function itemName(at: Record<string, unknown>, owner: string): string {
  const type = str(at.type);
  const name =
    owner === "" || owner === type ? type : GENERIC.has(type) ? owner : `${owner} › ${type}`;
  const text = str(at.text).replaceAll(/\s+/gu, " ").trim();
  if (text === "") return name;
  return `${name} "${text.length > 28 ? `${text.slice(0, 27)}…` : text}"`;
}

// The deepest item smaller than the screen that holds the point (logical px), by itemName. The
// shell's layers each span the whole screen, so they hold every point and name none. A child may
// stand outside its parent (QML does not clip), so every branch is walked.
function itemAt(tree: unknown, screen: { w: number; h: number }, px: number, py: number): string {
  let best = { item: "", depth: -1 };
  const walk = (at: unknown, owner: string, depth: number): void => {
    if (!isRecord(at)) return;
    const r = rectOf(at);
    if (holdsPoint(r, px, py) && (r.w < screen.w || r.h < screen.h) && depth > best.depth)
      best = { item: itemName(at, owner), depth };
    const type = str(at.type);
    const next = GENERIC.has(type) ? owner : type;
    if (Array.isArray(at.children)) for (const child of at.children) walk(child, next, depth + 1);
  };
  walk(tree, "", 0);
  return best.item;
}

// "20261101-050202-7ad8" reads "1 Nov 05:02".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function runLabel(run: string): string {
  const m = /^\d{4}(\d{2})(\d{2})-(\d{2})(\d{2})/u.exec(run);
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]} ${m[3]}:${m[4]}` : run;
}

function badgesOf(frame: Frame, prev: string): Badge[] {
  const badges: Badge[] = [];
  if (frame.todo) badges.push({ kind: "todo", text: "todo" });
  if (frame.changed)
    badges.push({
      kind: "changed",
      text: `changed vs ${runLabel(prev)}`,
      title: `${frame.changed.areas.length} pixel areas and ${frame.changed.changes.length} tree measures changed against run ${prev}`,
    });
  if (frame.checks.length > 0) badges.push({ kind: "fail", text: `FAIL · ${frame.checks.length}` });
  if (frame.checkError) badges.push({ kind: "fail", text: "check did not run" });
  if (frame.still === "moving") badges.push({ kind: "moving", text: "never still" });
  if (frame.masks.length > 0)
    badges.push({
      kind: "animates",
      text: "animates",
      title: "an item animates by design: the run neither waits for it nor compares it",
    });
  return badges;
}

// The strip's width in canvas px: the state, the journey and the badges on one line, each badge
// 0.85 of the strip's type with its padding (1.1 em) and the gap before it (0.45 em).
function labelWidth(frame: Frame): number {
  const words =
    frame.state.length + (frame.journey && frame.surface ? frame.journey.length + 2 : 0);
  const badges = frame.badges.reduce(
    (sum, b) => sum + b.text.length * CHAR_EM * 0.85 + 1.1 * 0.85 + 0.45,
    0,
  );
  return Math.ceil((words * CHAR_EM + badges) * STRIP_PX);
}

function frameOf(run: string, row: string[], diffs: Map<string, Frame["changed"]>): Frame {
  const [journey = "", state = "", , still = "", fails = "", surface = "", masks = ""] = row;
  const name = `${journey}--${state}`;
  const tree = readJson(join(run, "trees", `${name}.json`));
  if (!isRecord(tree)) return fail(`the tree of ${name} is not an object`);
  const screen = { w: num(tree.width), h: num(tree.height) };
  const image = pngSize(join(run, "shots", `${name}.png`));
  const crop = cropOf(tree, screen, surface);
  const scale = screen.w > 0 ? image.w / screen.w : 1;
  const changed = diffs.get(name) ?? null;
  for (const a of changed?.areas ?? [])
    a.item = itemAt(tree.tree, screen, (a.x + a.w / 2) / scale, (a.y + a.h / 2) / scale);
  const checkPath = join(run, "checks", `${name}.txt`);
  const checks = existsSync(checkPath)
    ? readFileSync(checkPath, "utf8")
        .split("\n")
        .filter((l) => l.endsWith(": FAIL"))
    : [];
  return {
    ...blankFrame(name, state, surface),
    journey,
    still,
    screen,
    scale,
    crop,
    checks,
    // drive writes "error" when the check itself could not run.
    checkError: fails === "error",
    failing: failingOf(checks),
    masks: masksOf(masks),
    changed,
  };
}

// The inventory holes the scenario declares, @Type STATE each, anywhere in it.
function todosOf(scenario: string): { surface: string; state: string }[] {
  const todos: { surface: string; state: string }[] = [];
  for (const line of readFileSync(scenario, "utf8").split("\n")) {
    const m = /^\s*todo\s+@(\S+)\s+(\S.*)$/u.exec(line);
    if (m) todos.push({ surface: m[1] ?? "", state: (m[2] ?? "").trim() });
  }
  return todos;
}

// Sections in the order their first frame appears; a shot without a surface is its journey's.
function sectionsOf(frames: Frame[], todos: { surface: string; state: string }[]): Section[] {
  const sections = new Map<string, Section>();
  const sectionFor = (title: string): Section => {
    const found = sections.get(title);
    if (found) return found;
    const made: Section = { title, at: { x: 0, y: 0 }, w: 0, frames: [] };
    sections.set(title, made);
    return made;
  };
  for (const frame of frames) sectionFor(frame.surface || frame.journey).frames.push(frame);
  for (const todo of todos) {
    const section = sectionFor(todo.surface);
    const like = section.frames.find((f) => !f.todo);
    const size = like ? { w: like.crop.w, h: like.crop.h } : TODO_SIZE;
    section.frames.push({
      ...blankFrame(`todo--${todo.surface}--${todo.state}`, todo.state, todo.surface),
      todo: true,
      screen: size,
      crop: { x: 0, y: 0, ...size },
    });
  }
  return [...sections.values()];
}

// One section's frames from its own corner: left to right, a row wraps after PER_ROW. Returns the
// section's size.
function placeFrames(section: Section): { w: number; h: number } {
  let rowY = TITLE_H;
  let w = 0;
  for (let i = 0; i < section.frames.length; i += PER_ROW) {
    const row = section.frames.slice(i, i + PER_ROW);
    let x = 0;
    for (const frame of row) {
      frame.at = { x, y: rowY };
      x += Math.max(frame.crop.w, labelWidth(frame)) + GAP_X;
    }
    w = Math.max(w, x - GAP_X);
    rowY += Math.max(...row.map((f) => f.crop.h)) + GAP_Y;
  }
  return { w, h: rowY - GAP_Y };
}

// The builder places every frame, so the page draws and never lays out. Sections flow left to
// right like blocks of text, a row of sections wrapping past ROW_W, so the canvas stays near square.
function layout(sections: Section[]): void {
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const section of sections) {
    const size = placeFrames(section);
    size.w = Math.max(size.w, Math.ceil(section.title.length * CHAR_EM * TITLE_PX));
    if (x > 0 && x + size.w > ROW_W) {
      x = 0;
      y += rowH + SECTION_GAP;
      rowH = 0;
    }
    section.at = { x, y };
    section.w = size.w;
    for (const frame of section.frames) frame.at = { x: frame.at.x + x, y: frame.at.y + y };
    x += size.w + SECTION_GAP;
    rowH = Math.max(rowH, size.h);
  }
}

function build(run: string, prev: string): void {
  const tsv = join(run, "shots.tsv");
  if (!existsSync(tsv)) fail(`${run} is not an atlas run (no shots.tsv)`);
  const diffs = diffOf(run, prev);
  const rows = readFileSync(tsv, "utf8")
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => l.split("\t"));
  const frames = rows.map((row) => frameOf(run, row, diffs));
  const sections = sectionsOf(frames, todosOf(join(run, "scenario")));
  for (const frame of sections.flatMap((section) => section.frames))
    frame.badges = badgesOf(frame, prev);
  layout(sections);
  const scenarioDir = dirname(run);
  const board = {
    scenario: basename(scenarioDir),
    run: basename(run),
    prev,
    prevLabel: prev === "" ? "" : runLabel(prev),
    runLabel: runLabel(basename(run)),
    desktop: readFileSync(join(run, "desktop-version"), "utf8").trim(),
    sections,
    comments: readComments(scenarioDir).filter((c) => !c.resolved),
  };
  const template = readFileSync(join(import.meta.dir, "atlas-board.html"), "utf8");
  // Inside <script type="application/json"> no "<" may open a tag or a comment; JSON reads \u003c.
  const data = JSON.stringify(board).replaceAll("<", "\\u003c");
  writeFileSync(
    join(run, "board.html"),
    template.replace("{{BOARD}}", () => data),
  );
}

const latestRun = (scenarioDir: string): string =>
  readdirSync(scenarioDir)
    .filter((d) => /^\d/u.test(d) && existsSync(join(scenarioDir, d, "board.html")))
    .toSorted()
    .at(-1) ?? fail(`${scenarioDir} has no run with a board (run drive atlas run first)`);

function addComment(scenarioDir: string, body: NewComment): Comment {
  const comment: Comment = {
    id: crypto.randomUUID(),
    shot: body.shot,
    x: Math.round(body.x),
    y: Math.round(body.y),
    text: body.text.trim(),
    run: body.run,
    at: new Date().toISOString(),
    resolved: false,
  };
  writeComments(scenarioDir, [...readComments(scenarioDir), comment]);
  return comment;
}

function resolveComment(scenarioDir: string, id: string): boolean {
  const comments = readComments(scenarioDir);
  const found = comments.find((c) => c.id === id);
  if (!found) return false;
  found.resolved = true;
  writeComments(scenarioDir, comments);
  return true;
}

const notFound = (): Response => new Response("not found", { status: 404 });

// Files of the scenario's runs, never above the scenario directory and never a directory.
function fileRoute(scenarioDir: string, path: string): Response {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return notFound();
  }
  const file = resolve(scenarioDir, `.${decoded}`);
  if (!file.startsWith(scenarioDir + sep) || !existsSync(file) || !statSync(file).isFile())
    return notFound();
  return new Response(Bun.file(file));
}

function serve(scenarioDir: string): void {
  latestRun(scenarioDir);
  // One server writes a scenario's notes: two would each read, add and write, and one note would
  // be lost. The kernel drops the lock when this process exits.
  if (!tryFlock(openSync(join(scenarioDir, "comments.lock"), "a")))
    fail(`another drive atlas review already serves ${scenarioDir}`);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    routes: {
      "/": () => Response.redirect(`/${latestRun(scenarioDir)}/board.html`, 302),
      "/comments": {
        GET: () => Response.json(readComments(scenarioDir).filter((c) => !c.resolved)),
        POST: async (request) => {
          const body: unknown = await request.json().catch(() => null);
          return isNewComment(body)
            ? Response.json(addComment(scenarioDir, body))
            : new Response("a comment needs shot, x, y, run and a text", { status: 400 });
        },
      },
      "/comments/:id/resolve": {
        POST: (request) =>
          resolveComment(scenarioDir, request.params.id)
            ? new Response("resolved")
            : new Response("no such comment", { status: 404 }),
      },
    },
    fetch: (request) => fileRoute(scenarioDir, new URL(request.url).pathname),
  });
  process.stdout.write(`http://127.0.0.1:${server.port}/\n`);
}

const [verb = "", target = "", prev = "", ...rest] = process.argv.slice(2);
if (target === "")
  fail(
    "usage: atlas-board build RUN [PREV] | serve SCENARIO_DIR | comments SCENARIO_DIR | surface TREE PATH | mask TREE SCALE PATH...",
  );
const where = resolve(target);
if (verb === "build") build(where, prev);
else if (verb === "serve") serve(where);
else if (verb === "comments")
  for (const c of readComments(where).filter((x) => !x.resolved))
    process.stdout.write(`${c.shot}\t${c.x},${c.y}\t${c.text.replaceAll(/\s+/gu, " ")}\n`);
else if (verb === "surface") {
  const tree = readJson(where);
  process.exitCode = isRecord(tree) && findSurface(tree.tree, prev) ? 0 : 1;
} else if (verb === "mask") mask(where, Number(prev), rest);
else fail(`unknown verb ${verb} (build, serve, comments, surface, mask)`);
