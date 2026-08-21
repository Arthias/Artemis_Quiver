import { loadTranslations, t } from "./i18n";
import { AppError, ErrorCodes } from "../app/utils/errors";
import { parseSiteEntry, siteToMatchPatterns, siteToOriginPatterns, normalizeSiteEntry, matchJobSite, DEFAULT_JOB_SITES } from "./job-sites";
import { extractPageContent } from "./pageExtract";
import { readActiveProfile } from "./idbProfile";
import { openAICompatibleAdapter } from "../app/services/provider/OpenAICompatibleAdapter";
import { anthropicAdapter } from "../app/services/provider/AnthropicAdapter";
import { geminiAdapter } from "../app/services/provider/GeminiAdapter";
import type { ProviderAdapter } from "../app/services/provider/ProviderAdapter";
import type { ModelEndpoint } from "../app/types/llm";

loadTranslations(navigator.language.split("-")[0] || "en").catch(() => {});

const STORAGE_KEY = "artemis:overlayConfig";

function contentScriptIdFor(entry: string): string {
  const parsed = parseSiteEntry(entry);
  const domain = parsed.domain.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = parsed.pathPattern ? parsed.pathPattern.replace(/[^a-zA-Z0-9._*-]/g, "_") : "";
  return ("overlay-" + domain + path).slice(0, 32);
}

// Reconcile registered overlay content scripts with the user's configured job
// sites. One content script per site, registered via chrome.scripting so the
// overlay only runs (and the extension only requests access to) sites the user
// explicitly added — no <all_urls> content script.
async function syncSiteContentScripts(): Promise<void> {
  const config = await getConfig();
  let sites: string[] = Array.isArray(config.jobSites) ? config.jobSites : [];

  // Migrate legacy path-pinned entries (the old popup baked page paths into
  // site entries, silently hiding the overlay on job boards like LinkedIn).
  // Persist the cleaned list so content-script registration and in-page
  // matching stay in sync.
  const migrated = sites.map((s) => normalizeSiteEntry(s));
  const changed = migrated.some((s, i) => s !== sites[i]);
  if (changed) {
    sites = migrated;
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: { ...config, jobSites: migrated } });
      console.log("[Artemis] Migrated legacy path-pinned site entries:", sites);
    } catch (err) {
      console.warn("[Artemis] Failed to persist migrated site entries:", err);
    }
  }

  let registered: chrome.scripting.RegisteredContentScript[] = [];
  try {
    registered = await chrome.scripting.getRegisteredContentScripts();
  } catch (err) {
    console.warn("[Artemis] getRegisteredContentScripts failed:", err);
  }
  const registeredIds = new Set(registered.map((s) => s.id));

  const desiredIds = new Set<string>();
  for (const site of sites) {
    const id = contentScriptIdFor(site);
    desiredIds.add(id);
    if (registeredIds.has(id)) continue;
    // Only register if we already hold host permission for the site's origins —
    // the popup grants it via chrome.permissions.request when the user adds it.
    let hasPermission = false;
    try {
      hasPermission = await chrome.permissions.contains({ origins: siteToOriginPatterns(site) });
    } catch (err) {
      console.warn("[Artemis] permissions.contains failed for", site, err);
    }
    if (!hasPermission) continue;

    try {
      const matches = siteToMatchPatterns(site);
      await chrome.scripting.registerContentScripts([
        {
          id,
          matches,
          js: ["overlay.js"],
          runAt: "document_idle",
          allFrames: false,
        },
      ]);
      registeredIds.add(id);
      console.log("[Artemis] Registered overlay content script for", site);
      // Inject into already-open tabs matching the site so the overlay appears
      // without a page reload. Registration only affects newly navigated
      // documents — existing tabs are picked up here.
      void injectOverlayIntoTabs(matches);
    } catch (err) {
      console.warn("[Artemis] registerContentScripts failed for", site, err);
    }
  }

  // Unregister scripts for sites that were removed from the config.
  const toRemove = [...registeredIds].filter((id) => !desiredIds.has(id));
  if (toRemove.length > 0) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: toRemove });
      console.log("[Artemis] Unregistered overlay content scripts for removed sites:", toRemove);
    } catch (err) {
      console.warn("[Artemis] unregisterContentScripts failed:", err);
    }
  }
}

export interface OverlaySiteDiagnostic {
  site: string;
  hasPermission: boolean;
  isRegistered: boolean;
}

export interface OverlayDiagnostics {
  sites: OverlaySiteDiagnostic[];
  activeTabUrl: string | null;
  activeTabMatchesConfiguredSite: boolean;
}

/** Surfaces per-site permission/registration state so the popup can explain
 * *why* the overlay isn't showing up, instead of it just silently not
 * appearing — chrome.scripting.registerContentScripts() silently no-ops
 * when the extension doesn't (yet) hold the optional host permission for
 * that site (see the `if (!hasPermission) continue;` above), which is the
 * most likely cause of "the overlay does not pop up". */
async function getOverlayDiagnostics(): Promise<OverlayDiagnostics> {
  const config = await getConfig();
  const sites: string[] = Array.isArray(config.jobSites) ? config.jobSites : [];

  let registered: chrome.scripting.RegisteredContentScript[] = [];
  try {
    registered = await chrome.scripting.getRegisteredContentScripts();
  } catch (err) {
    console.warn("[Artemis] diagnostics: getRegisteredContentScripts failed:", err);
  }
  const registeredIds = new Set(registered.map((s) => s.id));

  const siteDiagnostics: OverlaySiteDiagnostic[] = [];
  for (const site of sites) {
    let hasPermission = false;
    try {
      hasPermission = await chrome.permissions.contains({ origins: siteToOriginPatterns(site) });
    } catch (err) {
      console.warn("[Artemis] diagnostics: permissions.contains failed for", site, err);
    }
    siteDiagnostics.push({
      site,
      hasPermission,
      isRegistered: registeredIds.has(contentScriptIdFor(site)),
    });
  }

  let activeTabUrl: string | null = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabUrl = tab?.url ?? null;
  } catch (err) {
    console.warn("[Artemis] diagnostics: tabs.query failed:", err);
  }

  return {
    sites: siteDiagnostics,
    activeTabUrl,
    activeTabMatchesConfiguredSite: activeTabUrl ? matchJobSite(activeTabUrl, sites) : false,
  };
}

chrome.runtime.onInstalled.addListener(() => {
  void syncSiteContentScripts();
});
chrome.runtime.onStartup.addListener(() => {
  void syncSiteContentScripts();
});

// Auto-reconcile registered content scripts whenever the overlay config is
// written — from the popup OR the app's Settings page. This removes the need
// for the caller to fire ARTEMIS_SYNC_SITE_SCRIPTS (which raced the async
// storage write) and makes app-side edits take effect immediately.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!changes[STORAGE_KEY]) return;
  void syncSiteContentScripts();
  void refreshActiveTabAction();
});

// ── Side panel badge/entry point ──
// Every recognized job site (the same "allSites" set Config.tsx's
// ExtensionSettingsCard shows: DEFAULT_JOB_SITES minus excluded, plus custom
// entries) gets a badge on the toolbar icon, regardless of whether the site
// has been granted the standing host permission — clicking the badge opens
// the side panel, and the panel's own "Analyze" button works via activeTab
// (see handleQuickAnalyze), no standing permission required. The permission
// only matters for the opt-in "Always quick analyze this site" mode, which
// reuses the overlay's own per-site content-script registration.
function computeAllSites(config: any): string[] {
  const excluded: string[] = Array.isArray(config.excludedSites) ? config.excludedSites : [];
  const custom: string[] = Array.isArray(config.jobSites) ? config.jobSites : [];
  return [...DEFAULT_JOB_SITES.filter((s) => !excluded.includes(s)), ...custom];
}

async function updateActionForTab(tabId: number, url: string | undefined): Promise<void> {
  if (!url || !/^https?:/.test(url)) {
    await clearJobSiteAction(tabId);
    return;
  }
  try {
    const config = await getConfig();
    const isJobSite = matchJobSite(url, computeAllSites(config));
    if (isJobSite) {
      await chrome.action.setBadgeText({ tabId, text: "●" });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#3b82f6" });
      // Clears the manifest's default_popup for this tab only (resets when the
      // tab closes) so chrome.action.onClicked fires here instead — every
      // other tab keeps opening the regular config popup untouched.
      await chrome.action.setPopup({ tabId, popup: "" });
    } else {
      await clearJobSiteAction(tabId);
    }
  } catch (err) {
    console.warn("[Artemis] updateActionForTab failed for", tabId, err);
  }
}

async function clearJobSiteAction(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setPopup({ tabId, popup: "popup.html" });
  } catch {
    // Tab may already be gone — nothing to clean up.
  }
}

async function refreshActiveTabAction(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) void updateActionForTab(tab.id, tab.url);
  } catch {
    // No active window (e.g. background-only context) — nothing to refresh.
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    void updateActionForTab(tabId, tab.url);
  }
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then((tab) => void updateActionForTab(tabId, tab.url)).catch(() => {});
});

// Inject overlay.js into already-open tabs whose URL matches the given match
// patterns. Used after registering a new content script so the overlay appears
// without reloading those tabs. Best-effort: individual tab failures are logged
// but ignored (e.g. the tab may be mid-navigation or on a restricted page).
async function injectOverlayIntoTabs(matches: string[]): Promise<void> {
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({ url: matches });
  } catch (err) {
    console.warn("[Artemis] tabs.query failed for", matches, err);
    return;
  }
  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["overlay.js"],
      });
      console.log("[Artemis] Injected overlay.js into open tab", tab.id, tab.url);
    } catch (err) {
      console.warn("[Artemis] executeScript overlay failed for tab", tab.id, err);
    }
  }
}

const VITE_PROXY_MAP: Record<string, string> = {
  "/api/lmstudio": "http://localhost:1234",
  "/api/ollama": "http://localhost:11434",
};

function fixExtensionBaseUrl(url: string): string {
  for (const [prefix, target] of Object.entries(VITE_PROXY_MAP)) {
    if (url.startsWith(prefix)) {
      return target + url.slice(prefix.length);
    }
  }
  return url;
}

// Ensure the extension has host permission for the LLM endpoint origin so
// background fetch() can reach it. Localhost is declared statically; anything
// else (cloud APIs, LAN servers) is granted on demand via optional_host_permissions.
async function ensureHostPermission(baseUrl: string): Promise<void> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return; // invalid url — let the fetch fail naturally
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return; // already in host_permissions
  }
  const originPattern = origin + "/*";
  try {
    if (await chrome.permissions.contains({ origins: [originPattern] })) return;
  } catch {
    return; // permissions API unavailable — proceed and let fetch handle it
  }
  try {
    await chrome.permissions.request({ origins: [originPattern] });
  } catch (err) {
    console.warn("[Artemis] Failed to grant host permission for", origin, err);
  }
}

// ── Action click ──
// This only fires on tabs where updateActionForTab() cleared the default
// popup (i.e. recognized job-site tabs, see the badge logic above) — every
// other tab keeps opening popup.html directly and never reaches this
// listener. On a job-site tab, the click's job is just to open the panel;
// the panel handles extraction/scoring itself once it's open.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.warn("[Artemis] Failed to open side panel:", err);
  }
});

// ── Message handlers ──
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case "ARTEMIS_GENERATE_FINGERPRINT":
      void handleGenerateFingerprint(sendResponse);
      return true; // keep channel open for async

    case "ARTEMIS_LLM_SCORE":
      void handleLLMScore(msg.payload, sendResponse);
      return true;

    case "ARTEMIS_LOG_ERROR":
      void relayErrorToApp(msg.payload);
      break;

    case "ARTEMIS_IMPORT_JOB":
      void handleImportJob(msg.payload);
      break;

    case "ARTEMIS_OPEN_APP":
      void handleOpenApp();
      break;

    case "ARTEMIS_SYNC_SITE_SCRIPTS":
      void syncSiteContentScripts();
      break;

    case "ARTEMIS_GET_OVERLAY_DIAGNOSTICS":
      void getOverlayDiagnostics().then(sendResponse);
      return true; // keep channel open for async response

    case "ARTEMIS_QUICK_ANALYZE":
      void handleQuickAnalyze(msg.payload, sendResponse);
      return true; // keep channel open for async response

    case "ARTEMIS_QUICK_SCORE_UPDATE":
      // Fire-and-forget relay from the overlay content script (only sent on
      // "Always quick analyze this site" sites) — caches the score and
      // rebroadcasts it for any open side panel to pick up live.
      void handleQuickScoreUpdate(msg.payload);
      break;

    case "ARTEMIS_EXTRACT_AND_IMPORT": {
      // Messages from the popup have no _sender.tab, so the popup passes its
      // active tab id in the payload.
      const tabId = msg.payload?.tabId ?? _sender.tab?.id;
      if (tabId) {
        void handleExtractAndImport(tabId, sendResponse);
      } else {
        sendResponse({ error: "No active tab" });
      }
      return true; // keep channel open for async response
    }
  }
});

// ── Fingerprint generation ──
interface FingerprintSource {
  profileMarkdown: string;
  primaryEndpoint?: ModelEndpoint;
  secondaryEndpoint?: ModelEndpoint;
}

async function handleGenerateFingerprint(sendResponse: (resp: any) => void) {
  try {
    // Preferred path: read the active profile straight from IndexedDB (same
    // origin as the app), so no app tab needs to be open.
    const source = await getFingerprintSource(sendResponse);
    if (!source) return;

    const overlayCfg = await getConfig();
    const fingerprint = await generateFingerprintFromProfile(source, overlayCfg);

    if (fingerprint) {
      await saveFingerprint(fingerprint, source);
      console.log("[Artemis] Fingerprint generated:", fingerprint.slice(0, 60) + "...");
      sendResponse({ fingerprint });
    } else {
      console.log("[Artemis] LLM returned null fingerprint");
      sendResponse({ error: t("background.fingerprintFailed") });
    }
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
    console.error("[Artemis] generate_fingerprint:", appError);
    sendResponse({ error: appError.message });
  }
}

// Resolves profile data from IndexedDB first; falls back to asking an open app
// tab (e.g. when the app hasn't written its database yet). Returns null after
// sending an error response when neither path yields profile data.
async function getFingerprintSource(sendResponse?: (resp: any) => void): Promise<FingerprintSource | null> {
  const idbProfile = await readActiveProfile();
  if (idbProfile) {
    return {
      profileMarkdown: idbProfile.profileMarkdown,
      primaryEndpoint: idbProfile.primary,
      secondaryEndpoint: idbProfile.secondary,
    };
  }

  const appUrl = chrome.runtime.getURL("index.html");
  const existingTabs = await chrome.tabs.query({ url: appUrl + "*" });
  if (existingTabs.length === 0) {
    sendResponse?.({ error: t("background.noProfile") });
    return null;
  }
  const tabId = existingTabs[0]!.id!;
  const profileResp = await chrome.tabs.sendMessage(tabId, { type: "ARTEMIS_REQUEST_PROFILE" });
  const markdown: string | undefined = (profileResp as any)?.profileMarkdown;
  if (!markdown) {
    sendResponse?.({ error: t("background.noProfileData") });
    return null;
  }
  return { profileMarkdown: markdown, ...(profileResp as any) };
}

async function generateFingerprintFromProfile(source: FingerprintSource, overlayCfg: any): Promise<string | null> {
  const prompt = `Produce a single-line fingerprint of this profile for matching against job postings. Format: Role | Skills (pipe-separated, max 5) | YoE | Industries. Keep under 300 chars. No preamble, no explanation, no markdown.\n\nProfile:\n${source.profileMarkdown.slice(0, 4000)}`;
  const endpoints: any = {};
  if (source.primaryEndpoint) endpoints.primaryEndpoint = source.primaryEndpoint;
  if (source.secondaryEndpoint) endpoints.secondaryEndpoint = source.secondaryEndpoint;

  const effectiveConfig = overlayCfg.fallbackMode === "primary" || overlayCfg.fallbackMode === "secondary"
    ? { ...overlayCfg, ...endpoints }
    : { ...endpoints, fallbackMode: "primary" };

  return callRemoteLLM(prompt, effectiveConfig, { temperature: 0.3 });
}


function adapterFor(provider?: string): ProviderAdapter {
  switch (provider) {
    case "anthropic":
      return anthropicAdapter;
    case "google-gemini":
      return geminiAdapter;
    default:
      // openai-compatible, or legacy endpoints cached without a provider field
      return openAICompatibleAdapter;
  }
}

async function callRemoteLLM(prompt: string, config: any, opts?: { temperature?: number }): Promise<string> {
  const endpoint = resolveEndpoint(config);
  if (!endpoint) {
    throw new AppError(ErrorCodes.LLM_CONFIG_MISSING, t("background.noEndpoint"));
  }

  if (endpoint.provider === "webllm") {
    throw new AppError(ErrorCodes.LLM_CONFIG_MISSING, t("background.webllmNotSupported"));
  }

  const ep: ModelEndpoint = opts?.temperature !== undefined
    ? { ...endpoint, temperature: opts.temperature }
    : endpoint;

  const messages = [
    { role: "system" as const, content: t("background.youAreSummarizer") },
    { role: "user" as const, content: prompt },
  ];

  try {
    await ensureHostPermission(ep.baseUrl);
    return await adapterFor(ep.provider).chatCompletion(messages, ep, { timeoutMs: 30000 });
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
    console.error("[Artemis] LLM call failed for", ep.baseUrl, appError);
    throw appError;
  }
}

function resolveEndpoint(config: any): ModelEndpoint | null {
  const normalize = (ep: ModelEndpoint): ModelEndpoint => ({ ...ep, baseUrl: fixExtensionBaseUrl(ep.baseUrl) });

  if (config.fallbackMode === "secondary") {
    const useSecondary = config.secondaryUse === "quick-tasks" || config.secondaryUse === "always";
    if (useSecondary && config.secondaryEndpoint) return normalize(config.secondaryEndpoint);
  }

  if (config.primaryEndpoint) return normalize(config.primaryEndpoint);

  return normalize({
    label: "Primary",
    provider: "openai-compatible",
    baseUrl: "http://localhost:11434",
    model: "google/gemma-4-e2b",
    temperature: 0.7,
  });
}

async function saveFingerprint(fingerprint: string, appResp?: any) {
  const config = await getConfig();
  config.fingerprint = fingerprint;
  config.lastFingerprintUpdate = new Date().toISOString();
  if (appResp?.primaryEndpoint) {
    config.primaryEndpoint = { ...appResp.primaryEndpoint, baseUrl: fixExtensionBaseUrl(appResp.primaryEndpoint.baseUrl) };
  }
  if (appResp?.secondaryEndpoint) {
    config.secondaryEndpoint = { ...appResp.secondaryEndpoint, baseUrl: fixExtensionBaseUrl(appResp.secondaryEndpoint.baseUrl) };
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}

async function getConfig(): Promise<any> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result as any)[STORAGE_KEY] || {};
}

// ── LLM Score (fallback for content script) ──
async function handleLLMScore(
  payload: { fingerprint: string; jobText: string; fallbackMode: string },
  sendResponse: (resp: any) => void
) {
  try {
    const config = await getConfig();
    const prompt = `Score 0-100 how well this candidate matches this job. Reply with only the number.\n\nCandidate: ${payload.fingerprint}\n\nJob: ${payload.jobText.slice(0, 4000)}`;
    const score = await callRemoteLLM(prompt, { ...config, fallbackMode: payload.fallbackMode });
    sendResponse({ score });
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
    console.error("[Artemis] llm_score:", appError);
    sendResponse({ score: null });
  }
}


// ── Quick analyze (side panel) ──
// Auto-triggering is capped at this quick score, full stop — deep analysis
// and content generation stay explicit, user-initiated actions from the
// panel (see sidepanel.tsx). "Never auto deep score, as that would
// potentially shoot costs to the moon." (Bruno, 2026-08-21)
const QUICK_CACHE_KEY = "artemis:quickScoreCache";
const QUICK_CACHE_MAX = 200;

export interface QuickScoreEntry {
  url: string;
  title: string;
  company: string;
  salary: string;
  score: number | null;
  analyzedAt: string;
}

function parseScoreValue(raw: string): number | null {
  const m = raw.match(/(\d+)/);
  if (!m) return null;
  const score = parseInt(m[1]!, 10);
  return isNaN(score) ? null : Math.max(0, Math.min(100, score));
}

function parseSalaryFromText(text: string): string {
  const m = text.match(/(\$\d[\d,]*\s*(?:-\s*\$?\d[\d,]*)?\s*(?:\/yr|\/year|per year|k)?)/i);
  return m ? m[1]!.trim() : "";
}

async function getQuickCache(): Promise<Record<string, QuickScoreEntry>> {
  const result = await chrome.storage.local.get(QUICK_CACHE_KEY);
  return (result as any)[QUICK_CACHE_KEY] || {};
}

async function setQuickCacheEntry(entry: QuickScoreEntry): Promise<void> {
  const cache = await getQuickCache();
  cache[entry.url] = entry;
  const keys = Object.keys(cache);
  if (keys.length > QUICK_CACHE_MAX) {
    const sorted = keys.sort(
      (a, b) => new Date(cache[a]!.analyzedAt).getTime() - new Date(cache[b]!.analyzedAt).getTime()
    );
    for (const k of sorted.slice(0, keys.length - QUICK_CACHE_MAX)) delete cache[k];
  }
  await chrome.storage.local.set({ [QUICK_CACHE_KEY]: cache });
}

// Runs a quick match score for the given (or active) tab — extraction via
// activeTab + executeScript, same mechanism as ARTEMIS_EXTRACT_AND_IMPORT, so
// no standing host permission is required. Results are cached per-URL; pass
// force:true to bypass the cache (the panel's manual "Re-analyze" action).
async function handleQuickAnalyze(
  payload: { tabId?: number; force?: boolean } | undefined,
  sendResponse: (resp: any) => void
) {
  try {
    let tabId = payload?.tabId;
    let tab: chrome.tabs.Tab | undefined;
    if (tabId != null) {
      tab = await chrome.tabs.get(tabId);
    } else {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = active;
      tabId = tab?.id;
    }
    if (!tabId || !tab?.url) {
      sendResponse({ error: t("background.quickAnalyzeNoTab") });
      return;
    }
    const url = tab.url;

    if (!payload?.force) {
      const cache = await getQuickCache();
      const hit = cache[url];
      if (hit) {
        sendResponse({ ok: true, data: { ...hit, cached: true } });
        return;
      }
    }

    const config = await getConfig();
    if (!config.fingerprint) {
      sendResponse({ error: t("background.noFingerprint") });
      return;
    }

    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageContent });
    const data = result?.result as { title: string; company: string; text: string; url: string } | undefined;
    if (!data?.text) {
      sendResponse({ error: t("background.quickAnalyzeNoContent") });
      return;
    }

    const scoreRaw = await callRemoteLLM(
      `Score 0-100 how well this candidate matches this job. Reply with only the number.\n\nCandidate: ${config.fingerprint}\n\nJob: ${data.text.slice(0, 4000)}`,
      config
    );
    const score = parseScoreValue(scoreRaw);

    const entry: QuickScoreEntry = {
      url,
      title: data.title,
      company: data.company,
      salary: parseSalaryFromText(data.text),
      score,
      analyzedAt: new Date().toISOString(),
    };
    await setQuickCacheEntry(entry);
    sendResponse({ ok: true, data: { ...entry, cached: false } });
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
    console.error("[Artemis] quick_analyze:", appError);
    sendResponse({ error: appError.message });
  }
}

// Relayed from the overlay content script on "Always quick analyze this
// site" sites, once per completed computeMatch() — caches the score (so the
// panel shows it without a redundant call) and rebroadcasts it for any open
// side panel to pick up live via ARTEMIS_QUICK_SCORE_PUSH.
async function handleQuickScoreUpdate(payload: {
  url: string; title: string; company: string; salary: string; score: number | null;
}) {
  try {
    if (payload.score == null) return; // don't cache a failed/pending score
    const entry: QuickScoreEntry = { ...payload, score: payload.score, analyzedAt: new Date().toISOString() };
    await setQuickCacheEntry(entry);
    chrome.runtime.sendMessage({ type: "ARTEMIS_QUICK_SCORE_PUSH", payload: entry }).catch(() => {});
  } catch (err) {
    console.warn("[Artemis] quick_score_update failed:", err);
  }
}

// ── Extract page content and import (relayed from popup / toolbar) ──
async function handleExtractAndImport(tabId: number, sendResponse?: (resp: any) => void) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageContent,
    });
    const data = result?.result as { title: string; company: string; text: string; url: string } | undefined;
    if (!data?.text) {
      sendResponse?.({ error: "No job content found on this page" });
      return;
    }

    const appUrl = chrome.runtime.getURL("index.html");
    const existingTabs = await chrome.tabs.query({ url: appUrl + "*" });
    if (existingTabs.length > 0 && existingTabs[0]?.id) {
      await chrome.tabs.sendMessage(existingTabs[0].id, { type: "ARTEMIS_IMPORT", payload: data });
      await chrome.tabs.update(existingTabs[0].id, { active: true });
    } else {
      const stored = await chrome.storage.session.get("artemis:pendingImports");
      const existing = (stored as any)["artemis:pendingImports"] || [];
      existing.push(data);
      await chrome.storage.session.set({ "artemis:pendingImports": existing });
      await chrome.tabs.create({ url: appUrl });
    }
    sendResponse?.({ ok: true });
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.EXT_IMPORT_FAILED, err instanceof Error ? err.message : String(err));
    console.error("[Artemis] handleExtractAndImport:", appError);
    sendResponse?.({ error: appError.message });
  }
}


// ── Import job (relayed from overlay content script) ──
async function handleImportJob(payload: { title: string; company?: string; text: string; url: string }) {
  try {
    const appUrl = chrome.runtime.getURL("index.html");
    const existingTabs = await chrome.tabs.query({ url: appUrl + "*" });
    
    if (existingTabs.length > 0 && existingTabs[0]?.id) {
      await chrome.tabs.sendMessage(existingTabs[0].id, { type: "ARTEMIS_IMPORT", payload });
      await chrome.tabs.update(existingTabs[0].id, { active: true });
    } else {
      const stored = await chrome.storage.session.get("artemis:pendingImports");
      const existing = (stored as any)["artemis:pendingImports"] || [];
      existing.push(payload);
      await chrome.storage.session.set({ "artemis:pendingImports": existing });
    }
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.EXT_IMPORT_FAILED, err instanceof Error ? err.message : String(err));
    console.error("[Artemis] import_job:", appError);
  }
}


async function handleOpenApp() {
  try {
    const appUrl = chrome.runtime.getURL("index.html");
    const existingTabs = await chrome.tabs.query({ url: appUrl + "*" });
    if (existingTabs.length > 0 && existingTabs[0]?.id) {
      await chrome.tabs.update(existingTabs[0].id, { active: true });
    } else {
      await chrome.tabs.create({ url: appUrl });
    }
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.EXT_OPEN_APP_FAILED, err instanceof Error ? err.message : String(err));
    console.error("[Artemis] open_app:", appError);
  }
}


// ── Error relay (overlay/popup → app tab) ──
async function relayErrorToApp(payload: any) {
  const appUrl = chrome.runtime.getURL("index.html");
  const tabs = await chrome.tabs.query({ url: appUrl + "*" });
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "ARTEMIS_LOG_ERROR", payload }).catch(() => {});
    }
  }
}
