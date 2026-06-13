# Artemis Quiver

Job hunting automation engine: analyze job postings against your professional profile using a local LLM, then refine CVs and cover letters.

Design source: [Figma](https://www.figma.com/design/NAKF9BYIvmXKegz6JDnaJl/Job-Hunting-Automation-Engine).

## What it does

Paste job posting → compare to **master profile** (Markdown) → returns:
- Match score (0–100%)
- Salary range + interview/application tips
- CV optimization suggestions + path to CV Builder
- Cover letter draft + path to CL Builder

### Workspace profiles (no login)
Up to 3 local profiles, each with master profile, LLM settings, theme, analysis history. LRU eviction on 4th.

### Builders
- **CV Builder** — generate from profile + job description; interactive inline editing (all sections); 3 themes + color picker; AI chat; export as PDF or `.md`
- **Cover Letter Builder** — tailored letter; structured JSON editing; same themes/export + copy plain text

## Run locally

```bash
npm i
npm run dev
```

Default LLM: primary → `/api/lmstudio` (Vite proxy), model `google/gemma-4-e2b`. Secondary → `/api/ollama`, model `llama3.2:3b`. Change in Settings.

Data stays in browser (IndexedDB) unless you export `.md`.

## Chrome Extension (MV3)

```bash
npm run build:ext
```

Then `chrome://extensions` → Load unpacked → `dist-ext/`.

Extracts job content from any page. LinkedIn: MutationObserver + boundary trimming. Others: `document.body.innerText`. Pre-fills Analysis Hub.

## Tech stack

React 18, Vite, Tailwind CSS v4, shadcn/ui, React Router v7, Dexie.js (IndexedDB). Provider adapter layer: OpenAI-compatible, Anthropic Claude, Google Gemini. i18n via react-i18next (en + es). vitest + jsdom (138 tests).

## Docs

`artemis_quiver_docs/` — architecture, features, roadmap, bugs, changelog. Start at `00-Index/MOC.md`.
