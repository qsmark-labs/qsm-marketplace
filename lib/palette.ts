// The six actor colours a model paints with: an architecture graph gives each actor one, and a
// process graph colours a lane by its linked actor or, unlinked, by the colours left.

/** An actor's colour, by the name the source gives it in `colour`. */
export const PALETTE: Readonly<Record<string, string>> = {
  navy: "#08427b",
  purple: "#6b4fbb",
  orange: "#c2410c",
  green: "#15803d",
  teal: "#0f766e",
  red: "#b91c1c",
};
