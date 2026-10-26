import type { ModelEndpoint } from "../types/llm";
import type { ProfileSettings } from "../types/workspace";
import { defaultFlowRunConfig, type Layer, type ProfilePreferences } from "../types/preferences";
import { canonicalJson, sha256 } from "./profileLayers";

export interface FlowStatus {
  connected: boolean;
  configured: boolean;
  totalJobs?: number;
  lastScrape?: string | null;
}

export interface FlowEndpointTestResult {
  reachable: boolean;
  error?: string;
}

function logFlowError(err: unknown, baseUrl: string, action: string) {
  void import("../db/errorLogRepo").then(({ addErrorLog }) => addErrorLog({
    timestamp: new Date().toISOString(),
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    source: "flow",
    code: err instanceof Error && "code" in err ? (err as any).code : undefined,
    severity: "ERROR",
    metadata: { baseUrl, action } as Record<string, unknown>,
  }));
}

async function checkFlowIdentity(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const body = await res.json();
    return body.app === "artemis-flow";
  } catch {
    return false;
  }
}

export async function checkFlowHealth(baseUrl: string): Promise<FlowStatus> {
  const identified = await checkFlowIdentity(baseUrl);
  if (!identified) return { connected: false, configured: false };
  try {
    const res = await fetch(`${baseUrl}/api/settings/status`, { signal: AbortSignal.timeout(3000) });
    const status = res.ok ? await res.json() : {};
    return { connected: true, configured: false, totalJobs: status.total_jobs, lastScrape: status.last_scrape };
  } catch {
    return { connected: true, configured: false };
  }
}

/**
 * Quiver's ProviderType and Flow's provider vocabulary don't line up 1:1
 * (Flow's provider.py only accepts "ollama" | "lmstudio" | "anthropic").
 * "lmstudio" on Flow's side is really just "generic OpenAI-compatible".
 */
export function mapProviderForFlow(endpoint: ModelEndpoint): { provider: string; base_url: string } {
  if (endpoint.provider === "anthropic") {
    return { provider: "anthropic", base_url: endpoint.baseUrl || "https://api.anthropic.com" };
  }
  if (endpoint.provider === "openai-compatible") {
    return { provider: "lmstudio", base_url: endpoint.baseUrl };
  }
  throw new Error(`Flow does not support the "${endpoint.provider}" provider. Choose an Anthropic or OpenAI-compatible endpoint to send to Flow.`);
}

export async function testEndpointFromFlow(
  baseUrl: string,
  endpoint: ModelEndpoint
): Promise<FlowEndpointTestResult> {
  try {
    const mapped = mapProviderForFlow(endpoint);
    const res = await fetch(`${baseUrl}/api/settings/llm/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: mapped.provider,
        model: endpoint.model,
        base_url: mapped.base_url,
        api_key: endpoint.apiKey,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return await res.json();
  } catch (err) {
    logFlowError(err, baseUrl, "testEndpointFromFlow");
    return { reachable: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Digest, search, and scoring control ---------------------------------
// These mirror Flow's own frontend/src/api.ts (same endpoints, same shapes),
// safe to call directly from Quiver per the implementation plan.

export interface FlowJobSummary {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  is_remote: boolean;
  status: string;
  score: number;
  date_posted: string;
  ingested_at: string;
  job_type: string;
  label: string;
  archive_reason: string | null;
  /** LLM-generated 1-2 sentence "why this matched" blurb — only populated for jobs scoring > 70. */
  summary: string | null;
  /** Earlier applications to this company, newest first. Shown, never a gate. */
  company_history?: FlowCompanyApplication[];
  /** Card pre-score, 0-100; null until pre-scored. */
  align_score?: number | null;
}

export interface FlowJobDetail extends FlowJobSummary {
  description: string;
  job_url: string;
  company_url: string;
  country: string;
  emails: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_rate: string;
  fit_reasoning: string | null;
  rejection_category: string;
  archived_at: string | null;
  alternate_sources: string | null;
}

export interface FlowDashboardStats {
  total_jobs: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  ingested_today: number;
  last_scrape: string | null;
  avg_score: number;
  unscored_count: number;
}

export interface FlowJobListResponse {
  total: number;
  limit: number;
  offset: number;
  jobs: FlowJobSummary[];
}

export interface FlowRankStatus {
  running: boolean;
  phase: string;
  current: number;
  total: number;
  message: string;
  scored: number;
  failed: number;
  error: string;
}

export interface FlowSearchStatus {
  running: boolean;
  phase: string;
  current: number;
  total: number;
  message: string;
  error: string;
  /** Net-new rows this search batch has inserted so far. */
  inserted?: number;
  /** Set once a batch stops for a real, non-transient reason — Autopilot
   * won't restart search on its own until the user intervenes. */
  hard_cap_reached?: boolean;
  exhausted?: boolean;
}

async function flowGet<T>(baseUrl: string, path: string, action: string): Promise<T> {
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`${action} failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    logFlowError(err, baseUrl, action);
    throw err;
  }
}

async function flowPost<T>(baseUrl: string, path: string, action: string): Promise<T> {
  await ensureFlowSynced(baseUrl);
  try {
    const res = await fetch(`${baseUrl}${path}`, { method: "POST", signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`${action} failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    logFlowError(err, baseUrl, action);
    throw err;
  }
}

async function flowPut<T>(baseUrl: string, path: string, body: unknown, action: string): Promise<T> {
  await ensureFlowSynced(baseUrl);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`${action} failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    logFlowError(err, baseUrl, action);
    throw err;
  }
}

async function flowPatch<T>(baseUrl: string, path: string, body: unknown, action: string): Promise<T> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`${action} failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    logFlowError(err, baseUrl, action);
    throw err;
  }
}

/** The ranked digest — best-scoring new jobs, per the decided "digest, not board" default presentation.
 * Capped to the top 10 by default — the point of a digest is to not be a wall of everything. */
export function getFlowDigest(baseUrl: string, limit = 10): Promise<FlowJobListResponse> {
  return flowGet(
    baseUrl,
    // exclude_label=reviewed keeps jobs you've already looked at from permanently
    // occupying a digest slot until their status is formally changed.
    `/api/jobs?status=new&sort_by=score&sort_dir=desc&show_archived=false&exclude_label=reviewed&limit=${limit}`,
    "getFlowDigest"
  );
}

export function getRankStatus(baseUrl: string): Promise<FlowRankStatus> {
  return flowGet(baseUrl, "/api/pipeline/rank/status", "getRankStatus");
}

export function startRank(baseUrl: string): Promise<{ status: string; running: boolean }> {
  return flowPost(baseUrl, "/api/pipeline/rank", "startRank");
}

export function stopRank(baseUrl: string): Promise<{ status: string; running: boolean }> {
  return flowPost(baseUrl, "/api/pipeline/rank/stop", "stopRank");
}

/** Search status/stop don't exist on Flow's side yet (Phase 2) — will 404 until built there. */
export function getSearchStatus(baseUrl: string): Promise<FlowSearchStatus> {
  return flowGet(baseUrl, "/api/pipeline/search/status", "getSearchStatus");
}

export function startSearch(baseUrl: string): Promise<{ status: string; message: string }> {
  return flowPost(baseUrl, "/api/pipeline/search", "startSearch");
}

export function stopSearch(baseUrl: string): Promise<{ status: string; running: boolean }> {
  return flowPost(baseUrl, "/api/pipeline/search/stop", "stopSearch");
}

// --- Autopilot (the A/B loop: chains batch search + scoring, unattended) ---

export interface FlowAutopilotStatus {
  enabled: boolean;
  /** Why autopilot last powered itself off. "" while running/never started. */
  stopped_reason: "" | "user" | "hard_cap" | "exhausted" | "no_strategy" | "error";
  started_at: string | null;
  stopped_at: string | null;
  ticks: number;
  search: FlowSearchStatus;
  rank: FlowRankStatus;
  rank_backlog_unscored: number;
  logs: string[];
}

export function getAutopilotStatus(baseUrl: string): Promise<FlowAutopilotStatus> {
  return flowGet(baseUrl, "/api/pipeline/autopilot/status", "getAutopilotStatus");
}

export function startAutopilot(baseUrl: string): Promise<{ status: string; enabled: boolean }> {
  return flowPost(baseUrl, "/api/pipeline/autopilot", "startAutopilot");
}

export function stopAutopilot(baseUrl: string): Promise<{ status: string; enabled: boolean }> {
  return flowPost(baseUrl, "/api/pipeline/autopilot/stop", "stopAutopilot");
}

// --- Queue and job-board pool ---------------------------------------------

/** GET /api/queue — the backlog split the way Flow actually handles it. */
export interface FlowQueueSummary {
  to_score: number;
  parked_no_description: number;
  ineligible: number;
  scored: number;
  strong: number;
  /** Below the card pre-score threshold: not deep-scored. */
  prescreened?: number;
  archived_by_reason: Record<string, number>;
  boards: Record<string, { active: number; inactive: number; unchecked: number }>;
  sweep: {
    running: boolean;
    result: { checked: number; promoted: number; inserted: number } | null;
    started_at: string | null;
    finished_at: string | null;
    error: string;
  };
}

export function getQueueSummary(baseUrl: string): Promise<FlowQueueSummary> {
  return flowGet(baseUrl, "/api/queue", "getQueueSummary");
}

/** Check every inactive ATS board once and activate those with matching roles.
 * importLists first refreshes the board lists from the public aggregator. */
export async function startBoardSweep(baseUrl: string, importLists = false): Promise<{ status: string }> {
  await ensureFlowSynced(baseUrl);
  const res = await fetch(`${baseUrl}/api/ats/sweep`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ import_lists: importLists }),
  });
  if (!res.ok) throw new Error(`startBoardSweep failed: ${res.status}`);
  return res.json();
}

// --- Job detail, tracking, and stats --------------------------------------

export function getJob(baseUrl: string, jobId: string): Promise<FlowJobDetail> {
  return flowGet(baseUrl, `/api/jobs/${jobId}`, "getJob");
}

export function updateJobStatus(baseUrl: string, jobId: string, status: string): Promise<void> {
  return flowPatch(baseUrl, `/api/jobs/${jobId}/status`, { status }, "updateJobStatus");
}

export function updateJobLabel(baseUrl: string, jobId: string, label: string): Promise<void> {
  return flowPatch(baseUrl, `/api/jobs/${jobId}/label`, { label }, "updateJobLabel");
}

export function getDashboardStats(baseUrl: string): Promise<FlowDashboardStats> {
  return flowGet(baseUrl, "/api/dashboard/stats", "getDashboardStats");
}

/** Status-grouped jobs for the Board tab. Archived is deliberately never passed here — it has its own tab. */
export function getJobsByStatus(baseUrl: string, status: string, limit = 100): Promise<FlowJobListResponse> {
  return flowGet(baseUrl, `/api/jobs?status=${status}&limit=${limit}`, "getJobsByStatus");
}

export function getArchivedJobs(baseUrl: string, limit = 100): Promise<FlowJobListResponse> {
  return flowGet(baseUrl, `/api/jobs?status=archived&show_archived=true&sort_by=ingested_at&sort_dir=desc&limit=${limit}`, "getArchivedJobs");
}

export type FlowQueueKey = "to_score" | "strong" | "scored" | "parked" | "ineligible" | "prescreened";

/** The jobs behind one queue counter (or one archive-reason badge), newest
 * capture first, one page at a time. Flow derives the list and the counter
 * from the same predicate, so `total` matches the number on the button. */
export function getQueueJobs(
  baseUrl: string,
  filter: { queue: FlowQueueKey } | { archiveReason: string },
  offset: number,
  limit: number,
): Promise<FlowJobListResponse> {
  const qs = new URLSearchParams({ sort_by: "ingested_at", sort_dir: "desc", offset: String(offset), limit: String(limit) });
  if ("queue" in filter) qs.set("queue", filter.queue);
  else qs.set("archive_reason", filter.archiveReason);
  return flowGet(baseUrl, `/api/jobs?${qs}`, "getQueueJobs");
}

// --- Search strategy visibility and control ---------------------------------

export interface FlowStrategy {
  keywords: string[];
  locations: string[];
  exclude_keywords: string[];
  target_companies: string[];
  salary_floor: number | null;
  salary_floor_currency: string;
  sources: string[];
  results_wanted: number;
  reasoning: string;
  version: number;
}

export interface FlowStrategyHistoryEntry {
  version: number;
  strategy: Omit<FlowStrategy, "version">;
  feedback: string;
  created_at: string;
}

/** The strategy actually used the next time a search runs (see POST /pipeline/search). */
export function getStrategy(baseUrl: string): Promise<FlowStrategy> {
  return flowGet(baseUrl, "/api/strategy", "getStrategy");
}

/** Manual edit from the Strategy tab — saved as a new version, same as a chat-driven refinement. */
export function updateStrategy(baseUrl: string, strategy: FlowStrategy): Promise<FlowStrategy> {
  return flowPut(baseUrl, "/api/strategy", strategy, "updateStrategy");
}

/** Regenerates the strategy from the candidate profile, discarding manual/chat edits. */
export function generateStrategy(baseUrl: string): Promise<FlowStrategy> {
  return flowPost(baseUrl, "/api/strategy/generate", "generateStrategy");
}

export function getStrategyHistory(baseUrl: string, limit = 10): Promise<FlowStrategyHistoryEntry[]> {
  return flowGet(baseUrl, `/api/strategy/history?limit=${limit}`, "getStrategyHistory");
}

// --- Backlog cap settings --------------------------------------------------

export interface FlowBacklogConfig {
  /** Pauses search (self-recovering — resumes once scoring drains the
   * backlog back under this) once the total pending "new" backlog reaches
   * this size. null = no pending-backlog gate at all (2026-09-09) — search
   * runs every cycle regardless of review-queue size; useful when scoring
   * (e.g. a slow local model) can't keep pace and an unattended run
   * shouldn't throttle on that. */
  soft_cap: number | null;
  /** Caps net-new jobs a single search batch can insert before ending that
   * batch early — the direct fix for one sweep dumping hundreds of jobs at
   * once. null = a batch runs to completion however many sources/keywords
   * that takes (Autopilot still restarts search on its own after). */
  hard_cap: number | null;
  archive_retention_days: number;
  archive_score_threshold: number;
  /** Days an unscored/unactioned 'new' job can sit before it's archived as
   * stale, independent of score. null = disabled. */
  stale_new_days: number | null;
  /** Skip the boards listed under aggregator_boards in Flow's config/ats.yaml. */
  skip_aggregator_boards?: boolean;
}

export interface FlowCaptureJob {
  id: string;
  url: string;
  title: string;
  company: string | null;
}

/** Description-less jobs for background-tab capture. Flow never hands out
 * LinkedIn and stamps each job so it isn't handed out again for a week. */
export async function getCaptureQueue(baseUrl: string, limit = 1): Promise<FlowCaptureJob[]> {
  const res = await flowGet<{ jobs: FlowCaptureJob[] }>(baseUrl, `/api/capture/queue?limit=${limit}`, "getCaptureQueue");
  return res.jobs;
}

export interface FlowCaptureResult {
  job_id: string | null;
  matched_by: string | null;
  fields_written: string[];
  rescore_queued: boolean;
  error?: string;
}

export async function postCapture(baseUrl: string, capture: unknown): Promise<FlowCaptureResult> {
  try {
    const res = await fetch(`${baseUrl}/api/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(capture),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`postCapture failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    logFlowError(err, baseUrl, "postCapture");
    throw err;
  }
}

export function getBacklogConfig(baseUrl: string): Promise<FlowBacklogConfig> {
  return flowGet(baseUrl, "/api/settings/backlog", "getBacklogConfig");
}

export async function purgeArchivedJobs(baseUrl: string, retentionDays?: number): Promise<{ status: string; deleted: number }> {
  try {
    const res = await fetch(`${baseUrl}/api/settings/backlog/purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retention_days: retentionDays ?? null }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`purgeArchivedJobs failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    logFlowError(err, baseUrl, "purgeArchivedJobs");
    throw err;
  }
}

export interface FlowJobSearchParams {
  search?: string;
  status?: string;
  scoreMin?: number;
  sortBy?: "ingested_at" | "date_posted" | "score" | "salary_max" | "title";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/** Free-form search/filter/review over the full job set — powers the Search tab.
 * Leaves show_archived off by default so archived jobs stay out unless the
 * caller explicitly filters status=archived (mirrors getArchivedJobs' own call). */
export function searchJobs(baseUrl: string, params: FlowJobSearchParams = {}): Promise<FlowJobListResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.status === "archived") qs.set("show_archived", "true");
  if (params.scoreMin != null) qs.set("score_min", String(params.scoreMin));
  qs.set("sort_by", params.sortBy || "ingested_at");
  qs.set("sort_dir", params.sortDir || "desc");
  qs.set("limit", String(params.limit ?? 100));
  qs.set("offset", String(params.offset ?? 0));
  return flowGet(baseUrl, `/api/jobs?${qs.toString()}`, "searchJobs");
}

// --- User preferences (who the user is, what they accept) ------------------

/** null = no opinion; true = accepted wherever reachable; false = never;
 * a list = accepted only in these places (cities or country codes). */
export type FlowModeSetting = boolean | string[] | null;

/** Flow's GET/PUT /api/settings/preferences. Every field unset = no filtering
 * and no demotion. Place lists take ISO country codes or region codes. */
export interface FlowPreferences {
  home_country: string | null;
  work_authorisation: string[];
  remote_from: string[];
  relocation_countries: string[];
  work_modes: { remote: FlowModeSetting; hybrid: FlowModeSetting; onsite: FlowModeSetting };
  languages: { name: string; level: string | null }[];
  has_degree: boolean | null;
}

export function getPreferences(baseUrl: string): Promise<FlowPreferences> {
  return flowGet(baseUrl, "/api/settings/preferences", "getPreferences");
}

// --- Assisted apply ----------------------------------------------------------

export interface FlowVerdict {
  gate: string;
  verdict: "pass" | "block" | "ask" | "no_evidence";
  detail: string;
  evidence?: string | null;
}

export interface FlowQueueItem {
  job_id: string;
  title: string;
  company: string;
  company_key: string;
  employer_known: boolean;
  location: string;
  source: string;
  score: number;
  score_spread: number | null;
  score_passes: number | null;
  summary: string | null;
  fit_reasoning: string | null;
  job_url: string;
  apply_url: string | null;
  ats_identity: string | null;
  work_mode: string | null;
  office_days: number | null;
  eligibility: string | null;
  eligibility_reason: string | null;
  verdicts: FlowVerdict[];
  company_history: FlowCompanyApplication[];
}

/** An earlier application to the same company. Shown, never a gate (P11). */
export interface FlowCompanyApplication {
  applied_at: string;
  job_id: string | null;
  title: string;
  job_url: string | null;
  outcome: string;
}

export interface FlowApplyQueue {
  queue_id: string;
  built_at: string;
  lane: "assisted" | "bulk";
  daily_cap: number | null;
  remaining_today: number | null;
  items: FlowQueueItem[];
  excluded: FlowQueueItem[];
}

export function getApplyQueue(
  baseUrl: string,
  p: { minScore: number; maxScore: number; limit: number }
): Promise<FlowApplyQueue> {
  const qs = new URLSearchParams({ min_score: String(p.minScore), max_score: String(p.maxScore), limit: String(p.limit) });
  return flowGet(baseUrl, `/api/apply/queue?${qs}`, "getApplyQueue");
}

export const applicationsExportUrl = (baseUrl: string, format: "csv" | "json") =>
  `${baseUrl}/api/applications?format=${format}`;

// --- Sync (Profile-Management-Spec §6) ----------------------------------------
// Quiver owns every user setting. Before it controls Flow, Flow must hold the
// same bundle; a hash decides whether a PUT is needed.

export interface FlowSyncState {
  hash: string | null;
  profile_name: string | null;
  synced_at: string | null;
  apply?: { daily_cap: number | null; review_by: string | null };
  prescore?: { enabled: boolean; threshold: number };
}

export type FlowSyncProblem = "first-sync" | "other-profile";

/** Sync needs the user: Flow has never been synced and has settings of its
 * own (import or replace?), or it holds another workspace profile (replace?). */
export class FlowSyncError extends Error {
  constructor(public problem: FlowSyncProblem, message: string, public remoteProfile: string | null = null) {
    super(message);
    this.name = "FlowSyncError";
  }
}

export interface FlowSyncSource {
  name: string;
  profileMarkdown: string;
  settings: ProfileSettings;
  preferences?: Layer<ProfilePreferences>;
  fingerprint?: Layer<string>;
}

/** The bundle PUT /api/sync takes, and its hash. */
export async function buildFlowBundle(src: FlowSyncSource): Promise<{ bundle: Record<string, unknown>; hash: string }> {
  const flow = src.settings.flow ?? defaultFlowRunConfig();
  const ep = flow.llmEndpoint === "secondary" ? src.settings.secondary : src.settings.primary;
  let llm: Record<string, unknown> | null = null;
  if (ep?.model && (ep.provider === "anthropic" || ep.provider === "openai-compatible")) {
    const mapped = mapProviderForFlow(ep);
    llm = {
      provider: mapped.provider, model: ep.model, base_url: mapped.base_url,
      api_key: ep.apiKey || null, temperature: ep.temperature ?? 0,
      soft_model: flow.softModel || null, hard_model: flow.hardModel || null,
    };
  }
  const body = {
    profile_name: src.name,
    master: src.profileMarkdown,
    preferences: src.preferences?.value ?? null,
    fingerprint: src.fingerprint?.value ?? null,
    llm,
    backlog: flow.backlog,
    apply: flow.apply,
    prescore: flow.prescore,
  };
  const hash = await sha256(canonicalJson(body));
  return { bundle: { ...body, hash }, hash };
}

async function activeSyncSource(): Promise<FlowSyncSource | null> {
  try {
    const { db } = await import("../db/schema");
    const id = (await db.metadata.get("activeProfileId"))?.value;
    const rec = typeof id === "string" ? await db.profiles.get(id) : undefined;
    return rec
      ? { name: rec.name, profileMarkdown: rec.profileMarkdown, settings: rec.settings,
          preferences: rec.preferences, fingerprint: rec.fingerprint }
      : null;
  } catch {
    return null;
  }
}

/** baseUrl → the hash Flow was last seen holding, so an unchanged profile costs nothing. */
const syncedHash = new Map<string, string>();

export function getFlowSyncState(baseUrl: string): Promise<FlowSyncState> {
  return flowGet(baseUrl, "/api/sync", "getFlowSyncState");
}

function syncErrorMessage(detail: unknown, fallback: string): string {
  const d = (detail as { detail?: unknown } | null)?.detail;
  if (Array.isArray(d)) {
    return d.map((x: { loc?: unknown[]; msg: string }) => `${(x.loc ?? []).slice(1).join(".")}: ${x.msg}`).join("; ");
  }
  return typeof d === "string" ? d : fallback;
}

/**
 * Make Flow hold what Quiver has. Reads the active profile from IndexedDB
 * unless `source` is given. Throws FlowSyncError when the user must decide
 * (pass `replace: true` once they have), and a plain Error when the PUT fails;
 * either way the caller's control call does not run.
 */
export async function ensureFlowSynced(
  baseUrl: string,
  opts: { source?: FlowSyncSource; replace?: boolean; force?: boolean } = {}
): Promise<FlowSyncState | null> {
  const src = opts.source ?? (await activeSyncSource());
  if (!src) return null;
  const { bundle, hash } = await buildFlowBundle(src);
  if (!opts.force && syncedHash.get(baseUrl) === hash) return null;

  const remote = await getFlowSyncState(baseUrl);
  if (remote.hash === hash) {
    syncedHash.set(baseUrl, hash);
    return remote;
  }
  if (!opts.replace && !remote.hash && !src.settings.flow) {
    throw new FlowSyncError("first-sync", "Flow has settings this profile has not seen yet. Open Settings → Flow to import them or replace them.");
  }
  if (!opts.replace && remote.profile_name && remote.profile_name !== src.name) {
    throw new FlowSyncError("other-profile", `Flow holds the profile "${remote.profile_name}". Open Settings → Flow to replace it with this one.`, remote.profile_name);
  }
  try {
    const res = await fetch(`${baseUrl}/api/sync`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      throw new Error(`Sync to Flow failed: ${syncErrorMessage(await res.json().catch(() => null), res.statusText)}`);
    }
    const state: FlowSyncState = await res.json();
    syncedHash.set(baseUrl, hash);
    return state;
  } catch (err) {
    logFlowError(err, baseUrl, "ensureFlowSynced");
    throw err;
  }
}

export interface FlowLlmSettings {
  provider: string;
  model: string;
  base_url: string;
  soft_model: string | null;
  hard_model: string | null;
}

export function getFlowLlm(baseUrl: string): Promise<FlowLlmSettings> {
  return flowGet(baseUrl, "/api/settings/llm", "getFlowLlm");
}
