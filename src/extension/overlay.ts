/// <reference types="chrome" />
// NOTE: Content scripts in MV3 cannot use ES module imports.
// These helper functions are inlined here intentionally.
// If you add imports here, the build will produce dynamic import()
// statements that Chrome's isolated world rejects.

const _ot: Record<string, string> = {
  "overlay.matchScore": "Match Score",
  "overlay.scoreFailed": "Score Failed",
  "overlay.analyzing": "Analyzing...",
  "overlay.notConfigured": "Not Configured",
  "overlay.jobPosting": "Job posting",
  "overlay.clickToExpand": "Click to expand",
  "overlay.close": "Close",
  "overlay.noFingerprint": "No profile fingerprint.",
  "overlay.noFingerprintDesc": "Open the Artemis Quiver popup and generate a fingerprint to get AI match scores.",
  "overlay.scoringFailed": "Match scoring failed.",
  "overlay.nanUnavailable": "Gemini Nano is unavailable. Switch the fallback mode in the extension popup to enable AI scoring.",
  "overlay.checkEndpoint": "Check that your LLM endpoint is configured in settings and the server is running.",
  "overlay.retry": "Retry",
  "overlay.analyzingMatch": "Analyzing job match\u2026",
  "overlay.breakdown": "Breakdown",
  "overlay.skills": "Skills",
  "overlay.exp": "Exp.",
  "overlay.company": "Company:",
  "overlay.salary": "Salary:",
  "overlay.importing": "Importing...",
  "overlay.importToArtemis": "Import to Artemis",
  "overlay.openInArtemis": "Open in Artemis \u2192",
  "overlay.imported": "\u2713 Imported",
  "overlay.testing": "Testing...",
  "overlay.testChromeAI": "Test Chrome AI",
  "overlay.bridgeNotLoaded": "\u2717 Bridge not loaded",
  "overlay.nanoAvailable": "\u2713 Available",
  "overlay.nanoErrorTimedOut": "\u2717 Error (timed out)",
};
function ot(key: string): string { return _ot[key] || key; }

const STORAGE_KEY = "artemis:overlayConfig";

function parseSiteEntry(entry: string): { domain: string; pathPattern?: string } {
  let cleaned = entry.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/\/+$/, "");
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx === -1) return { domain: cleaned };
  return { domain: cleaned.slice(0, slashIdx), pathPattern: cleaned.slice(slashIdx) };
}

function domainMatches(entryDomain: string, hostname: string): boolean {
  return hostname === entryDomain || hostname.endsWith("." + entryDomain);
}

// Mirrors DEFAULT_JOB_SITES in job-sites.ts (content scripts can't import).
const KNOWN_BOARDS = [
  "linkedin.com", "indeed.com", "glassdoor.com", "monster.com",
  "ziprecruiter.com", "careerbuilder.com", "dice.com", "simplyhired.com",
  "upwork.com", "freelancer.com", "stackoverflow.com", "weworkremotely.com", "remoteok.com",
];

// Same rule as normalizeSiteEntry(): collapse legacy page-pins on known job
// boards to the domain so the overlay shows up where users actually are.
function normalizeEntry(entry: string): string {
  const parsed = parseSiteEntry(entry);
  if (!parsed.pathPattern || parsed.pathPattern.endsWith("*")) return entry;
  if (KNOWN_BOARDS.some((site) => domainMatches(site, parsed.domain))) return parsed.domain;
  return entry;
}

function matchJobSite(url: string, entries: string[]): boolean {
  let hostname: string;
  let pathname: string;
  try {
    const u = new URL(url);
    hostname = u.hostname;
    pathname = u.pathname;
  } catch { return false; }
  for (const entry of entries) {
    const parsed = parseSiteEntry(entry);
    if (!domainMatches(parsed.domain, hostname)) continue;
    if (parsed.pathPattern) {
      const prefix = parsed.pathPattern.endsWith("*") ? parsed.pathPattern.slice(0, -1) : parsed.pathPattern;
      if (!pathname.startsWith(prefix)) continue;
    }
    return true;
  }
  return false;
}

interface OverlayConfig {
  enabled: boolean;
  jobSites: string[];
  fallbackMode: "basic" | "secondary" | "primary";
  fingerprint?: string;
  lastFingerprintUpdate?: string;
}

async function loadConfig(): Promise<OverlayConfig> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const cfg = (result[STORAGE_KEY] as OverlayConfig) || { enabled: true, jobSites: [], fallbackMode: "basic" };
    if (Array.isArray(cfg.jobSites)) cfg.jobSites = cfg.jobSites.map(normalizeEntry);
    return cfg;
  } catch (e) {
    console.error("[Artemis] Failed to load config:", e);
    return { enabled: true, jobSites: [], fallbackMode: "basic" };
  }
}

// Uncaught error relay
function logErrorToApp(message: string, stack?: string, code?: string, metadata?: string) {
  try {
    chrome.runtime.sendMessage({
      type: "ARTEMIS_LOG_ERROR",
      payload: { message, stack, source: "overlay", timestamp: new Date().toISOString(), code, metadata },
    }).catch(() => {});
  } catch {}
}

const origConsoleError = console.error.bind(console);
console.error = (...args: any[]) => {
  origConsoleError(...args);
  const msg = args.map((a) => (typeof a === "object" ? (a instanceof Error ? a.message : JSON.stringify(a)) : String(a))).join(" ");
  const stack = args.find((a) => a instanceof Error)?.stack;
  logErrorToApp(msg, stack);
};

// Module state
// hostEl is the light-DOM anchor appended to document.body — the only overlay
// node a host page's own CSS can ever touch, so it is positioned purely via
// inline styles set through the DOM API (see injectOverlay). overlayEl is the
// actual overlay UI root that lives inside its shadow tree (styled via
// adoptedStyleSheets, fully isolated from the host page's CSS and unaffected
// by the page's style-src CSP).
let hostEl: HTMLDivElement | null = null;
let overlayEl: HTMLDivElement | null = null;
let isExpanded = false;
let hasFingerprint = false;
let matchScore: number | null = null;
let matchReason = "";
let scoringFailed = false;
let isImporting = false;
let isImported = false;
let extracted: { title: string; company: string; salary: string } = { title: "", company: "", salary: "" };
let nanoTestResult: string | null = null;
let nanoTesting = false;
let currentFallbackMode: string = "basic";
let storageInit = false;

function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function extractJobData(text: string): { title: string; company: string; salary: string } {
  let title = "";
  let company = "";
  let salary = "";

  // Attempt DOM-based extraction first (more accurate)
  const titleEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__title");
  if (titleEl) {
    title = titleEl.innerText?.trim() || "";
    const companyEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__company-name");
    if (companyEl) company = companyEl.innerText?.trim() || "";
  } else {
    const h1 = document.querySelector<HTMLElement>("h1");
    if (h1) title = h1.innerText?.trim() || "";
  }
  if (!title) title = document.title;

  // Salary from text
  const salaryMatch = text.match(/(\$\d[\d,]*\s*(?:-\s*\$?\d[\d,]*)?\s*(?:\/yr|\/year|per year|k)?)/i);
  if (salaryMatch) salary = salaryMatch[1]!.trim();
  return { title, company, salary };
}

function statusLabel(): string {
  if (matchScore !== null) return ot("overlay.matchScore");
  if (scoringFailed) return ot("overlay.scoreFailed");
  if (hasFingerprint) return ot("overlay.analyzing");
  return ot("overlay.notConfigured");
}

function ringHTML(): string {
  const r = 18;
  const circ = 2 * Math.PI * r;
  if (scoringFailed) {
    return `<div class="ao-ring-wrap"><svg viewBox="0 0 44 44" width="44" height="44"><circle cx="22" cy="22" r="${r}" fill="none" stroke="#dc2626" stroke-width="4" opacity=".5"/><text x="22" y="22" text-anchor="middle" dominant-baseline="central" fill="#dc2626" font-size="16" font-weight="700">!</text></svg></div>`;
  }
  if (!hasFingerprint) {
    return `<div class="ao-ring-wrap"><svg viewBox="0 0 44 44" width="44" height="44"><circle cx="22" cy="22" r="${r}" fill="none" stroke="#475569" stroke-width="4"/><text x="22" y="22" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-size="16" font-weight="700">?</text></svg></div>`;
  }
  if (matchScore === null) {
    return `<div class="ao-ring-wrap"><svg viewBox="0 0 44 44" width="44" height="44" class="ao-spinner"><circle cx="22" cy="22" r="${r}" fill="none" stroke="#334155" stroke-width="4"/><circle cx="22" cy="22" r="${r}" fill="none" stroke="#eab308" stroke-width="4" stroke-dasharray="50 63" stroke-linecap="round"/></svg><div class="ao-bullseye"></div></div>`;
  }
  const color = matchScore >= 70 ? "#059669" : matchScore >= 40 ? "#d97706" : "#dc2626";
  const offset = circ * (1 - matchScore / 100);
  return `<div class="ao-ring-wrap"><svg viewBox="0 0 44 44" width="44" height="44"><circle cx="22" cy="22" r="${r}" fill="none" stroke="#334155" stroke-width="4"/><circle cx="22" cy="22" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 22 22)" style="transition:stroke-dashoffset 1s ease"/><text x="22" y="22" text-anchor="middle" dominant-baseline="central" fill="#f1f5f9" font-size="14" font-weight="700">${matchScore}%</text></svg></div>`;
}

function render() {
  const el = overlayEl;
  if (!el) return;

  el.className = isExpanded ? "ao-expanded" : "";
  el.innerHTML = `
    <div class="ao-header" data-drag>
      ${ringHTML()}
      <div class="ao-header-info">
        <div class="ao-label">${statusLabel()}</div>
        <div class="ao-value">${esc(extracted.title || (isExpanded ? ot("overlay.jobPosting") : ot("overlay.clickToExpand")))}</div>
      </div>
      <button class="ao-close" data-action="close" title="${ot("overlay.close")}">✕</button>
      <span class="ao-expand-hint">${isExpanded ? "▲" : "▼"}</span>
    </div>
    ${isExpanded ? `
      <div class="ao-body">
        ${!hasFingerprint ? `
        <div class="ao-body-section">
          <div class="ao-info-box">
            <strong>${ot("overlay.noFingerprint")}</strong><br>
            ${ot("overlay.noFingerprintDesc")}
          </div>
        </div>
        ` : scoringFailed ? `
        <div class="ao-body-section">
          <div class="ao-info-box" style="border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#ef4444">
            <strong>${ot("overlay.scoringFailed")}</strong> ${currentFallbackMode === "basic" ? ot("overlay.nanUnavailable") : ot("overlay.checkEndpoint")}
            <br><button class="ao-sec-btn" data-action="retry" style="margin-top:8px;width:auto;display:inline-block;padding:4px 12px;font-size:12px">${ot("overlay.retry")}</button>
          </div>
        </div>
        ` : matchScore === null ? `
        <div class="ao-body-section">
          <div class="ao-info-box" style="border-color:rgba(234,179,8,0.3);background:rgba(234,179,8,0.08);color:#eab308">
            ${ot("overlay.analyzingMatch")}
          </div>
        </div>
        ` : `
        <div class="ao-body-section">
          <h4>${ot("overlay.breakdown")}</h4>
          <div class="ao-breakdown-row">
            <span style="width:60px">${ot("overlay.skills")}</span>
            <div class="ao-bar"><div class="ao-bar-fill" style="width:${Math.min(matchScore + 10, 100)}%;background:#3b82f6"></div></div>
          </div>
          <div class="ao-breakdown-row">
            <span style="width:60px">${ot("overlay.exp")}</span>
            <div class="ao-bar"><div class="ao-bar-fill" style="width:${Math.min(matchScore, 100)}%;background:#8b5cf6"></div></div>
          </div>
        </div>
        `}
        ${extracted.company ? `<div class="ao-extract-item"><strong>${ot("overlay.company")}</strong> ${esc(extracted.company)}</div>` : ""}
        ${extracted.salary ? `<div class="ao-extract-item"><strong>${ot("overlay.salary")}</strong> ${esc(extracted.salary)}</div>` : ""}
        <div class="ao-action-row">
          ${!isImported ? `<button class="ao-sec-btn" data-action="import">${isImporting ? ot("overlay.importing") : ot("overlay.importToArtemis")}</button>` : ""}
          ${isImported ? `<button class="ao-sec-btn" data-action="open-app">${ot("overlay.openInArtemis")}</button>` : ""}
        </div>
        ${isImported ? `<div style="text-align:center;margin-top:6px;font-size:12px;color:#059669">${ot("overlay.imported")}</div>` : ""}
        <div class="ao-body-section">
          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
            ${nanoTestResult !== null ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${esc(nanoTestResult)}</div>` : ""}
            <button class="ao-sec-btn" data-action="test-nano" style="width:auto;display:inline-block;padding:3px 10px;font-size:11px">${nanoTesting ? ot("overlay.testing") : ot("overlay.testChromeAI")}</button>
          </div>
        </div>
      </div>
    ` : ""}
  `;
}

function injectNanoBridge() {
  if (document.getElementById("artemis-nano-bridge")) return;
  const script = document.createElement("script");
  script.id = "artemis-nano-bridge";
  script.src = chrome.runtime.getURL("nano-inject.js");
  document.documentElement.appendChild(script);
  script.addEventListener("load", () => script.remove());
}

// Headless now — the side panel replaced the floating badge as the on-page
// surface (2026-08-21), so this no longer creates any visible DOM. It still
// runs the full extraction + scoring pipeline on "Always quick analyze this
// site" pages so a fresh score reaches the panel automatically via the
// ARTEMIS_QUICK_SCORE_UPDATE relay at the end of computeMatch() — that relay,
// and the settle-detection in initUrlWatch that triggers this function, are
// the only reasons this file still runs as a content script at all. render()
// calls inside computeMatch() are harmless no-ops (see the `if (!el) return`
// guard) since overlayEl is never assigned anymore.
let isProcessing = false;

async function injectOverlay(config: OverlayConfig) {
  if (isProcessing) return;
  isProcessing = true;
  try {
    injectNanoBridge();

    hasFingerprint = !!config.fingerprint;
    currentFallbackMode = config.fallbackMode;
    matchScore = null;
    scoringFailed = false;

    const pageText = document.body.innerText;
    const cleaned = await cleanPageText();
    extracted = {
      title: cleaned.title || extractJobData(pageText).title,
      company: extractJobData(pageText).company,
      salary: extractJobData(pageText).salary,
    };

    if (hasFingerprint) {
      await computeMatch(cleaned.text, config);
    }
  } finally {
    isProcessing = false;
  }

  // React to config changes (e.g. fingerprint generated in popup) — no
  // overlayEl guard anymore since it is never created;
  // this is what keeps the panel's live relay current after the fingerprint
  // changes, not just on the initial navigation.
  if (!storageInit) {
    storageInit = true;
    chrome.storage.onChanged.addListener((changes) => {
      const change = changes[STORAGE_KEY];
      if (!change) return;
      const newConfig = (change.newValue || change.oldValue) as OverlayConfig | undefined;
      if (!newConfig) return;
      const hadFingerprint = hasFingerprint;
      hasFingerprint = !!newConfig.fingerprint;
      currentFallbackMode = newConfig.fallbackMode;
      // Fingerprint just appeared (didn't have one, now does) — recompute so
      // the panel gets a real score instead of staying on "no fingerprint."
      if (hasFingerprint && !hadFingerprint) {
        scoringFailed = false;
        void cleanPageText().then((c) => computeMatch(c.text, newConfig));
      }
    });
  }
}

async function cleanPageText(): Promise<{ title: string; text: string; url: string }> {
  const isLinkedIn = location.hostname.includes("linkedin.com");

  if (isLinkedIn) {
    // Wait for LinkedIn's SPA to render the job DESCRIPTION section. The title
    // card appears first, so gating on the title alone captured innerText while
    // "About the job" was still loading — the quickscan then sent Nano a page
    // without the description and the model answered "no job posting was
    // provided" (import worked because it runs after the page settled).
    const startMarkers = ["about the job", "about this role", "job description"];
    const hasDescription = (): boolean => {
      const t = document.body.innerText;
      const lower = t.toLowerCase();
      let idx = -1;
      for (const m of startMarkers) {
        const i = lower.indexOf(m);
        if (i !== -1 && i > idx) idx = i;
      }
      return idx !== -1 && t.slice(idx).length > 120;
    };
    if (!hasDescription()) {
      await new Promise<void>((resolve) => {
        let elapsed = 0;
        const maxWait = 8000;
        const interval = setInterval(() => {
          elapsed += 500;
          if (hasDescription() || elapsed >= maxWait) {
            clearInterval(interval);
            resolve();
          }
        }, 500);
      });
    }

    let text = document.body.innerText;
    const endMarkers = ["job search faster with premium", "about the company", "show more", "people also viewed"];
    const lines = text.split("\n").map((l) => l.trim());
    let startIdx = 0;
    let endIdx = lines.length;
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i]!.toLowerCase();
      if (startMarkers.some((m) => lower.startsWith(m))) { startIdx = i; break; }
    }
    for (let i = startIdx + 1; i < lines.length; i++) {
      const lower = lines[i]!.toLowerCase();
      if (endMarkers.some((m) => lower.startsWith(m))) { endIdx = i; break; }
    }
    text = lines.slice(startIdx, endIdx).join("\n").trim();
    const titleEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__title, .job-details-jobs-unified-top-card__job-title, h1");
    const title = titleEl?.innerText?.trim() || document.title;
    return { title, text: `${title}\n\n${text}`, url: location.href };
  }

  return { title: document.title, text: document.body.innerText, url: location.href };
}

async function computeMatch(pageText: string, config: OverlayConfig) {
  console.log("[Artemis] computeMatch start, hasFingerprint:", !!config.fingerprint, "fallbackMode:", config.fallbackMode, "text.length:", pageText.length);
  scoringFailed = false;
  matchScore = null;
  matchReason = "";
  nanoTestResult = null;
  render();

  try {
    console.log("[Artemis] computeMatch: calling ensureNano...");
    const nanoOk = await ensureNano();
    console.log("[Artemis] computeMatch: ensureNano result:", nanoOk);
    if (nanoOk) {
      nanoTestResult = null;
      render();
      console.log("[Artemis] computeMatch: extracting title via Nano...");
      try {
        const nanoTitle = String(await postMessageToNano("nano-title", { text: pageText }, undefined, 15000));
        if (nanoTitle && nanoTitle.length < 200) {
          extracted.title = nanoTitle;
          render();
        }
      } catch {}
      console.log("[Artemis] computeMatch: calling nano-score...");
      const result = String(await postMessageToNano("nano-score", { text: pageText, fp: config.fingerprint! }));
      console.log("[Artemis] computeMatch: nano-score raw result:", JSON.stringify(result));
      ({ score: matchScore, reason: matchReason } = parseScore(result));
      console.log("[Artemis] computeMatch: parsed score:", matchScore);
    } else if (config.fallbackMode !== "basic") {
      console.log("[Artemis] computeMatch: Nano unavailable, trying remoteMatch with fallback:", config.fallbackMode);
      const result = await remoteMatch(pageText, config.fingerprint!, config);
      console.log("[Artemis] computeMatch: remoteMatch raw result:", JSON.stringify(result));
      ({ score: matchScore, reason: matchReason } = parseScore(result));
      console.log("[Artemis] computeMatch: parsed score:", matchScore);
    } else {
      console.log("[Artemis] computeMatch: Nano unavailable, fallbackMode is basic — no scoring");
    }
  } catch (err) {
    console.error("[Artemis] computeMatch: exception:", err);
    matchScore = null;
  }

  if (matchScore === null && hasFingerprint) {
    console.log("[Artemis] computeMatch: score is null, marking scoringFailed");
    scoringFailed = true;
  }
  nanoTestResult = null;
  render();
  console.log("[Artemis] computeMatch: done, matchScore:", matchScore, "scoringFailed:", scoringFailed);

  // Relay the freshly computed score to the background so it's cached and any
  // open side panel gets a live update — this is the "Always quick analyze
  // this site" path: the panel never has to poll or re-extract, it just rides
  // the same settle-detection (initUrlWatch) that already drives this overlay.
  // Auto-triggering never goes beyond this quick score (see background.ts).
  if (matchScore !== null) {
    try {
      chrome.runtime.sendMessage({
        type: "ARTEMIS_QUICK_SCORE_UPDATE",
        payload: {
          url: location.href,
          title: extracted.title,
          company: extracted.company,
          salary: extracted.salary,
          score: matchScore,
          reason: matchReason,
        },
      }).catch(() => {});
    } catch {}
  }
}

async function ensureNano(): Promise<boolean> {
  console.log("[Artemis] ensureNano: checking nano bridge...");
  try {
    await postMessageToNano("nano-ping", undefined, undefined, 3000);
    console.log("[Artemis] ensureNano: bridge alive");
  } catch {
    console.log("[Artemis] ensureNano: bridge not responding, re-injecting...");
    injectNanoBridge();
    await new Promise((r) => setTimeout(r, 500));
    try {
      await postMessageToNano("nano-ping", undefined, undefined, 3000);
      console.log("[Artemis] ensureNano: bridge alive after re-inject");
    } catch {
      console.log("[Artemis] ensureNano: bridge still dead after re-inject");
      return false;
    }
  }
  console.log("[Artemis] ensureNano: calling nano-ensure...");
  try {
    const result = await postMessageToNano("nano-ensure", undefined, (progress) => {
      console.log("[Artemis] ensureNano: progress:", progress);
      nanoTestResult = progress;
      render();
    }, 300000);
    console.log("[Artemis] ensureNano: nano-ensure result:", result);
    return !!result;
  } catch (err) {
    console.error("[Artemis] ensureNano: nano-ensure exception:", err);
    return false;
  }
}

function postMessageToNano(method: string, args?: any, onProgress?: (msg: string) => void, timeoutMs = 120000): Promise<any> {
  console.log("[Artemis] postMessageToNano: sending", method, "timeout:", timeoutMs);
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== "artemis-nano") return;
      if (event.data.requestId !== requestId) return;
      if (event.data.progress) {
        console.log("[Artemis] postMessageToNano: progress for", method, ":", event.data.progress);
        onProgress?.(event.data.progress);
        return;
      }
      window.removeEventListener("message", handler);
      clearTimeout(timer);
      if (event.data.error) {
        console.error("[Artemis] postMessageToNano: error for", method, ":", event.data.error);
        reject(new Error(event.data.error));
      } else {
        console.log("[Artemis] postMessageToNano: result for", method, ":", event.data.result);
        resolve(event.data.result);
      }
    };
    window.addEventListener("message", handler);
    const timer = setTimeout(() => {
      console.error("[Artemis] postMessageToNano: TIMEOUT for", method, "after", timeoutMs + "ms");
      window.removeEventListener("message", handler);
      reject(new Error("Nano timeout"));
    }, timeoutMs);
    window.postMessage({ source: "artemis-overlay", method, args, requestId }, "*");
  });
}

// background.ts's handleLLMScore already parses the LLM's JSON reply into
// {score, reason} — returned as a JSON string here so the caller can run it
// through the same parseScore() path as the Nano branch instead of having
// two separate result shapes to juggle.
async function remoteMatch(text: string, fp: string, config: OverlayConfig): Promise<string> {
  console.log("[Artemis] remoteMatch: fallback:", config.fallbackMode, "text.length:", text.length);
  const resp = await chrome.runtime.sendMessage({
    type: "ARTEMIS_LLM_SCORE",
    payload: { fingerprint: fp, jobText: text.slice(0, 8000), fallbackMode: config.fallbackMode },
  });
  console.log("[Artemis] Remote match response:", resp);
  return JSON.stringify({ score: (resp as any)?.score ?? null, reason: (resp as any)?.reason ?? "" });
}

function parseScore(raw: string): { score: number | null; reason: string } {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && "score" in parsed) {
      const n = typeof parsed.score === "number" ? parsed.score : null;
      return { score: n === null ? null : Math.max(0, Math.min(100, Math.round(n))), reason: String(parsed.reason || "").slice(0, 200) };
    }
  } catch {
    // fall through to regex — some endpoints/models ignore the JSON instruction
  }
  const m = cleaned.match(/(\d+)/);
  if (!m) return { score: null, reason: "" };
  const score = parseInt(m[1]!, 10);
  return { score: isNaN(score) ? null : Math.max(0, Math.min(100, score)), reason: "" };
}

async function init() {
  console.log("[Artemis] Overlay init on", location.hostname, "URL:", location.href);

  if (hostEl) {
    console.log("[Artemis] init: removing stale overlay");
    hostEl.remove();
    hostEl = null;
    overlayEl = null;
  }

  const config = await loadConfig();
  console.log("[Artemis] init: config loaded:", JSON.stringify({ ...config, fingerprint: config.fingerprint ? "(present, " + config.fingerprint.length + " chars)" : undefined }));
  if (!config.enabled) {
    console.log("[Artemis] Overlay disabled in config");
    return;
  }
  if (!matchJobSite(location.href, config.jobSites)) {
    console.log("[Artemis] Not a known job site:", location.hostname);
    return;
  }
  void injectOverlay(config);
}

// ── SPA URL change detection (LinkedIn navigation, etc.) ──
let urlWatchInit = false;

function initUrlWatch() {
  if (urlWatchInit) return;
  urlWatchInit = true;

  let lastUrl = location.href;
  let contentTimer: ReturnType<typeof setTimeout> | null = null;

  function onUrlChange() {
    if (contentTimer) return; // already waiting
    const now = location.href;
    if (now === lastUrl) return;
    const oldText = document.body.innerText;
    console.log("[Artemis] URL changed:", lastUrl, "->", now);
    lastUrl = now;
    contentTimer = setTimeout(async () => {
      contentTimer = null;
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (document.body.innerText !== oldText) break;
      }
      void init();
    }, 500);
  }

  // Monkey-patch pushState/replaceState for frameworks that use standard API
  const origPushState = history.pushState.bind(history);
  history.pushState = (data: any, title: string, url?: string | URL | null) => { origPushState(data, title, url); onUrlChange(); };
  const origReplaceState = history.replaceState.bind(history);
  history.replaceState = (data: any, title: string, url?: string | URL | null) => { origReplaceState(data, title, url); onUrlChange(); };

  // popstate for back/forward
  window.addEventListener("popstate", onUrlChange);

  // Poll every 1s as fallback (catches SPA frameworks that cache original pushState)
  setInterval(onUrlChange, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
    initUrlWatch();
  });
} else {
  void init();
  initUrlWatch();
}
