# Artemis Quiver

Job hunting automation engine: analyze job postings against your profile using a local LLM.

Design source: [Figma — Job Hunting Automation Engine](https://www.figma.com/design/NAKF9BYIvmXKegz6JDnaJl/Job-Hunting-Automation-Engine).

## Run locally

```bash
npm i
npm run dev
```

## MVP (current)

- **Profile**: Markdown profile in `localStorage`, auto-save, export `profile.md`
- **Job analysis**: LMStudio or Ollama via dev proxy, JSON → UI + Markdown export
- **Settings**: Local provider URL, model, temperature, connection test

### Default LLM (dev)

Vite proxies `/api/lmstudio` → `http://192.168.8.171:1234` with model `google/gemma-4-e2b`. Change in **Settings** if your setup differs.

1. Start LMStudio with the model loaded and the server enabled.
2. Open **Settings** → **Test connection**.
3. Edit **Profile**, then run **Job Analysis**.

Data stays in the browser unless you export `.md` files.

## See also

`plan.md` — full roadmap (CV builder AI, PDF, cloud providers, etc.).
