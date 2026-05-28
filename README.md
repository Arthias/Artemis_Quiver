# Artemis Quiver

Job hunting automation engine: analyze job postings against your professional profile using a local LLM, then refine CVs and cover letters.

Design source: [Figma — Job Hunting Automation Engine](https://www.figma.com/design/NAKF9BYIvmXKegz6JDnaJl/Job-Hunting-Automation-Engine).

## What it does

Paste a job posting and the app compares it to your **master profile** (Markdown) and returns:

- **Scoring** — match percentage (0–100%)
- **Recommendations** — salary range and interview/application tips
- **CV focus** — optimization suggestions and a path to the CV builder
- **Cover letter** — a draft plus a path to the cover letter builder

### Workspace profiles (no login)

Up to **3 local profiles**, each with its own master profile, LLM settings, theme, and analysis history. Switch profiles from the sidebar footer. Adding a fourth profile removes the least recently used one.

### Profile workspace

- Markdown editor with auto-save and export
- **Import** `.md` / `.txt` with LLM merge (preview before apply)
- **AI Assistant** tab to refine the profile

### Builders

- **CV Builder** — generate from profile + optional job description; chat to edit; export `.md`
- **Cover Letter Builder** — tailored letter with company/role fields; chat to edit; export `.md`
- Open from Analysis Hub with job context pre-filled

### Settings

- **LLM Provider:** LMStudio or Ollama
- **General:** light/dark theme and auto-save (per active profile)

## Run locally

```bash
npm i
npm run dev
```

### Default LLM (dev)

Vite proxies `/api/lmstudio` → `http://192.168.8.171:1234` with model `google/gemma-4-e2b`. Change in **Settings** if your setup differs.

1. Start LMStudio with the model loaded and the server enabled.
2. Open **Settings** → **Test connection**.
3. Edit **Profile**, then run **Job Analysis** on the Analysis Hub.

Data stays in the browser (`localStorage`) unless you export `.md` files. Legacy single-profile data migrates into a “Default” workspace profile on first load.

## MVP (implemented)

| Feature | Status |
|---------|--------|
| Job analysis + session history + export | Done |
| Up to 3 workspace profiles + switcher modal | Done |
| Per-profile settings + light/dark theme | Done |
| Sidebar analysis history + New Analysis | Done |
| Analysis → CV/CL builder handoff | Done |
| Profile import + AI assistant | Done |
| CV & CL builder AI + structured JSON generation | **Done** |
| Themed PDF download (HTML rendering) | ✅ **Implemented** |

---

## 📄 New: Themed PDF Export via HTML Rendering

The CV Builder now supports professional PDF export with multiple themes:

### Features Added:
- ✅ Structured JSON CV format for reliable rendering
- ✅ Three printable themes: Modern, Classic, Minimal
- ✅ HTML-based rendering engine (`renderCVToHTML()`)
- ✅ Print isolation via iframe (no app UI bleed)
- ✅ XSS protection with HTML entity escaping
- ✅ Theme-switching interface

### Architecture Change:
**Before:** LLM generated plain Markdown text → exported as `.md` file  
**Now:** LLM generates structured JSON → rendered to themed HTML → printed as PDF

See [`src/types/cv.ts`](./src/types/cv.ts) for the content schema and [`renderingEngine.ts`](./src/components/cv/renderingEngine.ts) for the rendering logic.
| Cloud API keys / login | Not planned |

## Routes

| Route | Page |
|-------|------|
| `/` | Analysis Hub |
| `/profile` | Profile workspace |
| `/cv-builder` | CV Studio |
| `/cl-builder` | Cover Letter Studio |
| `/config` | Settings |

## Tech stack

- **UI:** React 18, Vite, Tailwind CSS, shadcn/ui, React Router v7
- **AI:** `fetch` to local LMStudio (OpenAI-compatible) or Ollama chat APIs
- **Persistence:** `localStorage` via workspace manifest + per-profile blobs

## 📖 Internal Documentation & AI Agent Context

**🔔 IMPORTANT:** When reviewing code, fixing issues, or planning features — always check the bug fix log first!

The internal documentation vault inside [artemis_quiver_docs/](artemis_quiver_docs/) is an Obsidian-compatible notebook containing architecture maps, state details, prompt patterns, coding rules, manual test cases, sprint backlog, **and bug fix logs**. It must be treated as the source of truth for all specifications.

### 🤖 AI Agent Instructions
1. Read `README.md` for project-wide overview and routes
2. **Check `artemis_quiver_docs/60-Roadmap/Plan.md`** for upcoming features & backlog items  
3. **Review `artemis_quiver_docs/30-Bugs-and-Fixes/_Index.md`** ✅ before fixing any issues (prevents duplicate work)
4. Consult relevant feature docs in vault (e.g., Analysis Hub, Document Builders) before making changes
5. Update documentation regularly after fixing bugs or implementing features
6. Follow [Documentation Guidelines](artemis_quiver_docs/40-Development/Documentation%20Guidelines.md) when adding or modifying vault contents

### 📍 Documentation Map
- **Index & Navigation:** `artemis_quiver_docs/00-Index/MOC.md`
- **Bug Fixes Log:** `artemis_quiver_docs/30-Bugs-and-Fixes/_Index.md`
- **Development Roadmap & Backlog:** `artemis_quiver_docs/60-Roadmap/Plan.md`
- **Architecture Overview:** `artemis_quiver_docs/10-Architecture/_Index.md`
- **Coding Rules & Standards:** `artemis_quiver_docs/40-Development/_Index.md`
- **Documentation Standards:** `artemis_quiver_docs/40-Development/Documentation Guidelines.md`
- **Test Cases & QA Scenarios:** `artemis_quiver_docs/50-Testing/Test Cases.md`
- **Changelog:** `artemis_quiver_docs/90-Meta/CHANGELOG.md`

See [`artemis_quiver_docs/00-Index/MOC.md`](artemis_quiver_docs/00-Index/MOC.md) for the complete navigation map.

## Risks

- Large uploads may exceed model context — review merges carefully.
- Models may misread jobs or invent skills — verify generated CVs and letters.
- API failures show in the UI; check the browser console for detail.

