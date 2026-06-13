---
tags: [architecture, storage, database, persistence]
status: completed
last_updated: 2026-06-03
---

# 💾 Database & Storage Architecture

Artemis Quiver operates entirely client-side, storing user data, themes, settings, and analysis histories in the browser's `IndexedDB` database. It utilizes **Dexie.js** as a lightweight, developer-friendly wrapper to execute database queries and manage schema versions.

---

## 🏗️ Database Tables & Schemas

The database name is `ArtemisQuiverDB`. Under [schema.ts](file:///f:/Dev/Artemis_Quiver/src/app/db/schema.ts), it defines three primary tables:

### 1. `profiles`
- **Key Path:** `id` (UUID string)
- **Indexes:** `name`, `lastUsedAt`
- **TypeScript Interface:** `ProfileRecord`
- **Stores:** 
  - `id`: Profile identifier
  - `name`: User-defined profile name
  - `createdAt` / `lastUsedAt` / `lastModifiedAt`: Activity timestamps
  - `profileMarkdown`: The user's professional master profile (markdown text)
  - `settings`: Per-profile settings (LLM parameters, color themes, theme mode)
  - `draftJobPosting`: Last draft entered on the Analysis Hub
  - `profileChat`: Per-profile AI Assistant chat logs

### 2. `analysisSessions`
- **Key Path:** `id` (UUID string)
- **Indexes:** `profileId` (relational index), `createdAt`
- **TypeScript Interface:** `AnalysisSessionRecord`
- **Stores:**
  - `id`: Session identifier
  - `profileId`: Owner profile identifier (allows queries via `.where("profileId").equals(activeProfileId)`)
  - `createdAt`: Generation timestamp
  - `jobPosting`: The original job posting text
  - `result`: Score, salary range, ATS recommendations, and cover letter draft (structured JSON)
  - `markdown`: Human-readable full analysis markdown report
  - `followUpMessages`: Log of follow-up chat messages on the results page

### 3. `metadata`
- **Key Path:** `key` (string)
- **Stores:** Key-value configurations for app-level state (e.g. `activeProfileId` key representing the active workspace profile).

---

## 🔄 Initialization & Self-Healing

On app launch, the persistence layer checks if database profiles exist. If none exist, [migrations.ts](file:///f:/Dev/Artemis_Quiver/src/app/db/migrations.ts) creates a single default profile. If profiles exist but the `activeProfileId` is missing or corrupt in `metadata`, the system automatically selects the most recently used profile and restores a valid active session.

**Note:** The initial migration from `localStorage` (reading `artemis-workspace`, `artemis-profile`, `artemis-llm-config` keys and writing to IndexedDB) was performed in v3.0.0 and has since been removed from the codebase. Fresh installs go directly to IndexedDB with no localStorage dependency.

---

## 🧹 Workspace Limit (LRU Eviction)

To match the local-first design boundaries, Artemis Quiver enforces a **maximum of 3 profiles** (`MAX_WORKSPACE_PROFILES = 3`).

### Eviction Flow (in [WorkspaceProfileContext.tsx](file:///f:/Dev/Artemis_Quiver/src/app/context/WorkspaceProfileContext.tsx)):
When a user creates a 4th workspace profile:
1. Profiles are queried and sorted by `lastUsedAt` ascending.
2. The oldest profile is selected.
3. The selected profile record and all its associated analysis sessions are permanently deleted from IndexedDB tables.
4. The manifest is rebuilt, and the new profile is created.

> [!WARNING]
> Eviction permanently deletes the profile and its history. Users should export their master profile markdown files if they have valuable configurations they want to keep.
