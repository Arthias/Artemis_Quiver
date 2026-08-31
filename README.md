# Artemis Quiver

Job hunting automation engine: analyze job postings against your professional profile, then refine CVs and cover letters — powered by your choice of local or cloud LLM.

**Primary deliverable is the Chrome extension.** A local web mode exists for development and fallback use.

> [!TIP] Try it
> Download the latest build from the [Artemis Quiver Releases](https://github.com/Arthias/Artemis-Quiver-Releases/releases) page, unzip, then `chrome://extensions` → **Developer mode** → **Load unpacked** → select the `Artemis_Quiver_extension/` folder. Open the web app once to link your profile.

## What it does

Paste or import a job posting → compare to your **master profile** (Markdown) → returns:
- Match score (0–100%)
- Salary range + interview/application tips
- CV optimization suggestions + path to CV Builder
- Cover letter draft + path to CL Builder

- **Extension overlay** — extracts a job page and shows an AI match score badge; one-click import into the app. Works on LinkedIn (smart extraction) and other job sites.
- **Private & local-first** — all data stays in your browser (IndexedDB) unless you export. LLM inference is yours to run (LM Studio / Ollama / WebLLM) or a cloud API you configure.

## Install the Chrome extension

1. Grab `Artemis_Quiver_extension-vX.Y.Z.zip` from the [Releases page](https://github.com/Arthias/Artemis-Quiver-Releases/releases).
2. Unzip → you get an `Artemis_Quiver_extension/` folder.
3. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select that folder.
4. Pin the extension and open the **Artemis Quiver web app** once so it can build your profile fingerprint for scoring.

> **No auto-update** for unpacked builds — re-download the newest zip to update.

## Development

Clone this repo. Node + npm required.

```bash
npm install
```

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local web app dev server (secondary/test mode) on `:5173` |
| `npm run build` | Production build of the web app |
| `npm run build:ext` | Build the Chrome extension → `Artemis_Quiver_extension/` + `release/Artemis_Quiver_extension-v<version>.zip` |
| `npm run release:ext` | Build + commit + tag + publish a new extension release (see below) |
| `npm run test` | vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run qa:*` | Playwright QA suites (see `scripts/qa.ps1`) |

### Releasing the extension (zip-based)

Distributable zips can go to the public release repo.

```bash
npm run release:ext
```

This runs `build:ext`, commits + tags the zip in the `release/` repo, and creates a GitHub Release. Flags: `-SkipBuild` (reuse existing zip), `-SkipPublish` (commit/tag only).

### Local web mode (secondary)

The full app also runs standalone in the browser if you'd rather not use the extension:

```bash
npm run dev
```

Default LLM: primary → `/api/lmstudio` (Vite proxy, dev-only), secondary → `/api/ollama`. Change LLM + endpoints in **Settings**. Cloud APIs (OpenAI/OpenRouter/Anthropic/Gemini) work directly. In the extension, set real LLM URLs — Vite proxy paths don't exist there.

## Tech stack

React 18, Vite, Tailwind CSS v4, shadcn/ui, React Router v7, Dexie.js (IndexedDB). Provider adapter layer: OpenAI-compatible, Anthropic Claude, Google Gemini. i18n via react-i18next (en + es). vitest + jsdom.

## Docs

`artemis_quiver_docs/` — architecture, features, roadmap, bugs, changelog. Start at `00-Index/MOC.md`.