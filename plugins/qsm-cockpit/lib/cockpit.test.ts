import { expect, test } from "bun:test";
import { guideText, STAGES } from "./cockpit.ts";

test("each stage answers one sentence", () => {
  for (const stage of STAGES) {
    const text = guideText(stage);
    console.log(`${stage}: ${Buffer.byteLength(text)} bytes`);
    expect(text.endsWith(".")).toBe(true);
    expect(text.slice(0, -1)).not.toContain(". ");
  }
});
