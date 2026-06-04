/// <reference types="chrome" />

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });

    const data = result?.result;
    if (!data?.text) return;

    const appUrl = chrome.runtime.getURL("index.html");
    const existingTabs = await chrome.tabs.query({ url: appUrl });

    if (existingTabs.length > 0 && existingTabs[0]?.id) {
      await chrome.tabs.update(existingTabs[0].id, { active: true });
      await chrome.tabs.sendMessage(existingTabs[0].id, {
        type: "ARTEMIS_IMPORT",
        payload: data,
      });
    } else {
      await chrome.storage.session.set({ "artemis:pendingImport": data });
      await chrome.tabs.create({ url: appUrl });
    }
  } catch (err) {
    console.error("[Artemis] Failed to import:", err);
  }
});

async function extractPageContent() {
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

    const startMarkers = [
      "about the job",
      "about this role",
      "job description",
    ];
    const endMarkers = [
      "job search faster with premium",
      "about the company",
      "show more",
      "people also viewed",
    ];

    const lines = text.split("\n").map((l) => l.trim());
    let startIdx = 0;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (startMarkers.some((m) => lower.startsWith(m))) {
        startIdx = i;
        break;
      }
    }

    for (let i = startIdx + 1; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (endMarkers.some((m) => lower.startsWith(m))) {
        endIdx = i;
        break;
      }
    }

    const bodyLines = lines.slice(startIdx, endIdx);
    text = bodyLines.join("\n").trim();

    const titleEl =
      document.querySelector<HTMLElement>(
        ".jobs-unified-top-card__title, h1"
      );
    const title = titleEl?.innerText?.trim() || document.title;

    return { title, text: `${title}\n\n${text}`, url: location.href };
  }

  return {
    title: document.title,
    text: document.body.innerText,
    url: location.href,
  };
}
