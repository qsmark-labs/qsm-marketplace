import { expect, test } from "bun:test";
import { escapeHtml } from "./html.ts";

test("escapes the five characters that can open a tag or close a quoted value, once each", () => {
  expect(escapeHtml(`<a href="x" title='y'>Tom & "Jerry"</a>`)).toBe(
    "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; &quot;Jerry&quot;&lt;/a&gt;",
  );
  expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  expect(escapeHtml("plain text")).toBe("plain text");
});
