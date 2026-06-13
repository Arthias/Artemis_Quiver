import { db, type AnalysisSessionRecord } from "./schema";
import { AppError, ErrorCodes } from "../utils/errors";

export async function getSessions(profileId: string): Promise<AnalysisSessionRecord[]> {
  try {
    const sessions = await db.analysisSessions.where("profileId").equals(profileId).toArray();
    return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_READ_FAILED, "Failed to get sessions");
  }
}

export async function saveSession(session: AnalysisSessionRecord): Promise<void> {
  try {
    await db.analysisSessions.put(session);
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_WRITE_FAILED, "Failed to save session");
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await db.analysisSessions.delete(id);
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_DELETE_FAILED, `Failed to delete session ${id}`);
  }
}
