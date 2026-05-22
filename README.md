# Artemis Quiver

Job hunting automation engine: analyze job postings against your professional profile using a local LLM, then refine CVs and cover letters.

Design source: [Figma — Job Hunting Automation Engine](https://www.figma.com/design/NAKF9BYIvmXKegz6JDnaJl/Job-Hunting-Automation-Engine).

## What it does

Paste a job posting and the app compares it to your **master profile** (Markdown) and returns:

- **Scoring** — match percentage (0–100%)
- **Recommendations** — salary range and interview/application tips
- **CV focus** — optimization suggestions and a path to the CV builder
- **Cover letter** — a draft plus a path to the cover letter builder

The **sidebar** links to Analysis Hub, Profile, CV Builder, Cover Letter Builder, and Settings. Session history and a multi-profile switcher are on the roadmap (see [PLAN.md](PLAN.md)).

### Profile workspace

- Central **master profile** as editable Markdown (browser storage)
- **Export** `profile.md` for backup
- Planned: file upload to merge context, AI assistant to optimize the profile

### Builders

- **CV Builder** — tailored CV from profile + optional job description; chat refinement
- **Cover Letter Builder** — letter for a role/company or generic; chat refinement
- Planned: real LLM generation; PDF export deferred

### Settings

- Local LLM: **LMStudio** or **Ollama** (URL, model, temperature, connection test)
- General: auto-save profile; planned per-profile **light/dark theme**
- Cloud providers (Anthropic, Gemini, OpenRouter) deferred

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

Data stays in the browser (`localStorage`) unless you export `.md` files.

## MVP (implemented today)

| Feature | Status |
|---------|--------|
| Profile editor, auto-save, export | Done |
| Job analysis (score, tips, CV notes, cover letter draft) | Done |
| Analysis session history (in hub) + Markdown export | Done |
| Settings: LMStudio/Ollama, test connection | Done |
| Sidebar analysis history / profile switcher | Planned |
| CV & CL builder AI | Planned |
| PDF download | Out of scope for current sprint |
| Login / cloud API keys | Out of scope |

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
- **AI:** `fetch` to local OpenAI-compatible (LMStudio) or Ollama chat APIs
- **Persistence:** `localStorage` (profile, config, analysis sessions)

## Roadmap

Full task list, sprint order, and failsafe notes: **[PLAN.md](PLAN.md)**.

Active work includes: up to **3 local workspace profiles** (no login), dark theme per profile, sidebar profile modal, wiring sidebar history and analysis→builder handoff, profile upload/AI chat, then CV/CL builder LLM integration.

## Risks

- Large profile uploads may exceed model context — merge/summarize carefully.
- Models may misread jobs or invent skills — review merges and generated CVs.
- API failures should show clear UI errors; check the browser console for detail.
