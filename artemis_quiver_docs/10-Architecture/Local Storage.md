---
tags: [architecture, storage, persistence]
status: completed
last_updated: 2026-05-28
---
---

# 💾 Local Storage & Eviction (LRU) Architecture

Artemis Quiver operates entirely client-side, storing user data, themes, settings, and analysis histories in the browser's `localStorage`. This note describes the local storage data schema, the migration logic from legacy single-profile storage, and the Least Recently Used (LRU) workspace eviction mechanism.

---

## 🔑 Key Keys & Storage Structure

Data is stored under two primary key structures defined in [defaults.ts](file:///F:/Dev/Artemis_Quiver/src/app/config/defaults.ts):

1. **`artemis-workspace`**: Contains the global manifest of all profiles and specifies which profile is active.
2. **`artemis-profile-data-[UUID]`**: Contains the full workspace payload of a single workspace profile.

---

## 📊 Data Schemas

### 1. Global Workspace Manifest

- **Key:** `artemis-workspace`
- **TypeScript Interface:** `WorkspaceManifest` (in [workspace.ts](file:///F:/Dev/Artemis_Quiver/src/app/types/workspace.ts))
- **Schema Example:**
```json
{
  "activeProfileId": "7329faea-4122-48bd-b7bb-99fce970fa4b",
  "profiles": [
    {
      "id": "7329faea-4122-48bd-b7bb-99fce970fa4b",
      "name": "Software Engineering Profile",
      "createdAt": "2026-05-22T12:00:00.000Z",
      "lastUsedAt": "2026-05-22T13:30:00.000Z",
      "lastModifiedAt": "2026-05-22T13:20:00.000Z"
    },
    {
      "id": "cd0b61be-c3be-4977-9dfd-85fae4612301",
      "name": "Product Management Profile",
      "createdAt": "2026-05-22T12:15:00.000Z",
      "lastUsedAt": "2026-05-22T12:15:00.000Z",
      "lastModifiedAt": "2026-05-22T12:15:00.000Z"
    }
  ]
}
```

### 2. Workspace Profile Data Blob

- **Key:** `artemis-profile-data-[UUID]`
- **TypeScript Interface:** `ProfileWorkspaceData`
- **Schema Example:**
```json
{
  "profileMarkdown": "# Professional Profile\n\n## Overview\n...",
  "settings": {
    "provider": "lmstudio",
    "serverUrl": "/api/lmstudio",
    "model": "google/gemma-4-e2b",
    "temperature": 0.7,
    "autoSaveProfile": true,
    "theme": "dark"
  },
  "analysisSessions": [
    {
      "id": "0dfa1bd4-9467-4560-84c4-f2a893cb62ba",
      "createdAt": "2026-05-22T13:00:00.000Z",
      "jobPosting": "Looking for React dev...",
      "result": {
        "matchPercentage": 85,
        "recommendations": "Highlight TypeScript experience...",
        "salaryRange": "$110,000 - $130,000",
        "interviewTips": "Be prepared to talk about React Router...",
        "cvFocus": "Add AWS certifications...",
        "coverLetterSuggestions": "Tailor intro to match startup vibes..."
      },
      "markdown": "# Analysis Result\n\n### Scoring\n..."
    }
  ],
  "draftJobPosting": "Looking for React dev...",
  "profileChat": [
    {
      "role": "user",
      "content": "Improve my overview section."
    },
    {
      "role": "assistant",
      "content": "Here is a revision..."
    }
  ]
}
```

---

## 🔄 Migration of Legacy Data

On initial startup, Artemis Quiver checks for legacy, single-profile storage keys:
- `artemis-profile`
- `artemis-llm-config`
- `artemis-analysis-sessions`
- `artemis-draft-job-posting`

If any exist:
1. A new workspace profile metadata block is created with the name **"Default"**.
2. Legacy values are loaded, merged into a single `ProfileWorkspaceData` structure, and written to `artemis-profile-data-[UUID]`.
3. A new global manifest is initialized with this active profile.
4. All legacy single-profile keys are deleted from `localStorage` to clean up the browser space.

---

## 🧹 Profile Limit & LRU Eviction

To protect browser `localStorage` limits (usually 5MB), Artemis Quiver enforces a **maximum of 3 profiles** (`MAX_WORKSPACE_PROFILES = 3`).

### Eviction Flow (in [WorkspaceProfileContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/WorkspaceProfileContext.tsx)):

When a user attempts to create a 4th workspace profile:
1. The profiles array is cloned and sorted by `lastUsedAt` timestamp in ascending order.
2. The profile with the oldest `lastUsedAt` is chosen as the eviction candidate.
3. The data blob (`artemis-profile-data-[EVICTED_ID]`) is removed from `localStorage`.
4. The global manifest updates, omitting the evicted metadata block.
5. The new profile is created and activated.

> [!WARNING]
> Eviction permanently deletes the profile data from local storage. Remind users to export their profile markdown files if they have valuable configurations they want to keep.
