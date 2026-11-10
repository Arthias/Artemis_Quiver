declare module "pagedjs" {
  export interface PagedFlow {
    pages: unknown[];
    performance: number;
    size: unknown;
  }

  export class Previewer {
    constructor(options?: Record<string, unknown>);
    /** Owns the <style> tags Paged.js injects into <head>; destroy() removes them. */
    polisher: { destroy(): void };
    chunker: { removePages(fromIndex?: number): void };
    preview(
      content?: Node | string,
      stylesheets?: Array<string | Record<string, string>>,
      renderTo?: Element
    ): Promise<PagedFlow>;
  }
}
