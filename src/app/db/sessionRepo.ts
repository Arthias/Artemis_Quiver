import { db, type AnalysisSessionRecord } from "./schema";

export async function getSessions(profileId: string): Promise<AnalysisSessionRecord[]> {
  const sessions = await db.analysisSessions.where("profileId").equals(profileId).toArray();
  return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getSession(id: string): Promise<AnalysisSessionRecord | null> {
  const s = await db.analysisSessions.get(id);
  return s || null;
}

export async function saveSession(session: AnalysisSessionRecord): Promise<void> {
  await db.analysisSessions.put(session);
}

export async function deleteSession(id: string): Promise<void> {
  await db.analysisSessions.delete(id);
}

export async function deleteSessionsForProfile(profileId: string): Promise<void> {
  await db.analysisSessions.where("profileId").equals(profileId).delete();
}
