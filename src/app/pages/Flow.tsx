import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CaptureBlock, captureAvailable } from "../components/flow/CaptureBlock";
import { ApplyTab } from "../components/flow/ApplyTab";
import {
  checkFlowHealth,
  getFlowDigest,
  getRankStatus,
  startRank,
  stopRank,
  getSearchStatus,
  startSearch,
  stopSearch,
  getAutopilotStatus,
  startAutopilot,
  stopAutopilot,
  getJobsByStatus,
  getArchivedJobs,
  getDashboardStats,
  searchJobs,
  getStrategy,
  updateStrategy,
  generateStrategy,
  getStrategyHistory,
  getQueueSummary,
  getQueueJobs,
  startBoardSweep,
  type FlowQueueKey,
  type FlowJobListResponse,
  type FlowQueueSummary,
  type FlowStatus,
  type FlowJobSummary,
  type FlowRankStatus,
  type FlowSearchStatus,
  type FlowAutopilotStatus,
  type FlowDashboardStats,
  type FlowStrategy,
  type FlowStrategyHistoryEntry,
} from "../services/flowBridge";
import { submitFlowFeedback } from "../services/flowChatService";

const DIGEST_LAST_SEEN_KEY = "artemis:flowDigestLastSeen";

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
  lockedByAutopilot = false,
  onToggle,
  t,
}: {
  label: string;
  status: { running: boolean; phase?: string; message?: string; error?: string; current?: number; total?: number } | null;
  busy: boolean;
  unavailable: boolean;
  /** Autopilot is driving search+scoring itself — manual toggling would just
   * fight it, so the button is disabled and a note explains why. */
  lockedByAutopilot?: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const running = !!status?.running;
  return (
    <div className="rounded border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <Button size="sm" variant="outline" onClick={onToggle} disabled={busy || unavailable || lockedByAutopilot}>
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
        {lockedByAutopilot
          ? t("flow.controlledByAutopilot")
          : unavailable
            ? t("flow.controlUnavailable")
            : running
              ? status?.message || status?.phase || t("flow.running")
              : t("flow.idle")}
      </p>
      {running && !!status?.total && (
        <div className="h-1.5 rounded bg-muted overflow-hidden" title={`${status.current ?? 0}/${status.total}`}>
          <div
            className="h-full bg-teal-500 transition-all"
            style={{ width: `${Math.min(100, ((status.current ?? 0) / status.total) * 100)}%` }}
          />
        </div>
      )}
      {status?.error && <p className="text-xs text-destructive">{status.error}</p>}
    </div>
  );
}

function QueueStat({
  label, value, tone, active, onClick,
}: { label: string; value: number; tone?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded border p-2 text-left transition-colors hover:bg-accent/50 ${active ? "border-teal-500 bg-teal-500/5" : "border-border"}`}
    >
      <div className={`text-lg font-semibold ${tone ?? ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}

type QueueSelection = { queue: FlowQueueKey } | { archiveReason: string };
const QUEUE_PAGE_SIZE = 20;

/** One counter's jobs, newest capture first, a page at a time — a backlog can
 * run to thousands of rows and only one page is ever fetched. */
function QueueJobList({
  flowBaseUrl,
  filter,
  onSelect,
  t,
}: {
  flowBaseUrl: string;
  filter: QueueSelection;
  onSelect: (id: string) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<FlowJobListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getQueueJobs(flowBaseUrl, filter, page * QUEUE_PAGE_SIZE, QUEUE_PAGE_SIZE)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [flowBaseUrl, filter, page]);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {total > 0 && t("flow.queueListRange", {
            from: page * QUEUE_PAGE_SIZE + 1,
            to: Math.min(total, (page + 1) * QUEUE_PAGE_SIZE),
            total,
          })}
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={loading || page === 0} onClick={() => setPage((p) => p - 1)}>
              {t("flow.queueListPrev")}
            </Button>
            <span className="text-xs text-muted-foreground px-1">{page + 1} / {pages}</span>
            <Button size="sm" variant="outline" disabled={loading || page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              {t("flow.queueListNext")}
            </Button>
          </div>
        )}
      </div>
      <JobCardList
        jobs={data?.jobs ?? []}
        loading={loading}
        error={error}
        emptyMessage={t("flow.queueListEmpty")}
        onSelect={onSelect}
        showSummary
        showCaptured
      />
    </div>
  );
}

function QueueBlock({
  queue,
  flowBaseUrl,
  sweepBusy,
  onSweep,
  onSelect,
  t,
}: {
  queue: FlowQueueSummary;
  flowBaseUrl: string;
  sweepBusy: boolean;
  onSweep: (importLists: boolean) => void;
  onSelect: (id: string) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [importLists, setImportLists] = useState(false);
  const [selected, setSelected] = useState<QueueSelection | null>(null);
  const selectedKey = selected ? ("queue" in selected ? selected.queue : `archived:${selected.archiveReason}`) : null;
  const toggle = (key: string, next: QueueSelection) => setSelected(selectedKey === key ? null : next);
  const stat = (key: FlowQueueKey, label: string, value: number, tone?: string) => (
    <QueueStat label={label} value={value} tone={tone} active={selectedKey === key} onClick={() => toggle(key, { queue: key })} />
  );
  const archived = Object.entries(queue.archived_by_reason).sort((a, b) => b[1] - a[1]);
  const boards = Object.entries(queue.boards);
  const sweep = queue.sweep;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">{t("flow.queue")}</p>
        <div className={`grid gap-2 ${queue.prescreened ? "grid-cols-6" : "grid-cols-5"}`}>
          {stat("to_score", t("flow.queueToScore"), queue.to_score, "text-amber-600 dark:text-amber-400")}
          {stat("strong", t("flow.queueStrong"), queue.strong, "text-teal-600 dark:text-teal-400")}
          {stat("scored", t("flow.queueScored"), queue.scored)}
          {stat("parked", t("flow.queueParked"), queue.parked_no_description)}
          {stat("ineligible", t("flow.queueIneligible"), queue.ineligible)}
          {!!queue.prescreened && stat("prescreened", t("flow.queuePrescreened"), queue.prescreened)}
        </div>
        {archived.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 items-center">
            <span className="text-xs text-muted-foreground mr-1">{t("flow.queueArchived")}:</span>
            {archived.map(([reason, n]) => (
              <button
                key={reason}
                type="button"
                aria-pressed={selectedKey === `archived:${reason}`}
                onClick={() => toggle(`archived:${reason}`, { archiveReason: reason })}
              >
                <Badge
                  variant={selectedKey === `archived:${reason}` ? "default" : "outline"}
                  className="text-xs cursor-pointer"
                >
                  {reason.replace(/_/g, " ")} {n}
                </Badge>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <QueueJobList key={selectedKey} flowBaseUrl={flowBaseUrl} filter={selected} onSelect={onSelect} t={t} />
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2 gap-4">
          <div>
            <p className="text-sm font-medium">{t("flow.boards")}</p>
            <p className="text-xs text-muted-foreground">{t("flow.boardsDesc")}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={importLists} onChange={(e) => setImportLists(e.target.checked)} disabled={sweep.running} />
              {t("flow.boardsImport")}
            </label>
            <Button size="sm" variant="outline" onClick={() => onSweep(importLists)} disabled={sweepBusy || sweep.running}>
              {sweepBusy || sweep.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {sweep.running ? t("flow.boardsSweeping") : t("flow.boardsSweep")}
            </Button>
          </div>
        </div>
        {boards.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {boards.map(([ats, b]) => (
              <div key={ats} className="rounded border border-border p-2 text-xs">
                <div className="font-medium capitalize">{ats}</div>
                <div>{t("flow.boardsActive", { n: b.active })}</div>
                <div className="text-muted-foreground">{t("flow.boardsUnchecked", { n: b.unchecked, total: b.inactive })}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("flow.boardsNone")}</p>
        )}
        {!sweep.running && sweep.result && (
          <p className="text-xs text-muted-foreground mt-2">{t("flow.boardsLastSweep", { ...sweep.result })}</p>
        )}
        {sweep.error && <p className="text-xs text-destructive mt-2">{sweep.error}</p>}
      </div>
    </div>
  );
}

function AutopilotBlock({
  status,
  busy,
  onToggle,
  t,
}: {
  status: FlowAutopilotStatus | null;
  busy: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const enabled = !!status?.enabled;
  const reasonKey: Record<string, string> = {
    hard_cap: "flow.autopilotStoppedHardCap",
    exhausted: "flow.autopilotStoppedExhausted",
    no_strategy: "flow.autopilotStoppedNoStrategy",
    error: "flow.autopilotStoppedError",
    user: "flow.autopilotStoppedUser",
  };
  const stoppedReason = status?.stopped_reason ? reasonKey[status.stopped_reason] : null;
  // What the loop is doing right now: the running runner, else the last one
  // that finished (its message says why autopilot is idle, e.g. soft cap).
  const active = status?.search.running ? status.search : status?.rank.running ? status.rank : null;
  const step = active ?? [status?.search, status?.rank]
    .filter((s) => !!s?.finished_at)
    .sort((a, b) => (b!.finished_at! > a!.finished_at! ? 1 : -1))[0];
  const stepLabel = step === status?.search ? t("flow.autopilotStepSearch") : t("flow.autopilotStepRank");
  // Search and rank log lines are "HH:MM:SS ..." — merge and keep the newest.
  const recent = [...(status?.search.logs ?? []), ...(status?.rank.logs ?? [])].sort().slice(-40).reverse();

  return (
    <div className="rounded border border-teal-500/40 bg-teal-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{t("flow.autopilot")}</p>
          <p className="text-xs text-muted-foreground">{t("flow.autopilotDesc")}</p>
        </div>
        <Button size="sm" variant={enabled ? "outline" : "default"} onClick={onToggle} disabled={busy}>
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : enabled ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {enabled ? t("flow.autopilotStop") : t("flow.autopilotStart")}
        </Button>
      </div>
      {enabled && (
        <p className="text-xs text-muted-foreground">
          {t("flow.autopilotRunning", { ticks: status?.ticks ?? 0, backlog: status?.rank_backlog_unscored ?? 0 })}
          {status?.hard_cap?.cap != null &&
            ` ${t("flow.autopilotHardCap", { found: status.hard_cap.found, cap: status.hard_cap.cap, min: status.hard_cap.min_score })}`}
        </p>
      )}
      {enabled && status?.hard_cap_reached && (
        <p className="text-xs text-teal-700 dark:text-teal-400">{t("flow.autopilotHardCapReached")}</p>
      )}
      {enabled && step && (
        <p className="text-xs">
          {active && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}
          <span className="font-medium">{stepLabel}</span>
          {active && step.total > 0 && ` ${step.current}/${step.total}`}
          {" — "}
          {step.error || step.message || step.phase}
        </p>
      )}
      {enabled && recent.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">{t("flow.autopilotSteps")}</summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground">{recent.join("\n")}</pre>
        </details>
      )}
      {!enabled && stoppedReason && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{t(stoppedReason)}</p>
      )}
    </div>
  );
}

function JobCardList({
  jobs,
  loading,
  error,
  emptyMessage,
  onSelect,
  showSummary = false,
  showCaptured = false,
  newIds,
}: {
  jobs: FlowJobSummary[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onSelect: (id: string) => void;
  showSummary?: boolean;
  showCaptured?: boolean;
  newIds?: Set<string>;
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
        <JobCard
          key={job.id}
          job={job}
          onClick={() => onSelect(job.id)}
          showSummary={showSummary}
          showCaptured={showCaptured}
          isNew={newIds?.has(job.id) ?? false}
        />
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
  const [autopilotStatus, setAutopilotStatus] = useState<FlowAutopilotStatus | null>(null);
  const [autopilotAvailable, setAutopilotAvailable] = useState(true);
  const [autopilotBusy, setAutopilotBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [queue, setQueue] = useState<FlowQueueSummary | null>(null);
  const [sweepBusy, setSweepBusy] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);
  const [strategyRefreshKey, setStrategyRefreshKey] = useState(0);
  const [digestLastSeenAt, setDigestLastSeenAt] = useState<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Capture the previous "last visited" marker once per mount (so "new since
  // last visit" badges stay stable for the rest of this session), then push
  // the marker forward to now — the next time the app is opened, this visit
  // becomes the baseline.
  useEffect(() => {
    const stored = Number(localStorage.getItem(DIGEST_LAST_SEEN_KEY) || 0);
    setDigestLastSeenAt(stored || null);
    localStorage.setItem(DIGEST_LAST_SEEN_KEY, String(Date.now()));
  }, []);

  const digestNewIds = useMemo(() => {
    if (digestLastSeenAt == null) return new Set<string>();
    return new Set(
      digest
        .filter((j) => j.ingested_at && new Date(j.ingested_at).getTime() > digestLastSeenAt)
        .map((j) => j.id)
    );
  }, [digest, digestLastSeenAt]);

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

    // Queue summary is newer than everything above — hidden on an older Flow.
    try {
      setQueue(await getQueueSummary(flowBaseUrl));
    } catch {
      setQueue(null);
    }

    // Autopilot endpoints are newer still — same "may 404 on an older Flow" guard.
    try {
      setAutopilotStatus(await getAutopilotStatus(flowBaseUrl));
      setAutopilotAvailable(true);
    } catch {
      setAutopilotStatus(null);
      setAutopilotAvailable(false);
    }
  }, [flowBaseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const anyRunning =
    !!rankStatus?.running || !!searchStatus?.running || !!autopilotStatus?.enabled || !!queue?.sweep.running;
  const autopilotOn = !!autopilotStatus?.enabled;

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
    setStartError(null);
    try {
      if (rankStatus?.running) await stopRank(flowBaseUrl);
      else await startRank(flowBaseUrl);
      await refresh();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setRankBusy(false);
    }
  }

  async function handleToggleSearch() {
    if (!flowBaseUrl) return;
    setSearchBusy(true);
    setStartError(null);
    try {
      if (searchStatus?.running) await stopSearch(flowBaseUrl);
      else await startSearch(flowBaseUrl);
      await refresh();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearchBusy(false);
    }
  }

  async function handleToggleAutopilot() {
    if (!flowBaseUrl) return;
    setAutopilotBusy(true);
    setStartError(null);
    try {
      if (autopilotStatus?.enabled) await stopAutopilot(flowBaseUrl);
      else await startAutopilot(flowBaseUrl);
      await refresh();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutopilotBusy(false);
    }
  }

  async function handleSweep(importLists: boolean) {
    if (!flowBaseUrl) return;
    setSweepBusy(true);
    try {
      await startBoardSweep(flowBaseUrl, importLists);
      await refresh();
    } finally {
      setSweepBusy(false);
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
              {startError && <p className="text-sm text-destructive">{startError}</p>}
              {autopilotAvailable && (
                <AutopilotBlock
                  status={autopilotStatus}
                  busy={autopilotBusy}
                  onToggle={handleToggleAutopilot}
                  t={t}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                <ControlBlock
                  label={t("flow.search")}
                  status={searchStatus}
                  busy={searchBusy}
                  unavailable={!searchAvailable}
                  lockedByAutopilot={autopilotOn}
                  onToggle={handleToggleSearch}
                  t={t}
                />
                <ControlBlock
                  label={t("flow.scoring")}
                  status={rankStatus}
                  busy={rankBusy}
                  unavailable={false}
                  lockedByAutopilot={autopilotOn}
                  onToggle={handleToggleRank}
                  t={t}
                />
              </div>
              {queue && (
                <>
                  <Separator />
                  <QueueBlock
                    queue={queue}
                    flowBaseUrl={flowBaseUrl}
                    sweepBusy={sweepBusy}
                    onSweep={handleSweep}
                    onSelect={setSelectedJobId}
                    t={t}
                  />
                </>
              )}
              {captureAvailable && <CaptureBlock flowBaseUrl={flowBaseUrl} />}
            </Card>

            <Tabs defaultValue="digest">
              <TabsList>
                <TabsTrigger value="digest">{t("flow.tabDigest")}</TabsTrigger>
                <TabsTrigger value="board">{t("flow.tabBoard")}</TabsTrigger>
                <TabsTrigger value="strategy">{t("flow.tabStrategy")}</TabsTrigger>
                <TabsTrigger value="search">{t("flow.tabSearch")}</TabsTrigger>
                <TabsTrigger value="archive">{t("flow.tabArchive")}</TabsTrigger>
                <TabsTrigger value="stats">{t("flow.tabStats")}</TabsTrigger>
                <TabsTrigger value="apply">{t("flow.tabApply")}</TabsTrigger>
              </TabsList>

              <TabsContent value="digest" className="mt-4">
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{t("flow.digest")}</h2>
                    <Button size="sm" variant="ghost" onClick={refresh}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  {digestNewIds.size > 0 && (
                    <p className="text-xs text-teal-600 dark:text-teal-400 -mt-2">
                      {t("flow.digestNewSince", { n: digestNewIds.size })}
                    </p>
                  )}
                  <JobCardList
                    jobs={digest}
                    loading={false}
                    error={digestError}
                    emptyMessage={t("flow.digestEmpty")}
                    onSelect={setSelectedJobId}
                    showSummary
                    newIds={digestNewIds}
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

              <TabsContent value="apply" className="mt-4">
                <Card className="p-6">
                  <ApplyTab flowBaseUrl={flowBaseUrl} />
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

      <BuilderAssistantPanel
        suggestions={chatSuggestions}
        chatMessage={chatMessage}
        chatLoading={chatLoading}
        onChatMessageChange={setChatMessage}
        onSubmit={handleChatSubmit}
        accentClass="text-teal-500"
        panelBg="bg-muted/30"
        footer={(chatResult || chatError) && (
          <>
            {chatResult && <p className="text-xs text-muted-foreground">{chatResult}</p>}
            {chatError && <p className="text-xs text-destructive">{chatError}</p>}
          </>
        )}
      />


      <JobDetailDialog
        jobId={selectedJobId}
        flowBaseUrl={flowBaseUrl}
        onOpenChange={(open) => !open && setSelectedJobId(null)}
        onChanged={handleJobChanged}
      />
    </div>
  );
}
