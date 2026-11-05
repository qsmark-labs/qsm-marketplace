// Where the store keeps its files below the data directory, written once for the binary and for the
// hook, which stats a project's ledger: plain strings, so the hooks sandbox can import it too.

/** `<data>/qsm-docs`: a directory per project, and `.kinds` for the installed kinds. */
export const docsIn = (data: string): string => `${data}/qsm-docs`;

/** A project's append-only ledger under the store's root. */
export const ledgerIn = (docs: string, project: string): string =>
  `${docs}/${project}/ledger.jsonl`;
