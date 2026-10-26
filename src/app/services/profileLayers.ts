// The master profile's two derived layers (Profile-Management-Spec §4):
// preferences, generated from the master profile by one LLM call, and the
// fingerprint, rendered from the preferences by a template (no LLM). Both can
// also be written by hand; a layer is stale when its source changed since it
// was built or last edited.
import type { ChatMessage, LlmConfig } from "../types/llm";
import {
  FINGERPRINT_MAX,
  LEVELS,
  ProfilePreferencesSchema,
  type Layer,
  type ProfilePreferences,
} from "../types/preferences";
import { chatCompletionWithFallback } from "./llmService";
import { extractJsonObject } from "../utils/jsonParse";
import { placeCode, placeCodes } from "../utils/geo";

/** JSON with sorted keys, so equal values always hash alike. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v
  );
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const masterHash = (markdown: string) => sha256(markdown);
export const preferencesHash = (prefs: ProfilePreferences) => sha256(canonicalJson(prefs));

export function isStale(layer: Layer<unknown> | undefined, sourceHash: string): boolean {
  return !!layer && layer.sourceHash !== sourceHash;
}

export function makeLayer<T>(value: T, origin: Layer<T>["origin"], sourceHash: string): Layer<T> {
  return { value, origin, sourceHash, updatedAt: new Date().toISOString() };
}

// ── Fingerprint ─────────────────────────────────────────────────────────────

/** `<fields, top 2> | <skills, top 5> | <years>y | <domains, top 3> | <levels>`,
 * unset parts dropped, at most FINGERPRINT_MAX chars. */
export function renderFingerprint(p: ProfilePreferences): string {
  const parts = [
    p.fields.slice(0, 2).join(", "),
    p.skills.slice(0, 5).join(", "),
    p.years != null ? `${p.years}y` : "",
    p.domains.slice(0, 3).join(", "),
    p.levels.join(", "),
  ].filter(Boolean);
  let out = parts.join(" | ");
  while (out.length > FINGERPRINT_MAX && parts.length > 1) {
    parts.pop();
    out = parts.join(" | ");
  }
  return out.slice(0, FINGERPRINT_MAX);
}

// ── Generate preferences ────────────────────────────────────────────────────

// Placeholders only, never realistic example values: the 2026-10-22
// experiment showed the model copies example values into its answer.
const PREFERENCES_PROMPT = `Fill a candidate card from the profile below. Record only what the profile states; never guess.
Reply with compact JSON only, in this shape. The <...> are placeholders: fill each from the profile, never copy them.
{"fields":["<kind of work>"],
"levels":["<level>"],
"skills":["<skill>"],
"years":<number or null>,
"domains":["<industry>"],
"languages":[{"name":"<language>","level":"<A1-C2, native, or null>"}],
"has_degree":<true, false or null>,
"home":"<country, or null>",
"work_authorisation":["<country or region>"],
"remote":<true, false or null>,
"hybrid_places":["<city>"],
"onsite_places":["<city>"],
"relocation_countries":["<country>"]}
Rules:
- fields: 3 to 6 kinds of work this person would do every day, in plain words (not job titles).
- levels: target seniority, only from: ${LEVELS.join(", ")}.
- skills: up to 25 core technical and professional skills.
- years: total years of professional experience, if the profile makes it clear; else null.
- domains: up to 5 industries the person has worked in or wants.
- has_degree: true only for a completed degree; false only if the profile says there is none; else null.
- home: the country the person lives in.
- work_authorisation: countries or regions the profile says they may work in without sponsorship; [] if not stated.
- remote / hybrid_places / onsite_places: only what the profile says about how and where they want to work.
- relocation_countries: countries the profile says they would move to; [] if not stated.`;

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];

/** The model's card → ProfilePreferences. Places Flow cannot read are dropped. */
export function preferencesFromCard(raw: Record<string, unknown>): ProfilePreferences {
  const modes = (places: unknown, flag?: unknown) => {
    const l = list(places);
    if (l.length) return l;
    return typeof flag === "boolean" ? flag : null;
  };
  const home = typeof raw.home === "string" ? placeCode(raw.home.split(",").pop() ?? "") : null;
  const years = typeof raw.years === "number" && raw.years >= 0 ? raw.years : null;
  return ProfilePreferencesSchema.parse({
    home_country: home,
    work_authorisation: placeCodes(list(raw.work_authorisation)).codes,
    relocation_countries: placeCodes(list(raw.relocation_countries)).codes,
    work_modes: { remote: modes([], raw.remote), hybrid: modes(raw.hybrid_places), onsite: modes(raw.onsite_places) },
    languages: Array.isArray(raw.languages)
      ? raw.languages
          .map((l) => (typeof l === "string" ? { name: l, level: null } : (l as Record<string, unknown>)))
          .filter((l) => typeof l?.name === "string" && l.name.trim())
          .map((l) => ({ name: String(l.name).trim(), level: typeof l.level === "string" && l.level ? l.level : null }))
      : [],
    has_degree: typeof raw.has_degree === "boolean" ? raw.has_degree : null,
    fields: list(raw.fields).slice(0, 6),
    levels: list(raw.levels).filter((l): l is (typeof LEVELS)[number] => (LEVELS as readonly string[]).includes(l)),
    skills: list(raw.skills).slice(0, 25),
    years,
    domains: list(raw.domains).slice(0, 5),
  });
}

export async function generatePreferences(masterMarkdown: string, llm: LlmConfig): Promise<ProfilePreferences> {
  const messages: ChatMessage[] = [
    { role: "system", content: PREFERENCES_PROMPT },
    { role: "user", content: `## Profile\n\n${masterMarkdown}` },
  ];
  const raw = extractJsonObject(await chatCompletionWithFallback(messages, llm, { timeoutMs: 180000 }));
  if (!raw || typeof raw !== "object") throw new Error("The model did not return a preferences card.");
  return preferencesFromCard(raw as Record<string, unknown>);
}
