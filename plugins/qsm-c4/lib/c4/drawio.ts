// The draw.io half of a `.drawio.svg`: each shape of a view as a draw.io cell carrying draw.io's own
// C4 attributes, so draw.io opens the picture as an editable C4 diagram.
import { escapeHtml as esc } from "../../../../lib/html.ts";
import type { Rect } from "../../../../lib/touch.ts";
import type { C4Element } from "./model.ts";

const C4TYPE: Readonly<Record<C4Element["kind"], string>> = {
  person: "Person",
  system: "Software System",
  container: "Container",
  component: "Component",
};

const geo = (b: Rect): string =>
  `<mxGeometry x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" as="geometry"/>`;

/** The cells of one view, numbered in the order they are added. */
export class Cells {
  private readonly cells: string[] = [];
  private next = 2;
  private readonly ids = new Map<string, string>();

  private id(): string {
    const id = `c${this.next}`;
    this.next += 1;
    return id;
  }

  boundary(e: C4Element, b: Rect): void {
    const system = e.kind === "system";
    this.cells.push(
      `<object id="${this.id()}" label="&lt;b&gt;%c4Name%&lt;/b&gt;&lt;div&gt;[%c4Application%]&lt;/div&gt;" placeholders="1" c4Type="${system ? "SystemScopeBoundary" : "ContainerScopeBoundary"}" c4Name="${esc(e.title)}" c4Application="${system ? "Software System" : "Container"}" c4Id="${esc(e.id)}"><mxCell style="rounded=1;fontSize=11;whiteSpace=wrap;html=1;dashed=1;arcSize=4;fillColor=none;strokeColor=#555555;fontColor=#222222;align=left;verticalAlign=bottom;spacing=10;dashPattern=8 4;metaEdit=1;connectable=0;" vertex="1" parent="1">${geo(b)}</mxCell></object>`,
    );
  }

  group(name: string, b: Rect, fill: string, stroke: string): void {
    this.cells.push(
      `<mxCell id="${this.id()}" value="${esc(name)}" style="rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#333333;fontSize=11;align=left;verticalAlign=top;spacing=8;connectable=0;" vertex="1" parent="1">${geo(b)}</mxCell>`,
    );
  }

  element(e: C4Element, b: Rect, colours: { fill: string; stroke: string; ink: string }): void {
    const id = this.id();
    this.ids.set(e.id, id);
    const m = e.metadata;
    const extra = [
      m.path === undefined ? "" : ` c4Path="${esc(m.path)}"`,
      m.colour === undefined ? "" : ` c4Colour="${esc(m.colour)}"`,
      m.group === undefined ? "" : ` c4Group="${esc(m.group)}"`,
    ].join("");
    this.cells.push(
      `<object id="${id}" label="&lt;b&gt;%c4Name%&lt;/b&gt;&lt;div&gt;[%c4Type%%c4TechnologySep%%c4Technology%]&lt;/div&gt;&lt;div style=&quot;font-size:11px&quot;&gt;%c4Description%&lt;/div&gt;" placeholders="1" c4Type="${C4TYPE[e.kind]}" c4Name="${esc(e.title)}" c4Technology="${esc(e.technology)}" c4TechnologySep="${e.technology === "" ? "" : ": "}" c4Description="${esc(e.summary)}" c4Id="${esc(e.id)}" c4Tags="${esc(e.tags.join(" "))}"${extra}><mxCell style="rounded=1;whiteSpace=wrap;html=1;arcSize=${e.kind === "person" ? 26 : 10};fillColor=${colours.fill};strokeColor=${colours.stroke};fontColor=${colours.ink};metaEdit=1;resizable=1;" vertex="1" parent="1">${geo(b)}</mxCell></object>`,
    );
  }

  relation(
    from: string,
    to: string,
    title: string,
    bends: readonly { x: number; y: number }[],
    colour: string,
    dashed: boolean,
  ): void {
    this.cells.push(
      `<object id="${this.id()}" label="%c4Description%" placeholders="1" c4Type="Relationship" c4Description="${esc(title)}"><mxCell style="edgeStyle=orthogonalEdgeStyle;rounded=1;endArrow=blockThin;endFill=1;html=1;fontSize=10;strokeColor=${colour};fontColor=${colour};strokeWidth=2.4;${dashed ? "dashed=1;" : ""}metaEdit=1;" edge="1" parent="1" source="${this.ids.get(from) ?? ""}" target="${this.ids.get(to) ?? ""}"><mxGeometry relative="1" as="geometry"><Array as="points">${bends.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array></mxGeometry></mxCell></object>`,
    );
  }

  /** The view's draw.io file, for the root element's `content` attribute. */
  file(name: string): string {
    return `<mxfile host="qsm-c4"><diagram name="${esc(name)}" id="${esc(name)}"><mxGraphModel grid="1" gridSize="10" page="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${this.cells.join("")}</root></mxGraphModel></diagram></mxfile>`;
  }
}
