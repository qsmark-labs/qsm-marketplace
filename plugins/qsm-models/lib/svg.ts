// What the BPMN and the C4 renderers both need: one picture type and one escape for text and
// attribute values.

/** One picture a render writes: the file name beside the graph, and its bytes. */
export interface Picture {
  readonly name: string;
  readonly title: string;
  readonly svg: string;
}

export const esc = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
