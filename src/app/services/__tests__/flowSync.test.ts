import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFlowBundle, ensureFlowSynced, FlowSyncError, type FlowSyncSource } from "../flowBridge";
import { DEFAULT_PRIMARY_ENDPOINT, DEFAULT_SECONDARY_ENDPOINT } from "../../types/llm";
import { defaultFlowRunConfig } from "../../types/preferences";
import type { ProfileSettings } from "../../types/workspace";

const settings = (over: Partial<ProfileSettings> = {}): ProfileSettings => ({
  theme: "light", providerMode: "cloud", secondaryUse: "never", autoSaveProfile: true,
  primary: { ...DEFAULT_PRIMARY_ENDPOINT, baseUrl: "http://llm:1234", model: "m" },
  secondary: DEFAULT_SECONDARY_ENDPOINT,
  flow: defaultFlowRunConfig(),
  ...over,
} as ProfileSettings);

const source = (over: Partial<FlowSyncSource> = {}): FlowSyncSource => ({
  name: "Work", profileMarkdown: "# Me", settings: settings(), ...over,
});

function mockFlow(remote: { hash: string | null; profile_name: string | null }) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const body = method === "PUT" ? { status: "ok", hash: "new" } : { ...remote, synced_at: null };
    return new Response(JSON.stringify(body), { status: 200 });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("ensureFlowSynced", () => {
  it("makes no PUT when Flow already holds the bundle", async () => {
    const { hash } = await buildFlowBundle(source());
    const calls = mockFlow({ hash, profile_name: "Work" });
    await ensureFlowSynced("http://flow-a", { source: source() });
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
    await ensureFlowSynced("http://flow-a", { source: source() }); // cached: no request at all
    expect(calls).toHaveLength(1);
  });

  it("sends the whole bundle when the hash differs", async () => {
    const calls = mockFlow({ hash: "old", profile_name: "Work" });
    await ensureFlowSynced("http://flow-b", { source: source() });
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toBe("http://flow-b/api/sync");
    expect(put.body).toMatchObject({ profile_name: "Work", master: "# Me", llm: { provider: "lmstudio", model: "m" } });
  });

  it("asks before the first sync of a Flow that has its own settings", async () => {
    mockFlow({ hash: null, profile_name: null });
    const fresh = source({ settings: settings({ flow: undefined }) });
    await expect(ensureFlowSynced("http://flow-c", { source: fresh })).rejects.toMatchObject({ problem: "first-sync" });
  });

  it("asks before replacing another workspace profile, and replaces once told to", async () => {
    const calls = mockFlow({ hash: "x", profile_name: "Other" });
    const err = await ensureFlowSynced("http://flow-d", { source: source() }).catch((e) => e);
    expect(err).toBeInstanceOf(FlowSyncError);
    expect(err.remoteProfile).toBe("Other");
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    await ensureFlowSynced("http://flow-d", { source: source(), replace: true });
    expect(calls.some((c) => c.method === "PUT")).toBe(true);
  });
});
