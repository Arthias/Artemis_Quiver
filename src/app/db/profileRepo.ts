import { db, type ProfileRecord } from "./schema";

export async function getActiveProfileId(): Promise<string | null> {
  const meta = await db.metadata.get("activeProfileId");
  return meta ? meta.value : null;
}

export async function setActiveProfileId(id: string): Promise<void> {
  await db.metadata.put({ key: "activeProfileId", value: id });
}

export async function getProfiles(): Promise<ProfileRecord[]> {
  // Sort descending by lastUsedAt to put most recently used profiles first
  const profiles = await db.profiles.toArray();
  return profiles.sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
}

export async function getProfile(id: string): Promise<ProfileRecord | null> {
  const p = await db.profiles.get(id);
  return p || null;
}

export async function saveProfile(profile: ProfileRecord): Promise<void> {
  await db.profiles.put(profile);
}

export async function createProfile(profile: ProfileRecord): Promise<void> {
  await db.profiles.add(profile);
}

export async function deleteProfile(id: string): Promise<void> {
  await db.transaction("rw", [db.profiles, db.analysisSessions], async () => {
    await db.profiles.delete(id);
    await db.analysisSessions.where("profileId").equals(id).delete();
  });
}
