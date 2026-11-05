// The surface of the untyped npm packages this plugin calls, written once, so the code past these
// imports reads typed values. Each declaration is only what the plugin uses.

declare module "bpmn-moddle" {
  export interface Moddle {
    fromXML(xml: string): Promise<{ rootElement: object; warnings: { message: string }[] }>;
    toXML(element: object, options?: { format?: boolean }): Promise<{ xml: string }>;
  }
  export const BpmnModdle: new () => Moddle;
}

declare module "bpmnlint/lib/linter" {
  export interface LintReport {
    id?: string;
    message: string;
    category: string;
  }
  export interface BpmnLinter {
    lint(definitions: object): Promise<Record<string, LintReport[]>>;
  }
  const Linter: new (options: { config: unknown; resolver: unknown }) => BpmnLinter;
  export default Linter;
}

declare module "bpmnlint/lib/resolver/static-resolver" {
  const StaticResolver: new (cache: Record<string, unknown>) => object;
  export default StaticResolver;
}

declare module "bpmnlint/config/recommended" {
  const config: { rules: Record<string, string> };
  export default config;
}

declare module "bpmnlint/rules/*" {
  const factory: unknown;
  export default factory;
}

declare module "bpmn-auto-layout" {
  export function layoutProcess(xml: string): Promise<string>;
}

declare module "jsdom" {
  export interface Dom {
    readonly window: Window & typeof globalThis;
  }
  export const JSDOM: new (html: string, options?: { pretendToBeVisual?: boolean }) => Dom;
}

declare module "*.html" {
  const text: string;
  export default text;
}

declare module "*.css" {
  const text: string;
  export default text;
}
