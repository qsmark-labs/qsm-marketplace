// --repo and --project as resolveTarget reads them: no verb declares the flags until its own task
// lands, so the binary cannot reach this yet. Answers are recorded from the real gh.
import { describe, expect, it } from "bun:test";
import { UsageError } from "../../../../lib/outcome.ts";
import type { GhAnswer, Run } from "./gh.ts";
import { resolveTarget } from "./target.ts";

const REPO = { id: "R_kgDOVGCdTA", nameWithOwner: "qsmark-labs/qsm-marketplace" };

function recording(answer: GhAnswer): { run: Run; calls: (readonly string[])[] } {
  const calls: (readonly string[])[] = [];
  const run: Run = (args) => {
    calls.push(args);
    return Promise.resolve(answer);
  };
  return { run, calls };
}

describe("resolveTarget", () => {
  it("reads the named repository and a board it does not link in one query", async () => {
    const board = { id: "PVT_kwDOFMPqAc4Bo0vN", number: 1, owner: { login: "qsmark-labs" } };
    const repository = { ...REPO, projectsV2: { nodes: [] } };
    const data = { repository, repositoryOwner: { projectV2: board } };
    const { run, calls } = recording({ exit: 0, stdout: JSON.stringify({ data }), stderr: "" });
    const target = await resolveTarget(run, { repo: REPO.nameWithOwner, project: "qsmark-labs/1" });
    expect(target).toEqual({
      ok: true,
      value: {
        repoId: REPO.id,
        repo: REPO.nameWithOwner,
        board: { id: board.id, number: 1, owner: "qsmark-labs" },
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("named=true");
    expect(calls[0]).toContain("number=1");
  });

  it("is failed not-found for a board owner GitHub does not know", async () => {
    const data = { repository: { ...REPO, projectsV2: { nodes: [] } }, repositoryOwner: null };
    const { run } = recording({ exit: 0, stdout: JSON.stringify({ data }), stderr: "" });
    const target = await resolveTarget(run, { repo: undefined, project: "no-such-owner/1" });
    expect(target.ok ? null : target.outcome.data).toEqual({ reason: "not-found" });
  });

  it("is failed not-found for a board number GitHub does not know", async () => {
    const stdout = JSON.stringify({
      data: { repository: REPO, repositoryOwner: { projectV2: null } },
      errors: [
        { type: "NOT_FOUND", message: "Could not resolve to a ProjectV2 with the number 999." },
      ],
    });
    const { run } = recording({ exit: 1, stdout, stderr: "gh: Could not resolve" });
    const target = await resolveTarget(run, { repo: undefined, project: "qsmark-labs/999" });
    expect(target.ok ? null : target.outcome.data).toEqual({ reason: "not-found" });
  });

  it("refuses a --repo that is not owner/name before any call", async () => {
    const { run, calls } = recording({ exit: 0, stdout: "", stderr: "" });
    const target = resolveTarget(run, { repo: "qsm-marketplace", project: undefined });
    const thrown = await target.then(
      () => null,
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(UsageError);
    expect(calls).toHaveLength(0);
  });
});
