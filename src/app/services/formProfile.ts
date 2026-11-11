// The "form profile": one editable JSON per Quiver profile holding the answers
// to routine application-form fields, plus saved answers to recurring
// questions. Stored in the shared `metadata` table under its own key — NOT on
// the ProfileRecord, because the app writes the whole record on every save
// and would overwrite edits made from the side panel.
//
// Learning is the `aliases` list: once a form label has been matched to a key
// (by the user or by a model) and filled, the label is added as an alias, so
// the next form with that label matches by plain string lookup.
import { db } from "../db/schema";
import type { ChatMessage, LlmConfig } from "../types/llm";
import { runLlm } from "./llmService";
import { extractJsonObject } from "../utils/jsonParse";

export interface FormProfileField {
  value: string;
  aliases: string[];
}

export interface FormProfileAnswer {
  question: string;
  answer: string;
  /** "always", or a region the answer applies to (e.g. "US", "EU", "UK"). */
  scope: string;
}

export interface FormProfile {
  fields: Record<string, FormProfileField>;
  answers: FormProfileAnswer[];
  /** Free text the drafting model reads verbatim, e.g. sponsorship rules. */
  rules: string;
  /** Hide name and home location from cloud models (see services/redaction.ts). */
  redact: boolean;
}

export const REGIONS = ["US", "EU", "UK", "Other"] as const;

const DEFAULT_ALIASES: Record<string, string[]> = {
  first_name: ["first name", "given name", "forename", "first"],
  last_name: ["last name", "family name", "surname", "last"],
  full_name: ["full name", "name", "your name", "legal name"],
  preferred_name: ["preferred name", "preferred first name", "nickname"],
  email: ["email", "email address", "e mail", "e mail address"],
  phone: ["phone", "phone number", "mobile", "mobile number", "telephone", "cell phone"],
  city: ["city", "current city", "town"],
  country: ["country", "country of residence"],
  location: ["location", "current location", "where are you based", "where are you located"],
  address: ["address", "street address", "home address"],
  postal_code: ["postal code", "zip", "zip code", "postcode"],
  linkedin: ["linkedin", "linkedin profile", "linkedin url", "linkedin profile url"],
  github: ["github", "github profile", "github url"],
  portfolio: ["portfolio", "portfolio url", "portfolio link"],
  website: ["website", "personal website", "other website", "url"],
  current_company: ["current company", "current employer", "company name", "employer"],
  current_title: ["current title", "current job title", "current role", "job title"],
  years_experience: ["years of experience", "how many years of experience", "total years of experience"],
  salary_expectation: ["salary expectation", "salary expectations", "desired salary", "expected salary", "compensation expectations", "expected compensation", "desired compensation"],
  notice_period: ["notice period", "what is your notice period"],
  start_date: ["start date", "earliest start date", "when can you start", "availability to start"],
  how_heard: ["how did you hear about us", "how did you hear about this role", "how did you hear about this job", "how did you find us", "source", "referral source"],
  pronouns: ["pronouns", "preferred pronouns"],
};

// Standard HTML autocomplete tokens → keys. Checked before aliases.
const AUTOCOMPLETE_KEYS: Record<string, string> = {
  "given-name": "first_name",
  "family-name": "last_name",
  name: "full_name",
  nickname: "preferred_name",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  "address-level2": "city",
  "country-name": "country",
  "street-address": "address",
  "address-line1": "address",
  "postal-code": "postal_code",
  organization: "current_company",
  "organization-title": "current_title",
  url: "website",
};

// Equal-opportunity / demographic questions are never proposed or generated.
const EEO_PATTERN = /\b(gender|sex|race|racial|ethnic\w*|hispanic|latin[oax]|veteran|disabilit\w*|sexual orientation|transgender|lgbt\w*)\b/i;

export function emptyFormProfile(): FormProfile {
  const fields: Record<string, FormProfileField> = {};
  for (const [key, aliases] of Object.entries(DEFAULT_ALIASES)) fields[key] = { value: "", aliases: [...aliases] };
  return { fields, answers: [], rules: "", redact: true };
}

export function normalizeLabel(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Throws with a readable message when the JSON isn't a usable form profile. */
export function validateFormProfile(raw: unknown): FormProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Top level must be an object.");
  const obj = raw as Record<string, unknown>;
  const fieldsIn = obj.fields ?? {};
  if (typeof fieldsIn !== "object" || Array.isArray(fieldsIn)) throw new Error("\"fields\" must be an object.");
  const fields: Record<string, FormProfileField> = {};
  for (const [key, f] of Object.entries(fieldsIn as Record<string, unknown>)) {
    const field = f as Partial<FormProfileField> | null;
    if (!field || typeof field !== "object") throw new Error(`fields.${key} must be an object.`);
    if (field.value != null && typeof field.value !== "string") throw new Error(`fields.${key}.value must be a string.`);
    if (field.aliases != null && (!Array.isArray(field.aliases) || field.aliases.some((a) => typeof a !== "string")))
      throw new Error(`fields.${key}.aliases must be a list of strings.`);
    fields[key] = { value: field.value ?? "", aliases: field.aliases ?? [] };
  }
  const answersIn = obj.answers ?? [];
  if (!Array.isArray(answersIn)) throw new Error("\"answers\" must be a list.");
  const answers = answersIn.map((a, i) => {
    const ans = a as Partial<FormProfileAnswer> | null;
    if (!ans || typeof ans.question !== "string" || typeof ans.answer !== "string")
      throw new Error(`answers[${i}] needs "question" and "answer" strings.`);
    return { question: ans.question, answer: ans.answer, scope: typeof ans.scope === "string" && ans.scope ? ans.scope : "always" };
  });
  if (obj.rules != null && typeof obj.rules !== "string") throw new Error("\"rules\" must be a string.");
  if (obj.redact != null && typeof obj.redact !== "boolean") throw new Error("\"redact\" must be true or false.");
  return { fields, answers, rules: (obj.rules as string | undefined) ?? "", redact: obj.redact !== false };
}

const storageKey = (profileId: string) => `formProfile:${profileId}`;

/** Stored profile with any newly-added default keys filled in. */
export async function loadFormProfile(profileId: string): Promise<FormProfile> {
  const rec = await db.metadata.get(storageKey(profileId));
  const base = emptyFormProfile();
  if (!rec?.value) return base;
  const stored = validateFormProfile(rec.value);
  return { ...stored, fields: { ...base.fields, ...stored.fields } };
}

export async function saveFormProfile(profileId: string, fp: FormProfile): Promise<void> {
  await db.metadata.put({ key: storageKey(profileId), value: fp });
}

// ── Matching ─────────────────────────────────────────────────────────────

export type ProposalSource = "profile" | "answer" | "model" | "eeo" | "none";

export interface Proposal {
  key?: string;
  value: string;
  source: ProposalSource;
}

export interface FieldDescriptor {
  label: string;
  autocomplete?: string;
}

export function isEeoQuestion(label: string): boolean {
  return EEO_PATTERN.test(label);
}

/** Key whose alias best matches the label: whole-label match, or (multi-word aliases only) containment; longest wins. */
export function matchFieldKey(field: FieldDescriptor, fp: FormProfile): string | null {
  const auto = field.autocomplete ? AUTOCOMPLETE_KEYS[field.autocomplete.split(/\s+/).pop() ?? ""] : undefined;
  if (auto && fp.fields[auto]) return auto;

  const label = normalizeLabel(field.label).replace(/^(your|please enter your|enter your)\s+/, "");
  if (!label) return null;
  const padded = ` ${label} `;
  let best: { key: string; len: number } | null = null;
  for (const [key, f] of Object.entries(fp.fields)) {
    for (const rawAlias of f.aliases) {
      const alias = normalizeLabel(rawAlias);
      if (!alias) continue;
      const hit = label === alias || (alias.includes(" ") && padded.includes(` ${alias} `));
      if (hit && (!best || alias.length > best.len)) best = { key, len: alias.length };
    }
  }
  return best?.key ?? null;
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeLabel(s).split(" ").filter((w) => w.length > 2));
}

function similar(a: string, b: string): boolean {
  if (normalizeLabel(a) === normalizeLabel(b)) return true;
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  ta.forEach((w) => tb.has(w) && inter++);
  return inter / (ta.size + tb.size - inter) >= 0.75;
}

/** Saved answer for this question: one scoped to `region` beats "always"; null if neither exists. */
export function findAnswer(label: string, fp: FormProfile, region: string | null): FormProfileAnswer | null {
  const candidates = fp.answers.filter((a) => similar(a.question, label));
  return (region ? candidates.find((a) => a.scope === region) : undefined) ?? candidates.find((a) => a.scope === "always") ?? null;
}

/** Deterministic proposal only — no model. Model-assisted key matches are layered on by the caller. */
export function proposeValue(field: FieldDescriptor, fp: FormProfile, region: string | null): Proposal {
  if (isEeoQuestion(field.label)) return { value: "", source: "eeo" };
  const answer = findAnswer(field.label, fp, region);
  if (answer) return { value: answer.answer, source: "answer" };
  const key = matchFieldKey(field, fp);
  if (key) return { key, value: fp.fields[key]?.value ?? "", source: "profile" };
  return { value: "", source: "none" };
}

export function addAlias(fp: FormProfile, key: string, label: string): FormProfile {
  const field = fp.fields[key];
  const alias = normalizeLabel(label);
  if (!field || !alias || field.aliases.some((a) => normalizeLabel(a) === alias)) return fp;
  return { ...fp, fields: { ...fp.fields, [key]: { ...field, aliases: [...field.aliases, alias] } } };
}

export function upsertAnswer(fp: FormProfile, question: string, answer: string, scope: string): FormProfile {
  const rest = fp.answers.filter((a) => !(similar(a.question, question) && a.scope === scope));
  return { ...fp, answers: [...rest, { question, answer, scope }] };
}

export function hasAnyValue(fp: FormProfile): boolean {
  return Object.values(fp.fields).some((f) => f.value.trim()) || fp.answers.length > 0;
}

// ── Learning from what the user typed ───────────────────────────────────

export interface TypedEntry {
  label: string;
  value: string;
  kind: "text" | "textarea";
  /** Form-profile key the field was matched to, if any. */
  key?: string;
  /** What Quiver proposed for it; an unchanged value teaches nothing. */
  proposed: string;
}

export interface LearnCandidate {
  label: string;
  value: string;
  /** Set: store as that field's value. Unset: store as a saved answer to `label`. */
  key?: string;
  checked: boolean;
}

/**
 * What the user typed that the form profile doesn't know yet. Long answers and
 * overwritten field values are offered unticked: they're often specific to one job.
 */
export function learnCandidates(entries: TypedEntry[], fp: FormProfile, region: string | null): LearnCandidate[] {
  const out: LearnCandidate[] = [];
  for (const e of entries) {
    const value = e.value.trim();
    if (!value || !e.label.trim() || isEeoQuestion(e.label) || value === e.proposed.trim()) continue;
    if (e.key && fp.fields[e.key]) {
      const current = fp.fields[e.key]!.value.trim();
      if (current !== value) out.push({ label: e.label, value, key: e.key, checked: !current });
      continue;
    }
    if (findAnswer(e.label, fp, region)?.answer.trim() === value) continue;
    out.push({ label: e.label, value, checked: e.kind === "text" });
  }
  return out;
}

export function applyLearned(fp: FormProfile, picked: LearnCandidate[], region: string | null): FormProfile {
  let next = fp;
  for (const c of picked) {
    if (c.key && next.fields[c.key]) {
      next = { ...next, fields: { ...next.fields, [c.key]: { ...next.fields[c.key]!, value: c.value } } };
      next = addAlias(next, c.key, c.label);
    } else {
      next = upsertAnswer(next, c.label, c.value, region || "always");
    }
  }
  return next;
}

// ── Model-assisted label → key matching ─────────────────────────────────

function classifyPrompt(labels: string[], keys: string[]): string {
  return [
    "Map each application-form field label to one of these profile keys, or \"none\" if no key clearly fits.",
    `Keys: ${keys.join(", ")}`,
    "Labels:",
    ...labels.map((l, i) => `${i}. ${l}`),
    `Answer with JSON only: {"matches": [${labels.map(() => "\"<key or none>\"").join(", ")}]} — one entry per label, same order.`,
  ].join("\n");
}

function parseMatches(raw: unknown, labels: string[], keys: string[]): Array<string | null> {
  const list = (raw as { matches?: unknown } | null)?.matches;
  return labels.map((_, i) => {
    const k = Array.isArray(list) ? list[i] : null;
    return typeof k === "string" && keys.includes(k) ? k : null;
  });
}

/** Chrome's built-in model, only when it's already downloaded — never triggers a multi-GB download. */
async function nanoSession(): Promise<any | null> {
  const lm = (globalThis as any).LanguageModel;
  if (!lm) return null;
  try {
    if ((await lm.availability()) !== "available") return null;
    return await lm.create();
  } catch {
    return null;
  }
}

/**
 * Labels → keys. Sends only labels and key names — never profile values.
 * Tries Gemini Nano (local) first, then the configured model.
 */
export async function classifyLabels(
  labels: string[],
  keys: string[],
  llm: LlmConfig | null
): Promise<{ matches: Array<string | null>; engine: "nano" | "model" }> {
  const prompt = classifyPrompt(labels, keys);
  const session = await nanoSession();
  if (session) {
    try {
      const schema = {
        type: "object",
        properties: { matches: { type: "array", items: { type: "string", enum: [...keys, "none"] } } },
        required: ["matches"],
      };
      const out = await session.prompt(prompt, { responseConstraint: schema });
      return { matches: parseMatches(JSON.parse(out), labels, keys), engine: "nano" };
    } catch {
      // fall through to the configured model
    } finally {
      session.destroy?.();
    }
  }
  if (!llm) throw new Error("No model available to identify fields.");
  const out = await runLlm("assistMatchFields", [{ role: "user", content: prompt }], llm);
  return { matches: parseMatches(extractJsonObject(out), labels, keys), engine: "model" };
}

// ── Seeding from the profile markdown ───────────────────────────────────

/** Values for the standard keys, taken only from what the profile states. The user confirms before saving. */
export async function extractFieldValues(profileMarkdown: string, keys: string[], llm: LlmConfig): Promise<Record<string, string>> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You extract contact and application details from a candidate profile. Copy values exactly as written in the profile. " +
        "If the profile does not state a value explicitly, use an empty string. Never guess, infer or invent.",
    },
    {
      role: "user",
      content: `Keys: ${keys.join(", ")}\n\nProfile:\n${profileMarkdown}\n\nAnswer with JSON only: an object mapping every key to a string.`,
    },
  ];
  const raw = extractJsonObject(await runLlm("assistExtractValues", messages, llm)) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of keys) if (typeof raw[k] === "string") out[k] = (raw[k] as string).trim();
  return out;
}

// ── Drafting free-text answers ──────────────────────────────────────────

export interface DraftRequest {
  question: string;
  maxLength: number | null;
  profileMarkdown: string;
  rules: string;
  jobText: string;
  hint?: string;
}

export function buildDraftMessages(req: DraftRequest): ChatMessage[] {
  const limit = req.maxLength ? `Hard limit: ${req.maxLength} characters.` : "Keep it under 150 words unless the question asks for more.";
  return [
    {
      role: "system",
      content: [
        "You draft answers to job-application questions on behalf of the candidate, in the first person.",
        "Use ONLY facts stated in the candidate profile. Do not invent employers, titles, degrees, certifications, dates, numbers or achievements. If the profile lacks something the question asks for, write around it rather than making it up.",
        "Be specific to this company and role, plain and direct, no clichés, no sign-off. Output only the answer text.",
        limit,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Question: ${req.question}`,
        req.hint ? `Candidate's note for this answer: ${req.hint}` : "",
        req.rules ? `Candidate's standing preferences:\n${req.rules}` : "",
        `Job:\n${req.jobText.slice(0, 12000)}`,
        `Candidate profile:\n${req.profileMarkdown}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export async function draftAnswer(req: DraftRequest, llm: LlmConfig): Promise<string> {
  const text = (await runLlm("assistDraftAnswer", buildDraftMessages(req), llm)).trim();
  return req.maxLength ? text.slice(0, req.maxLength) : text;
}
