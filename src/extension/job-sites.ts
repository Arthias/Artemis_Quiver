export interface SiteEntry {
  domain: string;
  pathPattern?: string;
}

export const DEFAULT_JOB_SITES = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "monster.com",
  "ziprecruiter.com",
  "careerbuilder.com",
  "dice.com",
  "simplyhired.com",
  "upwork.com",
  "freelancer.com",
  "stackoverflow.com",
  "weworkremotely.com",
  "remoteok.com",
];

export function parseSiteEntry(entry: string): SiteEntry {
  let cleaned = entry.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/\/+$/, "");
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx === -1) {
    return { domain: cleaned };
  }
  return {
    domain: cleaned.slice(0, slashIdx),
    pathPattern: cleaned.slice(slashIdx),
  };
}

// Drops any path pattern, leaving just the domain. Used when "add current site"
// should cover the whole site rather than pinning the overlay to a job URL.
export function toDomainEntry(entry: string): string {
  return parseSiteEntry(entry).domain;
}

// Converts a page URL into a domain-only site entry for storage.
export function urlToSiteEntry(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// Builds a site entry from a user-supplied URL/path input. A bare hostname (or
// root path) yields a domain-only entry; a path narrows the overlay to that
// prefix, so the overlay only loads on matching job paths. A trailing "*" is
// kept (prefix + wildcard), trailing "/" is dropped. Empty input => "".
export function entryFromUrlInput(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";
  let candidate = trimmed;
  if (!/^[a-z]+:\/\//i.test(candidate)) candidate = "https://" + candidate;
  let host = "";
  let path = "";
  try {
    const u = new URL(candidate);
    host = u.hostname;
    path = u.pathname;
  } catch {
    const parsed = parseSiteEntry(trimmed);
    host = parsed.domain;
    path = parsed.pathPattern || "";
  }
  if (!host) return "";
  if (!path || path === "/") return host;
  path = path.replace(/\/+$/, "");
  if (!path.startsWith("/")) path = "/" + path;
  return path === "/" ? host : host + path;
}

export function extractBaseUrl(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

export function domainMatches(entryDomain: string, hostname: string): boolean {
  return hostname === entryDomain || hostname.endsWith("." + entryDomain);
}

export function matchJobSite(url: string, entries: string[]): boolean {
  let hostname: string;
  let pathname: string;
  try {
    const u = new URL(url);
    hostname = u.hostname;
    pathname = u.pathname;
  } catch {
    return false;
  }
  for (const entry of entries) {
    const parsed = parseSiteEntry(entry);
    if (!domainMatches(parsed.domain, hostname)) continue;
    if (parsed.pathPattern) {
      const prefix = parsed.pathPattern.endsWith("*")
        ? parsed.pathPattern.slice(0, -1)
        : parsed.pathPattern;
      if (!pathname.startsWith(prefix)) continue;
    }
    return true;
  }
  return false;
}

export function isKnownJobSite(hostname: string, customSites: string[]): boolean {
  const all = [
    ...DEFAULT_JOB_SITES,
    ...customSites.map((s) => {
      const parsed = parseSiteEntry(s);
      return parsed.domain;
    }),
  ];
  return all.some((site) => hostname === site || hostname.endsWith("." + site));
}

// Match patterns used when registering the overlay content script for a site
// (chrome.scripting.registerContentScripts). Mirrors matchJobSite() semantics:
// subdomains match, and a path entry is treated as a prefix match.
export function siteToMatchPatterns(entry: string): string[] {
  const parsed = parseSiteEntry(entry);
  const domain = parsed.domain;
  const path = parsed.pathPattern ? (parsed.pathPattern.endsWith("*") ? parsed.pathPattern : parsed.pathPattern + "*") : "/*";
  const isLocalOrIp = domain.startsWith("localhost") || domain.startsWith("127.") || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(domain);
  if (isLocalOrIp) {
    return [`*://${domain}${path}`];
  }
  return [`*://${domain}${path}`, `*://*.${domain}${path}`];
}

// Origin patterns to request/revoke via chrome.permissions for a site.
export function siteToOriginPatterns(entry: string): string[] {
  const parsed = parseSiteEntry(entry);
  const domain = parsed.domain;
  const isLocalOrIp = domain.startsWith("localhost") || domain.startsWith("127.") || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(domain);
  if (isLocalOrIp) {
    return [`*://${domain}/*`];
  }
  return [`*://${domain}/*`, `*://*.${domain}/*`];
}
