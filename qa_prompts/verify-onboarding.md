You are a frontend QA agent for Artemis Quiver. You have Playwright MCP browser tools available.

## Task
Verify the **Onboarding Wizard** flow on localhost:5173 works correctly and looks polished. The wizard is a 3-step full-screen overlay shown on first launch (when `artemis:onboardingComplete` is not set in IndexedDB metadata).

## Precondition
The app must be in a "fresh" state (no onboarding-complete flag). If the app loads normally (sidebar visible), navigate to Settings → Danger Zone → Clear All Data to reset, then reload.

## Steps

### 1. Launch & Initial State
- Launch headed Chrome via Playwright MCP
- Navigate to http://localhost:5173
- Take snapshot. Verify:
  - Full-screen overlay is visible (NOT normal app with sidebar)
  - OnboardingWizard renders with "Welcome to Artemis Quiver" heading
  - "What's your name?" input field is present and auto-focused
  - Four feature cards (Job Analysis, CV & Cover Letters, Chrome Extension, 100% Local)
  - Step indicator dots show 3 steps, first active
  - "Next →" button is visible; "← Back" is disabled (step 0)
  - "Let's Go!" button is NOT visible yet

### 2. Step 1 — Welcome + Name Input
- Type a name (e.g. "Test User") in the name input
- Click "Next →"
- Verify transition to Step 2 (Step 2 dot active, AI Setup heading visible)

### 3. Step 2 — AI Setup
- Take snapshot. Verify:
  - "Connect Your AI" heading
  - Cloud/Local mode toggle buttons (☁️ Cloud selected by default)
  - Primary Model card with: Provider dropdown, Base URL input, API Key input, Model input
  - Model preset buttons (Gemma 4 E2B, Llama 3.2, etc.)
  - "Test Connection" button
  - "← Back" button is enabled
  - Click "Next →" to proceed to Step 3

### 4. Step 3 — Profile Editor
- Take snapshot. Verify:
  - "Build Your Profile" heading
  - Profile Markdown textarea with placeholder content
  - "Import from Clipboard" button
  - "Let's Go!" button visible
  - Step 3 dot active

### 5. Complete Onboarding
- Type some markdown in the profile textarea: "# Test Profile\n\n## Skills\n- React\n- TypeScript"
- Click "Let's Go!"
- Verify app reloads (brief loading state)
- After reload, verify normal app layout appears:
  - Sidebar visible with profile initials
  - Main content area shows Analysis Hub (or home page)
  - Onboarding wizard is GONE

### 6. Navigate to Settings
- Click the gear icon (Settings) in the sidebar
- Verify /#/config page loads with "Settings" heading

### 7. Danger Zone — Clear All Data (triggers re-onboarding)
- Scroll to bottom of settings page
- Verify "Danger Zone" card exists with red border and "Clear All Data" button
- Click "Clear All Data"
- Verify dialog opens: "Clear All Data?" title, type DELETE instruction
- Type "DELETE" in the confirmation input
- Click "Clear Everything"
- Verify app reloads
- After reload, verify onboarding wizard reappears (back to Step 1, full-screen overlay)

### 8. Visual Polish
- Take full-page screenshots at each step
- Verify: consistent dark theme, proper spacing, no overlapping elements, z-index layering correct (wizard overlay above everything)

### 9. Edge Cases
- **Empty name**: Enter name field stays empty, click Next → verify Step 2 still loads (name is optional)
- **Back navigation**: From Step 3, click ← Back → Step 2 loads → ← Back → Step 1 loads
- **Cancel clear data**: In Danger Zone dialog, click "Cancel" instead of typing DELETE → dialog closes, no data cleared
- **Wrong confirm text**: Type "delete" (lowercase) in confirmation input → "Clear Everything" button stays disabled

## Report
List each issue found with: what, where (element/section), severity (minor/polish/blocking)
