import { describe, it, expect, vi, beforeEach } from "vitest";
import { chatCompletion } from "../llmService";
import { buildFlowBundle } from "../flowBridge";
import { readMeta } from "../applyQueue";
import type { ModelEndpoint } from "../../types/llm";
import type { ProfileSettings } from "../../types/workspace";

vi.mock("../../db/errorLogRepo", () => ({ addErrorLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../applyQueue", () => ({ readMeta: vi.fn() }));

const cloud: ModelEndpoint = { label: "C", provider: "openai-compatible", baseUrl: "https://llm.example.com", model: "m", temperature: 0 };
const local: ModelEndpoint = { ...cloud, baseUrl: "http://localhost:1234" };

function storeForm(form: unknown) {
  vi.mocked(readMeta).mockImplementation(async (key: string) => (key === "activeProfileId" ? "p1" : form) as never);
}

function mockReply(content: string) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] })));
  vi.stubGlobal("fetch", fetchMock);
  return () => String(fetchMock.mock.calls[0]![1].body);
}

const form = { fields: { first_name: { value: "Jane" }, city: { value: "Springfield" } } };
const ask = (ep: ModelEndpoint) => chatCompletion([{ role: "user", content: "Jane in Springfield" }], ep);

beforeEach(() => {
  vi.mocked(readMeta).mockReset();
});

describe("chatCompletion", () => {
  it("sends tags to a cloud endpoint and returns real values", async () => {
    storeForm(form);
    const sent = mockReply("Hello [CANDIDATE_FIRST_NAME]");
    expect(await ask(cloud)).toBe("Hello Jane");
    expect(sent()).toContain("[CANDIDATE_FIRST_NAME] in [HOME_CITY]");
    expect(sent()).not.toMatch(/Jane|Springfield/);
  });

  it("leaves local endpoints alone", async () => {
    storeForm(form);
    const sent = mockReply("ok");
    await ask(local);
    expect(sent()).toContain("Jane in Springfield");
  });

  it("respects the switch", async () => {
    storeForm({ ...form, redact: false });
    const sent = mockReply("ok");
    await ask(cloud);
    expect(sent()).toContain("Jane in Springfield");
  });

  it("sends nothing when the details can't be read", async () => {
    vi.mocked(readMeta).mockImplementation(async () => {
      throw new Error("no db");
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const failure = await ask(cloud).catch((e: Error) => e);
    expect((failure as Error).message).toBe("no db");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("buildFlowBundle", () => {
  const source = (primary: ModelEndpoint) => ({
    name: "Work",
    profileMarkdown: "Jane in Springfield",
    settings: { primary, secondary: primary } as ProfileSettings,
    fingerprint: { value: "Jane" } as never,
  });

  it("tags the profile and fingerprint for a cloud-backed Flow", async () => {
    storeForm(form);
    const { bundle } = await buildFlowBundle(source(cloud));
    expect(bundle.master).toBe("[CANDIDATE_FIRST_NAME] in [HOME_CITY]");
    expect(bundle.fingerprint).toBe("[CANDIDATE_FIRST_NAME]");
  });

  it("sends a local Flow the real profile", async () => {
    storeForm(form);
    expect((await buildFlowBundle(source(local))).bundle.master).toBe("Jane in Springfield");
  });
});
