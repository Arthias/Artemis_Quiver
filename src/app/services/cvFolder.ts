// The user's linked CV folder (File System Access API). The directory handle
// lives in IndexedDB's `metadata` table, which the app and the side panel
// share (same chrome-extension:// origin), so linking it once in either place
// works in both. Quiver never writes to it: exported CVs are saved by the user
// into the QUIVER_SUBFOLDER via the print dialog (Chrome remembers the last
// location), and the panel lists that subfolder separately.
import { db } from "../db/schema";

const HANDLE_KEY = "cvFolder:handle";
const FAVOURITES_KEY = "cvFolder:favourites";
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
  const handle = (await (window as any).showDirectoryPicker({ id: "artemis-cvs", mode: "read" })) as PermissionedHandle;
  await db.metadata.put({ key: HANDLE_KEY, value: handle });
  return handle;
}

export async function unlinkFolder(): Promise<void> {
  await db.metadata.delete(HANDLE_KEY);
}

/** True when access is already granted; never prompts. */
export async function hasFolderAccess(handle: PermissionedHandle): Promise<boolean> {
  return (await handle.queryPermission({ mode: "read" })) === "granted";
}

/** Prompts if needed — must be called from a click (before any other await that might lose the gesture). */
export async function ensureFolderAccess(handle: PermissionedHandle): Promise<boolean> {
  if (await hasFolderAccess(handle)) return true;
  return (await handle.requestPermission({ mode: "read" })) === "granted";
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

