import { db } from "./schema";

export async function clearAllData(): Promise<void> {
  await db.profiles.clear();
  await db.analysisSessions.clear();
  await db.metadata.clear();
  await db.errorLogs.clear();
  localStorage.removeItem("artemis:webllmCache");
  localStorage.removeItem("artemis:flowDigestLastSeen");
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.clear();
    }
  } catch {}
}
