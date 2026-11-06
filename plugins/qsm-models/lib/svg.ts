// What the BPMN and the C4 renderers both need: one picture type.

/** One picture a render writes: the file name beside the graph, and its bytes. */
export interface Picture {
  readonly name: string;
  readonly title: string;
  readonly svg: string;
}
