// Reads the text of an intent or a body: a path naming no file is missing no-file, no path is "".
import { refuse, type Result } from "./failure.ts";

export async function readText(path: string | undefined): Promise<Result<string>> {
  if (path === undefined) {
    return { ok: true, value: "" };
  }
  const text = Bun.file(path);
  return (await text.exists())
    ? { ok: true, value: await text.text() }
    : refuse("missing", "no-file", `no file ${path}`);
}
