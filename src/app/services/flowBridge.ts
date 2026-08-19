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
  summary: string | null;
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
    `/api/jobs?status=new&sort_by=score&sort_dir=desc&show_archived=false&limit=${limit}`,
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
  soft_cap: number;
  hard_cap: number;
  archive_retention_days: number;
  archive_score_threshold: number;
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
