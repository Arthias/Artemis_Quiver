# Frontend QA Agent — Artemis Quiver

An automated QA workflow for visually polishing and functionally testing Quiver across all three surfaces: SPA, Chrome Extension, and content script injection.

## Approach

**Playwright MCP Server** (by Microsoft, 33.7k ⭐, Apache-2.0) — an MCP interface into Playwright that gives an AI agent browser control: navigate localhost, click elements, fill forms, scroll, take accessibility snapshots, and capture screenshots. The QA agent uses the accessibility tree for functional verification (no vision needed) and screenshots for visual polish checks (vision model needed).

**Why Playwright MCP over alternatives:**
- Listed as a supported OpenCode client (works out of the box)
- Covers all three Quiver surfaces (SPA, extension, content script)
- Accessibility-tree based → Gemma 4 E2B can analyze it without vision
- Screenshot capability + vision model for polish
- Same tool works from OpenCode, VS Code, or CI

## Installation

### 1. Install Playwright MCP

```bash
npm install -g @playwright/mcp
npx playwright install chromium
```

### 2. Make the browser tools available to OpenCode

Playwright MCP supports direct MCP invocation. OpenCode can launch it as:

```bash
npx @playwright/mcp
```

Or configure it persistently in your agent tooling (see [OpenCode MCP docs](https://opencode-ai.com/docs/mcp) for the config format).

### 3. (Optional) Vision model for polish

For visual polish checks, a vision-capable model is needed. Options:

| Model | Provider | Setup |
|-------|----------|-------|
| Gemma 3 12B (vision) | LMStudio / Ollama | `ollama pull gemma3:12b` |
| Gemma 4 vision variant | LMStudio | Download via LMStudio UI |
| Qwen2-VL 7B | Ollama | `ollama pull qwen2-vl:7b` |
| Claude Sonnet / GPT-4o | OpenRouter | API key only |

The accessibility tree covers ~80% of QA without vision. Vision is only needed for the final polish pass (alignment, spacing, colors).

## How It Covers Quiver's Three Surfaces

### 1. SPA — Standard browser automation

```
localhost:5173
```

Navigate, snapshot, click, fill, scroll — standard Playwright. The `--allowed-hosts` flag restricts navigation to localhost and target sites.

```bash
# Start dev server
npm run dev

# In another terminal, agent launches
npx @playwright/mcp

# Agent can now call browser tools:
browser_navigate("http://localhost:5173")
browser_snapshot()             # accessibility tree, no vision needed
browser_click(...)             # interact with elements
```

### 2. Chrome Extension — Extension-aware browser

Playwright MCP can load your unpacked extension by passing the build path:

```bash
# Load extension into test browser
npx @playwright/mcp --extension /path/to/Artemis_Quiver/dist-ext

# Agent can now:
browser_navigate("chrome-extension://<ext-id>/popup.html")
browser_navigate("chrome-extension://<ext-id>/options.html")
```

**Finding your extension ID:** After building the extension (`npm run build:ext`), load it in Chrome at `chrome://extensions` with Developer Mode enabled. The ID appears there. For automated discovery, check the generated `dist-ext/manifest.json` for a `key` field.

### 3. Content Script Injection — Real page verification

The content script (which extracts LinkedIn job data, renders overlays, etc.) fires automatically when navigating to supported job sites. With the extension loaded, navigate to real pages:

```bash
browser_navigate("https://www.linkedin.com/jobs/view/...")
browser_snapshot()             # verify overlay rendered
browser_eval("window.__extractedJobData")  # check extraction result
```

**Sandbox note:** Use `--no-sandbox` on Linux/WSL if you encounter sandbox errors.

## QA Agent Prompt (for OpenCode)

Here is a reusable prompt template. Tailor the URL and checks per feature.

```markdown
You are a frontend QA agent. You have Playwright MCP browser tools available.

## Task
Verify the [FEATURE_NAME] on [URL] is working correctly and looks polished.

## Steps

1. **Start browser** — launch a headed (visible) Chrome session via Playwright MCP.
2. **Navigate** to the URL.
3. **Functional check** — take an accessibility snapshot. Verify:
   - All expected elements render (list them)
   - Buttons/links are interactive (check they respond to clicks)
   - Navigation works (routes change, modals open)
4. **Visual polish** — take a full-page screenshot. Check:
   - Consistent spacing and alignment
   - Colors match the theme (dark mode)
   - No overlapping elements or truncated text
   - Responsive layout at 1280×720 viewport
5. **Edge cases** — test loading state, empty state, error state if applicable.
6. **Report** — list each issue found with: what, where (element/section), severity (minor/polish/blocking)

Use the accessibility tree for functional checks (no vision model needed).
For visual polish, analyze the screenshot with your vision capabilities.
```

## Running from a Script

For automated runs (CI, cron, or just a repeatable command), create a thin wrapper:

```bash
# scripts/qa.sh
#!/bin/bash
npx @playwright/mcp --port 3099 &
MCP_PID=$!
sleep 2

echo "Dev server should be running on localhost:5173"
echo "Playwright MCP is listening on port 3099"
echo "Run your QA agent against it via OpenCode"
echo "---"
echo "opencode run 'QA verify the AnalysisHub page' --model ..."
echo "---"

wait $MCP_PID
```

Or if you have the QA prompt saved as `qa_prompts/verify-feature.md`, run:

```bash
opencode run "$(cat qa_prompts/verify-feature.md)" --model openrouter/google/gemma-4-e2b
```

## Model Strategy

| QA Phase | Model | What It Checks | Cost |
|----------|-------|---------------|------|
| **Functional** | Gemma 4 E2B (text) | Accessibility tree: buttons exist, clicks work, routes load | Free (local) |
| **Polish** | Gemma 3 12B vision | Screenshot: spacing, alignment, colors, contrast | Free (local, Ollama) |
| **Deep review** | Claude Sonnet / GPT-4o | Complex UI logic, edge cases, nuanced visual bugs | Paid (OpenRouter) |

Default to Gemma 4 E2B for the quick functional pass. Only invoke vision for the polish pass.

## Extension-Specific Setup Tips

1. **Build the extension first:** `npm run build:ext` produces `dist-ext/`
2. **The service worker** runs in the background — Playwright MCP can reach it via the extension's background page URL
3. **CSP considerations:** Extension pages have stricter CSP. Playwright MCP handles this automatically in headed mode
4. **Persistent state:** Use the `--user-data-dir` flag to preserve extension state (auth logins, settings) across sessions:
   ```bash
   npx @playwright/mcp --user-data-dir ~/.quiver-qa-profile --extension ./dist-ext
   ```

## Quiver-Specific QA Scenarios

| Feature | URL | Key Checks |
|---------|-----|------------|
| Analysis Hub | `localhost:5173/` | Sidebar collapse, prompt cards load, scrolling |
| CV Builder | `localhost:5173/cv-builder` | Form fields, InlineEdit, preview rendering |
| CL Builder | `localhost:5173/cl-builder` | Same as CV + multi-section |
| Extension popup | `chrome-extension://<id>/popup.html` | Extract button, settings |
| Extension options | `chrome-extension://<id>/options.html` | Provider config, theme |
| Content script overlay | LinkedIn job page | Overlay appears, data extracted |
| SPA ← Extension handoff | Both surfaces | Data flows from ext → SPA correctly |
| Profile Workspace | `localhost:5173/profile` | Match scoring, filters, sorting |
| Extension import | LinkedIn + analyze URL | Job extraction → analysis sync |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Browser not found" | Run `npx playwright install chromium` |
| "Permission denied" for extension | Use `--no-sandbox` on WSL/Linux |
| Extension not loading | Build it first (`npm run build:ext`), check `dist-ext/` exists |
| Can't find extension ID | Load unpacked in Chrome → copy ID from `chrome://extensions` |
| MCP connection refused | Ensure `@playwright/mcp` is running first, check port conflicts |
| Snapshots are empty | The extension may block snapshots on `chrome-extension://` pages — use headed mode |
