// The one escape for text written into HTML, SVG or XML, in element content and in quoted
// attribute values of either quote.

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** `text` with `& < > " '` written as entities, so it can never open a tag or close a value. */
export function escapeHtml(text: string): string {
  return text.replaceAll(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}
