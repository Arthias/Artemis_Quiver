// Place codes for preferences, without Flow (Profile-Management-Spec §5).
// geo.json is a snapshot of Flow's GET /api/geo/countries: the exact set Flow
// accepts. Regenerate it from Artemis_Flow when Flow's list changes:
//   python -c "import json; from app.api.routes import geo_countries; json.dump(geo_countries(), open('geo.json','w'), indent=0)"
import geo from "../data/geo.json";

export interface GeoCountry { code: string; name: string; regions: string[]; languages: string[] }
export interface GeoRegion { code: string; name: string }

export const COUNTRIES: GeoCountry[] = geo.countries;
export const REGIONS: GeoRegion[] = geo.regions;

const byKey = new Map<string, string>();
for (const r of REGIONS) byKey.set(r.code.toLowerCase(), r.code);
for (const c of COUNTRIES) {
  byKey.set(c.code.toLowerCase(), c.code);
  byKey.set(c.name.toLowerCase(), c.code);
}

/** "Italy", "it", "IT" → "IT"; "eu" → "EU"; unknown → null. */
export function placeCode(value: string): string | null {
  return byKey.get(value.trim().toLowerCase()) ?? null;
}

/** Codes for a list of free-text places, plus the entries that matched nothing. */
export function placeCodes(values: string[]): { codes: string[]; unknown: string[] } {
  const codes = new Set<string>();
  const unknown: string[] = [];
  for (const v of values) {
    const code = placeCode(v);
    if (code) codes.add(code);
    else if (v.trim()) unknown.push(v.trim());
  }
  return { codes: [...codes].sort(), unknown };
}

export const ALL_LANGUAGES = [...new Set(COUNTRIES.flatMap((c) => c.languages))].sort();

export function countriesSpeaking(lang: string): string[] {
  return COUNTRIES.filter((c) => c.languages.includes(lang)).map((c) => c.code);
}
