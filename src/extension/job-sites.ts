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
