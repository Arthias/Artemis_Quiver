/// <reference types="chrome" />

let cache: Record<string, unknown> | null = null;

// The locale files ship inside the extension (copied to locales/ by build:ext),
// so fetching them is a local read — no caching. A storage cache keyed by the
// extension version used to live here and served stale strings (raw keys) after
// any rebuild that added keys without bumping the version.
async function fetchLocale(locale: string): Promise<Record<string, unknown>> {
  const resp = await fetch(chrome.runtime.getURL(`locales/${locale}.json`));
  if (!resp.ok) throw new Error(`No locale file for "${locale}"`);
  return resp.json();
}

export async function loadTranslations(locale: string): Promise<void> {
  try {
    cache = await fetchLocale(locale);
  } catch {
    // Unsupported browser language (e.g. "it") → English rather than raw keys.
    cache = await fetchLocale("en");
  }
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
