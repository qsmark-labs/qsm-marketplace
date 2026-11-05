// The delete guard's whole decision, as a function of the command line alone: no engine, no Node,
// no filesystem. Only the owner deletes a snapshot, and the owner's `!` command never reaches it.

/** `qsm-docs delete` anywhere in the line: after a wrapper (`rtk`, `env`, `sudo`), a path to the
 * binary, a separator, a quote or a subshell, with any flags between the two words. */
const DELETE =
  /(?:^|[\s;&|()`'"$=])(?:[^\s;&|()`'"]*\/)?qsm-docs\s+(?:-\S+\s+)*delete(?=$|[\s;&|)`'"])(?:\s+(?:-\S+\s+)*([^\s;&|)`'"-][^\s;&|)`'"]*))?/;

/** The refusal for a Bash line that deletes a snapshot, or null when it may run. */
export function deleteRefusal(line: string): string | null {
  const match = DELETE.exec(line);
  if (match === null) {
    return null;
  }
  const id = match[1] ?? "<id>";
  return `qsm-docs: only the owner deletes a snapshot. Ask the owner whether it should go; if so, they run \`! qsm-docs delete ${id}\` themselves.`;
}
