export async function registerWebLLMSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/webllm-sw.js", {
      scope: "/",
      type: "module",
    });
  } catch {
    return null;
  }
}
