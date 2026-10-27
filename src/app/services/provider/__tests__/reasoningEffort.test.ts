import { afterEach, expect, it, vi } from "vitest";
import { openAICompatibleAdapter } from "../OpenAICompatibleAdapter";
import { DEFAULT_PRIMARY_ENDPOINT } from "../../../types/llm";

afterEach(() => vi.unstubAllGlobals());

function bodyOf(reasoningEffort?: "none") {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] })));
  vi.stubGlobal("fetch", fetchMock);
  const ep = { ...DEFAULT_PRIMARY_ENDPOINT, baseUrl: "http://s:1234/v1", model: "m", reasoningEffort };
  return openAICompatibleAdapter.chatCompletion([{ role: "user", content: "hi" }], ep)
    .then(() => JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)));
}

it("sends reasoning_effort only when the endpoint turns thinking off", async () => {
  expect(await bodyOf("none")).toMatchObject({ reasoning_effort: "none" });
  expect(await bodyOf()).not.toHaveProperty("reasoning_effort");
});
