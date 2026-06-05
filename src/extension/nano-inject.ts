/// <reference types="chrome" />

function init() {
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "artemis-overlay") return;

    const { method, args, requestId } = event.data;

    if (method === "nano-check") {
      try {
        const lm = (window as any).LanguageModel;
        if (!lm) {
          window.postMessage({ source: "artemis-nano", requestId, result: { grant: false } }, "*");
          return;
        }
        const availability = await lm.availability();
        const grant = availability === "available" || availability === "downloadable";
        window.postMessage({ source: "artemis-nano", requestId, result: { grant } }, "*");
      } catch {
        window.postMessage({ source: "artemis-nano", requestId, result: { grant: false } }, "*");
      }
      return;
    }

    if (method === "nano-score") {
      try {
        const lm = (window as any).LanguageModel;
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
        try {
          const result = await session.prompt(`Candidate: ${args.fp}\n\nJob: ${(args.text || "").slice(0, 8000)}`);
          window.postMessage({ source: "artemis-nano", requestId, result }, "*");
        } finally {
          session.destroy();
        }
      } catch {
        window.postMessage({ source: "artemis-nano", requestId, result: "" }, "*");
      }
      return;
    }
  });
}

init();
