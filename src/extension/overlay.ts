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
  #artemis-overlay .ao-score-badge {
    display: flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; border-radius: 10px;
    font-weight: 700; font-size: 16px; flex-shrink: 0;
  }
  #artemis-overlay .ao-score-high { background: #059669; color: #fff; }
  #artemis-overlay .ao-score-mid { background: #d97706; color: #fff; }
  #artemis-overlay .ao-score-low { background: #dc2626; color: #fff; }
  #artemis-overlay .ao-score-none { background: #475569; color: #94a3b8; font-size: 12px; }
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
let isDragging = false;
let hasFingerprint = false;
let matchScore: number | null = null;
let isImporting = false;
let isImported = false;
let extracted: { title: string; company: string; salary: string } = { title: "", company: "", salary: "" };

function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function extractJobData(text: string): { title: string; company: string; salary: string } {
  let title = "";
  let company = "";
  let salary = "";
  const lines = text.split("\n").filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i]!.trim();
    if (!title && l.length < 120) title = l;
    if (!company && l.includes("@") && l.length < 60) company = l.replace(/.*@/, "").trim();
  }
  const salaryMatch = text.match(/(\$\d[\d,]*\s*(?:-\s*\$?\d[\d,]*)?\s*(?:\/yr|\/year|per year|k)?)/i);
  if (salaryMatch) salary = salaryMatch[1]!.trim();
  return { title, company, salary };
}

function render() {
  const el = overlayEl;
  if (!el) return;

  const scoreClass = matchScore !== null
    ? matchScore >= 70 ? "ao-score-high" : matchScore >= 40 ? "ao-score-mid" : "ao-score-low"
    : "ao-score-none";
  const scoreText = matchScore !== null ? matchScore + "%" : hasFingerprint ? "..." : "JD";

  el.className = isExpanded ? "ao-expanded" : "";
  el.innerHTML = `
    <div class="ao-header" data-drag>
      <div class="ao-score-badge ${scoreClass}">${scoreText}</div>
      ${isExpanded ? `
        <div class="ao-header-info">
          <div class="ao-label">${matchScore !== null ? "Match Score" : hasFingerprint ? "Analyzing..." : "Job Detected"}</div>
          <div class="ao-value">${esc(extracted.title || "Job posting")}</div>
        </div>
        <button class="ao-close" data-action="close">✕</button>
      ` : ""}
    </div>
    ${isExpanded ? `
      <div class="ao-body">
        ${extracted.company ? `<div class="ao-extract-item"><strong>Company:</strong> ${esc(extracted.company)}</div>` : ""}
        ${extracted.salary ? `<div class="ao-extract-item"><strong>Salary:</strong> ${esc(extracted.salary)}</div>` : ""}

        ${matchScore !== null ? `
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
        ` : ""}

        <div class="ao-action-row">
          ${!isImported ? `<button class="ao-sec-btn" data-action="import">${isImporting ? "Importing..." : "Import to Artemis"}</button>` : ""}
          ${isImported ? `<button class="ao-sec-btn" data-action="open-app">Open in Artemis →</button>` : ""}
        </div>
        ${isImported ? `<div style="text-align:center;margin-top:6px;font-size:12px;color:#059669">✓ Imported</div>` : ""}
      </div>
    ` : ""}
  `;

  el.querySelector("[data-action='close']")?.addEventListener("click", (e) => {
    e.stopPropagation();
    el.remove();
    overlayEl = null;
  });

  el.querySelector("[data-action='import']")?.addEventListener("click", () => {
    void handleImport();
  });

  el.querySelector("[data-action='open-app']")?.addEventListener("click", () => {
    void openApp();
  });
}

function setupDrag(el: HTMLElement) {
  let dragActive = false;
  let startX = 0, startY = 0;
  let origX = 0, origY = 0;

  const header = el.querySelector("[data-drag]") as HTMLElement | null;
  if (!header) return;

  header.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragActive = true;
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    origX = parseInt(el.style.left) || 0;
    origY = parseInt(el.style.top) || 0;

    const onMove = (me: MouseEvent) => {
      if (!dragActive) return;
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
      el.style.left = (origX + dx) + "px";
      el.style.top = (origY + dy) + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (isDragging) {
        void savePosition({ x: parseInt(el.style.left) || 0, y: parseInt(el.style.top) || 0 });
      }
      dragActive = false;
      isDragging = false;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function setupToggle(el: HTMLElement) {
  el.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest("[data-drag]")) return;
    isExpanded = !isExpanded;
    render();
    setupDrag(el);
    setupToggle(el);
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

  const pageText = document.body.innerText;
  extracted = extractJobData(pageText);

  render();
  setupDrag(el);
  setupToggle(el);

  if (hasFingerprint) {
    void computeMatch(pageText, config);
  }
}

async function handleImport() {
  if (isImporting) return;
  isImporting = true;
  render();

  try {
    const pageText = document.body.innerText;
    const payload = {
      title: extracted.title || document.title,
      text: `${extracted.title || document.title}\n\n${pageText}`,
      url: location.href,
    };

    const appUrl = chrome.runtime.getURL("index.html");
    const existingTabs = await chrome.tabs.query({ url: appUrl });

    if (existingTabs.length > 0 && existingTabs[0]?.id) {
      await chrome.tabs.sendMessage(existingTabs[0].id, { type: "ARTEMIS_IMPORT", payload });
      await chrome.tabs.update(existingTabs[0].id, { active: true });
    } else {
      await chrome.storage.session.set({ "artemis:pendingImport": payload });
    }

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
  const appUrl = chrome.runtime.getURL("index.html");
  const existingTabs = await chrome.tabs.query({ url: appUrl });
  if (existingTabs.length > 0 && existingTabs[0]?.id) {
    await chrome.tabs.update(existingTabs[0].id, { active: true });
  } else {
    await chrome.tabs.create({ url: appUrl });
  }
}

async function computeMatch(pageText: string, config: OverlayConfig) {
  try {
    const { grant, nano } = await tryNano();
    if (grant) {
      const result = await nano!(pageText, config.fingerprint!);
      matchScore = parseScore(result);
    } else if (config.fallbackMode !== "basic") {
      const result = await remoteMatch(pageText, config.fingerprint!, config);
      matchScore = parseScore(result);
    }
  } catch {
    matchScore = null;
  }
  render();
}

function postMessageToNano(method: string, args?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== "artemis-nano") return;
      if (event.data.requestId !== requestId) return;
      window.removeEventListener("message", handler);
      clearTimeout(timer);
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    window.addEventListener("message", handler);
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Nano timeout"));
    }, 30000);
    window.postMessage({ source: "artemis-overlay", method, args, requestId }, "*");
  });
}

async function tryNano(): Promise<{ grant: boolean; nano?: (text: string, fp: string) => Promise<string> }> {
  try {
    const result = await postMessageToNano("nano-check");
    if (!result.grant) return { grant: false };
    return {
      grant: true,
      nano: async (text: string, fp: string) => {
        const r = await postMessageToNano("nano-score", { text, fp });
        return String(r);
      },
    };
  } catch {
    return { grant: false };
  }
}

async function remoteMatch(text: string, fp: string, config: OverlayConfig): Promise<string> {
  console.log("[Artemis] Remote match with fallback:", config.fallbackMode);
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
  console.log("[Artemis] Overlay init on", location.hostname);
  const config = await loadConfig();
  console.log("[Artemis] Config:", config);
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  void init();
}
