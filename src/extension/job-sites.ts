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

export function isKnownJobSite(hostname: string, customSites: string[]): boolean {
  const sites = [...DEFAULT_JOB_SITES, ...customSites.map((s) => s.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))];
  return sites.some((site) => hostname === site || hostname.endsWith("." + site));
}
