import { ServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

self.addEventListener("activate", () => {
  new ServiceWorkerMLCEngineHandler();
  (self as any).clients.claim();
});
