// CV import for the master profile: a PDF, DOCX, Markdown or text file becomes
// plain text in the editor (no LLM), and "Structure with AI" can then rewrite
// that text into sections with one call. Both parsers load only when used.
import type { LlmConfig } from "../types/llm";
import { runLlm } from "./llmService";

export class CvImportError extends Error {
  constructor(public readonly code: "unsupported" | "legacyDoc" | "noText", message: string) {
    super(message);
  }
}

/** pdf.js text items → text, in the order the PDF stores them. That order
 * usually keeps a sidebar column together; sorting by position would
 * interleave the columns line by line. */
export function pdfItemsToText(items: ReadonlyArray<{ str?: string; hasEOL?: boolean }>): string {
  return items.map((i) => (i.str ?? "") + (i.hasEOL ? "\n" : "")).join("");
}

/** Trailing spaces off, runs of blank lines down to one. */
export const tidyText = (s: string) =>
  s.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

async function pdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Bundled, not a CDN: the extension's CSP blocks remote scripts.
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(pdfItemsToText(content.items as { str?: string; hasEOL?: boolean }[]));
  }
  await doc.destroy();
  return pages.join("\n\n");
}

async function docxText(data: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  return (await mammoth.extractRawText({ arrayBuffer: data })).value;
}

export const IMPORT_EXTENSIONS = ["md", "txt", "pdf", "docx"] as const;

/** The file's text. Throws CvImportError for formats it cannot read and for
 * files with no text layer (a scanned PDF). */
export async function extractCvText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  let text: string;
  if (ext === "md" || ext === "txt") text = await file.text();
  else if (ext === "pdf") text = await pdfText(await file.arrayBuffer());
  else if (ext === "docx") text = await docxText(await file.arrayBuffer());
  else if (ext === "doc") throw new CvImportError("legacyDoc", "Old .doc files cannot be read; save it as PDF or DOCX.");
  else throw new CvImportError("unsupported", `Unsupported file type: .${ext}`);
  text = tidyText(text);
  // ponytail: a scanned PDF has no text layer; OCR (tesseract.js) if real users bring those.
  if (text.replace(/\s/g, "").length < 50) throw new CvImportError("noText", "No text found in the file.");
  return text;
}

const STRUCTURE_PROMPT = `Rewrite the CV text below as a Markdown master profile.
The text was extracted from a PDF or Word file: lines may be broken mid-sentence, columns mixed together, page headers repeated.
Rules:
- This is reorganisation, not summarising. Keep every fact and every bullet: roles, employers, clients and accounts, dates, promotions, numbers, education with grades, certifications, licences and where they are valid, languages with levels, publications, talks, projects, skills, contact details, location, work authorisation, working preferences.
- Do not shorten, merge or paraphrase bullets beyond fixing broken lines. If the text has several versions of something (several summaries, several headlines), keep them all.
- Never add, infer or embellish anything that is not in the text, not even an employment type such as "freelance".
- Write everything in the same language as the CV, headings included.
- Start with the person's name as a level-1 heading. Then use these level-2 sections, in this order, leaving out any the CV has nothing for: Details (location, contact, links, work authorisation, citizenship, working preferences), Summary, Experience, Education, Credentials and licences, Skills, Languages, Projects, Publications and other activities, Other.
- Under Experience, one level-3 heading per role: role, employer, dates. Then the bullets.
- Anything that fits no section goes under Other. Drop nothing.
- Reply with the Markdown only.`;

/** Numbers, emails and links that are in `before` but not in `after`: the
 * cheap sign that the model dropped facts. It cannot see a changed fact. */
export function missingDetails(before: string, after: string): string[] {
  const re = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|it|es|dev)\/[^\s)]*|\+\d[\d ()-]{6,}\d|\d[\d.,]*\d|\d/g;
  const tokens = (s: string) => new Set((s.match(re) ?? []).map((t) => t.replace(/[.,/]+$/, "")));
  const kept = tokens(after);
  return [...tokens(before)].filter((t) => !kept.has(t));
}

/** Strips a wrapping ```markdown fence, which small models often add. */
export function unfence(s: string): string {
  const m = /^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i.exec(s);
  return (m ? m[1]! : s).trim();
}

export async function structureProfile(rawText: string, llm: LlmConfig): Promise<string> {
  const out = unfence(await runLlm(
    "profileImport",
    [{ role: "system", content: STRUCTURE_PROMPT }, { role: "user", content: rawText }],
    llm,
  ));
  if (!out) throw new Error("The model returned an empty profile.");
  return out;
}
