declare module "pagedjs" {
  export interface PagedFlow {
    pages: unknown[];
    performance: number;
    size: unknown;
  }

  export class Previewer {
    constructor(options?: Record<string, unknown>);
    preview(
      content?: Node | string,
      stylesheets?: Array<string | Record<string, string>>,
      renderTo?: Element
    ): Promise<PagedFlow>;
  }
}
