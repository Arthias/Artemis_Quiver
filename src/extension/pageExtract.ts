// Shared page-content extraction, injected via chrome.scripting.executeScript
// into a tab's page context (NOT run as a normal module — the function body
// is serialized and executed in isolation, so it must not close over any
// outer variable). Used by both background.ts (import/quick-analyze) and
// sidepanel.tsx (deep-analysis handoff) so all three paths get the same
// LinkedIn-aware extraction instead of three slightly different copies.
export async function extractPageContent(): Promise<{
  title: string;
  company: string;
  text: string;
  url: string;
}> {
  const isLinkedIn = location.hostname.includes("linkedin.com");

  function waitForStable(timeout: number): Promise<void> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 800);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  }

  if (isLinkedIn) {
    await waitForStable(8000);
    await new Promise((r) => setTimeout(r, 2000));

    let text = document.body.innerText;

    const startMarkers = ["about the job", "about this role", "job description"];
    const endMarkers = ["job search faster with premium", "about the company", "show more", "people also viewed"];

    const lines = text.split("\n").map((l) => l.trim());
    let startIdx = 0;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const lower = line.toLowerCase();
      if (startMarkers.some((m) => lower.startsWith(m))) {
        startIdx = i;
        break;
      }
    }

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const lower = line.toLowerCase();
      if (endMarkers.some((m) => lower.startsWith(m))) {
        endIdx = i;
        break;
      }
    }

    const bodyLines = lines.slice(startIdx, endIdx);
    text = bodyLines.join("\n").trim();

    const titleEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__title, h1");
    const title = titleEl?.innerText?.trim() || document.title;
    const companyEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__company-name");
    const company = companyEl?.innerText?.trim() || "";

    return { title, company, text: `${title}\n\n${text}`, url: location.href };
  }

  return {
    title: document.title,
    company: "",
    text: document.body.innerText,
    url: location.href,
  };
}

// Background-tab capture for Flow (Flow.tsx CaptureBlock). Same serialization
// rule as above: injected via executeScript, so no outer variables. Prefers the
// schema.org JobPosting most ATS pages publish as JSON-LD (structured, and Flow
// ranks it above DOM text); falls back to the page's main text.
export function extractJobPosting(): {
  url: string;
  jsonld_found: boolean;
  fields: Record<string, string | number | boolean>;
} {
  const toText = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.innerText || div.textContent || "").trim();
  };
  const find = (node: any): any => {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const n of node) { const hit = find(n); if (hit) return hit; }
      return null;
    }
    const type = node["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return node;
    return find(node["@graph"]);
  };
  let posting: any = null;
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try { posting = find(JSON.parse(s.textContent || "")); } catch { /* malformed block */ }
    if (posting) break;
  }

  const fields: Record<string, string | number | boolean> = {};
  if (posting) {
    if (posting.title) fields.title = String(posting.title);
    const org = posting.hiringOrganization;
    if (org) fields.company = String(typeof org === "string" ? org : org.name || "");
    if (posting.description) fields.description = toText(String(posting.description));
    const loc = [posting.jobLocation].flat()[0]?.address;
    if (loc && typeof loc === "object") {
      fields.location = [loc.addressLocality, loc.addressRegion, loc.addressCountry?.name ?? loc.addressCountry]
        .filter((x) => typeof x === "string" && x).join(", ");
      const country = loc.addressCountry?.name ?? loc.addressCountry;
      if (typeof country === "string" && country) fields.country = country;
    }
    if (posting.jobLocationType === "TELECOMMUTE") fields.is_remote = true;
    if (posting.employmentType) fields.job_type = [posting.employmentType].flat().join(", ");
    if (posting.datePosted) fields.date_posted = String(posting.datePosted);
    const pay = posting.baseSalary;
    if (pay && typeof pay === "object") {
      const v = pay.value ?? {};
      if (typeof v.minValue === "number") fields.salary_min = v.minValue;
      if (typeof v.maxValue === "number") fields.salary_max = v.maxValue;
      if (typeof v.value === "number" && fields.salary_min === undefined) fields.salary_min = v.value;
      if (pay.currency) fields.salary_currency = String(pay.currency);
      if (v.unitText) fields.salary_rate = String(v.unitText).toLowerCase();
    }
  }
  if (!fields.description || String(fields.description).length < 200) {
    const main = document.querySelector<HTMLElement>("main, article, [role=main]") ?? document.body;
    fields.description = (main.innerText || "").trim();
  }
  return { url: location.href, jsonld_found: !!posting, fields };
}
