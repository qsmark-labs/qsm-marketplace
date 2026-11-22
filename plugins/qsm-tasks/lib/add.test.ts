// Fuzz of the pure half of add: the number in the URL gh prints.
import { expect, test } from "bun:test";
import { assert, nat, property, string, constantFrom } from "fast-check";
import { issueNumberOf } from "./add.ts";

test("the number is the last segment of the URL, whatever the owner, repo and line ending", () => {
  assert(
    property(
      string({ unit: "grapheme-ascii", minLength: 1 }).filter((s) => !s.includes("/")),
      string({ unit: "grapheme-ascii", minLength: 1 }).filter((s) => !s.includes("/")),
      nat(),
      constantFrom("", "\n", "\r\n"),
      (owner, repo, number, end) => {
        const url = `https://github.com/${owner}/${repo}/issues/${number}${end}`;
        expect(issueNumberOf(url)).toBe(number);
      },
    ),
  );
});

test("text that does not end in an issue URL is refused", () => {
  assert(
    property(
      string().filter((s) => !/\/issues\/\d+\s*$/.test(s)),
      (text) => {
        expect(() => issueNumberOf(text)).toThrow("no issue URL");
      },
    ),
  );
});
