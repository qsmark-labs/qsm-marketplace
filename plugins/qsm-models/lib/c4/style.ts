// What the C4 pictures say about the vocabulary: the palette for the actors and the one table of
// tags, read by the vocabulary the source is parsed with, by lint and by render.

/** An actor's colour, by the name the source gives it in `colour`. */
export const PALETTE: Readonly<Record<string, string>> = {
  navy: "#08427b",
  purple: "#6b4fbb",
  orange: "#c2410c",
  green: "#15803d",
  teal: "#0f766e",
  red: "#b91c1c",
};

/** Each tag the vocabulary declares: what a view calls an element that carries it, the fill of its
 * box where the tag sets one, and the legend line that explains it. */
export const TAGS = {
  external: { label: "external system", fill: "#8a8a8a", legend: "external system" },
  agent: { label: "agent", fill: undefined, legend: undefined },
  shared: {
    label: "shared",
    fill: undefined,
    legend: "italic note: who uses it, drawn without lines",
  },
  artifact: {
    label: "artifact",
    fill: "#c7e0f8",
    legend: "artifact: a skill or agent file a session loads",
  },
} as const;

export type Tag = keyof typeof TAGS;

/** Whether an element carries a tag of the vocabulary. */
export const hasTag = (e: { readonly tags: readonly string[] }, tag: Tag): boolean =>
  e.tags.includes(tag);
