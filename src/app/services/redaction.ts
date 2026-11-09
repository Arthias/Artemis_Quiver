// Swaps the user's name and home location for fixed tags before a prompt goes
// to a cloud model, and puts the real values back in the reply. The values come
// from the form profile, so this only hides what the user has filled in there.
//
// Deliberately narrow: contact details stay, except an email or link containing
// the user's name, which would undo the name tag. Country stays (work
// authorisation depends on it). Employers, titles and dates stay, and can still
// identify someone; this removes direct identifiers, it does not anonymise.
//
// Raw IndexedDB via readMeta, not Dexie: the background service worker uses this.
import type { ChatMessage, ModelEndpoint } from "../types/llm";
import { readMeta } from "./applyQueue";

const NAME_TAGS: Record<string, string> = {
  full_name: "CANDIDATE_FULL_NAME",
  first_name: "CANDIDATE_FIRST_NAME",
  last_name: "CANDIDATE_LAST_NAME",
  preferred_name: "CANDIDATE_PREFERRED_NAME",
};
const PLACE_TAGS: Record<string, string> = {
  address: "HOME_ADDRESS",
  postal_code: "HOME_POSTCODE",
  city: "HOME_CITY",
};

const EMAIL = String.raw`[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}`;
const LINK = String.raw`(?:https?:\/\/)?(?:[\p{L}\p{N}-]+\.)+\p{L}{2,}(?:\/[^\s)\]>"'|,]*)?`;
const TAG_LIKE = /\[\s*((?:CANDIDATE|HOME)[_\s-][^\]\n]*?)\s*\]/gi;
const UNRESTORED = /\[(?:CANDIDATE|HOME)_[A-Z0-9_]+\]/;

const NOTE =
  "Placeholders such as [CANDIDATE_FIRST_NAME] or [HOME_CITY] stand for the candidate's real details, which are known. " +
  "Write each placeholder exactly as given wherever that detail belongs. Never translate, alter or fill them in, and do not treat them as missing information.";

/** Fires when a reply still holds a tag after restoring; the app shows a warning. */
export const redactionEvents = new EventTarget();
export const UNRESTORED_TAG_EVENT = "unrestored-tag";

const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
const oneLine = (s: string) => s.trim().replace(/\s+/g, " ").normalize("NFC");

export interface Redactor {
  redact(text: string): string;
  redactMessages(messages: ChatMessage[]): ChatMessage[];
  restore(reply: string): string;
}

/** `values` maps form-profile keys to values. Null when there is nothing to hide. */
export function createRedactor(values: Record<string, string | undefined>): Redactor | null {
  const tagOf = new Map<string, string>(); // each spelling that gets replaced → tag
  const valueOf = new Map<string, string>(); // tag → real value
  const tokenTags = new Map<string, string>(); // email or link → tag
  const nameFragments = new Set<string>();

  const add = (tag: string, value: string) => {
    // Case-sensitive on purpose: "Mark" must not swallow the verb "mark".
    for (const v of [value, value.toUpperCase(), plain(value), plain(value).toUpperCase()]) {
      if (!tagOf.has(v)) tagOf.set(v, tag);
    }
    valueOf.set(tag, value);
  };

  const names = Object.entries(NAME_TAGS)
    .map(([key, tag]) => [tag, oneLine(values[key] ?? "")] as const)
    .filter(([, value]) => value);
  const places = Object.entries(PLACE_TAGS)
    .map(([key, tag]) => [tag, oneLine(values[key] ?? "")] as const)
    .filter(([, value]) => value);

  for (const [tag, value] of [...names, ...places]) add(tag, value);
  // Whole values first, so "Garcia" alone maps to a part of the surname only when
  // the surname is "Garcia Lopez". Lowercase particles ("de", "van") are skipped.
  for (const [tag, value] of names) {
    value.split(" ").forEach((word, i, words) => {
      if (word.length < 3) return;
      nameFragments.add(plain(word).toLowerCase());
      if (words.length > 1 && /^\p{Lu}/u.test(word) && !tagOf.has(word)) add(`${tag}_${i + 1}`, word);
    });
  }
  if (tagOf.size === 0) return null;

  const spellings = [...tagOf.keys()]
    .sort((a, b) => b.length - a.length)
    .map((v) => escapeRe(v).replace(/ /g, "\\s+"))
    .join("|");
  const bounded = String.raw`(?<![\p{L}\p{N}])(?:${spellings})(?![\p{L}\p{N}])`;
  const everything = new RegExp(`(${EMAIL}|${LINK})|${bounded}`, "gu");
  const onlyValues = new RegExp(bounded, "gu");

  const tagValue = (m: string) => `[${tagOf.get(oneLine(m))}]`;
  const containsName = (token: string) => {
    const squashed = plain(token).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return [...nameFragments].some((n) => squashed.includes(n));
  };
  const tagToken = (token: string) => {
    let tag = tokenTags.get(token);
    if (!tag) {
      tag = `CANDIDATE_${token.includes("@") ? "EMAIL" : "LINK"}_${tokenTags.size + 1}`;
      tokenTags.set(token, tag);
      valueOf.set(tag, token);
    }
    return `[${tag}]`;
  };

  // One pass over the text, so a surname like "Home" can't match inside an inserted tag.
  const redact = (text: string) =>
    text.replace(everything, (match, token?: string) => {
      if (!token) return tagValue(match);
      const trailing = /[.;:!?]+$/.exec(token)?.[0] ?? "";
      const bare = token.slice(0, token.length - trailing.length);
      return (containsName(bare) ? tagToken(bare) : bare.replace(onlyValues, tagValue)) + trailing;
    });

  return {
    redact,
    redactMessages(messages) {
      const out = messages.map((m) => ({ ...m, content: redact(m.content) }));
      if (out.every((m, i) => m.content === messages[i]!.content)) return out;
      const system = out.find((m) => m.role === "system");
      if (system) system.content += `\n\n${NOTE}`;
      else out.unshift({ role: "system", content: NOTE });
      return out;
    },
    restore(reply) {
      const restored = reply.replace(
        TAG_LIKE,
        (m, inner: string) => valueOf.get(inner.toUpperCase().replace(/[\s-]+/g, "_")) ?? m
      );
      if (UNRESTORED.test(restored)) {
        console.warn("[Artemis] A model reply still contains a privacy tag");
        redactionEvents.dispatchEvent(new Event(UNRESTORED_TAG_EVENT));
      }
      return restored;
    },
  };
}

const PRIVATE_NETWORK = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$)|\.local$/;

/** True unless the endpoint is on this machine or the LAN. Unparseable URLs count as cloud. */
export function isCloudEndpoint(endpoint: Pick<ModelEndpoint, "provider" | "baseUrl">): boolean {
  if (endpoint.provider === "webllm") return false;
  if (endpoint.provider === "anthropic" || endpoint.provider === "google-gemini") return true;
  if (endpoint.baseUrl.startsWith("/")) return false; // Vite dev proxy to a local server
  try {
    const host = new URL(endpoint.baseUrl).hostname;
    return !(PRIVATE_NETWORK.test(host) || !host.includes("."));
  } catch {
    return true;
  }
}

interface StoredFormProfile {
  fields?: Record<string, { value?: string }>;
  redact?: boolean;
}

export function privateValues(fields: StoredFormProfile["fields"] = {}): Record<string, string | undefined> {
  return Object.fromEntries([...Object.keys(NAME_TAGS), ...Object.keys(PLACE_TAGS)].map((k) => [k, fields[k]?.value]));
}

/** The active profile's redactor for this endpoint. A failed read rejects, so nothing goes out untagged. */
export async function redactorFor(endpoint: Pick<ModelEndpoint, "provider" | "baseUrl">): Promise<Redactor | null> {
  if (!isCloudEndpoint(endpoint)) return null;
  const id = await readMeta<string>("activeProfileId");
  if (typeof id !== "string") return null;
  const form = await readMeta<StoredFormProfile>(`formProfile:${id}`);
  if (!form || form.redact === false) return null;
  return createRedactor(privateValues(form.fields));
}
