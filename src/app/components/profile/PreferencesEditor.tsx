import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  LEVELS,
  ProfilePreferencesSchema,
  type ModeSetting,
  type ProfileLanguage,
  type ProfilePreferences,
} from "../../types/preferences";
import { ALL_LANGUAGES, COUNTRIES, REGIONS, countriesSpeaking, placeCode, placeCodes } from "../../utils/geo";

type PlaceKey = "work_authorisation" | "remote_from" | "relocation_countries";
type ListKey = PlaceKey | "languages" | "fields" | "skills" | "domains";
type ModeKey = "remote" | "hybrid" | "onsite";

const PLACE_KEYS: PlaceKey[] = ["work_authorisation", "remote_from", "relocation_countries"];
const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const toText = (l: string[]) => l.join(", ");

/** "English (C1), Spanish" ⇄ [{name: "English", level: "C1"}, {name: "Spanish", level: null}] */
const languagesToText = (l: ProfileLanguage[]) => toText(l.map((x) => (x.level ? `${x.name} (${x.level})` : x.name)));
function languagesFromText(s: string): ProfileLanguage[] {
  return toList(s).map((part) => {
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(part);
    return m ? { name: m[1]!.trim(), level: m[2]!.trim() || null } : { name: part, level: null };
  });
}

function modeChoice(m: ModeSetting): string {
  if (m == null) return "unset";
  if (typeof m === "boolean") return m ? "any" : "never";
  return "only";
}

function initialText(v: ProfilePreferences): Record<ListKey, string> {
  return {
    work_authorisation: toText(v.work_authorisation),
    remote_from: toText(v.remote_from),
    relocation_countries: toText(v.relocation_countries),
    languages: languagesToText(v.languages),
    fields: toText(v.fields),
    skills: toText(v.skills),
    domains: toText(v.domains),
  };
}

/**
 * The preferences card: the user's hard limits, and what they want to do.
 * Controlled; free-text lists keep the user's typing and are parsed on every
 * change. Places Flow cannot read are named under their field and left out.
 * Remount it (change `key`) to load a different value.
 */
export function PreferencesEditor({
  value,
  onChange,
}: {
  value: ProfilePreferences;
  onChange: (v: ProfilePreferences) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => initialText(value));
  const [modeText, setModeText] = useState<Record<ModeKey, string>>(() => ({
    remote: Array.isArray(value.work_modes.remote) ? toText(value.work_modes.remote) : "",
    hybrid: Array.isArray(value.work_modes.hybrid) ? toText(value.work_modes.hybrid) : "",
    onsite: Array.isArray(value.work_modes.onsite) ? toText(value.work_modes.onsite) : "",
  }));
  const [helperLang, setHelperLang] = useState("");
  const [homeText, setHomeText] = useState(value.home_country ?? "");

  const emit = (patch: Partial<ProfilePreferences>) => onChange(ProfilePreferencesSchema.parse({ ...value, ...patch }));

  function editText(key: ListKey, raw: string) {
    setText({ ...text, [key]: raw });
    if (key === "languages") emit({ languages: languagesFromText(raw) });
    else if ((PLACE_KEYS as string[]).includes(key)) emit({ [key]: placeCodes(toList(raw)).codes });
    else emit({ [key]: toList(raw) });
  }

  function setMode(key: ModeKey, choice: string, raw = modeText[key]) {
    const v: ModeSetting = choice === "unset" ? null : choice === "any" ? true : choice === "never" ? false : toList(raw);
    emit({ work_modes: { ...value.work_modes, [key]: v } });
  }

  function addRelocation(codes: string[]) {
    editText("relocation_countries", toText([...new Set([...toList(text.relocation_countries), ...codes])]));
  }

  const select = "h-9 rounded-md border border-input bg-input-background px-2 text-sm";
  const hint = "text-[11px] text-muted-foreground mt-0.5";

  return (
    <div className="space-y-6">
      <datalist id="pref-geo-codes">
        {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </datalist>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{t("profile.prefsLimitsTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("config.flowPrefsDesc")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t("config.flowPrefsHomeCountry")}</Label>
            <Input
              list="pref-geo-codes"
              value={homeText}
              placeholder="DE"
              onChange={(e) => { setHomeText(e.target.value); emit({ home_country: placeCode(e.target.value) }); }}
              className="bg-input-background"
            />
            {homeText.trim() && !placeCode(homeText) && (
              <p className="text-[11px] text-destructive">{t("profile.prefsUnknownPlaces", { places: homeText.trim() })}</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("config.flowPrefsDegree")}</Label>
            <select
              className={`${select} w-full`}
              value={value.has_degree == null ? "unset" : value.has_degree ? "yes" : "no"}
              onChange={(e) => emit({ has_degree: e.target.value === "unset" ? null : e.target.value === "yes" })}
            >
              <option value="unset">{t("config.flowPrefsUnset")}</option>
              <option value="yes">{t("config.flowPrefsYes")}</option>
              <option value="no">{t("config.flowPrefsNo")}</option>
            </select>
          </div>

          {PLACE_KEYS.map((key) => {
            const unknown = placeCodes(toList(text[key])).unknown;
            return (
              <div key={key} className="sm:col-span-2">
                <Label className="text-xs text-muted-foreground">{t(`config.flowPrefs_${key}`)}</Label>
                <Input
                  value={text[key]}
                  placeholder="EU, GB"
                  onChange={(e) => editText(key, e.target.value)}
                  className="bg-input-background"
                />
                <p className={hint}>{t(`config.flowPrefs_${key}_hint`)}</p>
                {unknown.length > 0 && (
                  <p className="text-[11px] text-destructive">{t("profile.prefsUnknownPlaces", { places: unknown.join(", ") })}</p>
                )}
                {key === "relocation_countries" && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {REGIONS.filter((r) => ["EU", "EEA"].includes(r.code)).map((r) => (
                      <Button key={r.code} size="sm" variant="outline" onClick={() => addRelocation([r.code])}>+ {r.name}</Button>
                    ))}
                    <select className={select} value={helperLang} onChange={(e) => setHelperLang(e.target.value)}>
                      <option value="">{t("config.flowPrefsSpeakingPick")}</option>
                      {ALL_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <Button size="sm" variant="outline" disabled={!helperLang} onClick={() => addRelocation(countriesSpeaking(helperLang))}>
                      {t("config.flowPrefsSpeakingAdd")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">{t("config.flowPrefs_languages")}</Label>
            <Input
              value={text.languages}
              placeholder="English (C1), German (native)"
              onChange={(e) => editText("languages", e.target.value)}
              className="bg-input-background"
            />
            <p className={hint}>{t("profile.prefsLanguagesHint")}</p>
          </div>

          {(["remote", "hybrid", "onsite"] as const).map((key) => {
            const choice = modeChoice(value.work_modes[key]);
            return (
              <div key={key} className="sm:col-span-2 grid grid-cols-[6rem_10rem_1fr] items-center gap-2">
                <Label className="text-xs text-muted-foreground">{t(`config.flowPrefsMode_${key}`)}</Label>
                <select className={select} value={choice} onChange={(e) => setMode(key, e.target.value)}>
                  <option value="unset">{t("config.flowPrefsUnset")}</option>
                  <option value="any">{t("config.flowPrefsModeAny")}</option>
                  <option value="never">{t("config.flowPrefsModeNever")}</option>
                  <option value="only">{t("config.flowPrefsModeOnly")}</option>
                </select>
                {choice === "only" && (
                  <Input
                    value={modeText[key]}
                    placeholder="Berlin, NL"
                    onChange={(e) => { setModeText({ ...modeText, [key]: e.target.value }); setMode(key, "only", e.target.value); }}
                    className="bg-input-background"
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{t("profile.prefsWorkTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("profile.prefsWorkDesc")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["fields", "skills", "domains"] as const).map((key) => (
            <div key={key} className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground">{t(`profile.prefs_${key}`)}</Label>
              <Input value={text[key]} onChange={(e) => editText(key, e.target.value)} className="bg-input-background" />
              <p className={hint}>{t(`profile.prefs_${key}_hint`)}</p>
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">{t("profile.prefs_levels")}</Label>
            <div className="flex flex-wrap gap-3 mt-1">
              {LEVELS.map((lvl) => (
                <label key={lvl} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={value.levels.includes(lvl)}
                    onChange={(e) =>
                      emit({ levels: LEVELS.filter((l) => (l === lvl ? e.target.checked : value.levels.includes(l))) })
                    }
                  />
                  {t(`profile.level_${lvl}`)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("profile.prefs_years")}</Label>
            <Input
              type="number"
              min={0}
              value={value.years ?? ""}
              placeholder={t("config.flowPrefsUnset")}
              onChange={(e) => emit({ years: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
              className="bg-input-background"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
