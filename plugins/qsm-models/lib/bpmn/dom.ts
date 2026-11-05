// A DOM for bpmn-js without a browser: jsdom, plus the few SVG and canvas calls jsdom lacks.
// diagram-js measures text on a canvas, which jsdom has not, so text is measured by an average
// glyph width; the result is the same on every machine, so a render writes the same bytes.
import { JSDOM } from "jsdom";

const GLOBALS = [
  "window",
  "document",
  "navigator",
  "Element",
  "Node",
  "SVGElement",
  "HTMLElement",
  "DOMParser",
  "XMLSerializer",
  "MutationObserver",
  "getComputedStyle",
  "requestAnimationFrame",
] as const;

interface Transform {
  str: string;
  matrix: Matrix;
  setTranslate(x: number, y: number): void;
  setScale(x: number, y: number): void;
  setRotate(a: number, x: number, y: number): void;
  setMatrix(m: Matrix): void;
}

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  translate(): Matrix;
  scale(): Matrix;
  multiply(): Matrix;
  inverse(): Matrix;
}

function matrix(): Matrix {
  const m: Matrix = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    translate: () => m,
    scale: () => m,
    multiply: () => m,
    inverse: () => m,
  };
  return m;
}

function transform(): Transform {
  return {
    str: "",
    matrix: matrix(),
    setTranslate(x, y) {
      this.str = `translate(${x},${y})`;
    },
    setScale(x, y) {
      this.str = `scale(${x},${y})`;
    },
    setRotate(a, x, y) {
      this.str = `rotate(${a},${x},${y})`;
    },
    setMatrix(m) {
      this.str = `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
    },
  };
}

/** The width of a text in px: capitals wide, thin glyphs narrow, the rest average. */
function textWidth(text: string, px: number): number {
  let em = 0;
  for (const c of text) {
    em += c >= "A" && c <= "Z" ? 0.68 : " il.,;:'|!".includes(c) ? 0.3 : 0.56;
  }
  return em * px;
}

function canvasContext(): { font: string; measureText(t: string): object } {
  return {
    font: "12px Arial",
    measureText(t: string) {
      const px = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? "12");
      return {
        width: textWidth(t, px),
        fontBoundingBoxAscent: px * 0.9,
        fontBoundingBoxDescent: px * 0.25,
      };
    },
  };
}

/** The SVG transform list diagram-js reads and writes, kept in the element's attribute. */
function transformList(el: Element): object {
  const items: Transform[] = [];
  const sync = (): void => {
    const s = items.map((i) => i.str).join(" ");
    if (s === "") {
      el.removeAttribute("transform");
    } else {
      el.setAttribute("transform", s);
    }
  };
  return {
    baseVal: {
      get numberOfItems() {
        return items.length;
      },
      clear() {
        items.length = 0;
        sync();
      },
      initialize(t: Transform) {
        items.length = 0;
        items.push(t);
        sync();
        return t;
      },
      appendItem(t: Transform) {
        items.push(t);
        sync();
        return t;
      },
      insertItemBefore(t: Transform, i: number) {
        items.splice(i, 0, t);
        sync();
        return t;
      },
      getItem: (i: number) => items[i],
      consolidate: () => items[0] ?? null,
    },
  };
}

function getBBox(this: Element): object {
  return { x: 0, y: 0, width: Math.max(10, (this.textContent ?? "").length * 6), height: 14 };
}

function getComputedTextLength(this: Element): number {
  return (this.textContent ?? "").length * 6;
}

function transformFromMatrix(m: Matrix): Transform {
  const t = transform();
  t.setMatrix(m);
  return t;
}

/** Adds a method to a prototype jsdom ships without it. */
function patch(proto: object, name: string, value: unknown): void {
  Object.defineProperty(proto, name, { value, configurable: true, writable: true });
}

let installed: HTMLElement | undefined;

/** Installs the DOM once per process and returns an empty container for a viewer. */
export function domContainer(): HTMLElement {
  if (installed !== undefined) {
    installed.replaceChildren();
    return installed;
  }
  const dom = new JSDOM('<!doctype html><div id="c"></div>', { pretendToBeVisual: true });
  const w = dom.window;
  for (const k of GLOBALS) {
    Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
  }
  patch(w.HTMLCanvasElement.prototype, "getContext", canvasContext);
  patch(w.SVGElement.prototype, "getBBox", getBBox);
  patch(w.SVGElement.prototype, "getComputedTextLength", getComputedTextLength);
  patch(w.SVGElement.prototype, "getScreenCTM", matrix);
  const lists = new WeakMap<Element, object>();
  Object.defineProperty(w.SVGElement.prototype, "transform", {
    get(this: Element) {
      const known = lists.get(this);
      if (known !== undefined) {
        return known;
      }
      const list = transformList(this);
      lists.set(this, list);
      return list;
    },
  });
  patch(globalThis, "SVGMatrix", function SVGMatrix() {});
  patch(w.SVGSVGElement.prototype, "createSVGMatrix", matrix);
  patch(w.SVGSVGElement.prototype, "createSVGTransform", transform);
  patch(w.SVGSVGElement.prototype, "createSVGTransformFromMatrix", transformFromMatrix);
  const container = w.document.querySelector<HTMLElement>("#c");
  if (container === null) {
    throw new Error("jsdom lost its container");
  }
  installed = container;
  return container;
}
