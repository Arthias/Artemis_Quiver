import { db, type ProfileRecord } from "./schema";
import { AppError, ErrorCodes } from "../utils/errors";

export async function getActiveProfileId(): Promise<string | null> {
  try {
    const meta = await db.metadata.get("activeProfileId");
    return meta ? meta.value : null;
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_READ_FAILED, "Failed to get active profile ID");
  }
}

export async function setActiveProfileId(id: string): Promise<void> {
  try {
    await db.metadata.put({ key: "activeProfileId", value: id });
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_WRITE_FAILED, "Failed to set active profile ID");
  }
}

export async function getProfiles(): Promise<ProfileRecord[]> {
  try {
    const profiles = await db.profiles.toArray();
    return profiles.sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_READ_FAILED, "Failed to get profiles");
  }
}

export async function getProfile(id: string): Promise<ProfileRecord | null> {
  try {
    const p = await db.profiles.get(id);
    return p || null;
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_READ_FAILED, `Failed to get profile ${id}`);
  }
}

export async function saveProfile(profile: ProfileRecord): Promise<void> {
  try {
    await db.profiles.put(profile);
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_WRITE_FAILED, "Failed to save profile");
  }
}

export async function createProfile(profile: ProfileRecord): Promise<void> {
  try {
    await db.profiles.add(profile);
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_WRITE_FAILED, "Failed to create profile");
  }
}

export async function deleteProfile(id: string): Promise<void> {
  try {
    await db.transaction("rw", [db.profiles, db.analysisSessions], async () => {
      await db.profiles.delete(id);
      await db.analysisSessions.where("profileId").equals(id).delete();
    });
  } catch (err) {
    throw err instanceof AppError ? err : new AppError(ErrorCodes.DB_DELETE_FAILED, `Failed to delete profile ${id}`);
  }
}
