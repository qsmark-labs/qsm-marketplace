// Fuzz of the pure half of move: the board query's answer in, where to write out.
import { expect, test } from "bun:test";
import { assert, nat, property, record, string, uniqueArray } from "fast-check";
import { targetOf } from "./move.ts";

const option = record({ id: string(), name: string() });
const options = uniqueArray(option, { selector: (o) => o.name, minLength: 1 });

function answer(all: readonly { id: string; name: string }[]): string {
  const node = {
    id: "item",
    project: { id: "project", title: "t", field: { id: "field", options: all } },
  };
  return JSON.stringify({ data: { repository: { issue: { projectItems: { nodes: [node] } } } } });
}

test("a Status that is one of the options is its option id, whatever the names", () => {
  assert(
    property(options, nat(), nat(), (all, number, pick) => {
      const chosen = all[pick % all.length];
      if (chosen === undefined) {
        return;
      }
      expect(targetOf(answer(all), number, chosen.name).optionId).toBe(chosen.id);
    }),
  );
});

test("a Status that is none of the options is refused with every option named", () => {
  assert(
    property(options, string(), (all, status) => {
      if (all.some((o) => o.name === status)) {
        return;
      }
      expect(() => targetOf(answer(all), 1, status)).toThrow(all.map((o) => o.name).join(", "));
    }),
  );
});

test("no node is no board, whatever the issue number", () => {
  assert(
    property(nat(), (number) => {
      const none = { data: { repository: { issue: { projectItems: { nodes: [] } } } } };
      expect(() => targetOf(JSON.stringify(none), number, "x")).toThrow(
        `issue #${number} is on no board`,
      );
    }),
  );
});
