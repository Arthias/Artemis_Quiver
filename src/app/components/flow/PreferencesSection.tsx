import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  getGeo,
  getPreferences,
  updatePreferences,
  type FlowGeo,
  type FlowModeSetting,
  type FlowPreferences,
} from "../../services/flowBridge";

type ListKey = "work_authorisation" | "remote_from" | "relocation_countries" | "languages";
type ModeKey = "remote" | "hybrid" | "onsite";

const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const toText = (l: string[]) => l.join(", ");

function modeChoice(m: FlowModeSetting): string {
  if (m == null) return "unset";
  if (typeof m === "boolean") return m ? "any" : "never";
  return "only";
}

/** The user's own constraints for Flow's eligibility judgement. Unset = Flow
 * filters nothing; every field is the user's call, nothing is assumed. */
export function PreferencesSection({ flowBaseUrl }: { flowBaseUrl: string }) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<FlowPreferences | null>(null);
  // Free text per list field, parsed on save, so typing a comma doesn't fight the input.
  const [text, setText] = useState<Record<ListKey, string>>({ work_authorisation: "", remote_from: "", relocation_countries: "", languages: "" });
  const [modeText, setModeText] = useState<Record<ModeKey, string>>({ remote: "", hybrid: "", onsite: "" });
  const [geo, setGeo] = useState<FlowGeo | null>(null);
  const [helperLang, setHelperLang] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPreferences(flowBaseUrl), getGeo(flowBaseUrl).catch(() => null)])
      .then(([p, g]) => {
        if (cancelled) return;
        setPrefs(p);
        setGeo(g);
        setText({
          work_authorisation: toText(p.work_authorisation),
          remote_from: toText(p.remote_from),
          relocation_countries: toText(p.relocation_countries),
          languages: toText(p.languages),
        });
        const m = p.work_modes;
        setModeText({
          remote: Array.isArray(m.remote) ? toText(m.remote) : "",
          hybrid: Array.isArray(m.hybrid) ? toText(m.hybrid) : "",
          onsite: Array.isArray(m.onsite) ? toText(m.onsite) : "",
        });
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [flowBaseUrl]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("config.flowPrefsLoading")}
      </div>
    );
  }
  if (!prefs) return error ? <p className="text-xs text-destructive">{error}</p> : null;

  const edit = (patch: Partial<FlowPreferences>) => { setPrefs({ ...prefs, ...patch }); setSaved(false); };
  const editText = (key: ListKey, value: string) => { setText({ ...text, [key]: value }); setSaved(false); };

  function setMode(key: ModeKey, choice: string) {
    const value: FlowModeSetting =
      choice === "unset" ? null : choice === "any" ? true : choice === "never" ? false : toList(modeText[key]);
    edit({ work_modes: { ...prefs!.work_modes, [key]: value } });
  }

  function addRelocation(codes: string[]) {
    const merged = [...new Set([...toList(text.relocation_countries), ...codes])];
    editText("relocation_countries", toText(merged));
  }

  async function handleSave() {
    const body: FlowPreferences = {
      ...prefs!,
      home_country: prefs!.home_country?.trim() || null,
      work_authorisation: toList(text.work_authorisation),
      remote_from: toList(text.remote_from),
      relocation_countries: toList(text.relocation_countries),
      languages: toList(text.languages),
      work_modes: {
        remote: modeChoice(prefs!.work_modes.remote) === "only" ? toList(modeText.remote) : prefs!.work_modes.remote,
        hybrid: modeChoice(prefs!.work_modes.hybrid) === "only" ? toList(modeText.hybrid) : prefs!.work_modes.hybrid,
        onsite: modeChoice(prefs!.work_modes.onsite) === "only" ? toList(modeText.onsite) : prefs!.work_modes.onsite,
      },
      review_by: prefs!.review_by || null,
    };
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePreferences(flowBaseUrl, body);
      setPrefs(updated);
      setText({
        work_authorisation: toText(updated.work_authorisation),
        remote_from: toText(updated.remote_from),
        relocation_countries: toText(updated.relocation_countries),
        languages: toText(updated.languages),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const allLanguages = geo ? [...new Set(geo.countries.flatMap((c) => c.languages))].sort() : [];
  const select = "h-9 rounded-md border border-input bg-input-background px-2 text-sm";

  return (
    <div className="space-y-3">
      <div>
        <Label>{t("config.flowPrefsTitle")}</Label>
        <p className="text-xs text-muted-foreground">{t("config.flowPrefsDesc")}</p>
      </div>

      <datalist id="flow-geo-codes">
        {geo?.regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        {geo?.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </datalist>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">{t("config.flowPrefsHomeCountry")}</Label>
          <Input
            list="flow-geo-codes"
            value={prefs.home_country ?? ""}
            placeholder="DE"
            onChange={(e) => edit({ home_country: e.target.value })}
            className="bg-input-background"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("config.flowPrefsDegree")}</Label>
          <select
            className={`${select} w-full`}
            value={prefs.has_degree == null ? "unset" : prefs.has_degree ? "yes" : "no"}
            onChange={(e) => edit({ has_degree: e.target.value === "unset" ? null : e.target.value === "yes" })}
          >
            <option value="unset">{t("config.flowPrefsUnset")}</option>
            <option value="yes">{t("config.flowPrefsYes")}</option>
            <option value="no">{t("config.flowPrefsNo")}</option>
          </select>
        </div>

        {(["work_authorisation", "remote_from", "relocation_countries", "languages"] as const).map((key) => (
          <div key={key} className="col-span-2">
            <Label className="text-xs text-muted-foreground">{t(`config.flowPrefs_${key}`)}</Label>
            <Input
              value={text[key]}
              placeholder={key === "languages" ? "English, German" : "EU, GB"}
              onChange={(e) => editText(key, e.target.value)}
              className="bg-input-background"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">{t(`config.flowPrefs_${key}_hint`)}</p>
            {key === "relocation_countries" && geo && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {geo.regions.filter((r) => ["EU", "EEA"].includes(r.code)).map((r) => (
                  <Button key={r.code} size="sm" variant="outline" onClick={() => addRelocation([r.code])}>+ {r.name}</Button>
                ))}
                <select className={select} value={helperLang} onChange={(e) => setHelperLang(e.target.value)}>
                  <option value="">{t("config.flowPrefsSpeakingPick")}</option>
                  {allLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!helperLang}
                  onClick={() => addRelocation(geo.countries.filter((c) => c.languages.includes(helperLang)).map((c) => c.code))}
                >
                  {t("config.flowPrefsSpeakingAdd")}
                </Button>
              </div>
            )}
          </div>
        ))}

        {(["remote", "hybrid", "onsite"] as const).map((key) => {
          const choice = modeChoice(prefs.work_modes[key]);
          return (
            <div key={key} className="col-span-2 grid grid-cols-[8rem_10rem_1fr] items-center gap-2">
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
                  onChange={(e) => { setModeText({ ...modeText, [key]: e.target.value }); setSaved(false); }}
                  className="bg-input-background"
                />
              )}
            </div>
          );
        })}

        <div>
          <Label className="text-xs text-muted-foreground">{t("config.flowPrefsDailyCap")}</Label>
          <Input
            type="number"
            min={1}
            value={prefs.daily_cap ?? ""}
            placeholder={t("config.flowPrefsUnset")}
            onChange={(e) => edit({ daily_cap: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
            className="bg-input-background"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{t("config.flowPrefsReviewBy")}</Label>
          <Input
            type="date"
            value={prefs.review_by ?? ""}
            onChange={(e) => edit({ review_by: e.target.value || null })}
            className="bg-input-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saved ? t("config.flowBacklogSaved") : t("config.flowBacklogSave")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
