import type { ModelEndpoint } from "../types/llm";

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

export async function sendProfileToFlow(baseUrl: string, profileMarkdown: string): Promise<void> {
  try {
    const res = await fetch(`${baseUrl}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: profileMarkdown, path: "" }),
    });
    if (!res.ok) throw new Error(`Failed to send profile to Flow: ${res.statusText}`);
  } catch (err) {
    logFlowError(err, baseUrl, "sendProfileToFlow");
    throw err;
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

export async function sendConfigToFlow(baseUrl: string, endpoint: ModelEndpoint): Promise<void> {
  try {
    const mapped = mapProviderForFlow(endpoint);
    const res = await fetch(`${baseUrl}/api/settings/llm`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: mapped.provider,
        model: endpoint.model,
        base_url: mapped.base_url,
        api_key: endpoint.apiKey,
        temperature: endpoint.temperature,
      }),
    });
    if (!res.ok) throw new Error(`Failed to send config to Flow: ${res.statusText}`);
  } catch (err) {
    logFlowError(err, baseUrl, "sendConfigToFlow");
    throw err;
  }
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
  /** Archive new jobs from companies already applied to on the board. */
  skip_applied_companies?: boolean;
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

export function updateBacklogConfig(baseUrl: string, config: FlowBacklogConfig): Promise<FlowBacklogConfig> {
  return flowPut(baseUrl, "/api/settings/backlog", config, "updateBacklogConfig");
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
  /** Language names, e.g. "English", "Italian". */
  languages: string[];
  has_degree: boolean | null;
  /** Most applications per day the apply queue hands out. null = no cap. */
  daily_cap: number | null;
  review_by: string | null;
}

export interface FlowGeo {
  countries: { code: string; name: string; regions: string[]; languages: string[] }[];
  regions: { code: string; name: string }[];
}

export function getPreferences(baseUrl: string): Promise<FlowPreferences> {
  return flowGet(baseUrl, "/api/settings/preferences", "getPreferences");
}

/** Flow re-judges every job on save; a 422 means an unknown place code. */
export async function updatePreferences(baseUrl: string, prefs: FlowPreferences): Promise<FlowPreferences> {
  const res = await fetch(`${baseUrl}/api/settings/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    const msg = Array.isArray(detail?.detail) ? detail.detail.map((d: { msg: string }) => d.msg).join("; ") : res.statusText;
    const err = new Error(`updatePreferences failed: ${msg}`);
    logFlowError(err, baseUrl, "updatePreferences");
    throw err;
  }
  return res.json();
}

export function getGeo(baseUrl: string): Promise<FlowGeo> {
  return flowGet(baseUrl, "/api/geo/countries", "getGeo");
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
  p: { minScore: number; maxScore: number; limit: number; excludeCompanies?: string[] }
): Promise<FlowApplyQueue> {
  const qs = new URLSearchParams({ min_score: String(p.minScore), max_score: String(p.maxScore), limit: String(p.limit) });
  for (const c of p.excludeCompanies ?? []) qs.append("exclude_company", c);
  return flowGet(baseUrl, `/api/apply/queue?${qs}`, "getApplyQueue");
}

export interface FlowCompanyRule {
  company_key?: string;
  display_name: string;
  aliases: string[];
  kind: "block" | "ask" | "quota";
  max_applications: number | null;
  window_days: number | null;
  role_cooldown_days: number | null;
  until: string | null;
  reason: string | null;
  policy_url: string | null;
}

export async function getCompanyRules(baseUrl: string): Promise<FlowCompanyRule[]> {
  return (await flowGet<{ rules: FlowCompanyRule[] }>(baseUrl, "/api/company-rules", "getCompanyRules")).rules;
}

export function putCompanyRule(baseUrl: string, rule: FlowCompanyRule): Promise<FlowCompanyRule> {
  return flowPut(baseUrl, "/api/company-rules", rule, "putCompanyRule");
}

export async function deleteCompanyRule(baseUrl: string, companyKey: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/company-rules/${encodeURIComponent(companyKey)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteCompanyRule failed: ${res.statusText}`);
}

export const applicationsExportUrl = (baseUrl: string, format: "csv" | "json") =>
  `${baseUrl}/api/applications?format=${format}`;
