import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { scanFormFields, fillFormFields, readFormField, attachFileToInput } from "../formPageScripts";

// Synthetic markup shaped like Ashby and Greenhouse application forms — no real data.
const ASHBY_LIKE = `
  <form>
    <div><label for="_systemfield_name">Name *</label><input id="_systemfield_name" type="text" required></div>
    <div><label for="_systemfield_email">Email *</label><input id="_systemfield_email" type="email"></div>
    <div><label for="loc">Location</label><input id="loc" role="combobox"></div>
    <div><label for="why">Why do you want to join us?</label><textarea id="why" maxlength="1000"></textarea></div>
    <div><label for="resume">Resume</label><input id="resume" type="file"></div>
    <div><select id="pick"><option>Yes</option></select></div>
    <input type="hidden" name="csrf" value="x">
    <input type="checkbox" id="agree">
  </form>`;

const GREENHOUSE_LIKE = `
  <form>
    <div class="field"><label>First Name<input id="first_name" type="text" autocomplete="given-name"></label></div>
    <div class="field"><input id="lnk" type="text" aria-label="LinkedIn Profile"></div>
    <fieldset><legend>Website</legend><input id="site" type="url"></fieldset>
    <div class="field"><input id="ph" type="text" placeholder="Phone"></div>
    <div><label for="cover">Cover Letter</label><input id="cover" type="file"></div>
    <div><label for="cv">Resume/CV</label><input id="cv" type="file"></div>
  </form>`;

beforeAll(() => {
  // jsdom has no layout and no CSS.escape.
  Element.prototype.getClientRects = function () {
    return [{}] as unknown as DOMRectList;
  };
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) };
});

describe("scanFormFields", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("finds text fields and textareas, skipping fixed-choice and hidden inputs", () => {
    document.body.innerHTML = ASHBY_LIKE;
    const { fields, fileInputs } = scanFormFields();
    expect(fields.map((f) => f.label)).toEqual(["Name", "Email", "Why do you want to join us?"]);
    expect(fields[0]!.required).toBe(true);
    expect(fields[2]).toMatchObject({ kind: "textarea", maxLength: 1000 });
    expect(fileInputs.map((f) => f.label)).toEqual(["Resume"]);
  });

  it("resolves wrapping labels, aria-label, legend and placeholder", () => {
    document.body.innerHTML = GREENHOUSE_LIKE;
    const { fields, fileInputs } = scanFormFields();
    expect(fields.map((f) => f.label)).toEqual(["First Name", "LinkedIn Profile", "Website", "Phone"]);
    expect(fields[0]!.autocomplete).toBe("given-name");
    expect(fileInputs.map((f) => f.label)).toEqual(["Cover Letter", "Resume/CV"]);
  });

  it("keeps ids stable across rescans", () => {
    document.body.innerHTML = ASHBY_LIKE;
    const first = scanFormFields().fields.map((f) => f.id);
    expect(scanFormFields().fields.map((f) => f.id)).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
});

describe("fillFormFields / readFormField", () => {
  it("sets values and fires input + change", () => {
    document.body.innerHTML = ASHBY_LIKE;
    const { fields } = scanFormFields();
    const email = document.getElementById("_systemfield_email") as HTMLInputElement;
    const events: string[] = [];
    email.addEventListener("input", () => events.push("input"));
    email.addEventListener("change", () => events.push("change"));

    const filled = fillFormFields([
      { id: fields[1]!.id, value: "ada@example.com" },
      { id: "missing", value: "x" },
    ]);
    expect(filled).toEqual([fields[1]!.id]);
    expect(email.value).toBe("ada@example.com");
    expect(events).toEqual(["input", "change"]);
    expect(readFormField(fields[1]!.id)).toBe("ada@example.com");
    expect(readFormField("missing")).toBeNull();
  });
});

describe("attachFileToInput", () => {
  it("puts the decoded file on the input and fires change", () => {
    document.body.innerHTML = ASHBY_LIKE;
    const { fileInputs } = scanFormFields();
    const input = document.getElementById("resume") as HTMLInputElement;
    let changed = false;
    input.addEventListener("change", () => (changed = true));

    // jsdom lacks DataTransfer; a minimal stand-in that yields a FileList-like.
    (globalThis as any).DataTransfer = class {
      private list: File[] = [];
      items = { add: (f: File) => this.list.push(f) };
      get files() {
        return Object.assign([...this.list], { item: (i: number) => this.list[i] ?? null });
      }
    };
    Object.defineProperty(input, "files", { writable: true, value: null });

    expect(attachFileToInput(fileInputs[0]!.id, btoa("%PDF-1.4"), "cv.pdf", "application/pdf")).toBe(true);
    expect(input.files![0]!.name).toBe("cv.pdf");
    expect(changed).toBe(true);
    expect(attachFileToInput("missing", "", "x", "y")).toBe(false);
  });
});
