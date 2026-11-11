import { describe, expect, it, vi } from "vitest";
import { CvImportError, extractCvText, missingDetails, pdfItemsToText, structureProfile, tidyText, unfence } from "../cvImport";
import { runLlm } from "../llmService";
import type { LlmConfig } from "../../types/llm";

vi.mock("../llmService", () => ({ runLlm: vi.fn() }));

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
    vi.mocked(runLlm).mockResolvedValueOnce("```markdown\n# Ana\n\n## Experience\n```");
    expect(await structureProfile(long, {} as LlmConfig)).toBe("# Ana\n\n## Experience");
    const [, messages] = vi.mocked(runLlm).mock.calls[0]!;
    expect(messages[0]!.content).toContain("Never add, infer or embellish");
    expect(messages[1]!.content).toBe(long);
  });

  it("leaves an unfenced reply alone", () => {
    expect(unfence("# Ana\n\nText")).toBe("# Ana\n\nText");
  });
});

describe("missingDetails", () => {
  it("lists numbers, emails, links and phones the rewrite dropped", () => {
    const before = "Ana +39 371 174 3761 ana@x.it linkedin.com/in/ana. Placed 700+ engineers, 2014 to 2019, 99.9% uptime.";
    const after = "# Ana\n\n- Placed 700+ engineers, 2019, 99.9% uptime";
    expect(missingDetails(before, after)).toEqual(["+39 371 174 3761", "ana@x.it", "linkedin.com/in/ana", "2014"]);
  });

  it("is empty when everything was kept", () => {
    expect(missingDetails("Java 8, 2021.", "- Java 8\n- 2021")).toEqual([]);
  });
});
