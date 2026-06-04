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

- **CV Builder** — generate from profile + optional job description; interactive inline editing on every section (name, title, contact, summary, experience with bullets, skills with categories, education, certifications); 3 themes with color picker; AI chat for modifications; export as themed PDF or `.md`
- **Cover Letter Builder** — tailored letter with company/role fields; structured JSON with paragraph editing; 3 themes with color picker; AI chat for modifications; export as themed PDF, `.md`, or copy plain text for application forms
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

Default server URL is `http://192.168.8.171:1234` with model `google/gemma-4-e2b`. Change in **Settings** if your setup differs.

1. Start LMStudio with the model loaded and the server enabled.
2. Open **Settings** → **Test connection**.
3. Edit **Profile**, then run **Job Analysis** on the Analysis Hub.

Data stays in the browser (IndexedDB) unless you export `.md` files.

---

## Chrome Extension

Artemis Quiver also runs as a **Chrome extension** (Manifest V3). Click the extension icon on any job posting page to extract the content and import it directly into the analysis textarea.

### Build & load

```bash
npm run build:ext
```

Then in `chrome://extensions` → **Load unpacked** → select `dist-ext/`.

### How it works

- **Non-LinkedIn pages**: instantly extracts `document.body.innerText`
- **LinkedIn job pages**: waits for dynamic content to render, then extracts the job description (trimmed of page clutter)
- The app tab opens with the extracted text pre-filled in the analysis textarea

### Permissions declared

- `scripting` — injects content extraction into the current tab
- `activeTab` — access only when clicking the extension icon
- `storage` — passes extracted data to the app page
- `host_permissions` — `http://192.168.8.171:1234` (LMStudio) and `http://localhost:11434` (Ollama)

## MVP (implemented)

| Feature | Status |
|---------|--------|
| Job analysis + session history + export | Done |
| Up to 3 workspace profiles + switcher modal | Done |
| Per-profile settings + light/dark theme | Done |
| Sidebar analysis history + New Analysis | Done |
| Profile import + AI assistant | Done |
| Analysis → CV/CL builder handoff | Done |
| CV & CL builder AI + structured JSON generation | Done |
| Interactive inline CV editing (all sections) | Done |
| Interactive inline CL editing (structured JSON) | Done |
| 3 themes (Modern, Classic, Minimal) + color picker | Done |
| Themed PDF export (CV & CL) | Done |
| Skills with category editing + drag reorder | Done |
| Follow-up chat on analysis results | Done |
| CV/CL builder AI chat for modifications | Done |
| 10 prompt optimization modes (prompts.ts) | Done |
| Centralized error codes + retry strategies | Done |
| 62 automated tests (vitest) | Done |

## Roadmap

| Feature | Sprint | Status |
|---------|--------|--------|
| IndexedDB migration (Dexie.js) | 6 | Done |
| LinkedIn job import (Chrome Extension) | 6b | **Done** |
| Application Kanban (pipeline tracker) | 8 | **Planned** |
| Email fetch for status checking | 8 | **Planned** |
| Outreach message generator | 9 | **Planned** |
| Cloud LLM fallback (OpenAI/Anthropic) | 10 | **Planned** |
| Interview simulator (STAR + technical) | 11 | **Future** |
| Desktop app (Tauri) + buy-once license | 12 | **Future** |

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
- **Persistence:** `IndexedDB` via Dexie.js (with automatic migration from `localStorage` on first load)
- **Testing:** vitest with jsdom (62 tests across 9 files)

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

