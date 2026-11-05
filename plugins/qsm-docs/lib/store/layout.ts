// Where the store keeps its files below the data directory, written once for the binary, for the
// hook, which stats a project's ledger, and for the guard, which knows what lies under the store:
// plain strings, so the hooks sandbox can import it too.

/** `<data>/qsm-docs`: `projects/` and `kinds/`. */
export const docsIn = (data: string): string => `${data}/qsm-docs`;

/** A project's directory: its snapshots and its ledger. */
export const projectsIn = (docs: string): string => `${docs}/projects`;

/** The installed kinds, one directory each. */
export const kindsIn = (docs: string): string => `${docs}/kinds`;

/** A project's append-only ledger. */
export const ledgerIn = (docs: string, project: string): string =>
  `${projectsIn(docs)}/${project}/ledger.jsonl`;
