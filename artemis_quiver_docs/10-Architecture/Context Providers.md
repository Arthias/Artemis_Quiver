---
tags: [architecture, state]
status: completed
last_updated: 2026-05-28
---

# 🌐 Context Providers & State Management

Artemis Quiver uses custom React Context Providers to manage settings, master profiles, analysis sessions, builder handoffs, and multi-profile workspaces. These contexts keep state synchronized and decoupled from presentation layers.

---

## 🏛️ Context Provider Hierarchy

The providers are nested in a specific order within [AppProviders.tsx](file:///F:/Dev/Artemis_Quiver/src/app/providers/AppProviders.tsx) to ensure dependencies resolve correctly (e.g., settings and profiles need workspace context to identify the active ID).

```text
WorkspaceProfileProvider
 └── ConfigProvider
      └── ProfileProvider
           └── AnalysisProvider
                └── BuilderHandoffProvider
```

---

## 🔑 Key Providers Details

### 1. WorkspaceProfileContext
- **File:** [WorkspaceProfileContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/WorkspaceProfileContext.tsx)
- **State Properties:**
  - `manifest: WorkspaceManifest` (Active profile ID and list of meta profiles).
  - `profileData: ProfileWorkspaceData` (Full profile blob: markdown, local settings, chats, history).
- **Functions:**
  - `switchProfile(id)`: Saves current profile data, loads next profile from local storage, updates theme.
  - `createProfile(name)`: Adds a new profile. Handles LRU eviction if profile count exceeds 3.
  - `updateProfileData(patch)` / `updateSettings(patch)`: Modifies local memory and triggers autosaves.
  - `persistActiveProfile()`: Serializes `profileData` to local storage under profile ID.

### 2. ConfigContext
- **File:** [ConfigContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/ConfigContext.tsx)
- **Dependencies:** `WorkspaceProfileContext`
- **State Properties:**
  - `config: ProfileSettings` (LLM configuration like endpoint URL, api key, model, and UI theme).
  - `isTesting: boolean` (True during active test connection requests).
  - `lastSavedAt: string | null` (Timestamp of last settings save).
- **Functions:**
  - `updateConfig(patch)`: Updates active settings in memory.
  - `saveConfig()`: Persists the active profile data block to local storage and updates `lastUsedAt`.
  - `testLlmConnection()`: Triggers API validation calls to local Ollama or LMStudio hosts.

### 3. ProfileContext
- **File:** [ProfileContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/ProfileContext.tsx)
- **Dependencies:** `ConfigContext`, `WorkspaceProfileContext`
- **State Properties:**
  - `profile: string` (The active master profile markdown text).
  - `lastSavedAt: string | null` (Autosave timestamp).
  - `isDirty: boolean` (True if there are unsaved profile changes).
- **Functions:**
  - `saveProfile()`: Saves the master profile markdown to storage.
  - `exportProfile()`: Downloads the profile markdown file to the host file system.
- **Autosave Logic:** Uses a 800ms debounce loop. If `autoSaveProfile` is enabled in configuration, edits persist to storage automatically.

### 4. AnalysisContext
- **File:** [AnalysisContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/AnalysisContext.tsx)
- **Dependencies:** `ConfigContext`, `ProfileContext`, `WorkspaceProfileContext`
- **State Properties:**
  - `draftJobPosting: string` (Active draft job description text).
  - `sessions: AnalysisSession[]` (List of past analyses for the active profile, max 50).
  - `currentResult: AnalysisResult | null` (Scoring and recommendations from the latest analysis).
  - `analyzing: boolean` (True while calling LLM for analysis).
- **Functions:**
  - `analyze()`: Performs matching by querying the active LLM, creates a session, and saves it.
  - `loadSession(id)`: Recalls a past analysis session into active memory.
  - `clearCurrent()`: Empties current view state.

### 5. BuilderHandoffContext
- **File:** [BuilderHandoffContext.tsx](file:///F:/Dev/Artemis_Quiver/src/app/context/BuilderHandoffContext.tsx)
- **State Properties:**
  - `handoff: BuilderHandoff | null` (Holds the context of the job matching: description, title, company, suggestions).
- **Functions:**
  - `setHandoff(value)`: Populates handoff data from Analysis Hub.
  - `consumeHandoff()`: Returns the handoff data and immediately nullifies context (avoiding stale carry-overs on page change).
