import { describe, it, expect } from "vitest";
import { buildPdfFilename } from "../pdfFilename";

describe("buildPdfFilename", () => {
  it("joins parts with _ and words with -, dropping symbols", () => {
    expect(buildPdfFilename(["CV", "Jane Doe", "Forward Deployed AI Engineer"], "x"))
      .toBe("CV_Jane-Doe_Forward-Deployed-AI-Engineer");
    expect(buildPdfFilename(["CL", "José Núñez", "Lead | AI & Data / ML: Ops"], "x"))
      .toBe("CL_José-Núñez_Lead-AI-Data-ML-Ops");
  });

  it("shortens long parts at a word boundary and skips empty ones", () => {
    const title = "Principal Solutions Architect | AI & Full-Stack Engineering Leader";
    expect(buildPdfFilename(["CV", "", title], "x")).toBe("CV_Principal-Solutions-Architect-AI-Full-Stack-Engineering");
    expect(buildPdfFilename([null, undefined, " | "], "fallback")).toBe("fallback");
  });
});
