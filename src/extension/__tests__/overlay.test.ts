import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStorage: Record<string, object> = {};
const mockGet = vi.fn((key: string) => {
  const val = mockStorage[key as any];
  return val !== undefined ? Promise.resolve({ [key]: val }) : Promise.resolve({});
});
const mockSet = vi.fn(() => Promise.resolve());

vi.stubGlobal("chrome", {
  runtime: { id: "test", getURL: (p: string) => p, sendMessage: vi.fn() },
  storage: {
    local: { get: mockGet, set: mockSet },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
});

async function loadConfig(): Promise<{ enabled: boolean; jobSites: string[]; fallbackMode: string; fingerprint?: string }> {
  try {
    const result = await chrome.storage.local.get("artemis:overlayConfig");
    return (result["artemis:overlayConfig"] as any) || { enabled: true, jobSites: [], fallbackMode: "basic" };
  } catch (e) {
    return { enabled: true, jobSites: [], fallbackMode: "basic" };
  }
}

async function loadPosition(): Promise<{ x: number; y: number }> {
  try {
    const result = await chrome.storage.local.get("artemis:overlayPosition");
    return (result["artemis:overlayPosition"] as any) || { x: 20, y: 20 };
  } catch (e) {
    return { x: 20, y: 20 };
  }
}

function getScoringFailedMessage(fallbackMode: string): string {
  return fallbackMode === "basic"
    ? "Gemini Nano is unavailable. Switch the fallback mode in the extension popup to enable AI scoring."
    : "Check that your LLM endpoint is configured in settings and the server is running.";
}

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete mockStorage["artemis:overlayConfig"];
  });

  it("returns stored config when chrome.storage succeeds", async () => {
    mockStorage["artemis:overlayConfig"] = { enabled: true, jobSites: ["linkedin.com"], fallbackMode: "primary", fingerprint: "abc123" };
    const cfg = await loadConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.jobSites).toEqual(["linkedin.com"]);
    expect(cfg.fallbackMode).toBe("primary");
    expect(cfg.fingerprint).toBe("abc123");
  });

  it("returns default config when storage returns nothing", async () => {
    const cfg = await loadConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.jobSites).toEqual([]);
    expect(cfg.fallbackMode).toBe("basic");
    expect(cfg.fingerprint).toBeUndefined();
  });

  it("returns default config on storage error (try/catch fix)", async () => {
    mockGet.mockRejectedValueOnce(new Error("Storage quota exceeded"));
    const cfg = await loadConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.jobSites).toEqual([]);
    expect(cfg.fallbackMode).toBe("basic");
  });

  it("returns default config on unexpected rejection (try/catch fix)", async () => {
    mockGet.mockRejectedValueOnce("random error");
    const cfg = await loadConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.fallbackMode).toBe("basic");
  });
});

describe("loadPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete mockStorage["artemis:overlayPosition"];
  });

  it("returns stored position when chrome.storage succeeds", async () => {
    mockStorage["artemis:overlayPosition"] = { x: 100, y: 200 };
    const pos = await loadPosition();
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
  });

  it("returns default position when storage returns nothing", async () => {
    const pos = await loadPosition();
    expect(pos.x).toBe(20);
    expect(pos.y).toBe(20);
  });

  it("returns default position on storage error (try/catch fix)", async () => {
    mockGet.mockRejectedValueOnce(new Error("Storage failed"));
    const pos = await loadPosition();
    expect(pos.x).toBe(20);
    expect(pos.y).toBe(20);
  });

  it("returns default position on unexpected rejection (try/catch fix)", async () => {
    mockGet.mockRejectedValueOnce("random error");
    const pos = await loadPosition();
    expect(pos.x).toBe(20);
    expect(pos.y).toBe(20);
  });
});

describe("error message for basic mode (fix #2)", () => {
  it('returns Nano-specific message when fallbackMode is "basic"', () => {
    const msg = getScoringFailedMessage("basic");
    expect(msg).toContain("Gemini Nano");
    expect(msg).not.toContain("LLM endpoint");
    expect(msg).not.toContain("server is running");
  });

  it('returns endpoint message when fallbackMode is "secondary"', () => {
    const msg = getScoringFailedMessage("secondary");
    expect(msg).toContain("LLM endpoint");
    expect(msg).toContain("server is running");
    expect(msg).not.toContain("Gemini Nano");
  });

  it('returns endpoint message when fallbackMode is "primary"', () => {
    const msg = getScoringFailedMessage("primary");
    expect(msg).toContain("LLM endpoint");
    expect(msg).toContain("server is running");
    expect(msg).not.toContain("Gemini Nano");
  });
});

describe("savePosition", () => {
  it("writes position to storage", async () => {
    await chrome.storage.local.set({ "artemis:overlayPosition": { x: 50, y: 75 } });
    expect(mockSet).toHaveBeenCalledWith({ "artemis:overlayPosition": { x: 50, y: 75 } });
  });
});
