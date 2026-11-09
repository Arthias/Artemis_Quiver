import { describe, it, expect } from "vitest";
import { createRedactor, isCloudEndpoint, redactionEvents, UNRESTORED_TAG_EVENT } from "../redaction";

const make = (extra: Record<string, string> = {}) =>
  createRedactor({ first_name: "Jane", last_name: "Doe", city: "Springfield", postal_code: "12345", address: "1 Elm Street", ...extra })!;

describe("redact", () => {
  it("tags name and home location and round-trips them", () => {
    const r = make();
    const out = r.redact("Jane Doe, 1 Elm Street, 12345 Springfield, France");
    expect(out).toBe("[CANDIDATE_FIRST_NAME] [CANDIDATE_LAST_NAME], [HOME_ADDRESS], [HOME_POSTCODE] [HOME_CITY], France");
    expect(r.restore(out)).toBe("Jane Doe, 1 Elm Street, 12345 Springfield, France");
  });

  it("matches ALL CAPS and unaccented spellings, not lowercase words", () => {
    const r = createRedactor({ first_name: "Mark", last_name: "García" })!;
    expect(r.redact("MARK GARCÍA and Mark Garcia")).not.toMatch(/mark|garc/i);
    expect(r.redact("please mark this")).toBe("please mark this");
  });

  it("does not match inside longer words", () => {
    expect(make().redact("Janet Doerr")).toBe("Janet Doerr");
  });

  it("keeps contact details unless they contain the name", () => {
    const r = make();
    expect(r.redact("x@mail.com, +39 333 1234567, github.com/octo/repo.")).toBe("x@mail.com, +39 333 1234567, github.com/octo/repo.");
    const out = r.redact("jane.doe@mail.com, https://linkedin.com/in/janedoe.");
    expect(out).toBe("[CANDIDATE_EMAIL_1], [CANDIDATE_LINK_2].");
    expect(r.restore(out)).toBe("jane.doe@mail.com, https://linkedin.com/in/janedoe.");
  });

  it("gives the same token the same tag", () => {
    const r = make();
    expect(r.redact("jane@x.com jane@x.com")).toBe("[CANDIDATE_EMAIL_1] [CANDIDATE_EMAIL_1]");
  });

  it("tags each part of a compound surname", () => {
    const r = createRedactor({ last_name: "García López" })!;
    const out = r.redact("García López, also López");
    expect(out).not.toMatch(/L[oó]pez/);
    expect(r.restore(out)).toBe("García López, also López");
  });

  it("does not re-tag inside an inserted tag", () => {
    const r = createRedactor({ last_name: "Home", city: "Paris" })!;
    expect(r.redact("Paris Home")).toBe("[HOME_CITY] [CANDIDATE_LAST_NAME]");
  });

  it("returns null with nothing to hide", () => {
    expect(createRedactor({ first_name: " ", city: undefined })).toBeNull();
  });
});

describe("redactMessages", () => {
  it("adds the instruction to the system message only when something was tagged", () => {
    const r = make();
    const sys = { role: "system" as const, content: "S" };
    const tagged = r.redactMessages([sys, { role: "user", content: "Jane" }]);
    expect(tagged[0]!.content).toContain("Never translate");
    expect(tagged[1]!.content).toBe("[CANDIDATE_FIRST_NAME]");
    expect(sys.content).toBe("S");
    expect(r.redactMessages([sys])).toEqual([sys]);
  });

  it("adds a system message when there is none", () => {
    expect(make().redactMessages([{ role: "user", content: "Jane" }])[0]!.role).toBe("system");
  });
});

describe("restore", () => {
  it("accepts tags the model changed the case or separators of", () => {
    expect(make().restore("[candidate first name] [ HOME-CITY ]")).toBe("Jane Springfield");
  });

  it("keeps ordinary bracketed text and warns only on real leftovers", () => {
    let fired = 0;
    const on = () => fired++;
    redactionEvents.addEventListener(UNRESTORED_TAG_EVENT, on);
    const r = make();
    expect(r.restore("[Home office]")).toBe("[Home office]");
    expect(fired).toBe(0);
    expect(r.restore("[CANDIDATE_PHONE]")).toBe("[CANDIDATE_PHONE]");
    expect(fired).toBe(1);
    redactionEvents.removeEventListener(UNRESTORED_TAG_EVENT, on);
  });
});

describe("isCloudEndpoint", () => {
  const compat = (baseUrl: string) => isCloudEndpoint({ provider: "openai-compatible", baseUrl });

  it("treats this machine and the LAN as local", () => {
    for (const u of ["http://localhost:1234", "http://127.0.0.1:1", "http://192.168.1.9:1234", "http://172.20.0.2", "http://servito.local:1234", "http://servito:1234", "/api/lmstudio"]) {
      expect(compat(u), u).toBe(false);
    }
    expect(isCloudEndpoint({ provider: "webllm", baseUrl: "" })).toBe(false);
  });

  it("treats everything else, including bad URLs, as cloud", () => {
    for (const u of ["https://openrouter.ai/api", "http://172.32.0.1", ""]) expect(compat(u), u).toBe(true);
    expect(isCloudEndpoint({ provider: "anthropic", baseUrl: "http://localhost" })).toBe(true);
  });
});
