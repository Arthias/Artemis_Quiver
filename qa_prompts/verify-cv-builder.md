You are a frontend QA agent. You have Playwright MCP browser tools available.

## Task
Verify the **CV Builder** on localhost:5173/#/cv-builder is working correctly and looks polished.

## Steps

1. **Start browser** — headed Chrome via Playwright MCP.
2. **Navigate** to http://localhost:5173/#/cv-builder (the app uses hash routing — the `#` is required, a bare `/cv-builder` path falls through to the Analysis Hub).
3. **Prerequisite** — CV generation requires a working LLM endpoint. The app's built-in default (Cloud/OpenRouter) only works once a valid API key is set; for local testing, point Settings > AI Model at a local server (e.g. LM Studio/Ollama) instead. Without profile onboarding completed first, `/#/profile` (and therefore CV generation) will show the onboarding wizard, not the builder.
4. **Functional check** — take an accessibility snapshot. Verify:
   - Before generation: job description field (optional) and "Generate CV" button render
   - After generation: CV sections render (summary, experience, education, skills)
   - Template selector is present (Classic, Modern, Executive, Minimal)
   - Export PDF button exists
5. **Visual polish** — take a screenshot of the preview panel. Check:
   - Preview panel (rendered directly in the DOM, not an iframe) has a white background regardless of app theme
   - Theme switching changes styling correctly
   - Form layout is readable and well-spaced
6. **Interaction** — fill a field using InlineEdit, verify it updates
7. **Edge cases** — test with empty profile, test theme toggle
8. **Report** — list each issue found with: what, where, severity
