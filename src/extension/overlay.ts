/// <reference types="chrome" />

const STORAGE_KEY = "artemis:overlayConfig";
const POSITION_KEY = "artemis:overlayPosition";

interface OverlayConfig {
  enabled: boolean;
  jobSites: string[];
  fallbackMode: "basic" | "secondary" | "primary";
  fingerprint?: string;
  lastFingerprintUpdate?: string;
}

interface OverlayPosition {
  x: number;
  y: number;
}

const DEFAULT_SITES = [
  "linkedin.com", "indeed.com", "glassdoor.com", "monster.com",
  "ziprecruiter.com", "careerbuilder.com", "dice.com", "simplyhired.com",
  "upwork.com", "freelancer.com", "stackoverflow.com", "weworkremotely.com", "remoteok.com",
];

function isKnownJobSite(hostname: string, custom: string[]): boolean {
  const all = [...DEFAULT_SITES, ...custom.map((s) => s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase())];
  return all.some((s) => hostname === s || hostname.endsWith("." + s));
}

async function loadConfig(): Promise<OverlayConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as OverlayConfig) || { enabled: true, jobSites: [], fallbackMode: "basic" };
}

async function loadPosition(): Promise<OverlayPosition> {
  const result = await chrome.storage.local.get(POSITION_KEY);
  return (result[POSITION_KEY] as OverlayPosition) || { x: 20, y: 20 };
}

async function savePosition(pos: OverlayPosition): Promise<void> {
  await chrome.storage.local.set({ [POSITION_KEY]: pos });
}

const STYLES = `
  #artemis-overlay {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    position: fixed; z-index: 2147483647;
    cursor: grab; user-select: none;
    border-radius: 12px; background: #1e293b; color: #f1f5f9;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    font-size: 14px; line-height: 1.4;
    min-width: 160px; max-width: 360px;
    transition: box-shadow 0.2s;
  }
  #artemis-overlay:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
  #artemis-overlay * { box-sizing: border-box; margin: 0; padding: 0; }
  #artemis-overlay .ao-header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; cursor: grab;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  #artemis-overlay .ao-header:active { cursor: grabbing; }
  #artemis-overlay .ao-header-info { flex: 1; min-width: 0; }
  #artemis-overlay .ao-header-info .ao-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  #artemis-overlay .ao-header-info .ao-value { font-weight: 600; font-size: 14px; }
  #artemis-overlay .ao-close {
    width: 24px; height: 24px; border: none; background: rgba(255,255,255,0.1);
    border-radius: 6px; color: #94a3b8; cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  #artemis-overlay .ao-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
  #artemis-overlay .ao-body { padding: 0 12px 12px; display: none; }
  #artemis-overlay.ao-expanded .ao-body { display: block; }
  #artemis-overlay.ao-expanded { min-width: 320px; }
  #artemis-overlay .ao-body-section { margin-top: 10px; }
  #artemis-overlay .ao-body-section h4 { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  #artemis-overlay .ao-breakdown-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; }
  #artemis-overlay .ao-breakdown-row .ao-bar { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
  #artemis-overlay .ao-breakdown-row .ao-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
  #artemis-overlay .ao-import-btn {
    display: block; width: 100%; margin-top: 10px;
    padding: 8px 16px; border: none; border-radius: 8px;
    background: #3b82f6; color: #fff; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.2s;
  }
  #artemis-overlay .ao-import-btn:hover { background: #2563eb; }
  #artemis-overlay .ao-extract-item { font-size: 13px; margin-top: 2px; color: #e2e8f0; }
  #artemis-overlay .ao-extract-item strong { color: #94a3b8; font-weight: 500; }
  #artemis-overlay .ao-summary-text { font-size: 13px; color: #cbd5e1; margin-top: 4px; line-height: 1.5; }
  #artemis-overlay .ao-action-row { display: flex; gap: 6px; margin-top: 10px; }
  #artemis-overlay .ao-sec-btn {
    flex: 1; padding: 8px; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
    background: transparent; color: #e2e8f0; font-size: 12px; font-weight: 500;
    cursor: pointer; transition: all 0.2s; text-align: center;
  }
  #artemis-overlay .ao-sec-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.25); }
  #artemis-overlay .ao-info-box {
    padding: 10px; border-radius: 8px;
    border: 1px solid rgba(148,163,184,0.2);
    background: rgba(148,163,184,0.08);
    font-size: 13px; color: #94a3b8; line-height: 1.5;
  }
  #artemis-overlay .ao-expand-hint { color: #64748b; font-size: 10px; flex-shrink: 0; }
  #artemis-overlay.ao-expanded .ao-expand-hint { display: none; }
  /* Circular ring indicator */
  #artemis-overlay .ao-ring-wrap { width:44px;height:44px;flex-shrink:0;position:relative;display:flex;align-items:center;justify-content:center }
  #artemis-overlay .ao-ring-wrap svg { display:block }
  #artemis-overlay .ao-spinner { animation:ao-spin 1s linear infinite }
  @keyframes ao-spin { to { transform:rotate(360deg) } }
  #artemis-overlay .ao-bullseye { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none }
  #artemis-overlay .ao-bullseye::after { content:'';display:block;width:6px;height:6px;border-radius:50%;background:rgba(234,179,8,0.3);animation:ao-pulse 1s ease-out infinite }
  @keyframes ao-pulse { 0% { width:6px;height:6px;opacity:.6 } 100% { width:44px;height:44px;opacity:0 } }
`;

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
let overlayEl: HTMLDivElement | null = null;
let isExpanded = false;
let hasFingerprint = false;
let matchScore: number | null = null;
let scoringFailed = false;
let isImporting = false;
let isImported = false;
let extracted: { title: string; company: string; salary: string } = { title: "", company: "", salary: "" };
let nanoTestResult: string | null = null;
let nanoTesting = false;

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
  if (matchScore !== null) return "Match Score";
  if (scoringFailed) return "Score Failed";
  if (hasFingerprint) return "Analyzing...";
  return "Not Configured";
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
        <div class="ao-value">${esc(extracted.title || (isExpanded ? "Job posting" : "Click to expand"))}</div>
      </div>
      <button class="ao-close" data-action="close" title="Close">✕</button>
      <span class="ao-expand-hint">${isExpanded ? "▲" : "▼"}</span>
    </div>
    ${isExpanded ? `
      <div class="ao-body">
        ${!hasFingerprint ? `
        <div class="ao-body-section">
          <div class="ao-info-box">
            <strong>No profile fingerprint.</strong><br>
            Open the Artemis Quiver popup and generate a fingerprint to get AI match scores.
          </div>
        </div>
        ` : scoringFailed ? `
        <div class="ao-body-section">
          <div class="ao-info-box" style="border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#ef4444">
            <strong>Match scoring failed.</strong> Check that your LLM endpoint is configured in settings and the server is running.
            <br><button class="ao-sec-btn" data-action="retry" style="margin-top:8px;width:auto;display:inline-block;padding:4px 12px;font-size:12px">Retry</button>
          </div>
        </div>
        ` : matchScore === null ? `
        <div class="ao-body-section">
          <div class="ao-info-box" style="border-color:rgba(234,179,8,0.3);background:rgba(234,179,8,0.08);color:#eab308">
            Analyzing job match&hellip;
          </div>
        </div>
        ` : `
        <div class="ao-body-section">
          <h4>Breakdown</h4>
          <div class="ao-breakdown-row">
            <span style="width:60px">Skills</span>
            <div class="ao-bar"><div class="ao-bar-fill" style="width:${Math.min(matchScore + 10, 100)}%;background:#3b82f6"></div></div>
          </div>
          <div class="ao-breakdown-row">
            <span style="width:60px">Exp.</span>
            <div class="ao-bar"><div class="ao-bar-fill" style="width:${Math.min(matchScore, 100)}%;background:#8b5cf6"></div></div>
          </div>
        </div>
        `}
        ${extracted.company ? `<div class="ao-extract-item"><strong>Company:</strong> ${esc(extracted.company)}</div>` : ""}
        ${extracted.salary ? `<div class="ao-extract-item"><strong>Salary:</strong> ${esc(extracted.salary)}</div>` : ""}
        <div class="ao-action-row">
          ${!isImported ? `<button class="ao-sec-btn" data-action="import">${isImporting ? "Importing..." : "Import to Artemis"}</button>` : ""}
          ${isImported ? `<button class="ao-sec-btn" data-action="open-app">Open in Artemis →</button>` : ""}
        </div>
        ${isImported ? `<div style="text-align:center;margin-top:6px;font-size:12px;color:#059669">✓ Imported</div>` : ""}
        <div class="ao-body-section">
          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">
            ${nanoTestResult !== null ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${esc(nanoTestResult)}</div>` : ""}
            <button class="ao-sec-btn" data-action="test-nano" style="width:auto;display:inline-block;padding:3px 10px;font-size:11px">${nanoTesting ? "Testing..." : "Test Chrome AI"}</button>
          </div>
        </div>
      </div>
    ` : ""}
  `;
}

function setupOverlayEvents(el: HTMLElement) {
  let justDragged = false;

  // Drag: mousedown on [data-drag] header
  el.addEventListener("mousedown", (e) => {
    const header = (e.target as HTMLElement).closest("[data-drag]");
    if (!header) return;
    if ((e.target as HTMLElement).closest("button")) return;

    let wasDragged = false;
    const startX = e.clientX, startY = e.clientY;
    const origX = parseInt(el.style.left) || 0;
    const origY = parseInt(el.style.top) || 0;

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX, dy = me.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged = true;
      el.style.left = (origX + dx) + "px";
      el.style.top = (origY + dy) + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (wasDragged) {
        justDragged = true;
        void savePosition({ x: parseInt(el.style.left) || 0, y: parseInt(el.style.top) || 0 });
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  // Click delegation: data-action buttons + toggle expand
  el.addEventListener("click", (e) => {
    const wasDrag = justDragged;
    justDragged = false;

    const btn = (e.target as HTMLElement).closest("[data-action]");
    if (btn) {
      const action = (btn as HTMLElement).dataset.action;
      if (action === "close") {
        el.remove();
        overlayEl = null;
        return;
      }
      if (action === "import") { void handleImport(); return; }
      if (action === "open-app") { void openApp(); return; }
      if (action === "retry") {
        scoringFailed = false;
        matchScore = null;
        render();
        void loadConfig().then((cfg) => computeMatch(cleanPageText().text, cfg));
        return;
      }
      if (action === "test-nano") { void testNano(); return; }
      return;
    }
    if (wasDrag) return;
    isExpanded = !isExpanded;
    render();
  });
}

function injectNanoBridge() {
  if (document.getElementById("artemis-nano-bridge")) return;
  const script = document.createElement("script");
  script.id = "artemis-nano-bridge";
  script.src = chrome.runtime.getURL("nano-inject.js");
  document.documentElement.appendChild(script);
  script.addEventListener("load", () => script.remove());
}

function injectOverlay(config: OverlayConfig) {
  if (document.getElementById("artemis-overlay")) return;

  injectNanoBridge();

  const style = document.createElement("style");
  style.textContent = STYLES;
  document.head.appendChild(style);

  const el = document.createElement("div");
  el.id = "artemis-overlay";
  document.body.appendChild(el);
  overlayEl = el;

  loadPosition().then((pos) => {
    el.style.bottom = "auto";
    el.style.right = "auto";
    el.style.left = pos.x + "px";
    el.style.top = pos.y + "px";
  });

  isExpanded = false;
  hasFingerprint = !!config.fingerprint;
  matchScore = null;
  scoringFailed = false;
  isImporting = false;
  isImported = false;
  nanoTestResult = null;
  nanoTesting = false;

  const pageText = document.body.innerText;
  const cleaned = cleanPageText();
  extracted = {
    title: cleaned.title || extractJobData(pageText).title,
    company: extractJobData(pageText).company,
    salary: extractJobData(pageText).salary,
  };

  render();
  setupOverlayEvents(el);

  if (hasFingerprint) {
    void computeMatch(cleaned.text, config);
  }

  // React to config changes (e.g. fingerprint generated in popup)
  if (!injectOverlay._storageInit) {
    injectOverlay._storageInit = true;
    chrome.storage.onChanged.addListener((changes) => {
      if (!overlayEl) return;
      const change = changes[STORAGE_KEY];
      if (!change) return;
      const newConfig = (change.newValue || change.oldValue) as OverlayConfig | undefined;
      if (!newConfig) return;
      const hadFingerprint = hasFingerprint;
      hasFingerprint = !!newConfig.fingerprint;
      console.log("[Artemis] storage changed: hadFingerprint:", hadFingerprint, "hasFingerprint:", hasFingerprint, "matchScore:", matchScore);
      if (hasFingerprint && !hadFingerprint && matchScore === null) {
        console.log("[Artemis] storage changed: re-triggering computeMatch");
        void computeMatch(cleanPageText().text, newConfig);
      } else if (hasFingerprint !== hadFingerprint) {
        if (hasFingerprint) {
          scoringFailed = false;
          console.log("[Artemis] storage changed: fingerprint appeared, re-triggering computeMatch");
          void computeMatch(cleanPageText().text, newConfig);
        } else {
          render();
        }
      }
    });
  }
}

function cleanPageText(): { title: string; text: string; url: string } {
  const isLinkedIn = location.hostname.includes("linkedin.com");

  if (isLinkedIn) {
    let text = document.body.innerText;
    const startMarkers = ["about the job", "about this role", "job description"];
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
    const titleEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__title, h1");
    const title = titleEl?.innerText?.trim() || document.title;
    return { title, text: `${title}\n\n${text}`, url: location.href };
  }

  return { title: document.title, text: document.body.innerText, url: location.href };
}

async function handleImport() {
  if (isImporting) return;
  isImporting = true;
  render();

  try {
    const data = cleanPageText();
    chrome.runtime.sendMessage({ type: "ARTEMIS_IMPORT_JOB", payload: data }).catch(() => {});
    isImported = true;
    isImporting = false;
    render();
  } catch (err) {
    console.error("[Artemis] Import failed:", err);
    isImporting = false;
    render();
  }
}

async function openApp() {
  chrome.runtime.sendMessage({ type: "ARTEMIS_OPEN_APP" }).catch(() => {});
}

async function computeMatch(pageText: string, config: OverlayConfig) {
  console.log("[Artemis] computeMatch start, hasFingerprint:", !!config.fingerprint, "fallbackMode:", config.fallbackMode, "text.length:", pageText.length);
  scoringFailed = false;
  matchScore = null;
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
      matchScore = parseScore(result);
      console.log("[Artemis] computeMatch: parsed score:", matchScore);
    } else if (config.fallbackMode !== "basic") {
      console.log("[Artemis] computeMatch: Nano unavailable, trying remoteMatch with fallback:", config.fallbackMode);
      const result = await remoteMatch(pageText, config.fingerprint!, config);
      console.log("[Artemis] computeMatch: remoteMatch raw result:", JSON.stringify(result));
      matchScore = parseScore(result);
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

async function testNano() {
  nanoTesting = true;
  nanoTestResult = null;
  render();

  // First check if the bridge is alive
  try {
    await postMessageToNano("nano-ping", undefined, undefined, 3000);
  } catch {
    // Bridge not loaded, try re-injecting
    console.log("[Artemis] Nano bridge not responding, re-injecting...");
    injectNanoBridge();
    // Wait for it to initialize
    await new Promise((r) => setTimeout(r, 500));
    try {
      await postMessageToNano("nano-ping", undefined, undefined, 3000);
    } catch {
      nanoTestResult = "✗ Bridge not loaded";
      nanoTesting = false;
      render();
      return;
    }
  }

  try {
    const raw = await postMessageToNano("nano-test", undefined, (progress) => {
      nanoTestResult = progress;
      render();
    }, 120000);
    const r = typeof raw === "string" ? JSON.parse(raw) : raw;
    nanoTestResult = r.ok
      ? "✓ Available"
      : "✗ " + (r.error || "unavailable");
  } catch {
    nanoTestResult = "✗ Error (timed out)";
  }
  nanoTesting = false;
  render();
}

async function remoteMatch(text: string, fp: string, config: OverlayConfig): Promise<string> {
  console.log("[Artemis] remoteMatch: fallback:", config.fallbackMode, "text.length:", text.length);
  const resp = await chrome.runtime.sendMessage({
    type: "ARTEMIS_LLM_SCORE",
    payload: { fingerprint: fp, jobText: text.slice(0, 8000), fallbackMode: config.fallbackMode },
  });
  console.log("[Artemis] Remote match response:", resp);
  return (resp as any)?.score ?? "";
}

function parseScore(raw: string): number | null {
  const m = raw.match(/(\d+)/);
  if (!m) return null;
  const score = parseInt(m[1]!, 10);
  return isNaN(score) ? null : Math.max(0, Math.min(100, score));
}

async function init() {
  console.log("[Artemis] Overlay init on", location.hostname, "URL:", location.href);

  if (overlayEl) {
    console.log("[Artemis] init: removing stale overlay");
    overlayEl.remove();
    overlayEl = null;
  }

  const config = await loadConfig();
  console.log("[Artemis] init: config loaded:", JSON.stringify({ ...config, fingerprint: config.fingerprint ? "(present, " + config.fingerprint.length + " chars)" : undefined }));
  if (!config.enabled) {
    console.log("[Artemis] Overlay disabled in config");
    return;
  }
  if (!isKnownJobSite(location.hostname, config.jobSites)) {
    console.log("[Artemis] Not a known job site:", location.hostname);
    return;
  }
  injectOverlay(config);
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
  history.pushState = (...args: any[]) => { origPushState(...args); onUrlChange(); };
  const origReplaceState = history.replaceState.bind(history);
  history.replaceState = (...args: any[]) => { origReplaceState(...args); onUrlChange(); };

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
