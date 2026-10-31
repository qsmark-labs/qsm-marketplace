import { Glob } from "bun";

/**
 * What the structure score leaves out of both trees: test files and test fixtures, by each
 * language's own convention.
 */
const TEST_FILES = [
  // bun test, vitest, jest
  "**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "**/__tests__/**",
  "**/fixtures/**",
  // pytest and unittest; `tests/` is also where cargo keeps integration tests
  "**/test_*.py",
  "**/*_test.py",
  "**/conftest.py",
  "**/tests/**",
  // a .NET test project
  "**/*.Tests/**",
  // go test
  "**/*_test.go",
  "**/testdata/**",
].map((pattern) => new Glob(pattern));

/** Whether a repository-relative path is a test file or a test fixture. */
export function isTestFile(path: string): boolean {
  return TEST_FILES.some((glob) => glob.match(path));
}
