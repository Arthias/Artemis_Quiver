// The user's linked CV folder (File System Access API). The directory handle
// lives in IndexedDB's `metadata` table, which the app and the side panel
// share (same chrome-extension:// origin), so linking it once in either place
// works in both. Quiver only ever writes into the QUIVER_SUBFOLDER inside it —
// the user's own CVs are listed, never touched.
import { db } from "../db/schema";

const HANDLE_KEY = "cvFolder:handle";
const FAVOURITES_KEY = "cvFolder:favourites";
const AUTO_SAVE_KEY = "cvFolder:autoSave";
export const QUIVER_SUBFOLDER = "Quiver";
const CV_EXTENSIONS = /\.(pdf|docx?|odt|rtf|txt)$/i;

export interface CvFile {
  name: string;
  /** "" for the user's folder, QUIVER_SUBFOLDER for generated CVs. */
  folder: string;
  lastModified: number;
  handle: FileSystemFileHandle;
}

// The File System Access types in lib.dom lag behind Chrome; these are the
// bits used here.
type PermissionedHandle = FileSystemDirectoryHandle & {
  queryPermission(opts: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission(opts: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  values(): AsyncIterable<FileSystemHandle>;
};

export function isFolderSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === "function";
}

export async function getFolderHandle(): Promise<PermissionedHandle | null> {
  const rec = await db.metadata.get(HANDLE_KEY);
  return (rec?.value as PermissionedHandle | undefined) ?? null;
}

/** Must be called from a click. */
export async function pickFolder(): Promise<PermissionedHandle> {
  const handle = (await (window as any).showDirectoryPicker({ id: "artemis-cvs", mode: "readwrite" })) as PermissionedHandle;
  await db.metadata.put({ key: HANDLE_KEY, value: handle });
  return handle;
}

export async function unlinkFolder(): Promise<void> {
  await db.metadata.delete(HANDLE_KEY);
}

/** True when access is already granted; never prompts. */
export async function hasFolderAccess(handle: PermissionedHandle): Promise<boolean> {
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

/** Prompts if needed — must be called from a click (before any other await that might lose the gesture). */
export async function ensureFolderAccess(handle: PermissionedHandle): Promise<boolean> {
  if (await hasFolderAccess(handle)) return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

async function listDir(dir: PermissionedHandle, folder: string): Promise<CvFile[]> {
  const out: CvFile[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind !== "file" || !CV_EXTENSIONS.test(entry.name)) continue;
    const handle = entry as FileSystemFileHandle;
    const file = await handle.getFile();
    out.push({ name: entry.name, folder, lastModified: file.lastModified, handle });
  }
  return out;
}

export async function listCvFiles(handle: PermissionedHandle): Promise<CvFile[]> {
  const own = await listDir(handle, "");
  let generated: CvFile[] = [];
  try {
    const sub = (await handle.getDirectoryHandle(QUIVER_SUBFOLDER)) as PermissionedHandle;
    generated = await listDir(sub, QUIVER_SUBFOLDER);
  } catch {
    // No generated CVs yet — the subfolder is created on first save.
  }
  return [...own, ...generated];
}

/** Writes into <folder>/Quiver/, replacing a same-named file. Returns the saved name. */
export async function saveToQuiverSubfolder(handle: PermissionedHandle, filename: string, bytes: Uint8Array): Promise<string> {
  const sub = await handle.getDirectoryHandle(QUIVER_SUBFOLDER, { create: true });
  const name = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  const fileHandle = await sub.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes as unknown as BufferSource);
  await writable.close();
  return name;
}

export function cvFileKey(f: Pick<CvFile, "folder" | "name">): string {
  return f.folder ? `${f.folder}/${f.name}` : f.name;
}

export async function getFavourites(): Promise<string[]> {
  const rec = await db.metadata.get(FAVOURITES_KEY);
  return Array.isArray(rec?.value) ? rec.value : [];
}

export async function setFavourites(keys: string[]): Promise<void> {
  await db.metadata.put({ key: FAVOURITES_KEY, value: keys });
}

export async function getAutoSave(): Promise<boolean> {
  return (await db.metadata.get(AUTO_SAVE_KEY))?.value === true;
}

export async function setAutoSave(on: boolean): Promise<void> {
  await db.metadata.put({ key: AUTO_SAVE_KEY, value: on });
}

/**
 * Sort order for the panel: favourites, then a file whose name mentions the
 * current company ("for this job"), then newest first.
 */
export function sortCvFiles(files: CvFile[], favourites: string[], company: string): CvFile[] {
  const c = company.trim().toLowerCase();
  const rank = (f: CvFile) =>
    (favourites.includes(cvFileKey(f)) ? 0 : 2) + (c.length >= 2 && f.name.toLowerCase().includes(c) ? 0 : 1);
  return [...files].sort((a, b) => rank(a) - rank(b) || b.lastModified - a.lastModified);
}

export function matchesCompany(name: string, company: string): boolean {
  const c = company.trim().toLowerCase();
  return c.length >= 2 && name.toLowerCase().includes(c);
}

// ── Auto-save: PDF bytes via the debugger ───────────────────────────────
// The browser exposes no print-to-PDF bytes; Page.printToPDF over
// chrome.debugger is the only way. Chrome does not allow `debugger` as an
// optional permission, so auto-save is only offered in a build whose manifest
// declares it as a required one — the shipped manifest doesn't. Chrome shows
// its "started debugging this browser" bar while attached.

export function isAutoSaveSupported(): boolean {
  try {
    return chrome.runtime.getManifest().permissions?.includes("debugger") ?? false;
  } catch {
    return false;
  }
}

export async function hasDebuggerPermission(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ["debugger"] });
}

/** Must be called from a click. */
export async function requestDebuggerPermission(): Promise<boolean> {
  return chrome.permissions.request({ permissions: ["debugger"] });
}

/** PDF of the calling tab as the print engine would produce it (print media, @page rules honoured). */
export async function capturePdfOfThisTab(): Promise<Uint8Array> {
  const tab = await chrome.tabs.getCurrent();
  if (!tab?.id) throw new Error("Auto-save only works from the extension's app tab.");
  const target = { tabId: tab.id };
  await chrome.debugger.attach(target, "1.3");
  try {
    const res = (await chrome.debugger.sendCommand(target, "Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
    })) as { data: string };
    return Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

/**
 * The folder to auto-save into, or null when auto-save is off or can't run
 * (no folder, permission withdrawn). Call early in the export click — it may
 * prompt to re-grant folder access.
 */
export async function getAutoSaveFolder(): Promise<PermissionedHandle | null> {
  if (!isAutoSaveSupported() || !(await getAutoSave())) return null;
  const handle = await getFolderHandle();
  if (!handle || !(await hasDebuggerPermission())) return null;
  return (await ensureFolderAccess(handle)) ? handle : null;
}
