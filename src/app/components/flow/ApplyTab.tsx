/// <reference types="chrome" />
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { getActiveProfileId } from "../../db";
import { getApplyQueue, type FlowQueueItem, type FlowVerdict } from "../../services/flowBridge";
import {
  discardOp,
  drainOutbox,
  loadQueue,
  logOutsideApplication,
  outbox,
  overrideExcluded,
  pendingCompanies,
  saveQueue,
  type OutboxOp,
  type StoredQueue,
} from "../../services/applyQueue";

export const QUEUE_UPDATED = "ARTEMIS_APPLY_QUEUE_UPDATED";

const TONE: Record<FlowVerdict["verdict"], string> = {
  pass: "text-green-600 dark:text-green-400",
  ask: "text-amber-600 dark:text-amber-400",
  block: "text-red-600 dark:text-red-400",
  no_evidence: "text-muted-foreground",
};

export function Verdicts({ verdicts }: { verdicts: FlowVerdict[] }) {
  const { t } = useTranslation();
  return (
    <ul className="text-xs space-y-0.5">
      {verdicts.map((v, i) => (
        <li key={i}>
          <span className={`font-medium ${TONE[v.verdict]}`}>{t(`flow.applyVerdict_${v.verdict}`)}</span>
          <span className="text-muted-foreground"> · {v.gate}: {v.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function notifyPanel() {
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: QUEUE_UPDATED }).catch(() => {});
  }
}

export function ApplyTab({ flowBaseUrl }: { flowBaseUrl: string }) {
  const { t } = useTranslation();
  const [minScore, setMinScore] = useState(70);
  const [maxScore, setMaxScore] = useState(100);
  const [limit, setLimit] = useState(10);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [queue, setQueue] = useState<StoredQueue | undefined>();
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outside, setOutside] = useState({ company: "", title: "", job_url: "", applied_at: "" });

  const reload = useCallback(async () => {
    const id = await getActiveProfileId();
    setProfileId(id ?? null);
    if (id) setQueue(await loadQueue(id));
    setOps(await outbox());
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // Looked up ahead of time: sidePanel.open must be called synchronously in the click.
  const [windowId, setWindowId] = useState<number | null>(null);
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.sidePanel && chrome.windows) {
      chrome.windows.getCurrent().then((w) => setWindowId(w.id ?? null)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
    const handler = (msg: { type?: string }) => { if (msg?.type === QUEUE_UPDATED) void reload(); };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [reload]);

  async function start() {
    if (!profileId) return;
    // Open the side panel first: it needs this click's user gesture.
    if (windowId != null) chrome.sidePanel.open({ windowId }).catch(() => {});
    setBusy(true);
    setError(null);
    try {
      const q = await getApplyQueue(flowBaseUrl, { minScore, maxScore, limit, excludeCompanies: await pendingCompanies() });
      setQueue(await saveQueue(profileId, flowBaseUrl, q));
      notifyPanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function override(item: FlowQueueItem) {
    if (!profileId) return;
    const reason = window.prompt(t("flow.applyOverridePrompt", { company: item.company }));
    if (!reason?.trim()) return;
    setQueue(await overrideExcluded(profileId, item.job_id, reason.trim()));
    notifyPanel();
  }

  async function sync() {
    setBusy(true);
    await drainOutbox().catch(() => {});
    await reload();
    setBusy(false);
  }

  async function logOutside() {
    await logOutsideApplication(flowBaseUrl, {
      company: outside.company.trim(),
      title: outside.title.trim(),
      job_url: outside.job_url.trim() || undefined,
      applied_at: outside.applied_at ? new Date(outside.applied_at).toISOString() : undefined,
    });
    setOutside({ company: "", title: "", job_url: "", applied_at: "" });
    await drainOutbox().catch(() => {});
    await reload();
  }

  const done = queue?.items.filter((i) => i.state === "done").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("flow.applyTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("flow.applyDesc")}</p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-xs text-muted-foreground">{t("flow.applyMinScore")}</Label>
            <Input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-24" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("flow.applyMaxScore")}</Label>
            <Input type="number" min={0} max={100} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className="w-24" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("flow.applyLimit")}</Label>
            <Input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-24" />
          </div>
          <Button onClick={start} disabled={busy || !profileId}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {t("flow.applyStart")}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {ops.length > 0 && (
        <div className="rounded-md border border-amber-500/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-sm">{t("flow.applyUnrecorded", { n: ops.length })}</p>
            <Button size="sm" variant="outline" className="ml-auto" onClick={sync} disabled={busy}>
              <RefreshCw className="w-4 h-4" /> {t("flow.applySyncNow")}
            </Button>
          </div>
          {ops.filter((o) => o.failed).map((o) => (
            <div key={o.id} className="flex items-center gap-2 text-xs text-destructive">
              <span>{o.method} {o.path}: {o.lastError}</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => { await discardOp(o.id); await reload(); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {queue && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("flow.applyProgress", { done, total: queue.items.length })}
            {queue.remaining_today != null && ` · ${t("flow.applyRemainingToday", { n: queue.remaining_today })}`}
            {` · ${new Date(queue.built_at).toLocaleString()}`}
          </p>
          <ul className="space-y-2">
            {queue.items.map((i) => (
              <li key={i.job_id} className="rounded-md border border-border p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{i.title}</span>
                  <span className="text-sm text-muted-foreground">{i.company}</span>
                  <Badge variant="outline" className="ml-auto">{Math.round(i.score)}</Badge>
                  <Badge variant={i.state === "done" ? "secondary" : "outline"}>{i.tag ? t(`flow.applyTag_${i.tag}`) : t(`flow.applyState_${i.state}`)}</Badge>
                </div>
                <Verdicts verdicts={i.verdicts} />
                {i.override && <p className="text-xs text-amber-600">{t("flow.applyOverridden")}: {i.override}</p>}
              </li>
            ))}
          </ul>

          {queue.excluded.length > 0 && (
            <details>
              <summary className="text-sm cursor-pointer">{t("flow.applyExcluded", { n: queue.excluded.length })}</summary>
              <ul className="space-y-2 mt-2">
                {queue.excluded.map((e) => (
                  <li key={e.job_id} className="rounded-md border border-border p-3 space-y-1 opacity-80">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{e.title}</span>
                      <span className="text-sm text-muted-foreground">{e.company}</span>
                      <Badge variant="outline" className="ml-auto">{Math.round(e.score)}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => override(e)}>{t("flow.applyAnyway")}</Button>
                    </div>
                    <Verdicts verdicts={e.verdicts.filter((v) => v.verdict !== "pass")} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>{t("flow.applyOutsideTitle")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder={t("flow.applyOutsideCompany")} value={outside.company} onChange={(e) => setOutside({ ...outside, company: e.target.value })} />
          <Input placeholder={t("flow.applyOutsideRole")} value={outside.title} onChange={(e) => setOutside({ ...outside, title: e.target.value })} />
          <Input placeholder={t("flow.applyOutsideUrl")} value={outside.job_url} onChange={(e) => setOutside({ ...outside, job_url: e.target.value })} />
          <Input type="date" value={outside.applied_at} onChange={(e) => setOutside({ ...outside, applied_at: e.target.value })} />
        </div>
        <Button size="sm" variant="outline" onClick={logOutside} disabled={!outside.company.trim() || !outside.title.trim()}>
          {t("flow.applyOutsideSave")}
        </Button>
      </div>
    </div>
  );
}
