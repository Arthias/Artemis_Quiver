import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  applicationsExportUrl,
  deleteCompanyRule,
  getCompanyRules,
  putCompanyRule,
  type FlowCompanyRule,
} from "../../services/flowBridge";

const EMPTY: FlowCompanyRule = {
  display_name: "", aliases: [], kind: "block", max_applications: null, window_days: null,
  role_cooldown_days: null, until: null, reason: null, policy_url: null,
};

const num = (v: string) => (v ? Math.max(0, Number(v)) : null);

/** The user's per-company rules for the apply queue (block / ask / quota),
 * plus the export of the application record Flow keeps. */
export function CompanyRulesSection({ flowBaseUrl }: { flowBaseUrl: string }) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<FlowCompanyRule[] | null>(null);
  const [draft, setDraft] = useState<FlowCompanyRule>(EMPTY);
  const [aliasText, setAliasText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    getCompanyRules(flowBaseUrl)
      .then(setRules)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));

  useEffect(() => { void load(); }, [flowBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await putCompanyRule(flowBaseUrl, {
        ...draft,
        aliases: aliasText.split(",").map((a) => a.trim()).filter(Boolean),
      });
      setDraft(EMPTY);
      setAliasText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(key: string) {
    await deleteCompanyRule(flowBaseUrl, key).catch((err) => setError(String(err)));
    await load();
  }

  function edit(rule: FlowCompanyRule) {
    setDraft(rule);
    setAliasText(rule.aliases.join(", "));
  }

  const select = "h-9 rounded-md border border-input bg-input-background px-2 text-sm";
  const describe = (r: FlowCompanyRule) =>
    r.kind === "quota"
      ? t("config.flowRulesQuotaSummary", { n: r.max_applications ?? "?", days: r.window_days ?? "?" })
      : t(`config.flowRulesKind_${r.kind}`);

  return (
    <div className="space-y-3">
      <div>
        <Label>{t("config.flowRulesTitle")}</Label>
        <p className="text-xs text-muted-foreground">{t("config.flowRulesDesc")}</p>
      </div>

      {rules === null && !error && <Loader2 className="w-4 h-4 animate-spin" />}
      {rules && rules.length === 0 && <p className="text-xs text-muted-foreground">{t("config.flowRulesEmpty")}</p>}
      {rules && rules.length > 0 && (
        <ul className="space-y-1">
          {rules.map((r) => (
            <li key={r.company_key} className="flex items-center gap-2 text-sm">
              <button className="font-medium hover:underline text-left" onClick={() => edit(r)}>{r.display_name}</button>
              <span className="text-xs text-muted-foreground">
                {describe(r)}{r.until ? ` · ${t("config.flowRulesUntil")} ${r.until}` : ""}{r.reason ? ` · ${r.reason}` : ""}
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove(r.company_key!)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input placeholder={t("config.flowRulesCompany")} value={draft.display_name}
          onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} className="bg-input-background" />
        <select className={select} value={draft.kind}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as FlowCompanyRule["kind"] })}>
          {(["block", "ask", "quota"] as const).map((k) => <option key={k} value={k}>{t(`config.flowRulesKind_${k}`)}</option>)}
        </select>
        {draft.kind === "quota" && (
          <>
            <Input type="number" min={1} placeholder={t("config.flowRulesMax")} value={draft.max_applications ?? ""}
              onChange={(e) => setDraft({ ...draft, max_applications: num(e.target.value) })} className="bg-input-background" />
            <Input type="number" min={1} placeholder={t("config.flowRulesWindow")} value={draft.window_days ?? ""}
              onChange={(e) => setDraft({ ...draft, window_days: num(e.target.value) })} className="bg-input-background" />
            <Input type="number" min={1} placeholder={t("config.flowRulesCooldown")} value={draft.role_cooldown_days ?? ""}
              onChange={(e) => setDraft({ ...draft, role_cooldown_days: num(e.target.value) })} className="bg-input-background" />
            <Input placeholder={t("config.flowRulesPolicyUrl")} value={draft.policy_url ?? ""}
              onChange={(e) => setDraft({ ...draft, policy_url: e.target.value || null })} className="bg-input-background" />
          </>
        )}
        <Input placeholder={t("config.flowRulesAliases")} value={aliasText}
          onChange={(e) => setAliasText(e.target.value)} className="bg-input-background" />
        <Input type="date" title={t("config.flowRulesUntil")} value={draft.until ?? ""}
          onChange={(e) => setDraft({ ...draft, until: e.target.value || null })} className="bg-input-background" />
        <Input className="col-span-2 bg-input-background" placeholder={t("config.flowRulesReason")} value={draft.reason ?? ""}
          onChange={(e) => setDraft({ ...draft, reason: e.target.value || null })} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={save} disabled={busy || !draft.display_name.trim()}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("config.flowRulesSave")}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{t("config.flowExportApplications")}</span>
        <a className="text-xs underline" href={applicationsExportUrl(flowBaseUrl, "csv")} download="applications.csv">CSV</a>
        <a className="text-xs underline" href={applicationsExportUrl(flowBaseUrl, "json")} download="applications.json">JSON</a>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
