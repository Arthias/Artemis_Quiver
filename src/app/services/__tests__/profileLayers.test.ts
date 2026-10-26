import { describe, expect, it } from "vitest";
import { ProfilePreferencesSchema, emptyPreferences, FINGERPRINT_MAX } from "../../types/preferences";
import { canonicalJson, isStale, makeLayer, preferencesFromCard, preferencesHash, renderFingerprint } from "../profileLayers";

describe("preferences schema", () => {
  it("reads Flow's shape, plain language names included", () => {
    const p = ProfilePreferencesSchema.parse({
      home_country: "ES", work_authorisation: ["EU"], languages: ["English", { name: "Spanish", level: "native" }],
      work_modes: { remote: true, hybrid: ["Madrid"], onsite: null }, has_degree: false,
    });
    expect(p.languages).toEqual([{ name: "English", level: null }, { name: "Spanish", level: "native" }]);
    expect(p.fields).toEqual([]);
    expect(p.work_modes.hybrid).toEqual(["Madrid"]);
  });

  it("rejects an unknown seniority level", () => {
    expect(ProfilePreferencesSchema.safeParse({ levels: ["wizard"] }).success).toBe(false);
  });
});

describe("preferencesFromCard", () => {
  it("keeps only places Flow can read and never guesses unstated values", () => {
    const p = preferencesFromCard({
      fields: ["backend engineering"], levels: ["senior", "guru"], skills: ["Go"],
      home: "Lyon, France", relocation_countries: ["Spain", "Atlantis"], remote: true,
      hybrid_places: [], has_degree: "maybe", years: -3,
    });
    expect(p.home_country).toBe("FR");
    expect(p.relocation_countries).toEqual(["ES"]);
    expect(p.levels).toEqual(["senior"]);
    expect(p.work_modes).toEqual({ remote: true, hybrid: null, onsite: null });
    expect(p.has_degree).toBeNull();
    expect(p.years).toBeNull();
  });
});

describe("renderFingerprint", () => {
  it("drops unset parts", () => {
    const p = { ...emptyPreferences(), skills: ["Python", "SQL"], years: 7 };
    expect(renderFingerprint(p)).toBe("Python, SQL | 7y");
    expect(renderFingerprint(emptyPreferences())).toBe("");
  });

  it("stays within the cap", () => {
    const long = "x".repeat(120);
    const p = { ...emptyPreferences(), fields: [long, long], skills: [long], domains: [long], levels: ["senior" as const] };
    expect(renderFingerprint(p).length).toBeLessThanOrEqual(FINGERPRINT_MAX);
  });
});

describe("staleness", () => {
  it("hashes equal values alike regardless of key order", async () => {
    const a = emptyPreferences();
    const b = ProfilePreferencesSchema.parse(JSON.parse(canonicalJson(a)));
    expect(await preferencesHash(a)).toBe(await preferencesHash(b));
  });

  it("is stale only when the source hash differs", () => {
    const layer = makeLayer("fp", "generated", "abc");
    expect(isStale(layer, "abc")).toBe(false);
    expect(isStale(layer, "def")).toBe(true);
    expect(isStale(undefined, "def")).toBe(false);
  });
});
