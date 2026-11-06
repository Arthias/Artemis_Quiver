import { describe, expect, it, vi } from "vitest";
import { CvImportError, extractCvText, pdfItemsToText, structureProfile, tidyText, unfence } from "../cvImport";
import { chatCompletionWithFallback } from "../llmService";
import type { LlmConfig } from "../../types/llm";

vi.mock("../llmService", () => ({ chatCompletionWithFallback: vi.fn() }));

const file = (name: string, text: string) => new File([text], name);
const long = "Abogada. Poder Judicial, 2017 - presente. Proyectista en cámara de apelaciones.";

describe("extractCvText", () => {
  it("reads text files as they are, tidied", async () => {
    expect(await extractCvText(file("cv.md", `# Ana\r\n\r\n\r\n\r\n${long}   \n`))).toBe(`# Ana\n\n${long}`);
  });

  it("names the formats it cannot read", async () => {
    await expect(extractCvText(file("cv.doc", long))).rejects.toMatchObject({ code: "legacyDoc" });
    await expect(extractCvText(file("cv.odt", long))).rejects.toMatchObject({ code: "unsupported" });
  });

  it("refuses a file with no real text, like a scanned PDF", async () => {
    await expect(extractCvText(file("cv.txt", " \n page 1 \n"))).rejects.toBeInstanceOf(CvImportError);
  });
});

describe("pdfItemsToText", () => {
  it("keeps the PDF's own order and breaks lines where it says", () => {
    expect(pdfItemsToText([{ str: "IDIOMAS", hasEOL: true }, { str: "Inglés " }, { str: "B2", hasEOL: true }, {}]))
      .toBe("IDIOMAS\nInglés B2\n");
  });
});

describe("tidyText", () => {
  it("collapses blank runs and trailing spaces", () => {
    expect(tidyText("a  \n\n\n\nb\r\nc")).toBe("a\n\nb\nc");
  });
});

describe("structureProfile", () => {
  it("sends the raw text and strips a markdown fence from the reply", async () => {
    vi.mocked(chatCompletionWithFallback).mockResolvedValueOnce("```markdown\n# Ana\n\n## Experience\n```");
    expect(await structureProfile(long, {} as LlmConfig)).toBe("# Ana\n\n## Experience");
    const [messages] = vi.mocked(chatCompletionWithFallback).mock.calls[0]!;
    expect(messages[0]!.content).toContain("Never add, infer or embellish");
    expect(messages[1]!.content).toBe(long);
  });

  it("leaves an unfenced reply alone", () => {
    expect(unfence("# Ana\n\nText")).toBe("# Ana\n\nText");
  });
});
