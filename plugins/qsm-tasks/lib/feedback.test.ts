// The privacy guard with a login and a hostname it is given: the real run reads them from the OS,
// which a test cannot set.
import { describe, expect, it } from "bun:test";
import { privateIn } from "./feedback.ts";

describe("privateIn", () => {
  it.each([
    ["a login that ends a sentence", "Running as alice.", "alice", "box"],
    ["a login that itself ends in a dash", "Running as alice-", "alice-", "box"],
    ["a hostname that ends a sentence", "It ran on box.", "alice", "box"],
  ])("finds %s", (_case, line, login, host) => {
    expect(privateIn(line, login, host)).not.toBeNull();
  });
});
