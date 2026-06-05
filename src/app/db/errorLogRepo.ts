import { db, type ErrorLogRecord } from "./schema";

const LOG_LIMIT = 500;
const listeners = new Set<() => void>();

export function onErrorLogUpdate(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export async function addErrorLog(entry: Omit<ErrorLogRecord, "id">): Promise<void> {
  const count = await db.errorLogs.count();
  if (count >= LOG_LIMIT) {
    const oldest = await db.errorLogs.orderBy("timestamp").limit(count - LOG_LIMIT + 1).toArray();
    if (oldest.length > 0) {
      await db.errorLogs.bulkDelete(oldest.map((r) => r.id));
    }
  }
  await db.errorLogs.add({ id: crypto.randomUUID(), ...entry });
  notifyListeners();
}

export async function getErrorLogs(limit = 200): Promise<ErrorLogRecord[]> {
  return db.errorLogs.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function clearErrorLogs(): Promise<void> {
  await db.errorLogs.clear();
}
