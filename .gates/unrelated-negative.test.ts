import { describe, expect, test } from "bun:test";
import { YAML } from "bun";
import { languageSkills, negativeCase } from "./unrelated-negative.ts";
import { isRecord } from "./walk.ts";

/** The YAML frontmatter of a generated file. */
function meta(text: string): Record<string, string> {
  const doc: unknown = YAML.parse(/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "");
  if (!isRecord(doc)) {
    throw new Error("generated file has no frontmatter mapping");
  }
  return Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, String(v)]));
}

describe("the generated unrelated negative case", () => {
  test("a plugin's language skills are its -dev directories", () => {
    expect(languageSkills(["typescript-dev", "bun-dev", "helper"])).toEqual([
      "bun-dev",
      "typescript-dev",
    ]);
  });

  test("one grader per skill fails on that skill's call and on no other", () => {
    const files = negativeCase(["bun-dev", "typescript-dev"]);

    const bun = new RegExp(meta(files["graders/no-bun-dev.md"] ?? "").input_match ?? "");
    const call = (skill: string) => JSON.stringify({ skill });
    expect(bun.test(call("bun-dev"))).toBe(true);
    expect(bun.test(call("qsm-langdev-ts:bun-dev"))).toBe(true);
    expect(bun.test(call("typescript-dev"))).toBe(false);
    expect(Object.keys(files).filter((f) => f.startsWith("graders/no-"))).toEqual([
      "graders/no-bun-dev.md",
      "graders/no-typescript-dev.md",
    ]);
  });

  test("the answered regex matches its pass sample and not its fail sample", () => {
    const files = negativeCase(["fish-dev"]);

    const answered = new RegExp(meta(files["graders/answered.md"] ?? "").pattern ?? "", "i");
    expect(answered.test(files["samples/pass.md"] ?? "")).toBe(true);
    expect(answered.test(files["samples/fail.md"] ?? "")).toBe(false);
  });
});
