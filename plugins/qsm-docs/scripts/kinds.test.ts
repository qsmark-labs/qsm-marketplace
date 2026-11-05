// The kind registry through the real entry: a kind whose converter and diff are fake executables,
// added, listed, used by create and diff, and removed while its snapshots stay.
import { describe, expect, it } from "bun:test";
import { join, resolve } from "node:path";
import { dataOf, envelopeOf, isolatedEnv, runBin } from "../../../lib/fixtures/cli.ts";
import { fakeBin } from "../../../lib/fixtures/bin.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { isRecord } from "../../../lib/outcome.ts";

const CLI = resolve(import.meta.dir, "cli.ts");
const AT = ["--project", "demo", "--branch", "main"];

/** A sandbox store, and a plugin directory holding the manifest of the kind `fake`, whose diff
 * prints `diff` (`{a}` and `{b}` replaced by the files it is given). */
function registry(diff = '[{"op": "changed", "element": "$1 $2"}]') {
  const home = sandboxDir("qsm-docs-kinds-");
  const plugin = join(home, "plugin");
  const env = isolatedEnv(home);
  const convert = fakeBin(
    home,
    "fake-convert",
    'case "$(cat "$1")" in bad*) echo "line 1: not a fake document" >&2; exit 3;; esac; echo \'{"ok": true}\'',
  );
  const differ = fakeBin(home, "fake-diff", `printf '%s' '${diff}' | sed "s|\\$1|$1|; s|\\$2|$2|"`);
  writeIn(plugin, "pages/fake/index.html", "<!doctype html><title>fake</title>");
  const manifest = {
    name: "fake",
    plugin: "qsm-fake",
    mediaType: "application/x-fake",
    ext: "fake",
    pages: "pages/fake",
    convert: [convert, "{file}"],
    diff: [differ, "{a}", "{b}"],
  };
  writeIn(plugin, "fake.json", JSON.stringify(manifest));
  const run = (args: string[]) => runBin(CLI, args, { env, cwd: home });
  const create = (kind: string, rel: string, text: string, extra: string[] = []): string => {
    writeIn(home, rel, text);
    const r = run(["create", kind, rel, ...AT, ...extra, "--json"]);
    const data = dataOf(r.stdout);
    if (!isRecord(data) || typeof data.id !== "string") {
      throw new Error(`create: ${r.stdout}`);
    }
    return data.id;
  };
  return { home, plugin, run, create, manifest, file: join(plugin, "fake.json") };
}

describe("the kind registry", () => {
  it("adds a kind and lists it after json with its media type", () => {
    const k = registry();
    expect(k.run(["kind", "add", k.file]).exit).toBe(0);
    const listed = k.run(["kind", "list"]);
    expect(listed.stdout).toBe(
      "json  application/json  json  qsm-docs\nfake  application/x-fake  fake  qsm-fake\n",
    );
  });

  it("refuses a create its converter fails, naming the converter's message, and stores nothing", () => {
    const k = registry();
    k.run(["kind", "add", k.file]);
    writeIn(k.home, "doc.fake", "bad document");
    const r = k.run(["create", "fake", "doc.fake", ...AT, "--json"]);
    expect(envelopeOf(r.stdout).code).toBe("failed");
    expect(envelopeOf(r.stdout).message).toContain("line 1: not a fake document");
    expect(k.run(["list", "demo"]).stdout).toBe("demo: no snapshots\n");
  });

  it("diffs through the newer snapshot's kind with a parent of another kind as {a}", () => {
    const k = registry();
    k.run(["kind", "add", k.file]);
    const parent = k.create("json", "p.json", "{}");
    const child = k.create("fake", "c.fake", "good", ["--parent", parent]);
    const store = join(k.home, "data", "qsm-docs", "demo");
    const r = k.run(["diff", child]);
    expect(r.stdout).toBe(
      `changed ${join(store, `${parent}.json`)} ${join(store, `${child}.fake`)}\n`,
    );
  });

  it("fails a diff that prints another shape, naming the kind and the record", () => {
    const k = registry('{"changes": 3}');
    k.run(["kind", "add", k.file]);
    const a = k.create("fake", "a.fake", "one");
    const b = k.create("fake", "b.fake", "two", ["--parent", a]);
    const r = k.run(["diff", b, "--json"]);
    expect(envelopeOf(r.stdout).code).toBe("failed");
    expect(envelopeOf(r.stdout).message).toContain('fake: the diff printed {"changes":3}');
    const record = registry('[{"op": "grew", "element": "x"}]');
    record.run(["kind", "add", record.file]);
    const c = record.create("fake", "c.fake", "one");
    const d = record.create("fake", "d.fake", "two", ["--parent", c]);
    expect(envelopeOf(record.run(["diff", d, "--json"]).stdout).message).toContain(
      'fake: the diff printed a record that is not {"op", "element", "detail"?}: {"op":"grew"',
    );
  });

  it("refuses two snapshots of different kinds", () => {
    const k = registry();
    k.run(["kind", "add", k.file]);
    const a = k.create("json", "a.json", "{}");
    const b = k.create("fake", "b.fake", "x");
    expect(k.run(["diff", b, a]).exit).toBe(2);
  });

  it("refuses a manifest missing a field, or a page directory without index.html", () => {
    const k = registry();
    writeIn(k.plugin, "no-diff.json", JSON.stringify({ ...k.manifest, diff: undefined }));
    const missing = k.run(["kind", "add", join(k.plugin, "no-diff.json"), "--json"]);
    expect(envelopeOf(missing.stdout)).toMatchObject({ code: "usage" });
    expect(envelopeOf(missing.stdout).message).toContain('"diff"');
    writeIn(k.plugin, "empty/readme.txt", "x");
    writeIn(k.plugin, "no-page.json", JSON.stringify({ ...k.manifest, pages: "empty" }));
    const noPage = k.run(["kind", "add", join(k.plugin, "no-page.json"), "--json"]);
    expect(envelopeOf(noPage.stdout).message).toContain("holds no index.html");
  });

  it("removes a kind and keeps its snapshots; create and diff then fail missing naming it", () => {
    const k = registry();
    k.run(["kind", "add", k.file]);
    const a = k.create("fake", "a.fake", "one");
    const b = k.create("fake", "b.fake", "two", ["--parent", a]);
    expect(k.run(["kind", "remove", "fake"]).exit).toBe(0);
    expect(k.run(["list", "demo"]).stdout).toContain(b);
    const diff = k.run(["diff", b]);
    expect(diff.exit).toBe(4);
    expect(diff.stderr).toContain("the kind fake is not installed");
    expect(diff.stderr).toContain("install qsm-fake");
    expect(k.run(["create", "fake", "a.fake", ...AT]).exit).toBe(4);
    expect(k.run(["kind", "remove", "json"]).exit).toBe(2);
  });
});
