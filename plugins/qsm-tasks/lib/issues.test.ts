// Fuzz of the pure half of the list: gh's JSON in, lines and data out, for any title and Status.
import { expect, test } from "bun:test";
import { assert, array, nat, option, property, record, string } from "fast-check";
import { lineOf, parseIssues } from "./issues.ts";

const issue = record({
  number: nat(),
  title: string({ unit: "binary" }),
  status: option(string({ unit: "binary" }), { nil: null }),
});

function ghJson(issues: readonly { number: number; title: string; status: string | null }[]) {
  return JSON.stringify(
    issues.map((i) => ({
      number: i.number,
      title: i.title,
      projectItems: i.status === null ? [] : [{ status: { name: i.status }, title: "board" }],
    })),
  );
}

test("the data is the input, for every issue", () => {
  assert(
    property(array(issue), (issues) => {
      expect(parseIssues(ghJson(issues))).toEqual(issues);
    }),
  );
});

test("any title prints as exactly one line", () => {
  assert(
    property(issue, (i) => {
      expect(lineOf(i).split(/\r|\n/)).toHaveLength(1);
    }),
  );
});
