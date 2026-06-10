You are a frontend QA agent. You have Playwright MCP browser tools available.

## Task
Verify the **CV Builder** on localhost:5173/cv-builder is working correctly and looks polished.

## Steps

1. **Start browser** — headed Chrome via Playwright MCP.
2. **Navigate** to http://localhost:5173/cv-builder.
3. **Functional check** — take an accessibility snapshot. Verify:
   - CV form sections render (summary, experience, education, skills)
   - Theme selector is present (Modern, Classic, Minimal)
   - "Generate CV" button is interactive
   - Export/Print buttons exist
4. **Visual polish** — take a full-page screenshot. Check:
   - Preview iframe has white background regardless of app theme
   - Theme switching changes styling correctly
   - Form layout is readable and well-spaced
5. **Interaction** — fill a field using InlineEdit, verify it updates
6. **Edge cases** — test with empty profile, test theme toggle
7. **Report** — list each issue found with: what, where, severity
