import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "../ui/button";
import { getCaptureQueue, postCapture } from "../../services/flowBridge";
import { extractJobPosting } from "../../../extension/pageExtract";

/** Only an extension page (Quiver opened from the extension) can open tabs. */
export const captureAvailable =
  typeof chrome !== "undefined" && !!chrome.tabs?.create && !!chrome.scripting?.executeScript;

const PAUSE_MIN_MS = 30_000;
const PAUSE_MAX_MS = 90_000;
const LOAD_TIMEOUT_MS = 30_000;
// Client-rendered career pages fill in after the load event.
const SETTLE_MS = 3_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function waitForLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === "complete") done();
    };
    const timer = setTimeout(done, LOAD_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/** Open the job in a background tab (no focus change), read it, close it. */
async function capturePage(url: string) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForLoad(tab.id!);
    await sleep(SETTLE_MS);
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id! }, func: extractJobPosting });
    return res?.result ?? null;
  } finally {
    chrome.tabs.remove(tab.id!).catch(() => {});
  }
}

interface Stats {
  captured: number;
  empty: number;
  failed: number;
}

export function CaptureBlock({ flowBaseUrl }: { flowBaseUrl: string }) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<Stats>({ captured: 0, empty: 0, failed: 0 });
  const stopRef = useRef(false);

  useEffect(() => () => { stopRef.current = true; }, []);

  async function loop() {
    while (!stopRef.current) {
      let job;
      try {
        [job] = await getCaptureQueue(flowBaseUrl, 1);
      } catch {
        setMessage(t("flow.captureFlowUnreachable"));
        break;
      }
      if (!job) {
        setMessage(t("flow.captureQueueEmpty"));
        break;
      }
      setMessage(t("flow.captureOpening", { title: job.title, company: job.company ?? "" }));
      try {
        const page = await capturePage(job.url);
        const result = page
          ? await postCapture(flowBaseUrl, {
              // Flow's own URL, not the post-redirect one, so the capture matches the job by url_hash.
              url: job.url,
              fields: page.fields,
              jsonld_found: page.jsonld_found,
              extractor: "quiver-bgtab",
              extractor_version: 1,
            })
          : null;
        const gotText = !!result?.fields_written?.includes("description");
        setStats((s) => ({ ...s, [gotText ? "captured" : "empty"]: s[gotText ? "captured" : "empty"] + 1 }));
      } catch (err) {
        console.warn("[Artemis] capture failed for", job.url, err);
        setStats((s) => ({ ...s, failed: s.failed + 1 }));
      }
      // Interruptible pause, jittered so the requests don't arrive on a beat.
      const until = Date.now() + PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
      while (!stopRef.current && Date.now() < until) {
        setMessage(t("flow.captureWaiting", { seconds: Math.ceil((until - Date.now()) / 1000) }));
        await sleep(1000);
      }
    }
    setRunning(false);
  }

  async function handleToggle() {
    if (running) {
      stopRef.current = true;
      setMessage(t("flow.captureStopping"));
      return;
    }
    // Reading arbitrary career sites needs host access; asked once, in this click.
    const granted = await chrome.permissions.request({ origins: ["*://*/*"] }).catch(() => false);
    if (!granted) {
      setMessage(t("flow.capturePermissionDenied"));
      return;
    }
    stopRef.current = false;
    setRunning(true);
    void loop();
  }

  return (
    <div className="rounded border border-sky-500/40 bg-sky-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t("flow.capture")}</p>
          <p className="text-xs text-muted-foreground">{t("flow.captureDesc")}</p>
        </div>
        <Button size="sm" variant={running ? "outline" : "default"} onClick={handleToggle}>
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {running ? t("flow.captureStop") : t("flow.captureStart")}
        </Button>
      </div>
      {(running || message) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          {running && <Loader2 className="w-3 h-3 animate-spin" />}
          {message}
        </p>
      )}
      {stats.captured + stats.empty + stats.failed > 0 && (
        <p className="text-xs text-muted-foreground">{t("flow.captureStats", { ...stats })}</p>
      )}
    </div>
  );
}
