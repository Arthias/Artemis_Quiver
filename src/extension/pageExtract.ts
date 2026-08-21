// Shared page-content extraction, injected via chrome.scripting.executeScript
// into a tab's page context (NOT run as a normal module — the function body
// is serialized and executed in isolation, so it must not close over any
// outer variable). Used by both background.ts (import/quick-analyze) and
// sidepanel.tsx (deep-analysis handoff) so all three paths get the same
// LinkedIn-aware extraction instead of three slightly different copies.
export async function extractPageContent(): Promise<{
  title: string;
  company: string;
  text: string;
  url: string;
}> {
  const isLinkedIn = location.hostname.includes("linkedin.com");

  function waitForStable(timeout: number): Promise<void> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 800);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  }

  if (isLinkedIn) {
    await waitForStable(8000);
    await new Promise((r) => setTimeout(r, 2000));

    let text = document.body.innerText;

    const startMarkers = ["about the job", "about this role", "job description"];
    const endMarkers = ["job search faster with premium", "about the company", "show more", "people also viewed"];

    const lines = text.split("\n").map((l) => l.trim());
    let startIdx = 0;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const lower = line.toLowerCase();
      if (startMarkers.some((m) => lower.startsWith(m))) {
        startIdx = i;
        break;
      }
    }

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const lower = line.toLowerCase();
      if (endMarkers.some((m) => lower.startsWith(m))) {
        endIdx = i;
        break;
      }
    }

    const bodyLines = lines.slice(startIdx, endIdx);
    text = bodyLines.join("\n").trim();

    const titleEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__title, h1");
    const title = titleEl?.innerText?.trim() || document.title;
    const companyEl = document.querySelector<HTMLElement>(".jobs-unified-top-card__company-name");
    const company = companyEl?.innerText?.trim() || "";

    return { title, company, text: `${title}\n\n${text}`, url: location.href };
  }

  return {
    title: document.title,
    company: "",
    text: document.body.innerText,
    url: location.href,
  };
}
