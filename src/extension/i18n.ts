/// <reference types="chrome" />

let cache: Record<string, string> | null = null;

export async function loadTranslations(locale: string): Promise<void> {
  const result = await chrome.storage.local.get("i18n_cache");
  const cached = result.i18n_cache as Record<string, Record<string, string>> | undefined;
  if (cached?.[locale]) {
    cache = cached[locale];
    return;
  }
  const resp = await fetch(chrome.runtime.getURL(`locales/${locale}.json`));
  const data = await resp.json();
  cache = data;
  await chrome.storage.local.set({ i18n_cache: { [locale]: data } });
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
