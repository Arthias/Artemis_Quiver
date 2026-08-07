import type { ModelEndpoint } from "../app/types/llm";

// The web app runs at chrome-extension://<id>/index.html, so its IndexedDB
// (ArtemisQuiverDB) lives on the SAME origin as the background service worker.
// That lets the background read the active profile directly instead of
// round-tripping through an open app tab.
const DB_NAME = "ArtemisQuiverDB";

export interface ExtensionProfile {
  profileMarkdown: string;
  primary?: ModelEndpoint;
  secondary?: ModelEndpoint;
}

interface MetadataRecord {
  key: string;
  value: unknown;
}

function requestTo<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbExists(): Promise<boolean> {
  try {
    if (typeof indexedDB.databases === "function") {
      const dbs = await indexedDB.databases();
      return dbs.some((d) => d.name === DB_NAME);
    }
  } catch {
    // fall through and let the open fail harmlessly
  }
  return true;
}

// Returns the markdown + LLM endpoint config of the currently active profile,
// or null when the app hasn't created a database or has no active profile yet.
export async function readActiveProfile(): Promise<ExtensionProfile | null> {
  if (!(await dbExists())) return null;

  let db: IDBDatabase | null = null;
  try {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tx = db.transaction(["metadata", "profiles"], "readonly");
    const activeRecord = await requestTo<MetadataRecord | undefined>(
      tx.objectStore("metadata").get("activeProfileId")
    );
    const activeId: unknown = activeRecord?.value ?? null;
    if (!activeId || typeof activeId !== "string") return null;

    const profile = await requestTo<any | undefined>(tx.objectStore("profiles").get(activeId));
    if (!profile) return null;

    const markdown: unknown = profile.profileMarkdown;
    if (typeof markdown !== "string" || markdown.length === 0) return null;

    const settings: Record<string, unknown> | undefined = profile.settings;
    return {
      profileMarkdown: markdown,
      primary: (settings?.primary as ModelEndpoint | undefined) || undefined,
      secondary: (settings?.secondary as ModelEndpoint | undefined) || undefined,
    };
  } catch (err) {
    console.warn("[Artemis] Failed to read profile from IndexedDB:", err);
    return null;
  } finally {
    db?.close();
  }
}