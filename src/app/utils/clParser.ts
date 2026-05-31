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

export function parsePlainTextToCLContent(text: string, senderName?: string): CLContent {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  if (blocks.length === 0) {
    return {
      senderName: senderName ?? "",
      salutation: "",
      bodyParagraphs: [""],
      closing: "",
    };
  }

  const allLines = text.split("\n").map(l => l.trim());
  const salutationIdx = findLineStartingWith(allLines, "dear");

  let salutation = "";
  let bodyParagraphs: string[] = [];
  let closing = "";
  let subject = "";
  let recipientName = "";
  let companyName = "";
  let date = "";

  if (salutationIdx >= 0) {
    salutation = allLines[salutationIdx];

    // Subject line is typically the line right before salutation
    for (let i = salutationIdx - 1; i >= 0; i--) {
      const line = allLines[i].trim();
      if (!line) continue;
      if (/^re:|^ref:|^subject:/i.test(line)) {
        subject = line.replace(/^(re|ref|subject):\s*/i, "").trim();
        break;
      }
      if (!recipientName && !companyName && !/^\d/.test(line) && line.length < 60) {
        if (!recipientName) recipientName = line;
      }
    }

    // Body starts after salutation
    const bodyStart = salutationIdx + 1;
    const closingIdx = findClosingBlock(allLines, bodyStart);

    if (closingIdx >= 0) {
      closing = allLines[closingIdx].replace(/[,;:.!]+$/, "");
      const bodyLines = allLines.slice(bodyStart, closingIdx);

      bodyParagraphs = [];
      let currentPara: string[] = [];
      for (const line of bodyLines) {
        if (!line.trim()) {
          if (currentPara.length > 0) {
            bodyParagraphs.push(currentPara.join(" "));
            currentPara = [];
          }
        } else {
          currentPara.push(line);
        }
      }
      if (currentPara.length > 0) {
        bodyParagraphs.push(currentPara.join(" "));
      }
    } else {
      // No closing found — treat everything after salutation as body
      const bodyLines = allLines.slice(bodyStart);
      let currentPara: string[] = [];
      for (const line of bodyLines) {
        if (!line.trim()) {
          if (currentPara.length > 0) {
            bodyParagraphs.push(currentPara.join(" "));
            currentPara = [];
          }
        } else {
          currentPara.push(line);
        }
      }
      if (currentPara.length > 0) {
        bodyParagraphs.push(currentPara.join(" "));
      }
      if (!bodyParagraphs.length) bodyParagraphs = [""];
      closing = "Sincerely,";
    }
  } else {
    // No salutation — treat entire text as body
    bodyParagraphs = blocks;
    salutation = "Dear Hiring Manager,";
    closing = "Sincerely,";
  }

  // Extract sender name from line(s) after closing (e.g. "Sincerely,\nBruno Manfredi")
  if (!senderName && closingIdx >= 0) {
    for (let i = closingIdx + 1; i < allLines.length; i++) {
      const next = allLines[i]?.trim();
      if (next) {
        senderName = next;
        break;
      }
    }
    // Also grab a title/role on the line after the name
    if (senderName) {
      for (let i = closingIdx + 1; i < allLines.length; i++) {
        if (allLines[i]?.trim() === senderName) continue;
        if (allLines[i]?.trim()) {
          // Keep it as senderName only, title isn't in the schema for now
          break;
        }
      }
    }
  }

  // Extract sender info from first block (skip if it starts with salutation)
  const firstBlockIsSalutation = blocks[0] && /^dear\b/i.test(blocks[0]);
  if (blocks[0] && !firstBlockIsSalutation) {
    const headerLines = blocks[0].split("\n").map(l => l.trim()).filter(Boolean);
    if (headerLines.length > 0) {
      if (!senderName) senderName = headerLines[0];
    }
    if (headerLines.length > 1) {
      const second = headerLines[1];
      if (/^[A-Z][a-z]+ \d{1,2},? \d{4}$/.test(second) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(second)) {
        date = second;
      }
    }
  }

  // Extract company from recipient block (between header and salutation)
  if (salutationIdx > 0) {
    for (let i = 1; i < salutationIdx; i++) {
      const line = allLines[i]?.trim();
      if (!line || /^[A-Z][a-z]+ \d{1,2},? \d{4}$/.test(line) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(line)) continue;
      if (!recipientName) {
        recipientName = line;
      } else if (!companyName) {
        companyName = line;
      }
    }
  }

  if (!bodyParagraphs.length) bodyParagraphs = [""];

  return {
    senderName: senderName || "Your Name",
    subject: subject || undefined,
    date: date || undefined,
    recipientName: recipientName || undefined,
    companyName: companyName || undefined,
    salutation,
    bodyParagraphs,
    closing,
  };
}
