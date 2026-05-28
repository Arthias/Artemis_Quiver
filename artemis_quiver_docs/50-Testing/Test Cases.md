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
* **Expected Result:** The button turns to "Analyzing...", the request successfully resolves, and a match score (0-100%) circle progress, tips, recommendations, and cover letter draft are shown. A collapsible card at the top shows the analyzed job posting (compressed by default, click to expand).

### Test Case 2.2: Collapsible Prompt View
* **Goal:** Verify the analyzed job posting is shown in a collapsible read-only card.
* **Preconditions:** A successful analysis result is displayed.
* **Steps:**
   1. Observe the "Analyzed Job Posting" card at the top of the results.
   2. Note the compressed height and scrollable text.
   3. Click the card header to expand.
   4. Click again to collapse.
* **Expected Result:** The prompt text is read-only (monospaced `<pre>`), defaults to compressed (`max-h-20`), expands to full height on click, collapses again on second click.

### Test Case 2.3: Sidebar Session Loading
* **Goal:** Verify clicking a past session in the sidebar loads the correct results.
* **Preconditions:** At least one completed analysis exists.
* **Steps:**
   1. Click a different past session in the sidebar's "Recent Analyses" list.
   2. Note that the results (score, tips, CV recs) update immediately.
   3. Verify the collapsible prompt shows the correct job posting for that session.
   4. Click "New Analysis" to clear.
* **Expected Result:** The selected session's full results load instantly with no dropdown interaction needed. Sessions with different job postings show the correct corresponding data.

### Test Case 2.4: API Error Recovery
* **Goal:** Verify the application handles offline or misconfigured LLM servers gracefully.
* **Preconditions:** LLM server is shut down or endpoint URL is set to an invalid port.
* **Steps:**
   1. Navigate to `/`.
   2. Paste a job posting and click **Analyze Job Posting**.
* **Expected Result:** The analyzing indicator stops, and an error card is displayed: "Analysis failed. Check LLM settings." pointing the user to check LMStudio server/model settings.

---

## 📄 3. Document Builders (CV & Cover Letter)

### Test Case 3.1: Handoff and Auto-Generation
* **Goal:** Verify that clicking "Generate CV with Recommendations" auto-generates the CV.
* **Steps:**
   1. Run a successful job analysis.
   2. Click **Generate CV with Recommendations** on the CV Optimization card.
   3. Note the page navigates to `/cv-builder` and CV generation starts immediately (loading spinner visible).
* **Expected Result:** The CV generates automatically on mount without requiring a manual "Generate CV" click. The themed iframe preview appears after generation completes.

### Test Case 3.2: Edit Profile Handoff
* **Goal:** Verify the "Edit Profile" button navigates to the profile page.
* **Steps:**
   1. Run a successful job analysis.
   2. Click **Edit Profile** on the CV Optimization card.
* **Expected Result:** The browser navigates to `/profile` where the master profile editor is shown.

### Test Case 3.3: Theme Switching and White Background
* **Goal:** Verify CV renders with white background regardless of app theme and themes switch correctly.
* **Preconditions:** A CV has been generated and is displayed in the iframe.
* **Steps:**
   1. Toggle the app theme to dark mode via Settings.
   2. Return to CV Builder and observe the iframe preview.
   3. Switch between Modern, Classic, and Minimal themes in the theme config panel.
* **Expected Result:** The CV iframe always has a white background regardless of app dark mode. Each theme applies distinct styling (Modern: Inter font, skill tags; Classic: serif fonts, centered headings; Minimal: stripped-back layout).

### Test Case 3.4: Chat Refinements
* **Goal:** Ensure the document content edits correctly via chat request payloads.
* **Steps:**
  1. In the right-hand panel of CV/CL Builder, click the "Add more metrics" quick suggestion card.
* **Expected Result:** The chat loading state spinner appears, the updated CV replaces the left-panel text, and quantifiable achievements are added to the resume.

### Test Case 3.5: Document Download
* **Goal:** Confirm the markdown document exports.
* **Steps:**
   1. Click **Export .md** in the header of the builder.
* **Expected Result:** A browser file download is triggered, saving the file locally as `cv.md` or `cover-letter.md`.

### Test Case 3.6: Follow-Up Chat Persistence
* **Goal:** Verify follow-up messages persist when switching sessions.
* **Steps:**
   1. Run a job analysis.
   2. Scroll to the Follow-up Questions section and type "Why would I be a good fit?".
   3. Click Send and wait for the AI response.
   4. Switch to a different session in the sidebar, then switch back.
* **Expected Result:** The original question and AI response are still visible in the chat history when returning to the session.

### Test Case 3.7: Follow-Up Chat Suggestions
* **Goal:** Verify quick-action suggestion pills populate the input.
* **Steps:**
   1. Click any of the 5 suggestion pills (e.g. "Draft a follow-up thank-you email").
* **Expected Result:** The input field is populated with the suggestion text. Pressing Enter sends it.

### Test Case 3.8: Follow-Up Chat Context
* **Goal:** Verify the LLM receives job posting + profile context in follow-ups.
* **Steps:**
   1. Paste a specific job posting (e.g. "Google PM role requiring cloud experience") and run analysis.
   2. Ask "What skills should I highlight for this role?".
* **Expected Result:** The AI response references specifics from the job posting (cloud experience) and the candidate profile — not generic advice.

---

## 4. Prompt Optimization Modes

### Test Case 4.1: Standard CV Generation with Context
* **Goal:** Verify generateCv accepts industry and target role context.
* **Steps:**
   1. Call `generateCv()` with `{ targetRole: "Senior Engineer", industry: "FinTech" }`.
* **Expected Result:** The generated system prompt includes both the target role and industry context, and the CV JSON is well-formed.

### Test Case 4.2: Summary Rewrite Mode
* **Goal:** Verify summary-rewrite returns text (not JSON).
* **Steps:**
   1. Call `generateCv()` with `{ mode: "summary-rewrite", targetRole: "Designer" }`.
* **Expected Result:** Return value is raw text (the summary rewrite), not a JSON object.

### Test Case 4.3: CV Audit Mode
* **Goal:** Verify optimizeCv in audit mode returns critique text.
* **Steps:**
   1. Call `optimizeCv()` with `mode: "audit"`, `targetRole: "PM"`, `industry: "SaaS"`.
* **Expected Result:** Returns structured audit feedback covering vagueness, wordiness, impact, leadership, structure, tone, gaps.

### Test Case 4.4: Career Transition Reframing
* **Goal:** Verify the prompt includes previous/current field context.
* **Steps:**
   1. Call `optimizeCv()` with `mode: "career-transition"`, `previousField: "Marketing"`, `newField: "Product"`, `jobDescription: "Looking for a PM"`.
* **Expected Result:** System prompt contains "Marketing" and "Product" context, and the response reframes experience for the new field.

### Test Case 4.5: All Optimization Modes Execute
* **Goal:** Verify no mode throws or fails unexpectedly.
* **Steps:**
   1. Call `optimizeCv()` with each of the 9 non-standard modes: summary-rewrite, bullet-optimize, ats-optimize, career-transition, audit, work-history-align, skills-section, headline, hiring-manager.
* **Expected Result:** Each mode returns a non-empty string response without error.
