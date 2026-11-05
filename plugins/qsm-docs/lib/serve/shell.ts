// The page shell: the snapshot's project, branch, id, parent and time, the snapshots of its branch,
// and the kind's page in a same-origin frame. Its script and styles, and the json kind's page, are
// compiled into the binary, so the server reads no file of this repository.
import type { Env } from "../../../../lib/paths.ts";
import shellCss from "../../pages/shell/shell.css.txt" with { type: "text" };
import shellJs from "../../pages/shell/shell.js.txt" with { type: "text" };
import jsonHtml from "../../pages/json/index.html.txt" with { type: "text" };
import jsonJs from "../../pages/json/page.js.txt" with { type: "text" };
import { listKinds } from "../kinds/kind.ts";
import type { Entry } from "../store/store.ts";
import type { Where } from "../store/where.ts";

interface Asset {
  readonly body: string;
  readonly type: string;
}

const JS = "text/javascript; charset=utf-8";

export const SHELL_ASSETS: Readonly<Record<string, Asset>> = {
  "/shell.css": { body: shellCss, type: "text/css; charset=utf-8" },
  "/shell.js": { body: shellJs, type: JS },
};

/** The json kind's page files, by their name under `/kinds/json/`. */
export const JSON_PAGE: Readonly<Record<string, Asset>> = {
  "index.html": { body: jsonHtml, type: "text/html; charset=utf-8" },
  "page.js": { body: jsonJs, type: JS },
};

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const esc = (text: string): string => text.replaceAll(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

const href = (e: Entry): string => `/${encodeURIComponent(e.kind)}/${encodeURIComponent(e.id)}`;

function document(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/shell.css">
</head>
<body>
${body}
</body>
</html>
`;
}

/** A snapshot in the shell, its kind's page in the frame. */
export function shellPage(entry: Entry, siblings: readonly Entry[]): string {
  const parent =
    entry.parent === null
      ? "none"
      : `<a href="/${encodeURIComponent(entry.kind)}/${encodeURIComponent(entry.parent)}">${esc(entry.parent)}</a>`;
  const rows = siblings
    .map(
      (e) =>
        `<li${e.id === entry.id ? ' aria-current="page"' : ""}><a href="${href(e)}">${esc(e.id)}</a> <span class="meta">${esc(e.kind)}, ${esc(e.by)}</span></li>`,
    )
    .join("\n");
  const frame = `/kinds/${encodeURIComponent(entry.kind)}/index.html#id=${encodeURIComponent(entry.id)}`;
  return document(
    `${entry.kind} ${entry.id}`,
    `<header class="bar">
<dl class="facts">
<div><dt>project</dt><dd id="project">${esc(entry.project)}</dd></div>
<div><dt>branch</dt><dd id="branch">${esc(entry.branch)}</dd></div>
<div><dt>snapshot</dt><dd id="snapshot">${esc(entry.id)}</dd></div>
<div><dt>parent</dt><dd id="parent">${parent}</dd></div>
<div><dt>time</dt><dd id="time">${esc(entry.time)}</dd></div>
</dl>
<button id="edit" type="button" aria-pressed="false">Edit</button>
</header>
<main class="body">
<nav aria-label="snapshots of ${esc(entry.branch)}"><h2>On ${esc(entry.branch)}</h2><ul class="list">
${rows}
</ul></nav>
<iframe id="page" title="${esc(entry.kind)} page" src="${frame}"></iframe>
</main>
<script src="/shell.js"></script>`,
  );
}

/** `/`: the installed kinds, each a link to its newest snapshot on the server's branch. */
export function indexPage(where: Where, env: Env): string {
  const kinds = listKinds(env)
    .map(
      (k) =>
        `<li><a href="/${encodeURIComponent(k.name)}">${esc(k.name)}</a> <span class="meta">${esc(k.mediaType)}, ${esc(k.plugin)}</span></li>`,
    )
    .join("\n");
  return document(
    `qsm-docs: ${where.project}`,
    `<main class="note"><h1>${esc(where.project)} on ${esc(where.branch)}</h1><ul class="list">
${kinds}
</ul></main>`,
  );
}

/** What a page says when there is nothing to show. */
export function notFoundPage(message: string): string {
  return document("qsm-docs", `<main class="note"><p role="alert">${esc(message)}</p></main>`);
}
