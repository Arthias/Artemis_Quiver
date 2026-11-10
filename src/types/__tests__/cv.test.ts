import { describe, it, expect } from "vitest";
import { SECTION_TYPES, emptySection, isSectionEmpty, type BodySectionType } from "../cv";

describe("isSectionEmpty", () => {
  it("treats every new section as empty", () => {
    const body = SECTION_TYPES.filter((t): t is BodySectionType => t !== "contact");
    for (const type of body) expect(isSectionEmpty(emptySection(type))).toBe(true);
  });

  it("treats blank entries as empty and real ones as content", () => {
    expect(isSectionEmpty({ type: "languages", languages: ["", "  "] })).toBe(true);
    expect(isSectionEmpty({ type: "languages", languages: ["Spanish (Native)"] })).toBe(false);
    expect(isSectionEmpty({ type: "summary", content: "  " })).toBe(true);
    expect(isSectionEmpty({ type: "skills", categories: [{ name: "Tools", items: [""] }] })).toBe(true);
    expect(isSectionEmpty({ type: "skills", categories: [{ name: "Tools", items: ["Git"] }] })).toBe(false);
    expect(isSectionEmpty({ type: "experience", experience: [{ role: "", company: "", period: "2020" }] })).toBe(true);
    expect(isSectionEmpty({ type: "education", education: [{ degree: "BSc", institution: "", period: "" }] })).toBe(false);
  });
});

describe("sectionLabel", () => {
  it("follows the CV language and falls back to English", async () => {
    const { sectionLabel } = await import("../../components/cv/EditComponents");
    expect(sectionLabel("languages", "es")).toBe("Idiomas");
    expect(sectionLabel("experience", "it-IT")).toBe("Esperienza professionale");
    expect(sectionLabel("skills", "ja")).toBe("Skills");
    expect(sectionLabel("summary")).toBe("Professional Summary");
  });
});
