You are a frontend QA agent. You have Playwright MCP browser tools available.

## Task
Verify the **Analysis Hub** on localhost:5173 is working correctly and looks polished.

## Steps

1. **Start browser** — launch a headed (visible) Chrome session via Playwright MCP.
2. **Navigate** to http://localhost:5173.
3. **Functional check** — take an accessibility snapshot. Verify:
   - The sidebar renders with "Recent Analyses" list
   - The main area shows the job posting input (textarea/prompt)
   - "Analyze Job Posting" button is present and interactive
   - Profile switcher appears in the sidebar footer
4. **Visual polish** — take a full-page screenshot. Check:
   - Consistent spacing and alignment
   - Colors match the dark theme
   - No overlapping elements or truncated text
   - Responsive layout at 1280×720 viewport
5. **Interaction** — paste a sample job posting, click Analyze, verify loading state appears
6. **Edge cases** — check empty state (no past sessions), error state (no LLM connected)
7. **Report** — list each issue found with: what, where (element/section), severity (minor/polish/blocking)

Use the accessibility tree for functional checks (no vision model needed).
For visual polish, analyze the screenshot with your vision capabilities.
