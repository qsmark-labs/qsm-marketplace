import { expect, test } from "bun:test";
import { sandboxDir, writeIn } from "../lib/fixtures/sandbox.ts";
import { deleteCalls } from "./validate-no-docs-delete.ts";

// each line is split so this file's own text holds no call for the gate to find
const CALL = ["qsm-docs", 'delete "$id"'].join(" ");
const NOUN = ["await $.docs", "delete({ id })"].join(".");

test("names the file and line of a skill, an agent or a hook that deletes a snapshot", () => {
  const plugins = sandboxDir("gate-no-docs-delete-");
  writeIn(plugins, "qsm-a/skills/clean/SKILL.md", `# Clean\n\nRun:\n\n    ${CALL}\n`);
  writeIn(plugins, "qsm-a/agents/sweeper.md", `Then ${CALL}.\n`);
  writeIn(plugins, "qsm-b/hooks/register.tsx", `${NOUN};\n`);
  expect(
    deleteCalls(plugins)
      .map((f) => f.slice(plugins.length + 1))
      .toSorted(),
  ).toEqual([
    "qsm-a/agents/sweeper.md:1",
    "qsm-a/skills/clean/SKILL.md:5",
    "qsm-b/hooks/register.tsx:1",
  ]);
});

test("leaves a comment of code and the owner's own command alone, never a skill's markdown", () => {
  const plugins = sandboxDir("gate-no-docs-delete-");
  const hook = [`// the guard that denies \`${CALL}\``, ` * ${CALL}`, `# ${CALL}`].join("\n");
  writeIn(plugins, "qsm-docs/hooks/register.tsx", `${hook}\n`);
  writeIn(plugins, "qsm-a/skills/ask/SKILL.md", `The owner runs \`! ${CALL}\`.\n# ${CALL}\n`);
  expect(deleteCalls(plugins).map((f) => f.slice(plugins.length + 1))).toEqual([
    "qsm-a/skills/ask/SKILL.md:2",
  ]);
});

test("leaves a hook's test, the plugin's lib and its docs alone", () => {
  const plugins = sandboxDir("gate-no-docs-delete-");
  writeIn(plugins, "qsm-docs/hooks/register.test.ts", `command: "${CALL}"\n`);
  writeIn(plugins, "qsm-docs/lib/delete-guard.ts", `they run \`! ${CALL}\`\n`);
  writeIn(plugins, "qsm-docs/USAGE.md", `${CALL}\n`);
  expect(deleteCalls(plugins)).toEqual([]);
});
