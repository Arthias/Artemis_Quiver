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

/** The ranked digest — best-scoring new jobs, per the decided "digest, not board" default presentation. */
export function getFlowDigest(baseUrl: string, limit = 20): Promise<FlowJobListResponse> {
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
