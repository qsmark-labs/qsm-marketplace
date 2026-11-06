// The steps the install base cannot know: the structural checker and the
// semgrep login. A missing or unpatched sentrux is built through the build handed in; the
// probes of the sentrux on PATH and of the semgrep login are handed in, so no
// test depends on this machine's.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { chmodSync, readFileSync } from "node:fs";
import { type FakeInstall, fakeInstall } from "../../../lib/fixtures/install.ts";
import { sandboxDir, writeIn } from "../../../lib/fixtures/sandbox.ts";
import { type InstallContext, isFailure } from "../../../lib/install-contract.ts";
import {
  PATCHED_SENTRUX_VERSION,
  type StructuralCheckerStatus,
  structuralCheckerStatus,
} from "../lib/compare.ts";
import { extraSteps, semgrepLoginStep, structuralChecker } from "./install.ts";

function machine(opts: { dryRun?: boolean; cargo?: boolean } = {}): FakeInstall {
  return fakeInstall({
    present: opts.cargo === false ? [] : ["cargo"],
    dryRun: opts.dryRun ?? false,
  });
}

const ctx = (opts: { dryRun?: boolean; cargo?: boolean } = {}): InstallContext => machine(opts).ctx;

/** A build that records the cache root it was handed, or throws. */
function builder(log: string[], failure?: string): (cacheRoot: string) => void {
  return (cacheRoot) => {
    log.push(cacheRoot);
    if (failure !== undefined) {
      throw new Error(failure);
    }
  };
}

const patched = (): Promise<StructuralCheckerStatus> =>
  Promise.resolve({ present: true, patched: true, found: PATCHED_SENTRUX_VERSION });
const unpatched = (): Promise<StructuralCheckerStatus> =>
  Promise.resolve({ present: true, patched: false, found: "0.5.7" });
const absent = (): Promise<StructuralCheckerStatus> =>
  Promise.resolve({ present: false, patched: false, found: null });

describe("qsm-langdev structural checker step", () => {
  test("A compatible checker is already present", async () => {
    for (const dryRun of [false, true]) {
      const log: string[] = [];
      const step = await structuralChecker(ctx({ dryRun }), patched, builder(log));
      expect(step).toMatchObject({
        status: "already",
        detail: "sentrux reports a qsm-patched version",
      });
      expect(log).toHaveLength(0);
    }
  });

  test("No compatible checker present", async () => {
    const log: string[] = [];
    const fx = machine();
    const step = await structuralChecker(fx.ctx, absent, builder(log));
    expect(step.status).toBe("installed");
    expect(log).toEqual([join(fx.home, ".cache")]);
  });

  test("an unpatched sentrux is rebuilt", async () => {
    const log: string[] = [];
    const fx = machine();
    expect((await structuralChecker(fx.ctx, unpatched, builder(log))).status).toBe("installed");
    expect(log).toEqual([join(fx.home, ".cache")]);
  });

  test("a sentrux of an older qsm version is rebuilt, the patch's own version is not", async () => {
    const root = sandboxDir("qsm-langdev-sentrux-");
    const probe = (version: string): string => {
      writeIn(root, version, `#!/bin/sh\necho "sentrux ${version}"\n`);
      chmodSync(join(root, version), 0o755);
      return join(root, version);
    };
    const log: string[] = [];
    const fx = machine();
    const stale = probe("0.5.7-qsm.2");
    const step = await structuralChecker(
      fx.ctx,
      () => structuralCheckerStatus(stale),
      builder(log),
    );
    expect(step.status).toBe("installed");
    expect(log).toHaveLength(1);
    const current = probe(PATCHED_SENTRUX_VERSION);
    expect(await structuralCheckerStatus(current)).toEqual({
      present: true,
      patched: true,
      found: PATCHED_SENTRUX_VERSION,
    });
  });

  test("the version the checker wants is the one the patch declares", () => {
    const patch = readFileSync(join(import.meta.dir, "..", "sentrux", "wiring.patch"), "utf8");
    expect(patch).toContain(`+version = "${PATCHED_SENTRUX_VERSION}"`);
  });

  test("The build fails", async () => {
    const step = await structuralChecker(ctx(), absent, builder([], "cargo exited 101"));
    expect(step.status).toBe("error");
    expect(step.detail).toContain("cargo exited 101");
  });

  test("No cargo", async () => {
    const log: string[] = [];
    const step = await structuralChecker(ctx({ cargo: false }), absent, builder(log));
    expect(step.status).toBe("missing-prereq");
    expect(step.detail).toContain("cargo");
    expect(log).toHaveLength(0);
  });

  test("a dry run names the build and runs nothing", async () => {
    const log: string[] = [];
    const step = await structuralChecker(ctx({ dryRun: true }), unpatched, builder(log));
    expect(step.detail).toBe("would build the qsm-patched sentrux with cargo");
    expect(log).toHaveLength(0);
  });

  test("a dry run without cargo says it would need it", async () => {
    const step = await structuralChecker(ctx({ dryRun: true, cargo: false }), absent);
    expect(step.detail).toStartWith("would need cargo");
  });
});

const WARNING = "semgrep is not logged in: run semgrep login to use qsm-langdev at its fullest";

/** cargo, and semgrep when `semgrep` is set, on PATH */
const withSemgrep = (semgrep: boolean): InstallContext =>
  fakeInstall({ present: semgrep ? ["cargo", "semgrep"] : ["cargo"] }).ctx;

describe("qsm-langdev semgrep login step", () => {
  test("logged out is its own suggested step carrying the warning, never a failure", async () => {
    const step = await semgrepLoginStep(withSemgrep(true), () =>
      Promise.resolve("logged-out" as const),
    );
    expect(step).toEqual({ name: "semgrep login", status: "suggested", detail: WARNING });
    expect(isFailure(step?.status ?? "error")).toBe(false);
  });

  test("an unknown login state is said, not taken for logged out", async () => {
    const step = await semgrepLoginStep(withSemgrep(true), () =>
      Promise.resolve("unknown" as const),
    );
    expect(step?.status).toBe("suggested");
    expect(step?.detail).toStartWith("semgrep login state is unknown");
  });

  test("logged in is no step", async () => {
    expect(
      await semgrepLoginStep(withSemgrep(true), () => Promise.resolve("logged-in" as const)),
    ).toBeNull();
  });

  test("no semgrep on PATH asks nothing and is no step: that is the missing-binary path", async () => {
    let asked = false;
    const step = await semgrepLoginStep(withSemgrep(false), () => {
      asked = true;
      return Promise.resolve("logged-out" as const);
    });
    expect(step).toBeNull();
    expect(asked).toBe(false);
  });
});

describe("qsm-langdev extra steps", () => {
  test("logged out adds the login step after the checker and leaves the checker alone", async () => {
    const steps = await extraSteps(withSemgrep(true), patched, () =>
      Promise.resolve("logged-out" as const),
    );
    expect(steps).toEqual([
      {
        name: "structural checker",
        status: "already",
        detail: "sentrux reports a qsm-patched version",
      },
      { name: "semgrep login", status: "suggested", detail: WARNING },
    ]);
  });

  test("logged in is the checker step alone", async () => {
    const steps = await extraSteps(withSemgrep(true), patched, () =>
      Promise.resolve("logged-in" as const),
    );
    expect(steps.map((s) => s.name)).toEqual(["structural checker"]);
  });

  test("no semgrep is the checker step alone", async () => {
    const steps = await extraSteps(withSemgrep(false), patched, () =>
      Promise.resolve("logged-out" as const),
    );
    expect(steps.map((s) => s.name)).toEqual(["structural checker"]);
  });

  test("a failed build stays failed and the login step still appears", async () => {
    const steps = await extraSteps(
      withSemgrep(true),
      absent,
      () => Promise.resolve("logged-out" as const),
      builder([], "cargo exited 101"),
    );
    expect(steps.map((s) => [s.name, s.status])).toEqual([
      ["structural checker", "error"],
      ["semgrep login", "suggested"],
    ]);
  });
});
