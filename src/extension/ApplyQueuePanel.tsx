/// <reference types="chrome" />
// Side-panel section for the assisted-apply queue built on Quiver's /flow page:
// why this job (score, spread, reasoning, gate verdicts), Open, and the tag
// that records the outcome. Never fills or submits anything.
// See artemis_quiver_docs/60-Roadmap/Assisted Apply - Build Plan.md.
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { t } from "./i18n";
import { getActiveProfileId } from "../app/db";
import {
  currentItem,
  drainOutbox,
  loadQueue,
  outbox,
  tagItem,
  undoApplied,
  updateItem,
  type ApplyTag,
  type BlockDetails,
  type QueueEntry,
  type StoredQueue,
} from "../app/services/applyQueue";
import type { FlowVerdict } from "../app/services/flowBridge";

const QUEUE_UPDATED = "ARTEMIS_APPLY_QUEUE_UPDATED";

const VERDICT_COLOR: Record<FlowVerdict["verdict"], string> = {
  pass: "#4ade80", ask: "#fbbf24", block: "#f87171", no_evidence: "#94a3b8",
};

const BLOCK_KINDS: BlockDetails["kind"][] = ["degree", "location", "work_mode", "sponsorship", "language", "clearance", "other"];

export function ApplyQueueSection({ tabId }: { tabId: number | null }) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [queue, setQueue] = useState<StoredQueue | undefined>();
  const [unsynced, setUnsynced] = useState(0);
  const [blocking, setBlocking] = useState<BlockDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const id = await getActiveProfileId();
      setProfileId(id);
      setQueue(id ? await loadQueue(id) : undefined);
      setUnsynced((await outbox()).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
    // Opening the panel is also a chance to deliver outcomes recorded offline.
    void drainOutbox().then(reload).catch(() => {});
    const handler = (msg: { type?: string }) => { if (msg?.type === QUEUE_UPDATED) void reload(); };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [reload]);

  const item = currentItem(queue);
  const lastDone = queue?.items.filter((i) => i.state === "done").slice(-1)[0];

  async function open(entry: QueueEntry) {
    if (!profileId) return;
    const url = entry.apply_url || entry.job_url;
    if (tabId != null) await chrome.tabs.update(tabId, { url });
    else await chrome.tabs.create({ url });
    setQueue(await updateItem(profileId, entry.job_id, { state: "open", openedAt: new Date().toISOString() }));
  }

  async function tag(entry: QueueEntry, value: ApplyTag, block?: BlockDetails) {
    if (!profileId || !queue) return;
    setError(null);
    try {
      setQueue(await tagItem(profileId, queue, entry, value, block));
      setBlocking(null);
      setUnsynced((await outbox()).length);
      // The drain runs in the background; refresh the count once it's had a moment.
      setTimeout(() => void outbox().then((o) => setUnsynced(o.length)), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function undo(entry: QueueEntry) {
    if (!profileId || !queue) return;
    setQueue(await undoApplied(profileId, queue, entry));
  }

  async function retry() {
    await drainOutbox().catch(() => {});
    await reload();
  }

  if (!queue) return null;
  const done = queue.items.filter((i) => i.state === "done").length;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("sidepanel.queue.title")}</span>
        <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "auto" }}>
          {t("sidepanel.queue.progress", { done, total: queue.items.length })}
        </span>
      </div>

      {unsynced > 0 && (
        <div style={{ fontSize: "11px", color: "#fbbf24", marginBottom: "8px", display: "flex", gap: "6px", alignItems: "center" }}>
          {t("sidepanel.queue.unsynced", { n: unsynced })}
          <button onClick={retry} style={{ ...btn, padding: "2px 8px", marginLeft: "auto" }}>{t("sidepanel.queue.retry")}</button>
        </div>
      )}

      {!item ? (
        <div style={{ fontSize: "12px", color: "#94a3b8" }}>{t("sidepanel.queue.finished")}</div>
      ) : (
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600 }}>{item.title}</div>
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>
            {[item.company, item.location, item.work_mode].filter(Boolean).join(" · ")}
          </div>
          {item.company_history?.map((h, i) => (
            <div key={i} style={{ fontSize: "11px", color: "#d97706" }}>
              {t("flow.appliedOn", { company: item.company, date: new Date(h.applied_at).toLocaleDateString() })}
              {" · "}
              {h.job_url ? <a href={h.job_url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{h.title}</a> : h.title}
            </div>
          ))}
          <div style={{ fontSize: "12px", marginTop: "6px" }}>
            {t("sidepanel.queue.score", { score: Math.round(item.score) })}
            {item.score_passes != null && ` · ${t("sidepanel.queue.passes", { n: item.score_passes, spread: Math.round(item.score_spread ?? 0) })}`}
          </div>
          {item.summary && <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "6px", lineHeight: 1.4 }}>{item.summary}</div>}
          {item.fit_reasoning && (
            <details style={{ marginTop: "6px" }}>
              <summary style={{ fontSize: "11px", color: "#93c5fd", cursor: "pointer" }}>{t("sidepanel.queue.reasoning")}</summary>
              <div style={{ fontSize: "11px", color: "#cbd5e1", whiteSpace: "pre-wrap", marginTop: "4px" }}>{item.fit_reasoning}</div>
            </details>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: "11px" }}>
            {item.verdicts.map((v, i) => (
              <li key={i} style={{ marginBottom: "2px" }}>
                <span style={{ color: VERDICT_COLOR[v.verdict], fontWeight: 600 }}>{t(`sidepanel.queue.verdict_${v.verdict}`)}</span>
                <span style={{ color: "#94a3b8" }}> · {v.gate}: {v.detail}</span>
              </li>
            ))}
            {item.override && <li style={{ color: "#fbbf24" }}>{t("sidepanel.queue.overridden")}: {item.override}</li>}
          </ul>

          {item.state === "queued" ? (
            <div style={row}>
              <button onClick={() => open(item)} style={primary}>{t("sidepanel.queue.open")}</button>
              <button onClick={() => tag(item, "not_applied")} style={btn}>{t("sidepanel.queue.skip")}</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "12px", fontWeight: 600, marginTop: "10px" }}>{t("sidepanel.queue.didYouSubmit")}</div>
              <div style={row}>
                <button onClick={() => tag(item, "applied")} style={primary}>{t("sidepanel.queue.tag_applied")}</button>
                <button onClick={() => tag(item, "not_sure")} style={btn}>{t("sidepanel.queue.tag_not_sure")}</button>
                <button onClick={() => tag(item, "not_applied")} style={btn}>{t("sidepanel.queue.tag_not_applied")}</button>
              </div>
              <div style={row}>
                <button onClick={() => tag(item, "closed")} style={btn}>{t("sidepanel.queue.tag_closed")}</button>
                <button onClick={() => tag(item, "archived")} style={btn}>{t("sidepanel.queue.tag_archived")}</button>
                <button onClick={() => setBlocking({ kind: "other", evidence: "" })} style={btn}>
                  {t("sidepanel.queue.tag_blocked")}
                </button>
                <button onClick={() => open(item)} style={btn}>{t("sidepanel.queue.reopen")}</button>
              </div>
            </>
          )}

          {blocking && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <select value={blocking.kind} onChange={(e) => setBlocking({ ...blocking, kind: e.target.value as BlockDetails["kind"] })} style={input}>
                {BLOCK_KINDS.map((k) => <option key={k} value={k}>{t(`sidepanel.queue.kind_${k}`)}</option>)}
              </select>
              <textarea
                rows={3}
                placeholder={t("sidepanel.queue.evidence")}
                value={blocking.evidence}
                onChange={(e) => setBlocking({ ...blocking, evidence: e.target.value })}
                style={input}
              />
              <div style={row}>
                <button onClick={() => tag(item, "blocked", blocking)} disabled={!blocking.evidence.trim()} style={primary}>
                  {t("sidepanel.queue.confirmBlocked")}
                </button>
                <button onClick={() => setBlocking(null)} style={btn}>{t("sidepanel.queue.cancel")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {lastDone && (lastDone.tag === "applied" || lastDone.tag === "not_sure") && (
        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px" }}>
          {t("sidepanel.queue.lastTagged", { title: lastDone.title, tag: t(`sidepanel.queue.tag_${lastDone.tag}`) })}{" "}
          <button onClick={() => undo(lastDone)} style={{ ...btn, padding: "1px 6px" }}>{t("sidepanel.queue.undo")}</button>
        </div>
      )}
      {error && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>{error}</div>}
    </div>
  );
}

const card: CSSProperties = { border: "1px solid rgba(59,130,246,0.35)", borderRadius: "10px", padding: "14px", background: "rgba(59,130,246,0.05)" };
const row: CSSProperties = { display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" };
const btn: CSSProperties = {
  padding: "6px 10px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
  background: "#1e293b", color: "#e2e8f0", fontSize: "12px", cursor: "pointer",
};
const primary: CSSProperties = { ...btn, background: "#3b82f6", border: "none", color: "#fff", fontWeight: 600 };
const input: CSSProperties = {
  padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)",
  background: "#0f172a", color: "#e2e8f0", fontSize: "12px",
};
