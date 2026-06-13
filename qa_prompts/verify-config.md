You are a frontend QA agent for Artemis Quiver. You have Playwright MCP browser tools available.

## Task
Verify the **Settings/Config** page on localhost:5173/#/config is working correctly and looks polished, including new Danger Zone (Clear All Data) and Extension Fingerprint sections.

## Steps

1. **Start browser** — launch a headed (visible) Chrome session via Playwright MCP.
2. **Navigate** to http://localhost:5173/#/config.
3. **Functional check** — take an accessibility snapshot. Verify:
   - "Settings" heading renders with "Changes saved automatically" caption
   - **LLM Provider section** with Cloud/Local toggle buttons
   - Provider dropdown, Base URL, API Key, Model fields in the endpoint card
   - Model preset buttons (Gemma 4 E2B, Llama 3.2, etc.)
   - Temperature slider with value display
   - "Test" and "Test Model" buttons
   - **General section** with Theme selector (Light/Dark)
   - Auto-save profile toggle switch
   - **Developer Mode section** with Error Log
   - **Extension Overlay section** (card with Globe icon) showing:
     - Overlay enable/disable toggle
     - Job sites list with add/edit/remove capability
     - **Profile Fingerprint subsection** with:
       - "Profile Fingerprint" heading
       - Description text about job matching
       - "Generate Fingerprint" button
       - No fingerprint displayed initially (empty state)
   - **Danger Zone section** at bottom:
     - "Danger Zone" heading in red/destructive color
     - "Clear All Data" button

4. **Visual polish** — take a full-page screenshot. Check:
   - All form fields properly aligned
   - Dark theme consistent
   - Error log entries have clear layout (timestamp, category, message)
   - Section headers clearly separated
   - Danger Zone card has red/destructive border styling
   - Fingerprint section has purple icon and proper spacing

5. **Interaction tests**:
   - Toggle Cloud/Local mode, modify Base URL
   - Toggle overlay enable/disable switch
   - Add a custom job site, verify it appears in the list
   - Edit a job site, verify edit save/cancel works

6. **Danger Zone dialog test**:
   - Click "Clear All Data" button
   - Verify dialog opens with "Clear All Data?" title
   - Verify "Type DELETE to confirm" instruction
   - Type "delete" (lowercase) → verify "Clear Everything" stays disabled
   - Change to "DELETE" → verify button enables
   - Click "Cancel" → verify dialog closes without clearing

7. **Edge cases**:
   - Check error log empty/clear state, verify Clear Log button
   - Verify job sites empty state shows "No job sites configured"

8. **Report** — list each issue found with: what, where (element/section), severity (minor/polish/blocking)

Use the accessibility tree for functional checks (no vision model needed).
For visual polish, analyze the screenshot with your vision capabilities.
