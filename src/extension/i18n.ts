/// <reference types="chrome" />

let cache: Record<string, string> | null = null;

// Key the storage cache by the extension version so a rebuilt locale file with
// new keys is always re-fetched instead of serving stale cached translations
// (raw keys shown). Old keys are orphaned, never read again.
function cacheKey(): string {
  let version = "dev";
  try {
    version = chrome.runtime.getManifest().version || "dev";
  } catch {}
  return `i18n_cache_${version}`;
}

export async function loadTranslations(locale: string): Promise<void> {
  const key = cacheKey();
  const result = await chrome.storage.local.get(key);
  const cached = result[key] as Record<string, Record<string, string>> | undefined;
  if (cached?.[locale]) {
    cache = cached[locale];
    return;
  }
  const resp = await fetch(chrome.runtime.getURL(`locales/${locale}.json`));
  const data = await resp.json();
  cache = data;
  await chrome.storage.local.set({ [key]: { [locale]: data } });
}

function getNested(obj: Record<string, unknown> | null, path: string): unknown {
  if (!obj) return null;
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function t(key: string, params?: Record<string, string | number>): string {
  const val = getNested(cache, key);
  let result = (typeof val === "string" ? val : key) ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    });
  }
  return result;
}
