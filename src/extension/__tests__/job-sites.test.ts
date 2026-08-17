import { describe, it, expect } from "vitest";
import {
  DEFAULT_JOB_SITES,
  parseSiteEntry,
  extractBaseUrl,
  matchJobSite,
  isKnownJobSite,
  toDomainEntry,
  urlToSiteEntry,
  entryFromUrlInput,
  normalizeSiteEntry,
} from "../job-sites";

describe("DEFAULT_JOB_SITES", () => {
  it("contains known job sites", () => {
    expect(DEFAULT_JOB_SITES).toContain("linkedin.com");
    expect(DEFAULT_JOB_SITES).toContain("indeed.com");
    expect(DEFAULT_JOB_SITES).toContain("glassdoor.com");
  });

  it("contains 13 sites", () => {
    expect(DEFAULT_JOB_SITES).toHaveLength(13);
  });
});

describe("parseSiteEntry", () => {
  it("parses plain domain", () => {
    expect(parseSiteEntry("linkedin.com")).toEqual({ domain: "linkedin.com" });
  });

  it("parses domain with path pattern", () => {
    expect(parseSiteEntry("linkedin.com/jobs/*")).toEqual({
      domain: "linkedin.com",
      pathPattern: "/jobs/*",
    });
  });

  it("parses domain with path without wildcard", () => {
    expect(parseSiteEntry("example.com/careers")).toEqual({
      domain: "example.com",
      pathPattern: "/careers",
    });
  });

  it("strips protocol", () => {
    expect(parseSiteEntry("https://linkedin.com/jobs/*")).toEqual({
      domain: "linkedin.com",
      pathPattern: "/jobs/*",
    });
  });

  it("lowercases the entry", () => {
    expect(parseSiteEntry("LinkedIn.com/Jobs/*")).toEqual({
      domain: "linkedin.com",
      pathPattern: "/jobs/*",
    });
  });

  it("strips trailing slashes", () => {
    expect(parseSiteEntry("linkedin.com/")).toEqual({ domain: "linkedin.com" });
  });

  it("handles empty entry gracefully", () => {
    expect(parseSiteEntry("")).toEqual({ domain: "" });
  });
});

describe("extractBaseUrl", () => {
  it("extracts scheme and host from full URL", () => {
    expect(extractBaseUrl("https://www.linkedin.com/jobs/view/123")).toBe(
      "https://www.linkedin.com"
    );
  });

  it("works with http", () => {
    expect(extractBaseUrl("http://indeed.com/view")).toBe("http://indeed.com");
  });

  it("works with URL without path", () => {
    expect(extractBaseUrl("https://monster.com")).toBe("https://monster.com");
  });
});

describe("matchJobSite", () => {
  const entries = ["linkedin.com", "indeed.com/jobs/*", "example.com/careers"];

  it("matches plain domain", () => {
    expect(matchJobSite("https://linkedin.com/jobs/123", entries)).toBe(true);
  });

  it("matches subdomain of plain domain", () => {
    expect(
      matchJobSite("https://www.linkedin.com/in/username", entries)
    ).toBe(true);
  });

  it("matches domain with matching path pattern", () => {
    expect(
      matchJobSite("https://indeed.com/jobs/view/456", entries)
    ).toBe(true);
  });

  it("rejects domain with non-matching path pattern", () => {
    expect(matchJobSite("https://indeed.com/company/reviews", entries)).toBe(
      false
    );
  });

  it("matches path pattern without wildcard", () => {
    expect(matchJobSite("https://example.com/careers/engineering", entries)).toBe(
      true
    );
  });

  it("rejects unknown domain", () => {
    expect(
      matchJobSite("https://unknown-site.com/jobs/123", entries)
    ).toBe(false);
  });

  it("returns false for invalid URL", () => {
    expect(matchJobSite("not-a-url", entries)).toBe(false);
  });

  it("matches exact path with wildcard pattern", () => {
    expect(matchJobSite("https://indeed.com/jobs/", entries)).toBe(true);
  });

  it("matches www subdomain with path pattern", () => {
    expect(
      matchJobSite("https://www.indeed.com/jobs/view/789", entries)
    ).toBe(true);
  });
});

describe("isKnownJobSite (backward-compatible)", () => {
  it("matches default site by exact hostname", () => {
    expect(isKnownJobSite("linkedin.com", [])).toBe(true);
  });

  it("matches default site by subdomain", () => {
    expect(isKnownJobSite("www.linkedin.com", [])).toBe(true);
  });

  it("matches unknown hostname when added as custom site", () => {
    expect(isKnownJobSite("myjobboard.com", ["myjobboard.com"])).toBe(true);
  });

  it("rejects unknown hostname", () => {
    expect(isKnownJobSite("example.com", [])).toBe(false);
  });

  it("extracts domain from custom site with path", () => {
    expect(
      isKnownJobSite("myjobboard.com", ["myjobboard.com/apply/*"])
    ).toBe(true);
  });

  it("strips protocol from custom site", () => {
    expect(
      isKnownJobSite("myjobboard.com", ["https://myjobboard.com"])
    ).toBe(true);
  });
});

describe("toDomainEntry (domain-only add)", () => {
  it("drops the path from a path-pinned entry", () => {
    expect(toDomainEntry("linkedin.com/jobs/view/123")).toBe("linkedin.com");
  });

  it("keeps a plain domain as-is", () => {
    expect(toDomainEntry("linkedin.com")).toBe("linkedin.com");
  });

  it("strips protocol and lowercases", () => {
    expect(toDomainEntry("HTTPS://www.LinkedIn.com/jobs/*")).toBe("www.linkedin.com");
  });
});

describe("urlToSiteEntry (popup enable-here)", () => {
  it("extracts hostname from a job URL, dropping the path", () => {
    expect(urlToSiteEntry("https://www.linkedin.com/jobs/view/123")).toBe("www.linkedin.com");
  });

  it("lowercases the hostname", () => {
    expect(urlToSiteEntry("https://Indeed.com/jobs/view/456")).toBe("indeed.com");
  });

  it("returns empty string for invalid URLs", () => {
    expect(urlToSiteEntry("not-a-url")).toBe("");
  });
});

describe("entryFromUrlInput (editable popup site URL)", () => {
  it("bare hostname yields a domain-only entry", () => {
    expect(entryFromUrlInput("www.awin.com")).toBe("www.awin.com");
  });

  it("URL with path yields a path-prefixed entry", () => {
    expect(entryFromUrlInput("https://www.awin.com/gb/careers/vacancies/123")).toBe(
      "www.awin.com/gb/careers/vacancies/123"
    );
  });

  it("path keeps a trailing wildcard", () => {
    expect(entryFromUrlInput("https://www.awin.com/gb/careers/vacancies/*")).toBe(
      "www.awin.com/gb/careers/vacancies/*"
    );
  });

  it("path without protocol is treated as https", () => {
    expect(entryFromUrlInput("www.awin.com/gb/careers/vacancies")).toBe(
      "www.awin.com/gb/careers/vacancies"
    );
  });

  it("root path collapses to domain-only", () => {
    expect(entryFromUrlInput("https://www.awin.com/")).toBe("www.awin.com");
  });

  it("trailing slashes on the path are stripped", () => {
    expect(entryFromUrlInput("https://www.awin.com/gb/careers/")).toBe(
      "www.awin.com/gb/careers"
    );
  });

  it("lowercases host and path", () => {
    expect(entryFromUrlInput("HTTPS://WWW.AWIN.COM/GB/Careers/Vacancies")).toBe(
      "www.awin.com/gb/careers/vacancies"
    );
  });

  it("garbage input falls back to domain-only", () => {
    expect(entryFromUrlInput("not a url")).toBe("not a url");
  });

  it("empty or whitespace input yields empty string", () => {
    expect(entryFromUrlInput("")).toBe("");
    expect(entryFromUrlInput("   ")).toBe("");
  });
});

describe("normalizeSiteEntry (legacy path-pin migration)", () => {
  it("collapses a legacy page-pin on a known job board to the domain", () => {
    expect(normalizeSiteEntry("www.linkedin.com/jobs/search-results")).toBe("www.linkedin.com");
  });

  it("collapses a subdomain pin on a known board", () => {
    expect(normalizeSiteEntry("linkedin.com/jobs/view/123")).toBe("linkedin.com");
  });

  it("preserves a deliberate wildcard pin on a known board", () => {
    expect(normalizeSiteEntry("linkedin.com/jobs/view/*")).toBe("linkedin.com/jobs/view/*");
  });

  it("preserves a path pin on a non-board site", () => {
    expect(normalizeSiteEntry("www.awin.com/gb/careers/vacancies")).toBe("www.awin.com/gb/careers/vacancies");
    expect(normalizeSiteEntry("app.welcometothejungle.com/jobs/")).toBe("app.welcometothejungle.com/jobs/");
  });

  it("leaves domain-only entries unchanged", () => {
    expect(normalizeSiteEntry("linkedin.com")).toBe("linkedin.com");
    expect(normalizeSiteEntry("www.hitachienergy.com")).toBe("www.hitachienergy.com");
  });
});
