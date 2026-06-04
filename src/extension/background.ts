/// <reference types="chrome" />

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        text: document.body.innerText,
        url: location.href,
      }),
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
