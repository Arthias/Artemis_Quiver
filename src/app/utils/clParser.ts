import type { CLContent } from "../../types/cl";

const CLOSING_KEYWORDS = [
  "sincerely", "best regards", "regards", "yours truly",
  "yours faithfully", "warm regards", "kind regards",
  "respectfully", "cordially",
];

function findLineStartingWith(lines: string[], prefix: string): number {
  return lines.findIndex(l => l.toLowerCase().startsWith(prefix.toLowerCase()));
}

function findClosingBlock(lines: string[], searchStart: number): number {
  for (let i = searchStart; i < lines.length; i++) {
    const raw = lines[i].trim();
    const lower = raw.toLowerCase().replace(/[,;:.!]+$/, "");
    if (CLOSING_KEYWORDS.some(k => lower === k)) {
      return i;
    }
  }
  return -1;
}

function isDateLine(s: string): boolean {
  return /^[A-Z][a-z]+ \d{1,2},? \d{4}$/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s);
}

function extractSubject(lines: string[], salutationIdx: number): string {
  for (let i = salutationIdx - 1; i >= 0; i--) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (/^re:|^ref:|^subject:/i.test(line)) {
      return line.replace(/^(re|ref|subject):\s*/i, "").trim();
    }
    break;
  }
  return "";
}

function extractRecipientInfo(lines: string[], salutationIdx: number): { recipientName: string; companyName: string } {
  let recipientName = "";
  let companyName = "";
  for (let i = 1; i < salutationIdx; i++) {
    const line = lines[i]?.trim();
    if (!line || isDateLine(line)) continue;
    if (!recipientName) {
      recipientName = line;
    } else if (!companyName) {
      companyName = line;
    }
  }
  return { recipientName, companyName };
}

function parseBodyParagraphs(lines: string[], start: number, end: number): string[] {
  const paragraphs: string[] = [];
  let currentPara: string[] = [];
  for (const line of lines.slice(start, end)) {
    if (!line.trim()) {
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join(" "));
        currentPara = [];
      }
    } else {
      currentPara.push(line);
    }
  }
  if (currentPara.length > 0) paragraphs.push(currentPara.join(" "));
  return paragraphs;
}

function extractSenderFromHeader(blocks: string[], senderName?: string): { senderName: string; date: string } {
  const firstBlock = blocks[0];
  if (!firstBlock || /^dear\b/i.test(firstBlock)) return { senderName: senderName ?? "", date: "" };

  let name = senderName ?? "";
  let date = "";
  const headerLines = firstBlock.split("\n").map(l => l.trim()).filter(Boolean);
  if (headerLines.length > 0 && !name) name = headerLines[0] ?? "";
  if (headerLines.length > 1) {
    const second = headerLines[1]!;
    if (isDateLine(second)) date = second;
  }
  return { senderName: name, date };
}

function extractSenderAfterClosing(allLines: string[], closingIdx: number): string | undefined {
  for (let i = closingIdx + 1; i < allLines.length; i++) {
    const next = allLines[i]?.trim();
    if (next) return next;
  }
  return undefined;
}

export function parsePlainTextToCLContent(text: string, senderName?: string): CLContent {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const allLines = text.split("\n").map(l => l.trim());
  const salutationIdx = findLineStartingWith(allLines, "dear");

  let salutation = "";
  let bodyParagraphs: string[] = [];
  let closing = "";
  let closingIdx = -1;

  if (salutationIdx < 0) {
    bodyParagraphs = blocks.length ? blocks : [""];
    salutation = "Dear Hiring Manager,";
    closing = "Sincerely,";
  } else {
    salutation = allLines[salutationIdx] ?? "";
    closingIdx = findClosingBlock(allLines, salutationIdx + 1);

    if (closingIdx >= 0) {
      closing = (allLines[closingIdx] ?? "").replace(/[,;:.!]+$/, "");
      bodyParagraphs = parseBodyParagraphs(allLines, salutationIdx + 1, closingIdx);
    } else {
      bodyParagraphs = parseBodyParagraphs(allLines, salutationIdx + 1, allLines.length);
      if (!bodyParagraphs.length) bodyParagraphs = [""];
      closing = "Sincerely,";
    }
  }

  const subject = salutationIdx >= 0 ? extractSubject(allLines, salutationIdx) : "";
  const { recipientName, companyName } = salutationIdx >= 0 ? extractRecipientInfo(allLines, salutationIdx) : { recipientName: "", companyName: "" };

  const sender = extractSenderFromHeader(blocks, senderName);
  if (!senderName && closingIdx >= 0) {
    const after = extractSenderAfterClosing(allLines, closingIdx);
    if (after) sender.senderName = after;
  }

  if (!bodyParagraphs.length) bodyParagraphs = [""];

  return {
    senderName: sender.senderName || "Your Name",
    subject: subject || undefined,
    date: sender.date || undefined,
    recipientName: recipientName || undefined,
    companyName: companyName || undefined,
    salutation,
    bodyParagraphs,
    closing,
  };
}
