/// <reference types="chrome" />

console.log("[Artemis] Nano inject loaded");

function init() {
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "artemis-overlay") return;

    const { method, args, requestId } = event.data;
    console.log("[Artemis] Nano inject received:", method, requestId);

    if (method === "nano-ping") {
      console.log("[Artemis] nano-ping: responding pong");
      window.postMessage({ source: "artemis-nano", requestId, result: "pong" }, "*");
      return;
    }

    if (method === "nano-check") {
      try {
        const lm = (window as any).LanguageModel;
        if (!lm) {
          console.log("[Artemis] nano-check: LanguageModel not found");
          window.postMessage({ source: "artemis-nano", requestId, result: { grant: false } }, "*");
          return;
        }
        const availability = await lm.availability();
        console.log("[Artemis] nano-check: availability:", availability);
        const grant = availability === "available" || availability === "downloadable";
        window.postMessage({ source: "artemis-nano", requestId, result: { grant } }, "*");
      } catch (err) {
        console.error("[Artemis] nano-check: exception:", err);
        window.postMessage({ source: "artemis-nano", requestId, result: { grant: false } }, "*");
      }
      return;
    }

    if (method === "nano-test") {
      console.log("[Artemis] nano-test: starting");
      try {
        const lm = (window as any).LanguageModel;
        if (!lm) {
          window.postMessage({ source: "artemis-nano", requestId, result: JSON.stringify({ ok: false, error: "LanguageModel API not found" }) }, "*");
          return;
        }
        const availability = await lm.availability();

        if (availability === "unavailable") {
          window.postMessage({ source: "artemis-nano", requestId, result: JSON.stringify({ ok: false, error: "Not supported in this browser" }) }, "*");
          return;
        }

        if (availability === "downloadable") {
          window.postMessage({ source: "artemis-nano", requestId, progress: "Downloading model\u2026" }, "*");
        }

        console.log("[Artemis] Nano create session...");
        const session = await lm.create({
          monitor(m: any) {
            m.addEventListener("downloadprogress", (e: any) => {
              const pct = Math.round(e.loaded * 100 / e.total);
              console.log("[Artemis] Nano download:", pct + "%");
              window.postMessage({ source: "artemis-nano", requestId, progress: `Downloading\u2026 ${pct}%` }, "*");
            });
          },
        });
        console.log("[Artemis] Nano session created");

        try {
          const result = await session.prompt("Reply with exactly the word 'ok' and nothing else.");
          const ok = result.trim().toLowerCase() === "ok";
          console.log("[Artemis] Nano test result:", result.trim());
          window.postMessage({ source: "artemis-nano", requestId, result: JSON.stringify({ ok, result: result.trim() }) }, "*");
        } finally {
          session.destroy();
        }
      } catch (err: any) {
        console.error("[Artemis] Nano test error:", err);
        window.postMessage({ source: "artemis-nano", requestId, result: JSON.stringify({ ok: false, error: err?.message || String(err) }) }, "*");
      }
      return;
    }

    if (method === "nano-ensure") {
      console.log("[Artemis] nano-ensure: starting");
      try {
        const lm = (window as any).LanguageModel;
        if (!lm) {
          console.log("[Artemis] nano-ensure: LanguageModel not found");
          window.postMessage({ source: "artemis-nano", requestId, result: false }, "*");
          return;
        }
        const availability = await lm.availability();
        console.log("[Artemis] nano-ensure: availability:", availability);
        if (availability === "unavailable") {
          console.log("[Artemis] nano-ensure: unavailable, returning false");
          window.postMessage({ source: "artemis-nano", requestId, result: false }, "*");
          return;
        }
        if (availability === "available") {
          console.log("[Artemis] nano-ensure: already available, returning true");
          window.postMessage({ source: "artemis-nano", requestId, result: true }, "*");
          return;
        }
        console.log("[Artemis] nano-ensure: downloadable, starting download...");
        window.postMessage({ source: "artemis-nano", requestId, progress: "Downloading model\u2026" }, "*");
        const session = await lm.create({
          monitor(m: any) {
            m.addEventListener("downloadprogress", (e: any) => {
              const pct = Math.round(e.loaded * 100 / e.total);
              console.log("[Artemis] nano-ensure: download progress:", pct + "%");
              window.postMessage({ source: "artemis-nano", requestId, progress: `Downloading\u2026 ${pct}%` }, "*");
            });
          },
        });
        console.log("[Artemis] nano-ensure: session created, destroying");
        session.destroy();
        console.log("[Artemis] nano-ensure: returning true");
        window.postMessage({ source: "artemis-nano", requestId, result: true }, "*");
      } catch (err) {
        console.error("[Artemis] nano-ensure: exception:", err);
        window.postMessage({ source: "artemis-nano", requestId, result: false }, "*");
      }
      return;
    }

    if (method === "nano-title") {
      console.log("[Artemis] nano-title: starting");
      try {
        const lm = (window as any).LanguageModel;
        const session = await lm.create();
        try {
          const result = await session.prompt(`Extract the job title from this job posting. Reply with only the job title, nothing else.\n\n${(args.text || "").slice(0, 2000)}`);
          console.log("[Artemis] nano-title: result:", JSON.stringify(result.trim()));
          window.postMessage({ source: "artemis-nano", requestId, result: result.trim() }, "*");
        } finally {
          session.destroy();
        }
      } catch (err) {
        console.error("[Artemis] nano-title: exception:", err);
        window.postMessage({ source: "artemis-nano", requestId, result: "" }, "*");
      }
      return;
    }

    if (method === "nano-score") {
      console.log("[Artemis] nano-score: starting, text.length:", args?.text?.length, "fp.length:", args?.fp?.length);
      try {
        const lm = (window as any).LanguageModel;
        console.log("[Artemis] nano-score: creating session...");
        const session = await lm.create({
          initialPrompts: [{
            role: "system",
            content: "You are a job match scorer. Given a candidate profile and job posting, reply with only a number 0-100. No explanation.",
          }],
          monitor(m: any) {
            m.addEventListener("downloadprogress", (e: any) => {
              console.log(`[Artemis] Nano download: ${(e.loaded * 100 / e.total).toFixed(0)}%`);
            });
          },
        });
        console.log("[Artemis] nano-score: session created");
        try {
          const prompt = `Candidate: ${args.fp}\n\nJob: ${(args.text || "").slice(0, 8000)}`;
          console.log("[Artemis] nano-score: running prompt...");
          const result = await session.prompt(prompt);
          console.log("[Artemis] nano-score: result:", JSON.stringify(result));
          window.postMessage({ source: "artemis-nano", requestId, result }, "*");
        } finally {
          session.destroy();
        }
      } catch (err) {
        console.error("[Artemis] nano-score: exception:", err);
        window.postMessage({ source: "artemis-nano", requestId, result: "" }, "*");
      }
      return;
    }
  });
}

init();
