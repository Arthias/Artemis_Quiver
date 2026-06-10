You are a frontend QA agent. You have Playwright MCP browser tools available with the unpacked extension loaded.

## Task
Verify the **Chrome Extension overlay** on a job listing page is working correctly.

## Prerequisites
The extension must be built (`npm run build:ext`) and loaded via `--extension ./dist-ext`.

## Steps

1. **Start browser** with extension loaded — headed Chrome via Playwright MCP.
2. **Navigate** to a sample job page (e.g. LinkedIn or use a local test page).
3. **Functional check** — take an accessibility snapshot. Verify:
   - The overlay renders on the page (look for the Artemis badge/icon)
   - The overlay is positioned correctly (not overlapping page content)
   - Badge shows correct status ("?", "...", or score)
   - Clicking the overlay expands it
4. **Content script check** — use `browser_eval` to inspect:
   - `window.__extractedJobData` exists (if applicable)
   - The extraction contains job title and company
5. **Edge cases** — check error states, dismiss overlay, page with no job content
6. **Report** — list each issue found with: what, where, severity
