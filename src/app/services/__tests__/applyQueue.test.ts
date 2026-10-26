import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/schema";
import { drainOutbox, loadQueue, outbox, saveQueue, tagItem, undoApplied, currentItem } from "../applyQueue";
import type { FlowApplyQueue, FlowQueueItem } from "../flowBridge";

const item = (id: string, company: string): FlowQueueItem => ({
  job_id: id, title: `Role ${id}`, company, company_key: company.toLowerCase(), employer_known: true,
  location: "", source: "test", score: 80, score_spread: 4, score_passes: 3, summary: null, fit_reasoning: null,
  job_url: `https://example.com/${id}`, apply_url: null, ats_identity: null, work_mode: null, office_days: null,
  eligibility: null, eligibility_reason: null, verdicts: [{ gate: "eligibility", verdict: "pass", detail: "" }],
  company_history: [],
});

const queue: FlowApplyQueue = {
  queue_id: "q1", built_at: "2026-10-19T00:00:00Z", lane: "assisted", daily_cap: null, remaining_today: null,
  items: [item("j1", "Acme"), item("j2", "Beta")], excluded: [],
};

describe("assisted apply outbox", () => {
  beforeEach(async () => {
    await db.open();
    await db.metadata.clear();
  });

  it("records a tag before Flow is reachable and delivers it in order later", async () => {
    const q = await saveQueue("p", "http://flow", queue);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const after = await tagItem("p", q, q.items[0]!, "applied");
    await drainOutbox();
    expect(after.items[0]).toMatchObject({ state: "done", tag: "applied" });
    expect(currentItem(await loadQueue("p"))?.job_id).toBe("j2");
    let ops = await outbox();
    expect(ops).toHaveLength(1);
    expect(ops[0]!.body).toMatchObject({ job_id: "j1", company: "Acme", confirmed: true, queue_id: "q1" });

    // Undo queues a DELETE behind the POST; both go once Flow answers, in order.
    await undoApplied("p", after, after.items[0]!);
    fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
    await drainOutbox();
    expect(fetchMock.mock.calls.map((c) => c[1].method)).toEqual(["POST", "DELETE"]);
    expect(await outbox()).toEqual([]);
    expect(currentItem(await loadQueue("p"))?.job_id).toBe("j1");
  });

  it("keeps an op Flow rejected, marked failed, instead of dropping it", async () => {
    const q = await saveQueue("p", "http://flow", queue);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 422 })));
    await tagItem("p", q, q.items[1]!, "not_sure");
    await drainOutbox();
    const [op] = await outbox();
    expect(op).toMatchObject({ failed: true });
    expect(op!.lastError).toContain("422");
  });

  it("refuses a blocked tag without quoted evidence", async () => {
    const q = await saveQueue("p", "http://flow", queue);
    await expect(tagItem("p", q, q.items[0]!, "blocked", { kind: "degree", evidence: " " }))
      .rejects.toThrow();
    expect(await outbox()).toEqual([]);
  });
});
