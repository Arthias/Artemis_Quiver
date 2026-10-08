// Functions injected into an application page via chrome.scripting.executeScript
// (one call per frame — Ashby/Greenhouse forms are often a cross-origin iframe
// on the company's own site). Same rule as pageExtract.ts: each function is
// serialized and run in isolation, so it must not reference anything outside
// its own body. Arguments and return values must be JSON-serializable.

export interface ScannedField {
  /** Value of the data-artemis-field attribute, unique within its frame. */
  id: string;
  label: string;
  kind: "text" | "textarea";
  inputType: string;
  maxLength: number | null;
  required: boolean;
  value: string;
  autocomplete: string;
  name: string;
}

export interface ScannedFileInput {
  id: string;
  label: string;
}

/**
 * Finds the free-text fields and file inputs of the form(s) on the page and
 * tags each with a stable attribute. Fixed-choice fields (select, radio,
 * checkbox, custom comboboxes) are deliberately ignored — they're quick to do
 * by hand.
 */
export function scanFormFields(): { fields: ScannedField[]; fileInputs: ScannedFileInput[] } {
  const TEXT_TYPES = new Set(["", "text", "email", "tel", "url", "number", "search"]);
  const clean = (s: string | null | undefined) =>
    (s || "").replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim().slice(0, 300);

  function textOf(id: string): string {
    return id
      .split(/\s+/)
      .map((ref) => document.getElementById(ref)?.textContent || "")
      .join(" ");
  }

  function labelFor(el: HTMLElement): string {
    const id = el.getAttribute("id");
    if (id) {
      const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lab?.textContent?.trim()) return clean(lab.textContent);
    }
    const wrapping = el.closest("label");
    if (wrapping?.textContent?.trim()) return clean(wrapping.textContent);
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy && textOf(labelledBy).trim()) return clean(textOf(labelledBy));
    const aria = el.getAttribute("aria-label");
    if (aria?.trim()) return clean(aria);
    const legend = el.closest("fieldset")?.querySelector("legend");
    if (legend?.textContent?.trim()) return clean(legend.textContent);
    const placeholder = el.getAttribute("placeholder");
    if (placeholder?.trim()) return clean(placeholder);
    // Nearest ancestor (up to 4 levels) carrying a short piece of text.
    let node: HTMLElement | null = el.parentElement;
    for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
      const text = clean(node.innerText);
      if (text && text.length <= 200) return text;
    }
    return clean(el.getAttribute("name"));
  }

  const isVisible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

  let n = 0;
  const nextId = (el: HTMLElement) => {
    const existing = el.getAttribute("data-artemis-field");
    if (existing) return existing;
    const id = `f${n++}`;
    el.setAttribute("data-artemis-field", id);
    return id;
  };
  // Keep numbering clear of ids a previous scan already handed out.
  document.querySelectorAll("[data-artemis-field]").forEach((el) => {
    const m = /^f(\d+)$/.exec(el.getAttribute("data-artemis-field") || "");
    if (m) n = Math.max(n, Number(m[1]) + 1);
  });

  const fields: ScannedField[] = [];
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((el) => {
    const isArea = el instanceof HTMLTextAreaElement;
    const type = isArea ? "textarea" : (el.getAttribute("type") || "").toLowerCase();
    if (!isArea && !TEXT_TYPES.has(type)) return;
    if (el.disabled || el.readOnly || !isVisible(el)) return;
    // Text inputs that are really comboboxes (react-select, Ashby location) are fixed-choice in practice.
    if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") === "list") return;
    fields.push({
      id: nextId(el),
      label: labelFor(el),
      kind: isArea ? "textarea" : "text",
      inputType: type,
      maxLength: el.maxLength > 0 ? el.maxLength : null,
      required: el.required || el.getAttribute("aria-required") === "true",
      value: el.value,
      autocomplete: (el.getAttribute("autocomplete") || "").toLowerCase(),
      name: el.getAttribute("name") || "",
    });
  });

  const fileInputs: ScannedFileInput[] = [];
  // File inputs are usually visually hidden behind a styled button, so no visibility check.
  document.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((el) => {
    if (el.disabled) return;
    fileInputs.push({ id: nextId(el), label: labelFor(el) });
  });

  return { fields, fileInputs };
}

/**
 * Writes values through the native value setter and fires input/change/blur,
 * so React/Vue-controlled inputs pick the change up. Skips fields that have
 * vanished. Returns the ids actually filled.
 */
export function fillFormFields(values: Array<{ id: string; value: string }>): string[] {
  const filled: string[] = [];
  for (const { id, value } of values) {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-artemis-field="${id}"]`);
    if (!el) continue;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    el.focus();
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    filled.push(id);
  }
  return filled;
}

/** Current value of one tagged field, or null if it's gone. */
export function readFormField(id: string): string | null {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-artemis-field="${id}"]`);
  return el ? el.value : null;
}

/** Puts a file (base64) into the tagged file input and fires input/change. */
export function attachFileToInput(id: string, base64: string, filename: string, mime: string): boolean {
  const el = document.querySelector<HTMLInputElement>(`[data-artemis-field="${id}"]`);
  if (!el) return false;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], filename, { type: mime }));
  el.files = dt.files;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
