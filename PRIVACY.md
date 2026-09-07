# Privacy

**Draft.** This document describes what Artemis Quiver does with your data, derived from
the code in this repository rather than from a template. If you find a divergence between
this document and the code, the code is the truth and this document is a bug — please open
an issue.

There is no Artemis Quiver server. There is no account, no sign-up, no telemetry, no
analytics SDK and no crash reporter. Nothing is sent to the maintainer, ever. What follows
is entirely about **your browser** and **the AI provider you choose**.

## The one thing to understand first

Artemis Quiver stores everything locally. But it is an LLM tool, and an LLM has to run
somewhere. **If you configure a cloud provider — which is the default — then your profile
and the job postings you analyse are sent to that provider.** That is not a bug or a leak;
it is what you asked the app to do by choosing a cloud model. It is stated here plainly
because the choice is easy to make without noticing.

If you want nothing to leave your machine, use a local provider (WebLLM in-browser, or
LM Studio / Ollama on your own network). See "Local providers" below.

## What is stored, and where

All application data lives in your browser's **IndexedDB**, in a database named
`ArtemisQuiverDB` (`src/app/db/schema.ts`). Nothing is written to a server.

| Store | Contents |
|---|---|
| `profiles` | Your master profile Markdown, workspace settings (including provider config and API keys), the job posting draft, and your profile-assistant chat history |
| `analysisSessions` | Each job posting you analysed, the model's result, generated CVs |
| `metadata` | App-level flags such as the active profile and schema version |
| `errorLogs` | Errors from the app, extension overlay, popup, background worker and LLM calls, with message, stack and metadata |

**API keys are stored in this IndexedDB alongside the rest of the profile, in plain text.**
That is normal for a no-backend browser app, but it means anyone with access to your
browser profile can read them. Use a scoped, revocable key.

The Chrome extension additionally uses `chrome.storage`:

- `chrome.storage.local` → `artemis:overlayConfig` — the list of sites you enabled, your
  LLM settings for scoring, and a short **profile fingerprint** (a model-generated summary
  of your profile, kept under ~300 characters, used so scoring does not need to send your
  whole CV); and `artemis:quickScoreCache`, cached scores for pages already seen.
- `chrome.storage.session` → `artemis:pendingImports` — job pages you imported, held until
  the app tab picks them up. Cleared when the browser session ends.

Clearing your browser data deletes all of the above. There is no copy anywhere else, and
therefore **no recovery** — use *Export profile* if you care about it.

## What leaves your machine

Nothing leaves your machine except calls to the model provider you configured. There is no
other outbound traffic in the codebase.

### Cloud providers (the default)

The shipped default (`src/app/config/defaults.ts`) is `providerMode: "cloud"` with an
OpenAI-compatible endpoint pointed at `https://openrouter.ai/api/v1`. Anthropic and Google
Gemini (default base URL `https://generativelanguage.googleapis.com`) are also supported,
as is any OpenAI-compatible base URL you enter yourself. In every case the destination is
the base URL configured in Settings — the app has no hardcoded endpoint of its own beyond
those defaults.

When a cloud provider is active, the following is sent to it, in the request body:

| Action | What is sent |
|---|---|
| Analyse a job posting | Your **entire master profile** plus the full job posting text |
| Generate or edit a CV | Your entire master profile, the job posting, and the current CV |
| Generate or edit a cover letter | Your entire master profile and the job posting |
| Profile assistant chat | Your entire master profile and the conversation |
| Extension: score a page | Your profile **fingerprint** (not the whole profile) plus up to the first 8,000 characters of the page text |
| Extension: generate the fingerprint | The first ~4,000 characters of your profile |

Your profile typically contains your name, contact details, employers and education. Treat
sending it to a provider as equivalent to emailing your CV to that company. What the
provider then does with it — retention, training, logging — is governed by *their* policy,
not this one. Read it before choosing.

The request goes directly from your browser (or the extension's service worker) to the
provider. It does not pass through anything belonging to this project.

### Local providers

- **WebLLM** runs the model inside your browser tab via WebGPU. Prompts never leave the
  machine. The **model weights are downloaded once** from the MLC/Hugging Face CDN, which
  means that CDN sees your IP address and which model you fetched — but not your data.
- **LM Studio / Ollama** run on your own machine or LAN. Prompts go to the base URL you
  configured and nowhere else.
- **Chrome's built-in on-device model** (`LanguageModel`, "Gemini Nano"), used by the
  extension's fallback scoring path when available, runs on-device. The page text is passed
  to that API inside the page's own JavaScript context.

## The extension's permissions

Declared in `src/extension/manifest.json`:

| Permission | Why | When it applies |
|---|---|---|
| `scripting` | Registers the overlay content script for sites you enable | Only for sites you added |
| `storage` | The keys listed above | Always |
| `activeTab` | Read the current tab when you explicitly act on it | Only on your click |
| `sidePanel` | The side panel UI | Always |

Host access is deliberately narrow:

- `host_permissions` is **localhost only** (`http://localhost/*`, `http://127.0.0.1/*`) —
  granted on install so a local LM Studio or Ollama can be reached.
- `*://*/*` is under **`optional_host_permissions`**, which means it is **not** granted at
  install time. Chrome asks you for each site, and only when you add that site.
- There are **no static `content_scripts`**. Overlays are registered at runtime with
  `chrome.scripting.registerContentScripts()` for the sites you enabled, and are
  unregistered when you remove them.

In practice: installing the extension does not give it the ability to read the pages you
visit. That happens per site, after you ask for it.

The extension reads the page you are on (title, URL, visible text) only for sites you
enabled, and only to score or import the posting.

## What the app never does

- No account, no login, no server owned by this project.
- No telemetry, analytics, crash reporting or usage tracking of any kind. There is no such
  code in the repository.
- No advertising, no third-party trackers, no data sold or shared with anyone.
- No background upload of your profile. Every outbound request is caused by an action you
  took.
- No automatic update channel — the extension is distributed as an unpacked zip.

## Where this diverges from "local-first"

Stated explicitly, because the README makes a local-first claim and a reader deserves the
qualification:

1. **The default is a cloud provider, not a local one.** `DEFAULT_LLM_CONFIG` ships
   `providerMode: "cloud"` because WebLLM fails on machines without a capable GPU, and a
   new install that does nothing at all is worse. The consequence is that an unmodified
   install sends your profile to a third party the first time you analyse anything.
2. **"All data stays in your browser" is true of storage, not of inference.** Your data is
   only ever *stored* locally. It is *transmitted* every time you run an LLM action against
   a cloud endpoint.
3. **The app does not currently warn you at the moment of transmission.** There is no
   in-UI notice on the Analyse or Generate buttons naming the provider that is about to
   receive your profile. Making the trade visible in the UI is planned
   (`artemis_quiver_docs/60-Roadmap/Public Release Readiness.md`, P1.4) and is not done yet.
4. **API keys are stored unencrypted** in IndexedDB, as described above.

## Deleting your data

- App: Settings → clear data, or clear site data for the app origin in your browser.
- Extension: remove the extension, which drops its `chrome.storage` entries; or remove
  individual sites from the popup to revoke their host permission.
- Cloud providers: whatever you sent them is subject to their retention policy. Deleting
  local data does not reach it.

## Contact

Open an issue on the repository. There is no data-controller inbox because there is no
data controller — nothing is collected.
