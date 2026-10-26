/// <reference types="chrome" />
// Assisted apply, client side: the queue snapshot and the outbox of outcomes
// not yet recorded in Flow. Both live in the existing `metadata` store (no
// Dexie version bump: a branch build at v4 would break main's v3 build on the
// same database). Flow's DB is the record; Quiver only holds what hasn't
// reached it yet. See artemis_quiver_docs/60-Roadmap/Assisted Apply - Build Plan.md.
//
// Raw IndexedDB rather than Dexie, so the background service worker can use
// the same code, and every update is one readwrite transaction: the side
// panel, the app and the alarm drain can't overwrite each other's changes.

import type { FlowApplyQueue, FlowQueueItem, FlowVerdict } from "./flowBridge";

const DB_NAME = "ArtemisQuiverDB";
export const OUTBOX_KEY = "applyOutbox";
export const queueKey = (profileId: string) => `applyQueue:${profileId}`;

export type ApplyTag = "applied" | "not_sure" | "not_applied" | "archived" | "closed" | "blocked";

export interface QueueEntry extends FlowQueueItem {
  state: "queued" | "open" | "done";
  tag?: ApplyTag;
  /** Set when the user applied despite a block. */
  override?: string;
  openedAt?: string;
  /** The Flow application id, for undoing a mistaken "applied". */
  appId?: string;
}

export interface StoredQueue extends Omit<FlowApplyQueue, "items"> {
  flowBaseUrl: string;
  items: QueueEntry[];
}

export interface OutboxOp {
  id: string;
  flowBaseUrl: string;
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  /** For the "applied, not yet synced" exclusion when the next queue is built. */
  company?: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  /** Flow rejected it (4xx): retrying won't help. Kept, and shown, until the user discards it. */
  failed?: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    // No database yet means no profile yet: never create an empty one here,
    // Dexie would then fail to upgrade it.
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Quiver database not found"));
  });
}

export async function readMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction("metadata", "readonly").objectStore("metadata").get(key);
      req.onsuccess = () => resolve(req.result?.value as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Read-modify-write in a single transaction. */
export async function updateMeta<T>(key: string, fn: (current: T | undefined) => T): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("metadata", "readwrite");
      const store = tx.objectStore("metadata");
      let next: T;
      const get = store.get(key);
      get.onsuccess = () => {
        next = fn(get.result?.value as T | undefined);
        store.put({ key, value: next });
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
    });
  } finally {
    db.close();
  }
}

// --- Queue -------------------------------------------------------------------

export function saveQueue(profileId: string, flowBaseUrl: string, q: FlowApplyQueue): Promise<StoredQueue> {
  return updateMeta<StoredQueue>(queueKey(profileId), () => ({
    ...q,
    flowBaseUrl,
    items: q.items.map((i) => ({ ...i, state: "queued" as const })),
  }));
}

export function loadQueue(profileId: string): Promise<StoredQueue | undefined> {
  return readMeta<StoredQueue>(queueKey(profileId));
}

export function updateItem(profileId: string, jobId: string, patch: Partial<QueueEntry>): Promise<StoredQueue> {
  return updateMeta<StoredQueue>(queueKey(profileId), (q) => {
    if (!q) throw new Error("No apply queue");
    return { ...q, items: q.items.map((i) => (i.job_id === jobId ? { ...i, ...patch } : i)) };
  });
}

/** An excluded job the user decided to apply to anyway; the reason is recorded with the application. */
export function overrideExcluded(profileId: string, jobId: string, reason: string): Promise<StoredQueue> {
  return updateMeta<StoredQueue>(queueKey(profileId), (q) => {
    if (!q) throw new Error("No apply queue");
    const hit = q.excluded.find((e) => e.job_id === jobId);
    if (!hit) return q;
    return {
      ...q,
      excluded: q.excluded.filter((e) => e.job_id !== jobId),
      items: [...q.items, { ...hit, state: "queued", override: reason }],
    };
  });
}

/** The item the panel should show: an opened-but-untagged one first ("did you submit?"), else the next queued. */
export function currentItem(q: StoredQueue | undefined): QueueEntry | undefined {
  return q?.items.find((i) => i.state === "open") ?? q?.items.find((i) => i.state === "queued");
}

// --- Outbox ------------------------------------------------------------------

export async function enqueue(ops: Omit<OutboxOp, "id" | "createdAt" | "attempts">[]): Promise<void> {
  const now = new Date().toISOString();
  await updateMeta<OutboxOp[]>(OUTBOX_KEY, (cur) => [
    ...(cur ?? []),
    ...ops.map((op) => ({ ...op, id: crypto.randomUUID(), createdAt: now, attempts: 0 })),
  ]);
  await refreshBadge();
}

export async function outbox(): Promise<OutboxOp[]> {
  return (await readMeta<OutboxOp[]>(OUTBOX_KEY)) ?? [];
}

/** Send queued ops in order; each one leaves the outbox only once Flow accepted
 * it. Every op is idempotent on Flow's side, so a drain racing another is harmless. */
export function drainOutbox(): Promise<{ sent: number; left: number }> {
  // One drain at a time, across the panel, the app and the service worker
  // (same origin, so one lock): two concurrent drains would both send an op,
  // and a duplicate POST landing after its undo would recreate the application.
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("artemis:applyOutbox", drainOnce);
  }
  localDrain = localDrain.then(drainOnce, drainOnce);
  return localDrain;
}

let localDrain: Promise<{ sent: number; left: number }> = Promise.resolve({ sent: 0, left: 0 });

async function drainOnce(): Promise<{ sent: number; left: number }> {
  let sent = 0;
  for (const op of await outbox()) {
    if (op.failed) continue;
    let error: string | undefined;
    let failed = false;
    try {
      const res = await fetch(`${op.flowBaseUrl}${op.path}`, {
        method: op.method,
        headers: op.body ? { "Content-Type": "application/json" } : undefined,
        body: op.body ? JSON.stringify(op.body) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        error = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
        failed = res.status < 500 && res.status !== 408 && res.status !== 429;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    await updateMeta<OutboxOp[]>(OUTBOX_KEY, (cur) =>
      error
        ? (cur ?? []).map((o) => (o.id === op.id ? { ...o, attempts: o.attempts + 1, lastError: error, failed } : o))
        : (cur ?? []).filter((o) => o.id !== op.id)
    );
    if (error && !failed) break; // Flow likely unreachable: keep order, retry on the next tick
    if (!error) sent++;
  }
  const left = (await outbox()).length;
  await refreshBadge(left);
  return { sent, left };
}

export async function discardOp(id: string): Promise<void> {
  const left = await updateMeta<OutboxOp[]>(OUTBOX_KEY, (cur) => (cur ?? []).filter((o) => o.id !== id));
  await refreshBadge(left.length);
}

/** An application made outside the queue (another site, by email, in person). */
export function logOutsideApplication(flowBaseUrl: string, a: { company: string; title: string; job_url?: string; applied_at?: string; note?: string }): Promise<void> {
  return enqueue([{
    flowBaseUrl, method: "POST", path: "/api/applications", company: a.company,
    body: { id: crypto.randomUUID(), source: "manual", ...a },
  }]);
}

export async function refreshBadge(count?: number): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.action) return;
  const n = count ?? (await outbox()).length;
  await chrome.action.setBadgeText({ text: n ? String(n) : "" });
  if (n) await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
}

// --- Tagging -----------------------------------------------------------------

export interface BlockDetails {
  kind: "degree" | "location" | "work_mode" | "sponsorship" | "language" | "clearance" | "other";
  evidence: string;
}

/** Record a tag: the outbox write happens before the caller updates its UI. */
export async function tagItem(
  profileId: string,
  q: StoredQueue,
  item: QueueEntry,
  tag: ApplyTag,
  block?: BlockDetails
): Promise<StoredQueue> {
  const base = { flowBaseUrl: q.flowBaseUrl };
  const verdicts: FlowVerdict[] = item.override
    ? [...item.verdicts, { gate: "override", verdict: "pass", detail: item.override }]
    : item.verdicts;
  const appId = tag === "applied" || tag === "not_sure" ? crypto.randomUUID() : undefined;
  if (appId) {
    await enqueue([{
      ...base, method: "POST", path: "/api/applications", company: item.company,
      body: {
        id: appId, job_id: item.job_id, company: item.company, title: item.title,
        job_url: item.job_url, source: "assisted", confirmed: tag === "applied",
        gates_at_apply: verdicts, queue_id: q.queue_id, lane: q.lane,
      },
    }]);
  } else if (tag === "not_applied") {
    await enqueue([{ ...base, method: "PATCH", path: `/api/jobs/${item.job_id}/label`, body: { label: "reviewed" } }]);
  } else if (tag === "archived" || tag === "closed") {
    await enqueue([{ ...base, method: "PATCH", path: `/api/jobs/${item.job_id}/status`, body: { status: "archived" } }]);
  } else if (tag === "blocked") {
    if (!block?.evidence.trim()) throw new Error("Quote the text that rules this job out.");
    await enqueue([{
      ...base, method: "POST", path: "/api/disqualifications",
      body: {
        id: crypto.randomUUID(), job_id: item.job_id, company: item.company, kind: block.kind, evidence: block.evidence.trim(),
        found_where: "posting", verdicts_at_time: verdicts,
      },
    }]);
  }
  const updated = await updateItem(profileId, item.job_id, { state: "done", tag, appId });
  void drainOutbox().catch(() => {});
  return updated;
}

/** Undo a mistaken "applied": Flow deletes the record and returns the job to new. */
export async function undoApplied(profileId: string, q: StoredQueue, item: QueueEntry): Promise<StoredQueue> {
  if (item.appId) {
    await enqueue([{ flowBaseUrl: q.flowBaseUrl, method: "DELETE", path: `/api/applications/${item.appId}` }]);
  }
  const updated = await updateItem(profileId, item.job_id, { state: "open", tag: undefined, appId: undefined });
  void drainOutbox().catch(() => {});
  return updated;
}

