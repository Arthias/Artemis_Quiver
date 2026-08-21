import { db } from "./schema";
import { AppError, ErrorCodes } from "../utils/errors";

export async function clearAllData(): Promise<void> {
  try {
    await db.transaction(
      "rw",
      [db.profiles, db.analysisSessions, db.metadata, db.errorLogs],
      async () => {
        await db.profiles.clear();
        await db.analysisSessions.clear();
        await db.metadata.clear();
        await db.errorLogs.clear();
      }
    );
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_DELETE_FAILED, "Failed to clear all data");
  }

  localStorage.removeItem("artemis:webllmCache");
  localStorage.removeItem("artemis:flowDigestLastSeen");
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.clear();
    }
  } catch {}
}
