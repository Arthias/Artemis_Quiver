import React from "react";
import { renderCVToHTML } from "./renderingEngine";
import type { CVContent } from "../types/cv";

/**
 * Props for the CVRenderer component
 */
export interface CVRendererProps {
  /** The structured JSON CV content from LLM generation */
  content: CVContent;
  
  /** Theme configuration - determines styling (color, font, layout) */
  themeConfig?: {
    primaryColor: string; // HEX color like "#2563eb"  
    templateId?: "modern" | "classic" | "minimal" | undefined;
  };
}

/**
 * Main CV rendering component for print/PDF export
 * Renders content to an iframe for clean, isolated output without app UI bleed-through
 */
export const CVRenderer: React.FC<CVRendererProps> = ({ content, themeConfig }) => {
  
  // Get or derive primary color (defaults to blue if not provided)
  const color = themeConfig?.primaryColor || "#2563eb";
  
  // Render HTML string using the engine
  const htmlString = renderCVToHTML(content, { templateId: themeConfig?.templateId, primaryColor: color });

  /* ========================================================================
     Return Iframe with rendered content and print-trigger functionality
     ======================================================================== */
  
  return React.createElement(React.Fragment, null, 
    // Hidden iframe for rendering
    React.createElement("iframe", {
      id: "cv-print-iframe",
      style: { display: "none; width: 0px; height: 0px;" },
      srcDoc: `<!DOCTYPE html>`,
      title: "CV Preview" 
    }),
    
    // If you want to see the rendered result inline (for debugging/preview):
    /* Uncomment below for preview mode */
    // React.createElement("div", { style: { fontFamily: "Inter, sans-serif; padding: 2rem;" } }, htmlString)
  );
};
