# QA Agent — Artemis Quiver

Playwright MCP browser tools for automated UI/UX QA. Three surfaces: SPA, Chrome Extension, content script.

## Setup

```bash
npm install -g @playwright/mcp
npx playwright install chromium
```

Then start dev server: `npm run dev`.

For extension QA: `npm run build:ext` first, then load with `--extension ./dist-ext`.

## Available Suites

| Command | Suite | Prompt |
|---------|-------|--------|
| `npm run qa:hub` | Analysis Hub | `qa_prompts/verify-analysis-hub.md` |
| `npm run qa:profile` | Profile | `qa_prompts/verify-profile.md` |
| `npm run qa:cv` | CV Builder | `qa_prompts/verify-cv-builder.md` |
| `npm run qa:cl` | CL Builder | `qa_prompts/verify-cl-builder.md` |
| `npm run qa:config` | Settings | `qa_prompts/verify-config.md` |
| `npm run qa:ext` | Extension | `qa_prompts/verify-extension-overlay.md` |
| `npm run qa:all` | All suites | — |
| `npm run qa:headless` | Full auto-QA headless | — |

Override model: `npm run qa:hub -- --Model ollama/qwen2.5-coder:1.5b`

## QA Flow

1. `scripts/qa.ps1` starts Vite + Playwright MCP (SSE port 3099)
2. Feeds prompt from `qa_prompts/<suite>.md` to `opencode run --agent qa`
3. QA agent (`.opencode/agents/qa.md`) uses `ollama/qwen2.5-coder:7b`
4. Agent calls Playwright MCP browser tools: navigate, snapshot, click, eval
5. Results written to `qa-reports/qa-report-<timestamp>.md`

## Strategy

| Phase | Model | What |
|-------|-------|------|
| Functional | Gemma 4 E2B (text) | Accessibility tree: buttons, clicks, routes |
| Polish | Gemma 3 12B vision | Screenshot: spacing, alignment, colors |
| Deep review | Claude Sonnet / GPT-4o | Complex UI logic, edge cases |

Accessibility tree covers ~80%. Vision only for polish pass.

## SPA URLs

| Feature | URL |
|---------|-----|
| Analysis Hub | `localhost:5173` |
| Profile | `localhost:5173/#/profile` |
| CV Builder | `localhost:5173/#/cv-builder` |
| CL Builder | `localhost:5173/#/cl-builder` |
| Settings | `localhost:5173/#/config` |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Browser not found | `npx playwright install chromium` |
| Extension not loading | Build first (`npm run build:ext`), check `dist-ext/` |
| MCP connection refused | Ensure `@playwright/mcp` running, check port 3099 |
| Snapshots empty on ext pages | Use headed mode |
| Permission denied (Linux/WSL) | `--no-sandbox` |
