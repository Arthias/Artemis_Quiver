// The web app's t() keys are type-checked (i18next.d.ts); the extension's
// t() takes a plain string, so a missing key only shows up at runtime as the
// raw key ("sidepanel.cv.title"). This catches it in CI instead.
import { describe, it, expect } from "vitest";
import en from "../../app/i18n/locales/en.json";
import es from "../../app/i18n/locales/es.json";

function flatten(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix + k;
    if (v && typeof v === "object") flatten(v as Record<string, unknown>, key + ".").forEach((x) => out.add(x));
    else out.add(key);
  }
  return out;
}

const enKeys = flatten(en);
const esKeys = flatten(es);
const namespaces = Object.keys(en).join("|");
// Any quoted "<namespace>.<path>" literal — covers t("…") calls and key maps.
const KEY_LITERAL = new RegExp(`["'\`]((?:${namespaces})(?:\\.[A-Za-z0-9_]+)+)["'\`]`, "g");

const sources = import.meta.glob<string>("../*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

function extensionKeys(): Map<string, string> {
  const found = new Map<string, string>();
  for (const [file, text] of Object.entries(sources)) {
    for (const m of text.matchAll(KEY_LITERAL)) {
      if (!/\.(html|js|json|css)$/.test(m[1]!)) found.set(m[1]!, file);
    }
  }
  return found;
}

describe("locale files", () => {
  it("en and es define the same keys", () => {
    expect([...enKeys].filter((k) => !esKeys.has(k))).toEqual([]);
    expect([...esKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("every key the extension uses exists in en and es", () => {
    const missing = [...extensionKeys()]
      .filter(([key]) => !enKeys.has(key) || !esKeys.has(key))
      .map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });

  it("actually finds the extension's keys", () => {
    expect(extensionKeys().has("sidepanel.cv.title")).toBe(true);
    expect(extensionKeys().has("sidepanel.apply.srcProfile")).toBe(true);
  });
});
