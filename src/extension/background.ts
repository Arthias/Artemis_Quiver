import { loadTranslations, t } from "./i18n";
import logger from "../app/services/logger";
import { AppError, ErrorCodes } from "../app/utils/errors";

loadTranslations(navigator.language.split("-")[0] || "en").catch(() => {});

const STORAGE_KEY = "artemis:overlayConfig";

const VITE_PROXY_MAP: Record<string, string> = {
  "/api/lmstudio": "http://192.168.8.171:1234",
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

// ── Action click: overlay handles this now via content script ──
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });

    const data = result?.result;
    if (!data?.text) return;

    const appUrl = chrome.runtime.getURL("index.html");
    const existingTabs = await chrome.tabs.query({ url: appUrl });

    if (existingTabs.length > 0 && existingTabs[0]?.id) {
      await chrome.tabs.update(existingTabs[0].id, { active: true });
      await chrome.tabs.sendMessage(existingTabs[0].id, {
        type: "ARTEMIS_IMPORT",
        payload: data,
      });
    } else {
      await chrome.storage.session.set({ "artemis:pendingImport": data });
      await chrome.tabs.create({ url: appUrl });
    }
  } catch (err) {
    console.error("[Artemis] Failed to import:", err);
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

    case "ARTEMIS_EXTRACT_AND_IMPORT": {
      const tabId = _sender.tab?.id;
      if (tabId) void handleExtractAndImport(tabId);
      break;
    }
  }
});

// ── Fingerprint generation ──
async function handleGenerateFingerprint(sendResponse: (resp: any) => void) {
  try {
    const appUrl = chrome.runtime.getURL("index.html");
    const existingTabs = await chrome.tabs.query({ url: appUrl });
    
    if (existingTabs.length === 0) {
      console.log("[Artemis] App tab not found");
      sendResponse({ error: t("background.appNotOpen") });
      return;
    }
    
    const tabId = existingTabs[0]!.id!;
    const profileResp = await chrome.tabs.sendMessage(tabId, { type: "ARTEMIS_REQUEST_PROFILE" });
    console.log("[Artemis] Profile response:", profileResp);
    const profileMarkdown: string | undefined = (profileResp as any)?.profileMarkdown;
    
    if (!profileMarkdown) {
      console.log("[Artemis] No profile markdown in response");
      sendResponse({ error: t("background.noProfileData") });
      return;
    }
    
    const overlayCfg = await getConfig();
    const fingerprint = await generateFingerprintFromProfile(profileMarkdown, overlayCfg, profileResp);
    
    if (fingerprint) {
      await saveFingerprint(fingerprint, profileResp);
      console.log("[Artemis] Fingerprint generated:", fingerprint.slice(0, 60) + "...");
      sendResponse({ fingerprint });
    } else {
      console.log("[Artemis] LLM returned null fingerprint");
      sendResponse({ error: t("background.fingerprintFailed") });
    }
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
    logger.error(appError, { source: "generate_fingerprint" });
    sendResponse({ error: err instanceof Error ? err.message : String(err) });
  }
}


async function generateFingerprintFromProfile(markdown: string, overlayCfg: any, appResp: any): Promise<string | null> {
  const prompt = `Produce a single-line fingerprint of this profile for matching against job postings. Format: Role | Skills (pipe-separated, max 5) | YoE | Industries. Keep under 300 chars. No preamble, no explanation, no markdown.\n\nProfile:\n${markdown.slice(0, 4000)}`;
  const endpoints: any = {};
  if (appResp?.primaryEndpoint) endpoints.primaryEndpoint = appResp.primaryEndpoint;
  if (appResp?.secondaryEndpoint) endpoints.secondaryEndpoint = appResp.secondaryEndpoint;
  
  try {
    if (overlayCfg.fallbackMode === "primary" || overlayCfg.fallbackMode === "secondary") {
      return await callRemoteLLM(prompt, { ...overlayCfg, ...endpoints });
    }
    return await callRemoteLLM(prompt, { ...endpoints, fallbackMode: "primary" });
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
    logger.error(appError, { source: "fingerprint_gen" });
    return null;
  }
}


async function callRemoteLLM(prompt: string, config: any): Promise<string> {
  const endpoint = resolveEndpoint(config);
  if (!endpoint) {
    throw new AppError(ErrorCodes.LLM_CONFIG_MISSING, t("background.noEndpoint"));
  }
  
  const body = {
    model: endpoint.model,
    messages: [
      { role: "system", content: t("background.youAreSummarizer") },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 600,
  };
  
  try {
    const resp = await fetch(endpoint.baseUrl + "/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(endpoint.apiKey ? { Authorization: `Bearer ${endpoint.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      throw new AppError(ErrorCodes.LLM_API_FAILURE, t("background.llmRequestFailed", { status: resp.status.toString(), url: endpoint.baseUrl + "/v1/chat/completions" }));
    }
    
    const json = await resp.json() as any;
    const msg = json?.choices?.[0]?.message;
    const content = msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
    return content;
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.LLM_API_FAILURE, err instanceof Error ? err.message : String(err));
    logger.error(appError, { endpoint: endpoint.baseUrl });
    throw appError;
  }
}


function resolveEndpoint(config: any) {
  if (config.fallbackMode === "primary" || !config.fallbackMode) {
    const ep = config.primaryEndpoint || { baseUrl: "http://localhost:11434", model: "google/gemma-4-e2b" };
    return { ...ep, baseUrl: fixExtensionBaseUrl(ep.baseUrl) };
  }
  if (config.fallbackMode === "secondary") {
    const useSecondary = config.secondaryUse === "quick-tasks" || config.secondaryUse === "always";
    if (useSecondary && config.secondaryEndpoint) {
      return { ...config.secondaryEndpoint, baseUrl: fixExtensionBaseUrl(config.secondaryEndpoint.baseUrl) };
    }
    const ep = config.primaryEndpoint || { baseUrl: "http://localhost:11434", model: "google/gemma-4-e2b" };
    return { ...ep, baseUrl: fixExtensionBaseUrl(ep.baseUrl) };
  }
  throw new Error(t("background.noEndpoint"));
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
    logger.error(appError, { source: "llm_score" });
    sendResponse({ score: null });
  }
}


// ── Extract page content and import (relayed from overlay) ──
async function handleExtractAndImport(tabId: number) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageContent,
    });
    const data = result?.result as { title: string; text: string; url: string } | undefined;
    if (!data?.text) return;
    
    const appUrl = chrome.runtime.getURL("index.html");
    const existingTabs = await chrome.tabs.query({ url: appUrl });
    if (existingTabs.length > 0 && existingTabs[0]?.id) {
      await chrome.tabs.sendMessage(existingTabs[0].id, { type: "ARTEMIS_IMPORT", payload: data });
      await chrome.tabs.update(existingTabs[0].id, { active: true });
    } else {
      await chrome.storage.session.set({ "artemis:pendingImport": data });
    }
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError(ErrorCodes.EXT_IMPORT_FAILED, err instanceof Error ? err.message : String(err));
    logger.error(appError, { source: "handleExtractAndImport" });
  }
}


// ── Import job (relayed from overlay content script) ──
async function handleImportJob(payload: { title: string; text: string; url: string }) {
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
    logger.error(appError, { source: "import_job" });
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
    logger.error(appError, { source: "open_app" });
  }
}


// ── Error relay (overlay/popup → app tab) ──
async function relayErrorToApp(payload: any) {
  const appUrl = chrome.runtime.getURL("index.html");
  const tabs = await chrome.tabs.query({ url: appUrl });
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "ARTEMIS_LOG_ERROR", payload }).catch(() => {});
    }
  }
}

// ── Page content extraction ──
async function extractPageContent() {
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

    const startMarkers = [
      "about the job", "about this role", "job description",
    ];
    const endMarkers = [
      "job search faster with premium", "about the company",
      "show more", "people also viewed",
    ];

    const lines = text.split("\n").map((l) => l.trim());
    let startIdx = 0;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (startMarkers.some((m) => lower.startsWith(m))) {
        startIdx = i;
        break;
      }
    }

    for (let i = startIdx + 1; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (endMarkers.some((m) => lower.startsWith(m))) {
        endIdx = i;
        break;
      }
    }

    const bodyLines = lines.slice(startIdx, endIdx);
    text = bodyLines.join("\n").trim();

    const titleEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__title, h1");
    const title = titleEl?.innerText?.trim() || document.title;

    return { title, text: `${title}\n\n${text}`, url: location.href };
  }

  return {
    title: document.title,
    text: document.body.innerText,
    url: location.href,
  };
}
