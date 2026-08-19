import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Workflow, Play, Pause, RefreshCw, Loader2, Search as SearchIcon, X } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useConfig } from "../context/ConfigContext";
import { BuilderAssistantPanel } from "../components/builder/BuilderAssistantPanel";
import { JobCard } from "../components/flow/JobCard";
import { JobDetailDialog } from "../components/flow/JobDetailDialog";
import {
  checkFlowHealth,
  getFlowDigest,
  getRankStatus,
  startRank,
  stopRank,
  getSearchStatus,
  startSearch,
  stopSearch,
  getJobsByStatus,
  getArchivedJobs,
  getDashboardStats,
  searchJobs,
  getStrategy,
  updateStrategy,
  generateStrategy,
  getStrategyHistory,
  type FlowStatus,
  type FlowJobSummary,
  type FlowRankStatus,
  type FlowSearchStatus,
  type FlowDashboardStats,
  type FlowStrategy,
  type FlowStrategyHistoryEntry,
} from "../services/flowBridge";
import { submitFlowFeedback } from "../services/flowChatService";

function FlowHeader({
  t,
  status,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  status: FlowStatus | null;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t("flow.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {status?.connected
                ? t("flow.totalJobs", { n: status.totalJobs ?? 0 })
                : t("flow.subtitle")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlBlock({
  label,
  status,
  busy,
  unavailable,
  onToggle,
  t,
}: {
  label: string;
  status: { running: boolean; phase?: string; message?: string; error?: string } | null;
  busy: boolean;
  unavailable: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const running = !!status?.running;
  return (
    <div className="rounded border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <Button size="sm" variant="outline" onClick={onToggle} disabled={busy || unavailable}>
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : running ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {running ? t("flow.pause") : t("flow.start")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {unavailable
          ? t("flow.controlUnavailable")
          : running
            ? status?.message || status?.phase || t("flow.running")
            : t("flow.idle")}
      </p>
      {status?.error && <p className="text-xs text-destructive">{status.error}</p>}
    </div>
  );
}

function JobCardList({
  jobs,
  loading,
  error,
  emptyMessage,
  onSelect,
}: {
  jobs: FlowJobSummary[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onClick={() => onSelect(job.id)} />
      ))}
    </div>
  );
}

const BOARD_STATUSES = ["new", "applied", "interviewing", "offer", "rejected"] as const;

function BoardTab({
  flowBaseUrl,
  refreshKey,
  onSelect,
  t,
}: {
  flowBaseUrl: string;
  refreshKey: number;
  onSelect: (id: string) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [byStatus, setByStatus] = useState<Record<string, FlowJobSummary[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(BOARD_STATUSES.map((s) => getJobsByStatus(flowBaseUrl, s)))
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, FlowJobSummary[]> = {};
        BOARD_STATUSES.forEach((s, i) => { next[s] = results[i]?.jobs ?? []; });
        setByStatus(next);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [flowBaseUrl, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
      {BOARD_STATUSES.map((status) => (
        <div key={status} className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold">{t(`flow.status_${status}`)}</h3>
            <span className="text-xs text-muted-foreground">{byStatus[status]?.length ?? 0}</span>
          </div>
          {(byStatus[status]?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">{t("flow.boardColumnEmpty")}</p>
          ) : (
            <div className="space-y-2">
              {(byStatus[status] ?? []).map((job) => (
                <JobCard key={job.id} job={job} onClick={() => onSelect(job.id)} compact />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ArchiveTab({
  flowBaseUrl,
  refreshKey,
  onSelect,
  t,
}: {
  flowBaseUrl: string;
  refreshKey: number;
  onSelect: (id: string) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [jobs, setJobs] = useState<FlowJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getArchivedJobs(flowBaseUrl)
      .then((d) => !cancelled && setJobs(d.jobs))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [flowBaseUrl, refreshKey]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("flow.archiveDesc")}</p>
      <JobCardList jobs={jobs} loading={loading} error={error} emptyMessage={t("flow.archiveEmpty")} onSelect={onSelect} />
    </div>
  );
}

const SEARCH_STATUSES = ["new", "applied", "interviewing", "offer", "rejected", "archived"] as const;
const SEARCH_SORT_OPTIONS = ["ingested_at", "date_posted", "score", "salary_max", "title"] as const;

function SearchTab({
  flowBaseUrl,
  refreshKey,
  onSelect,
  t,
}: {
  flowBaseUrl: string;
  refreshKey: number;
  onSelect: (id: string) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scoreMin, setScoreMin] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SEARCH_SORT_OPTIONS)[number]>("ingested_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [jobs, setJobs] = useState<FlowJobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce free-text search so we're not firing a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchText.trim()), 300);
    return () => clearTimeout(id);
  }, [searchText]);

  const hasFilters = debouncedSearch !== "" || statusFilter !== "all" || scoreMin !== "";

  function clearFilters() {
    setSearchText("");
    setStatusFilter("all");
    setScoreMin("");
    setSortBy("ingested_at");
    setSortDir("desc");
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const parsedScoreMin = scoreMin.trim() === "" ? undefined : Number(scoreMin);
    searchJobs(flowBaseUrl, {
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      scoreMin: parsedScoreMin !== undefined && Number.isFinite(parsedScoreMin) ? parsedScoreMin : undefined,
      sortBy,
      sortDir,
      limit: 100,
    })
      .then((d) => {
        if (cancelled) return;
        setJobs(d.jobs);
        setTotal(d.total);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [flowBaseUrl, refreshKey, debouncedSearch, statusFilter, scoreMin, sortBy, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("flow.searchPlaceholder")}
            className="pl-8"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("flow.filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("flow.filterAllStatuses")}</SelectItem>
            {SEARCH_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`flow.status_${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={0}
          max={100}
          value={scoreMin}
          onChange={(e) => setScoreMin(e.target.value)}
          placeholder={t("flow.filterScoreMin")}
          className="w-[110px]"
        />

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_SORT_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{t(`flow.sort_${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          title={t(sortDir === "desc" ? "flow.sortDesc" : "flow.sortAsc")}
        >
          {sortDir === "desc" ? "↓" : "↑"}
        </Button>

        {hasFilters && (
          <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
            <X className="w-3.5 h-3.5" />
            {t("flow.filterClear")}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {loading ? t("flow.searching") : t("flow.searchResults", { n: total })}
      </p>

      <JobCardList
        jobs={jobs}
        loading={loading}
        error={error}
        emptyMessage={t("flow.searchEmpty")}
        onSelect={onSelect}
      />
    </div>
  );
}

function arrayToText(arr: string[] | undefined | null): string {
  return (arr || []).join(", ");
}

function textToArray(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

function StrategyTab({
  flowBaseUrl,
  refreshKey,
  onChanged,
  t,
}: {
  flowBaseUrl: string;
  refreshKey: number;
  onChanged: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [strategy, setStrategy] = useState<FlowStrategy | null>(null);
  const [history, setHistory] = useState<FlowStrategyHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [keywordsText, setKeywordsText] = useState("");
  const [locationsText, setLocationsText] = useState("");
  const [excludeText, setExcludeText] = useState("");
  const [companiesText, setCompaniesText] = useState("");
  const [sourcesText, setSourcesText] = useState("");
  const [resultsWanted, setResultsWanted] = useState("50");
  const [salaryFloor, setSalaryFloor] = useState("");
  const [salaryFloorCurrency, setSalaryFloorCurrency] = useState("USD");

  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function applyToForm(s: FlowStrategy) {
    setKeywordsText(arrayToText(s.keywords));
    setLocationsText(arrayToText(s.locations));
    setExcludeText(arrayToText(s.exclude_keywords));
    setCompaniesText(arrayToText(s.target_companies));
    setSourcesText(arrayToText(s.sources));
    setResultsWanted(String(s.results_wanted ?? 50));
    setSalaryFloor(s.salary_floor != null ? String(s.salary_floor) : "");
    setSalaryFloorCurrency(s.salary_floor_currency || "USD");
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, h] = await Promise.all([
        getStrategy(flowBaseUrl),
        getStrategyHistory(flowBaseUrl, 10),
      ]);
      setStrategy(s);
      applyToForm(s);
      setHistory(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [flowBaseUrl]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey]);

  async function handleSave() {
    if (!strategy) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateStrategy(flowBaseUrl, {
        ...strategy,
        keywords: textToArray(keywordsText),
        locations: textToArray(locationsText),
        exclude_keywords: textToArray(excludeText),
        target_companies: textToArray(companiesText),
        sources: textToArray(sourcesText),
        results_wanted: Number(resultsWanted) || strategy.results_wanted,
        salary_floor: salaryFloor.trim() === "" ? null : Number(salaryFloor),
        salary_floor_currency: salaryFloorCurrency.trim() || "USD",
      });
      setStrategy(updated);
      applyToForm(updated);
      setHistory(await getStrategyHistory(flowBaseUrl, 10));
      onChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setSaveError(null);
    try {
      const updated = await generateStrategy(flowBaseUrl);
      setStrategy(updated);
      applyToForm(updated);
      setHistory(await getStrategyHistory(flowBaseUrl, 10));
      onChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!strategy) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t("flow.strategyCurrent")}</h3>
          <p className="text-xs text-muted-foreground">
            {strategy.version > 0 ? t("flow.strategyVersion", { v: strategy.version }) : t("flow.strategyNone")}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={regenerating || saving}>
          {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {t("flow.strategyRegenerate")}
        </Button>
      </div>

      {strategy.reasoning && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">{strategy.reasoning}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="strategy-keywords">{t("flow.strategyKeywords")}</Label>
          <Textarea id="strategy-keywords" rows={2} value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder={t("flow.strategyCommaHint")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="strategy-locations">{t("flow.strategyLocations")}</Label>
          <Textarea id="strategy-locations" rows={2} value={locationsText} onChange={(e) => setLocationsText(e.target.value)} placeholder={t("flow.strategyCommaHint")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="strategy-exclude">{t("flow.strategyExclude")}</Label>
          <Textarea id="strategy-exclude" rows={2} value={excludeText} onChange={(e) => setExcludeText(e.target.value)} placeholder={t("flow.strategyCommaHint")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="strategy-companies">{t("flow.strategyCompanies")}</Label>
          <Textarea id="strategy-companies" rows={2} value={companiesText} onChange={(e) => setCompaniesText(e.target.value)} placeholder={t("flow.strategyCommaHint")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="strategy-sources">{t("flow.strategySources")}</Label>
          <Input id="strategy-sources" value={sourcesText} onChange={(e) => setSourcesText(e.target.value)} placeholder={t("flow.strategyCommaHint")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="strategy-results">{t("flow.strategyResultsWanted")}</Label>
          <Input id="strategy-results" type="number" min={1} value={resultsWanted} onChange={(e) => setResultsWanted(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="strategy-salary">{t("flow.strategySalaryFloor")}</Label>
          <Input id="strategy-salary" type="number" min={0} value={salaryFloor} onChange={(e) => setSalaryFloor(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="strategy-currency">{t("flow.strategyCurrency")}</Label>
          <Input id="strategy-currency" value={salaryFloorCurrency} onChange={(e) => setSalaryFloorCurrency(e.target.value)} />
        </div>
      </div>

      {saveError && <p className="text-xs text-destructive">{saveError}</p>}

      <div className="flex items-center justify-between">
        <Button size="sm" onClick={handleSave} disabled={saving || regenerating}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t("flow.strategySave")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => applyToForm(strategy)} disabled={saving || regenerating}>
          {t("flow.strategyResetEdits")}
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("flow.strategyHistory")}</h3>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("flow.strategyHistoryEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.version} className="text-xs border border-border rounded-md p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">v{entry.version}</Badge>
                  <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                {entry.feedback && (
                  <p className="text-muted-foreground">{t("flow.strategyHistoryFeedback")}: {entry.feedback}</p>
                )}
                {entry.strategy?.reasoning && <p>{entry.strategy.reasoning}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsTab({ flowBaseUrl, refreshKey, t }: { flowBaseUrl: string; refreshKey: number; t: ReturnType<typeof useTranslation>["t"] }) {
  const [stats, setStats] = useState<FlowDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDashboardStats(flowBaseUrl)
      .then((s) => !cancelled && setStats(s))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [flowBaseUrl, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!stats) return null;

  const scored = stats.total_jobs - stats.unscored_count;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded border border-border p-3">
          <div className="text-2xl font-bold">{stats.total_jobs}</div>
          <div className="text-xs text-muted-foreground">{t("flow.statFound")}</div>
        </div>
        <div className="rounded border border-border p-3">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{scored}</div>
          <div className="text-xs text-muted-foreground">{t("flow.statScored")}</div>
        </div>
        <div className="rounded border border-border p-3">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.unscored_count}</div>
          <div className="text-xs text-muted-foreground">{t("flow.statUnscored")}</div>
        </div>
        <div className="rounded border border-border p-3">
          <div className="text-2xl font-bold">{stats.ingested_today}</div>
          <div className="text-xs text-muted-foreground">{t("flow.statToday")}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-medium mb-2">{t("flow.statByStatus")}</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.by_status).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">{t(`flow.status_${status}` as const)}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-border p-3">
          <h3 className="text-sm font-medium mb-2">{t("flow.statBySource")}</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.by_source).slice(0, 8).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{source || t("flow.unknownSource")}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("flow.lastScrape")}: {stats.last_scrape ? new Date(stats.last_scrape).toLocaleString() : t("flow.never")}
      </p>
    </div>
  );
}

export function Flow() {
  const { t } = useTranslation();
  const { config } = useConfig();
  const flowBaseUrl = config.flowBaseUrl;

  const [status, setStatus] = useState<FlowStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [digest, setDigest] = useState<FlowJobSummary[]>([]);
  const [digestError, setDigestError] = useState<string | null>(null);
  const [rankStatus, setRankStatus] = useState<FlowRankStatus | null>(null);
  const [searchStatus, setSearchStatus] = useState<FlowSearchStatus | null>(null);
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [rankBusy, setRankBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);
  const [strategyRefreshKey, setStrategyRefreshKey] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = status?.connected ?? false;

  const refresh = useCallback(async () => {
    if (!flowBaseUrl) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const s = await checkFlowHealth(flowBaseUrl);
    setStatus(s);
    setChecking(false);
    if (!s.connected) return;

    try {
      const d = await getFlowDigest(flowBaseUrl);
      setDigest(d.jobs);
      setDigestError(null);
    } catch (err) {
      setDigestError(err instanceof Error ? err.message : String(err));
    }

    try {
      setRankStatus(await getRankStatus(flowBaseUrl));
    } catch {
      setRankStatus(null);
    }

    // Search stop/status is Flow's Phase 2 work — not built yet on some deployments.
    try {
      setSearchStatus(await getSearchStatus(flowBaseUrl));
      setSearchAvailable(true);
    } catch {
      setSearchStatus(null);
      setSearchAvailable(false);
    }
  }, [flowBaseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const anyRunning = !!rankStatus?.running || !!searchStatus?.running;

  useEffect(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    if (!connected || !anyRunning) return;
    pollTimer.current = setInterval(refresh, 2000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [connected, anyRunning, refresh]);

  async function handleToggleRank() {
    if (!flowBaseUrl) return;
    setRankBusy(true);
    try {
      if (rankStatus?.running) await stopRank(flowBaseUrl);
      else await startRank(flowBaseUrl);
      await refresh();
    } finally {
      setRankBusy(false);
    }
  }

  async function handleToggleSearch() {
    if (!flowBaseUrl) return;
    setSearchBusy(true);
    try {
      if (searchStatus?.running) await stopSearch(flowBaseUrl);
      else await startSearch(flowBaseUrl);
      await refresh();
    } finally {
      setSearchBusy(false);
    }
  }

  async function handleChatSubmit(message?: string) {
    const text = (message ?? chatMessage).trim();
    if (!text || !flowBaseUrl) return;
    setChatLoading(true);
    setChatError(null);
    setChatResult(null);
    setChatMessage("");
    try {
      const result = await submitFlowFeedback(flowBaseUrl, text);
      if (result.error) {
        setChatError(result.error);
      } else if (result.refined) {
        setChatResult(result.strategy?.reasoning ? `${t("flow.chatApplied")} ${result.strategy.reasoning}` : t("flow.chatApplied"));
        setStrategyRefreshKey((k) => k + 1);
      } else {
        setChatResult(result.strategy?.reasoning ? `${t("flow.chatNoChange")} ${result.strategy.reasoning}` : t("flow.chatNoChange"));
      }
      await refresh();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatLoading(false);
    }
  }

  function handleStrategyChanged() {
    setStrategyRefreshKey((k) => k + 1);
  }

  function handleJobChanged() {
    setTrackingRefreshKey((k) => k + 1);
    refresh(); // digest/total-jobs count can shift too
  }

  if (!flowBaseUrl || (!checking && !connected)) {
    return (
      <div className="h-full flex flex-col">
        <FlowHeader t={t} status={null} />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="p-8 max-w-md text-center space-y-3">
            <Workflow className="w-8 h-8 mx-auto text-teal-500" />
            <h2 className="text-lg font-semibold">{t("flow.notConnectedTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("flow.notConnectedDesc")}</p>
            <Button asChild>
              <Link to="/config">{t("flow.goToSettings")}</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const chatSuggestions = [
    { title: t("flow.suggestionRemote"), hint: t("flow.suggestionRemoteHint"), prompt: "I'd like to focus on fully remote roles only from now on." },
    { title: t("flow.suggestionEurope"), hint: t("flow.suggestionEuropeHint"), prompt: "Expand the search to include roles across Italy and the rest of Europe, remote ideally." },
    { title: t("flow.suggestionExclude"), hint: t("flow.suggestionExcludeHint"), prompt: "Exclude staffing agencies and recruiter-posted listings from the results." },
  ];

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <FlowHeader t={t} status={status} />
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">{t("flow.controls")}</h2>
              <div className="grid grid-cols-2 gap-4">
                <ControlBlock
                  label={t("flow.search")}
                  status={searchStatus}
                  busy={searchBusy}
                  unavailable={!searchAvailable}
                  onToggle={handleToggleSearch}
                  t={t}
                />
                <ControlBlock
                  label={t("flow.scoring")}
                  status={rankStatus}
                  busy={rankBusy}
                  unavailable={false}
                  onToggle={handleToggleRank}
                  t={t}
                />
              </div>
            </Card>

            <Tabs defaultValue="digest">
              <TabsList>
                <TabsTrigger value="digest">{t("flow.tabDigest")}</TabsTrigger>
                <TabsTrigger value="board">{t("flow.tabBoard")}</TabsTrigger>
                <TabsTrigger value="strategy">{t("flow.tabStrategy")}</TabsTrigger>
                <TabsTrigger value="search">{t("flow.tabSearch")}</TabsTrigger>
                <TabsTrigger value="archive">{t("flow.tabArchive")}</TabsTrigger>
                <TabsTrigger value="stats">{t("flow.tabStats")}</TabsTrigger>
              </TabsList>

              <TabsContent value="digest" className="mt-4">
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{t("flow.digest")}</h2>
                    <Button size="sm" variant="ghost" onClick={refresh}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <JobCardList
                    jobs={digest}
                    loading={false}
                    error={digestError}
                    emptyMessage={t("flow.digestEmpty")}
                    onSelect={setSelectedJobId}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="board" className="mt-4">
                <Card className="p-6">
                  <BoardTab flowBaseUrl={flowBaseUrl} refreshKey={trackingRefreshKey} onSelect={setSelectedJobId} t={t} />
                </Card>
              </TabsContent>

              <TabsContent value="strategy" className="mt-4">
                <Card className="p-6">
                  <StrategyTab flowBaseUrl={flowBaseUrl} refreshKey={strategyRefreshKey} onChanged={handleStrategyChanged} t={t} />
                </Card>
              </TabsContent>

              <TabsContent value="search" className="mt-4">
                <Card className="p-6">
                  <SearchTab flowBaseUrl={flowBaseUrl} refreshKey={trackingRefreshKey} onSelect={setSelectedJobId} t={t} />
                </Card>
              </TabsContent>

              <TabsContent value="archive" className="mt-4">
                <Card className="p-6">
                  <ArchiveTab flowBaseUrl={flowBaseUrl} refreshKey={trackingRefreshKey} onSelect={setSelectedJobId} t={t} />
                </Card>
              </TabsContent>

              <TabsContent value="stats" className="mt-4">
                <Card className="p-6">
                  <StatsTab flowBaseUrl={flowBaseUrl} refreshKey={trackingRefreshKey} t={t} />
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <BuilderAssistantPanel
          suggestions={chatSuggestions}
          chatMessage={chatMessage}
          chatLoading={chatLoading}
          onChatMessageChange={setChatMessage}
          onSubmit={handleChatSubmit}
          accentClass="text-teal-500"
          panelBg="bg-muted/30"
        />
        {(chatResult || chatError) && (
          <div className="px-4 pb-4 bg-muted/30 border-l border-border">
            {chatResult && <p className="text-xs text-muted-foreground">{chatResult}</p>}
            {chatError && <p className="text-xs text-destructive">{chatError}</p>}
          </div>
        )}
      </div>

      <JobDetailDialog
        jobId={selectedJobId}
        flowBaseUrl={flowBaseUrl}
        onOpenChange={(open) => !open && setSelectedJobId(null)}
        onChanged={handleJobChanged}
      />
    </div>
  );
}
