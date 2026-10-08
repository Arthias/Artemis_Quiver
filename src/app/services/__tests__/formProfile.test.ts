import { describe, it, expect } from "vitest";
import {
  emptyFormProfile,
  matchFieldKey,
  proposeValue,
  findAnswer,
  addAlias,
  upsertAnswer,
  validateFormProfile,
  buildDraftMessages,
} from "../formProfile";

function profile() {
  const fp = emptyFormProfile();
  fp.fields.first_name!.value = "Ada";
  fp.fields.email!.value = "ada@example.com";
  fp.fields.current_company!.value = "Analytical Engines Ltd";
  fp.fields.salary_expectation!.value = "€70k";
  return fp;
}

describe("matchFieldKey", () => {
  it("prefers the autocomplete token", () => {
    expect(matchFieldKey({ label: "Something odd", autocomplete: "given-name" }, profile())).toBe("first_name");
  });

  it("matches labels with punctuation, case and required markers stripped", () => {
    expect(matchFieldKey({ label: "E-mail Address" }, profile())).toBe("email");
    expect(matchFieldKey({ label: "LinkedIn Profile URL" }, profile())).toBe("linkedin");
  });

  it("single-word aliases only match the whole label", () => {
    expect(matchFieldKey({ label: "Name" }, profile())).toBe("full_name");
    // "name" must not swallow "Company name" — the longer multi-word alias wins.
    expect(matchFieldKey({ label: "Current company name" }, profile())).toBe("current_company");
    expect(matchFieldKey({ label: "Name of the person who referred you" }, profile())).toBeNull();
  });

  it("finds multi-word aliases inside longer questions", () => {
    expect(matchFieldKey({ label: "What are your salary expectations for this role?" }, profile())).toBe("salary_expectation");
  });
});

describe("answers and scope", () => {
  const fp = upsertAnswer(
    upsertAnswer(profile(), "Will you now or in the future require visa sponsorship?", "Yes", "US"),
    "Will you now or in the future require visa sponsorship?",
    "No",
    "EU"
  );

  it("picks the answer for the selected region", () => {
    const q = "Will you now, or in the future, require visa sponsorship?";
    expect(findAnswer(q, fp, "US")?.answer).toBe("Yes");
    expect(findAnswer(q, fp, "EU")?.answer).toBe("No");
    expect(findAnswer(q, fp, null)).toBeNull();
  });

  it("falls back to an 'always' answer", () => {
    const withAlways = upsertAnswer(fp, "How did you hear about this role?", "Company website", "always");
    expect(findAnswer("How did you hear about this role", withAlways, "UK")?.answer).toBe("Company website");
  });

  it("upsert replaces the same question+scope instead of duplicating", () => {
    const again = upsertAnswer(fp, "Will you now or in the future require visa sponsorship?", "Maybe", "US");
    expect(again.answers.filter((a) => a.scope === "US")).toHaveLength(1);
    expect(again.answers.find((a) => a.scope === "US")?.answer).toBe("Maybe");
  });
});

describe("proposeValue", () => {
  it("never proposes for demographic questions", () => {
    expect(proposeValue({ label: "What is your gender?" }, profile(), null).source).toBe("eeo");
    expect(proposeValue({ label: "Are you a protected veteran" }, profile(), null).source).toBe("eeo");
  });

  it("proposes profile values and reports unmatched fields", () => {
    expect(proposeValue({ label: "First Name" }, profile(), null)).toEqual({ key: "first_name", value: "Ada", source: "profile" });
    expect(proposeValue({ label: "Why do you want to work here?" }, profile(), null).source).toBe("none");
  });
});

describe("addAlias", () => {
  it("learns a label so it matches next time, without duplicates", () => {
    const label = "Who do you work for at the moment?";
    expect(matchFieldKey({ label }, profile())).not.toBe("current_company");
    const learned = addAlias(profile(), "current_company", label);
    expect(matchFieldKey({ label }, learned)).toBe("current_company");
    expect(addAlias(learned, "current_company", label)).toBe(learned);
  });
});

describe("validateFormProfile", () => {
  it("round-trips the default profile", () => {
    const fp = emptyFormProfile();
    expect(validateFormProfile(JSON.parse(JSON.stringify(fp)))).toEqual(fp);
  });

  it("rejects malformed input with a readable message", () => {
    expect(() => validateFormProfile([])).toThrow(/object/);
    expect(() => validateFormProfile({ fields: { email: { value: 3 } } })).toThrow(/fields.email.value/);
    expect(() => validateFormProfile({ answers: [{ question: "q" }] })).toThrow(/answers\[0\]/);
  });

  it("defaults a missing scope to always", () => {
    expect(validateFormProfile({ answers: [{ question: "q", answer: "a" }] }).answers[0]!.scope).toBe("always");
  });
});

describe("buildDraftMessages", () => {
  it("carries the no-fabrication rule, the length limit and the rules note", () => {
    const [system, user] = buildDraftMessages({
      question: "Why us?",
      maxLength: 500,
      profileMarkdown: "# Ada",
      rules: "Needs sponsorship in the US",
      jobText: "Engineer at Example",
    });
    expect(system!.content).toMatch(/Do not invent/);
    expect(system!.content).toMatch(/500 characters/);
    expect(user!.content).toMatch(/Needs sponsorship in the US/);
  });
});
