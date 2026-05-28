---
tags: [testing, quality-assurance, test-cases]
status: completed
last_updated: 2026-05-28
---

# 🧪 QA Test Scenarios & Manual Test Cases

This document describes the manual validation scenarios and criteria for testing Artemis Quiver's functionalities. Use these scenarios to verify releases and validate developer or AI agent edits.

---

## 🗂️ 1. Workspace Profile Switching & Eviction

### Test Case 1.1: Default Profile Migration
* **Goal:** Verify that legacy data is automatically ported to a new "Default" workspace.
* **Preconditions:** Clear local storage except for single legacy keys: `artemis-profile` (set to any test CV text) and `artemis-llm-config` (set to custom server URLs).
* **Steps:**
  1. Load the application home page (`/`).
  2. Inspect the sidebar footer profile initials.
* **Expected Result:** The profile initializes with a profile named **"Default"**. Check local storage: legacy keys must be deleted, and a new global `artemis-workspace` manifest and `artemis-profile-data-[UUID]` key must exist, containing the legacy data.

### Test Case 1.2: Profile Lifecycle (Create, Switch)
* **Goal:** Ensure profiles can be created and switched seamlessly.
* **Steps:**
  1. Click the active profile switcher at the bottom of the sidebar.
  2. In the modal, enter a new profile name "Dev Profile" and click Create.
  3. Change the LLM Server URL in Settings (`/config`) to a unique value and change the theme to **Light**.
  4. Switch back to the "Default" profile using the sidebar footer.
* **Expected Result:** When switching back to "Default", the UI theme reverts to its dark/previous setting, and the Server URL resets to the default configuration.

### Test Case 1.3: LRU Eviction Limit
* **Goal:** Verify that only 3 profiles are kept, and the oldest is deleted on adding a 4th.
* **Steps:**
  1. Start with 3 profiles: Profile A, Profile B, and Profile C.
  2. Touch Profile A (switch to it, making it the most recently used).
  3. Touch Profile C.
  4. Touch Profile B. (LRU order: Profile A is oldest, then C, then B is newest).
  5. Click the profile switcher, input "Profile D", and click Create.
* **Expected Result:** Profile D is created and activated. Profile A is evicted. Check the switcher list: Profile A is no longer available. `localStorage.getItem("artemis-profile-data-[ID_OF_A]")` must be null.

---

## 🔍 2. Job Posting Analysis

### Test Case 2.1: Success Flow
* **Goal:** Analyze a job description using a mock or local active LLM.
* **Preconditions:** A local LLM is running on the endpoint set in Settings (e.g., LMStudio on `/api/lmstudio`).
* **Steps:**
  1. Navigate to `/`.
  2. Paste a job posting (e.g., "React Developer position...").
  3. Click **Analyze Job Posting**.
* **Expected Result:** The button turns to "Analyzing...", the request successfully resolves, and a match score (0-100%) circle progress, tips, recommendations, and cover letter draft are shown.

### Test Case 2.2: API Error Recovery
* **Goal:** Verify the application handles offline or misconfigured LLM servers gracefully.
* **Preconditions:** LLM server is shut down or endpoint URL is set to an invalid port.
* **Steps:**
  1. Navigate to `/`.
  2. Paste a job posting and click **Analyze Job Posting**.
* **Expected Result:** The analyzing indicator stops, and an error card is displayed: "Analysis failed. Check LLM settings." pointing the user to check LMStudio server/model settings.

---

## 📄 3. Document Builders (CV & Cover Letter)

### Test Case 3.1: Handoff and Tailored Generation
* **Goal:** Verify that job descriptions and recommendations pass to builders correctly.
* **Steps:**
  1. Run a successful job analysis.
  2. Click **Open CV Builder** on the CV Optimization card.
  3. Note the pre-populated job description and recommendations in the generation form.
  4. Click **Generate CV**.
* **Expected Result:** The LLM generates a tailored CV. The page shifts to the document/chat layout.

### Test Case 3.2: Chat Refinements
* **Goal:** Ensure the document content edits correctly via chat request payloads.
* **Steps:**
  1. In the right-hand panel of CV/CL Builder, click the "Add more metrics" quick suggestion card.
* **Expected Result:** The chat loading state spinner appears, the updated CV replaces the left-panel text, and quantifiable achievements are added to the resume.

### Test Case 3.3: Document Download
* **Goal:** Confirm the markdown document exports.
* **Steps:**
  1. Click **Export .md** in the header of the builder.
* **Expected Result:** A browser file download is triggered, saving the file locally as `cv.md` or `cover-letter.md`.
