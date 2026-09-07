---
tags: [roadmap, release, open-source, onboarding, accessibility, ci]
status: planning
last_updated: 2026-09-02
---

# Public Release Readiness

Work plan for making the Quiver repo and product presentable to a public audience — an engineer or recruiter arriving cold at the GitHub page, and a stranger running the extension for the first time. Six phases, `P0` → `P5`, implemented in order.

> [!NOTE] Scope
> This is a **technical readiness** plan, not a review. Every item below is either a hard blocker for publication or a concrete improvement with an owner-executable task list. Items marked **BLOCKER** must be done before the repo goes public; everything else improves the impression it makes.

> [!IMPORTANT] Product philosophy — settled 2026-09-03
> **Quiver is a simple CV builder, a tool to facilitate job hunting. Not an enterprise product.**
>
> **Generation quality is delegated to model quality.** A better model at a lower temperature produces a better file. Quiver's job is the tooling applied over that output — the builder, the templates, the export, the scoring — not guaranteeing the output itself. It is a casual tool, not built for revenue, and it does not need to be 100% precise.
>
> **The objective is public and usable by general users.** If it gains traction it can be improved and monetised later.
>
> Practical consequence for this plan: items are justified by **usability**, not by accuracy or verification. No output-validation machinery, no fabrication detection, no correctness guarantees. What *does* follow is that **model choice and configuration become the product surface that matters most** — see P1.6.
>
> Prompt- and output-layer work derived from this sits in **P1B**; full analysis in [[../../../dispatch/15-quiver-prompt-review|dispatch/15 — Quiver prompt review]].

> [!WARNING] Prerequisites
> `P1` assumes familiarity with the provider abstraction — read [[../20-APIs/Local LLM Integration]] and [[../40-Development/WebLLM Stability and Service Worker]] first.

**Residual, noted once and not otherwise actioned:** three `ExampleCVs/*.html` blobs in git history carry a personal mobile number and personal email address. History is out of scope by decision; recorded here only so it is not rediscovered as news.

---

## Phase Summary

| Phase | Focus | Blocks publication? | Estimate |
|-------|-------|---------------------|----------|
| **P0** | Hard blockers — deps, typecheck, tests | **Yes** | **3–4 h** |
| **P1** | Onboarding rework — provider choice, gated test, privacy copy, model guidance | No, but highest product value | **3–4 days** |
| **P1B** | Prompt & output simplification — structured output, `num_ctx`, scoring split | No, but it is what makes small models usable | **2–3 days** |
| **P2** | First-run & credibility — a11y, side panel theme, import-file honesty | No | **3–4 days** |
| **P3** | Repository hygiene — `.gitattributes`, CI, licence, advisories | Partly (`.gitattributes`, licence) | **4–6 h** |
| **P4** | README rewrite | No, but it is the first thing anyone reads | **4–6 h** |
| **P5** | Verification gate | **Yes** | **1–2 h** |

**Total: roughly 9–12 working days**, of which ~4 hours are true blockers.

---

## P0 — Hard Blockers

**Goal:** `git clone && npm install && npm run typecheck && npm run test && npm run build` succeeds on a clean machine that is not Bruno's.

Nothing else in this document matters if a visitor's first command fails.

### P0.1 — `react` and `react-dom` are undeclared dependencies · **BLOCKER** · 30 min

`package.json` declares neither, yet 39 source files import from `"react"`. It resolves today only because Radix pulls React 18.3.1 in as a peer:

```
$ npm ls react
artemis-quiver@3.8.0
└─┬ @radix-ui/react-dialog@1.1.6
  └── react@18.3.1 deduped     ← the only reason this builds
```

Under pnpm's strict resolution or Yarn PnP this fails outright; under npm it is a hoisting coin-flip. For a repo whose README says *"Clone this repo. Node + npm required."* this is the worst possible first impression.

- [ ] Add `"react": "^18.3.1"` and `"react-dom": "^18.3.1"` to `dependencies`
- [ ] Move `@mlc-ai/web-llm` from `devDependencies` to `dependencies` — it is a **runtime** import in `WebLLMAdapter.ts` and `webllm-sw.ts`, and it is the flagship feature
- [ ] Add `"engines": { "node": ">=20" }` (currently absent)
- [ ] Resolve the `@types/react@^19` vs React 18.3.1 runtime mismatch — either pin `@types/react` to `^18` or plan the React 19 upgrade deliberately. Do **not** leave them disagreeing
- [ ] Verify with a scratch clone: `rm -rf node_modules package-lock.json && npm install && npm run build`

### P0.2 — Five `tsc --noEmit` errors · **BLOCKER** · 1 h

`npm run typecheck` is currently red:

```
src/extension/overlay.ts(116,16)    TS6133  'loadPosition' declared but never read
src/extension/overlay.ts(130,7)     TS6133  'STYLES' declared but never read
src/extension/overlay.ts(228,5)     TS6133  'overlayShadowRoot' declared but never read
src/extension/overlay.ts(364,10)    TS6133  'setupOverlayEvents' declared but never read
src/extension/sidepanel.tsx(138,61) TS2694  Namespace 'chrome.tabs' has no exported
                                            member 'TabChangeInfo'
```

- [ ] Delete the four unused declarations in `overlay.ts` — a whole `STYLES` constant and a `setupOverlayEvents` function suggest an abandoned refactor. **Delete rather than suppress**; confirm no dynamic reference first
- [ ] Fix `sidepanel.tsx:138` — `chrome.tabs.TabChangeInfo` does not exist in `@types/chrome@0.1.x`. Use `chrome.tabs.OnUpdatedInfo`, or inline the shape
- [ ] Update the **stale** "known pre-existing TS issues" list in `CLAUDE.md` and `AGENTS.md` — it names `clParser.ts`, `migrations.ts` and `WorkspaceProfileContext.tsx`, which appear to be fixed. A wrong known-issues list is worse than none

### P0.3 — Three stale `providerMode` test expectations · **BLOCKER** · 20 min

Not product bugs. Commit `853d9c6` deliberately changed `DEFAULT_LLM_CONFIG.providerMode` from `"local"` to `"cloud"` — correctly, and with a good comment in `defaults.ts` explaining that WebLLM crashes on machines without a capable GPU. Three assertions in `src/app/db/__tests__/db.test.ts` were never updated.

> [!NOTE] The suite was green at v3.6.1
> [[Public Beta Release]] records `144/144 tests` passing. These three broke after that, when the cloud default landed. The regression is in the tests, not the code.

| Line | Test | Change |
|------|------|--------|
| 82 | *"should create new profiles with providerMode set by default"* | `"local"` → `"cloud"` |
| 126 | *"should create a default profile with providerMode when DB is empty"* | `"local"` → `"cloud"` |
| 229 | *"should NOT overwrite providerMode on profiles that already have it set"* | `"local"` → `"cloud"` |

- [ ] Update the three assertions
- [ ] Fix the now-false comment at line ~226: `// Verify it starts with "local" from DEFAULT_LLM_CONFIG`
- [ ] Leave the two **backfill** tests (lines 199, 210) alone — `migrations.ts` still correctly infers `webllm → local`, `else → cloud`

### P0.4 — Package identity · **BLOCKER (licence field)** · 30 min

`package.json` was renamed to `artemis-quiver` in `69c637b`. Still missing:

- [ ] `description`, `author`, `repository`, `keywords`, `homepage`, `bugs`
- [ ] **`"license": "MIT"`** — a `LICENSE` file exists but the field does not, so tooling cannot detect it
- [ ] `index.html` `<title>` still reads **"Job Hunting Automation Engine"** — the original Figma Make name, shown in every browser tab
- [x] **Decided 2026-09-07:** `LICENSE` now reads `Copyright (c) 2026 Bruno Manfredi - Arthias`

---

## P1 — Onboarding Rework · 3–4 days

**Goal:** a stranger with no local model and no idea what an LLM endpoint is reaches a working first analysis without leaving the app, and understands what they traded to get there.

**Priority: highest after P0.** This is the change that most improves the product, and it closes three separate findings at once — no setup validation, a cloud tab that suggests invalid Ollama model tags, and privacy claims that stop being true without saying so.

> [!NOTE] This also closes an open question
> [[Public Beta Release]] § Open Questions asks: *"Primary LLM for beta testers who don't have LMStudio/Ollama on the LAN — default to cloud API key or WebLLM download?"* This phase answers it: **cloud, with OpenRouter's free tier as the zero-setup default, and local as an explicit equal-weight choice.** Close that question when this lands.

### P1.0 — What the provider layer already supports

**Assessment: this is an onboarding and configuration change, not new plumbing.** Verified against the code:

| Need | Already exists? | Where |
|------|-----------------|-------|
| OpenRouter as a provider | ✅ **No new adapter needed** — OpenRouter is OpenAI-compatible; `openai-compatible` fronts it | `OpenAICompatibleAdapter.ts` |
| Bearer-token auth | ✅ `buildHeaders()` sets `Authorization: Bearer` when `apiKey` is set | `OpenAICompatibleAdapter.ts:6` |
| Correct base URL default | ✅ `DEFAULT_LLM_CONFIG.primary.baseUrl` is already `https://openrouter.ai/api/v1` | `defaults.ts:49` |
| Connection test | ✅ `testConnection()` on the adapter interface, surfaced via `llmService.testConnection()`, **already called** by the wizard's Test button | `ProviderAdapter.ts`, `OnboardingWizard.tsx:161` |
| Model discovery | ✅ `listModels()` on the interface, already wired into a UI button in Settings | `Config.tsx:994` |
| Local/cloud mode state | ✅ `providerMode` + `savedCloudEndpoints` on `LlmConfig` | `types/llm.ts` |
| Anthropic / Gemini | ✅ Dedicated adapters registered | `registry.ts` |

**Two genuine gaps, both small:**

1. **Mode-switch logic is duplicated, and the wizard's copy is lossy.** `Config.tsx:1552` saves the user's cloud endpoints into `savedCloudEndpoints` before switching to local and restores them on switching back. `OnboardingWizard.tsx:194` does **not** — it discards them and resets to defaults. Extract one shared helper and use it in both.
2. **Free-model filtering.** `listModels()` returns `string[]` of IDs and discards pricing. See P1.2 for why that turns out not to matter.

- [ ] Extract `switchProviderMode(config, target)` into `src/app/utils/` or `config/`; use it in both `Config.tsx` and `OnboardingWizard.tsx`
- [ ] Add unit tests for the helper — round-trip cloud → local → cloud must preserve endpoints

### P1.1 — Provider choice as the first-class step · 1 day

Replace the current two-button Cloud/Local toggle with a deliberate choice screen. Both paths equal weight; neither pre-selected as the "advanced" one.

- [ ] Rebuild `AiSetupStep` as **choice → configure → test**, three sub-states rather than one dense form
- [ ] **Cloud path**
  - [ ] OpenRouter free tier presented as the zero-setup default
  - [ ] "Other provider" disclosure revealing the providers the codebase already supports: OpenAI-compatible (any base URL), Anthropic, Google Gemini — driven off `CLOUD_PROVIDER_OPTIONS`, which already exists
  - [ ] API key field with a **direct link to `https://openrouter.ai/keys`** and a one-line "create a free account, no card required"
  - [ ] Derive the Base URL placeholder from `PROVIDER_DEFAULT_BASE_URLS` in `defaults.ts` — it already exists and is simply not used by the wizard. **Delete the current `http://localhost:11434` placeholder from the cloud tab**; it is an Ollama address on the cloud screen
- [ ] **Local path** — unchanged behaviour: WebLLM in-browser, or a local server base URL (LM Studio / Ollama). Keep the existing VRAM detection and model ladder
- [ ] Surface WebGPU absence **before** the user commits to local. `navigator.gpu` is already checked at `OnboardingWizard.tsx:134`, but only to skip the VRAM readout. If it is missing, say so and steer to cloud rather than letting them click Download and receive a raw adapter exception
- [ ] Delete `COMMON_MODELS` (`OnboardingWizard.tsx:38`) — see P1.2

### P1.2 — Model selection that cannot go stale · 0.5 day

The current `COMMON_MODELS` chips are **Ollama tag syntax** (`llama3.2:3b`, `mistral:7b`, `qwen2.5:7b`, `deepseek-r1:7b`) offered against a default OpenRouter endpoint, where they are invalid IDs. Clicking a chip labelled "Llama 3.2 (3B)" currently guarantees a failed first analysis.

> [!TIP] OpenRouter free models are identifiable by suffix
> Verified against OpenRouter's API docs (2026-09-02): **free model variants have IDs ending in `:free`**. So `listModels()` can be filtered with `.endsWith(":free")` — **no change to the `ProviderAdapter` interface**, and no hardcoded list. This matters because the free roster rotates constantly; a pinned model ID would be a maintenance liability.

- [ ] On the cloud path, call the existing `listModels()` and populate a real dropdown
- [ ] Add a "Free models only" filter — `id.endsWith(":free")` — **on by default** when the endpoint is OpenRouter
- [ ] Do not hardcode a default free model ID. Select the first entry that passes the connection test, or let the user pick from the filtered list
- [ ] Keep the curated `WEBLLM_MODELS` ladder as-is for the local path — that catalogue is version-pinned to the installed `@mlc-ai/web-llm` and correctly belongs in code

### P1.3 — Gated connection test · 0.5 day

Closes the finding that nothing verifies setup and a stranger's first five minutes end in a raw provider error.

- [ ] **"Next" is disabled until `testConnection()` succeeds at least once** for the chosen endpoint
- [ ] Provide an explicit `Skip — I'll configure later` escape so the state is *chosen*, never stumbled into
- [ ] Map the provider errors OpenRouter actually returns to specific guidance rather than passing `err.message` through:

| Status | Meaning | Copy |
|--------|---------|------|
| `401` | Invalid / missing key | "That key wasn't accepted. Check you copied the whole thing from openrouter.ai/keys." |
| `402` | Insufficient credits | "This account has no credits. Free models need a balance at or above zero." |
| `429` | Rate limited | "Rate limit reached — free models allow 20 requests/minute. Wait a moment and retry." |
| `404` | Bad model ID | "That model isn't available. Pick one from the list." |
| network | Unreachable | "Couldn't reach the provider. Check the Base URL and your connection." |

- [ ] If setup was skipped, show a dismissible **"Finish setup"** banner on the Analysis Hub whenever config or profile is empty
- [ ] Gate the Hub's Analyze button on a configured endpoint, not just `draftJobPosting.trim()` (`AnalysisHub.tsx:137`), with a tooltip naming what is missing

### P1.4 — Privacy copy at the point of choice · 0.5 day

The README promises local-first. The app must be honest at the moment that stops being true — **on the choice screen, not in a doc**.

> [!NOTE] The copy already exists, in the wrong place
> `onboarding.local100Desc` already says it well: *"Your profile, CVs, and job history are stored only in your browser. AI processing uses whichever provider you choose — from fully local (WebLLM/LM Studio) to cloud (OpenRouter, Anthropic, Gemini)."* It sits on the **Welcome** card, two steps before the decision it describes. Move the substance to where the choice is made.

Draft copy — sits directly under each option, always visible, not behind a tooltip:

> **💻 Run it on this computer**
> Your CV and job postings never leave your machine. Needs a modern GPU, and a one-time model download of 2–7 GB.
>
> **☁️ Use a cloud provider**
> Works on any machine, nothing to download. **Your CV and the job postings you analyse are sent to the provider you choose.** OpenRouter's free tier needs no card — about 50 requests a day, enough for roughly 10–15 job analyses.

- [ ] Add the two blocks to `en.json` and `es.json` under `onboarding.*`, following the existing `page.component.element` key convention
- [ ] Render them **inline and always visible**
- [ ] Add a persistent, low-key indicator elsewhere in the app showing which mode is active, so the trade stays visible after onboarding
- [ ] Rate-limit numbers verified 2026-09-02: 20 req/min; 50 req/day under $10 lifetime credits, 1000/day above. **Do not restate these as guarantees** — link to `https://openrouter.ai/docs/api-reference/limits` and keep the in-app phrasing approximate

### P1.5 — Wizard mechanics · 0.5 day

- [ ] Remove the one-way corridor — add a close/skip affordance and an Escape handler. It is currently `fixed inset-0 z-[100]` with no exit
- [ ] Render the (translated) step labels. `STEPS = ["Welcome", "AI Setup", "Profile"]` is hardcoded English and **never displayed** — only `.length` is used, giving three anonymous dots
- [ ] Replace `window.location.reload()` at `handleComplete()` (`OnboardingWizard.tsx:484`) with proper state propagation
- [ ] Fix the silent clipboard failure — `handleImportClipboard` swallows the error (`catch {}`, line 417), so on Firefox/Safari or a denied permission the button does nothing at all. `sonner` is already a dependency; one `toast.error()`
- [ ] Offer file upload on the Profile step, not only clipboard — most people's CV is a file
- [ ] i18n the English leaks: `"Download cancelled."` (line 383, also rendered in the **green success** style) and `` `OK: "${reply}"` `` (line 167)
- [ ] Surface `WebLLMStatusEvent` `downgrade` events in the UI. When the ladder steps a user down, tell them — *"Your GPU lost its device twice; switched to Qwen3.5 (2B)."* This turns the repo's best code into something a user can actually see

### P1.6 — Model guidance as the quality lever · 0.5–1 day

**Follows directly from the product philosophy.** If generation quality is delegated to model quality, then the provider picker is not a settings screen — it is *the* place the user determines what they get. Today it presents a choice with no guidance about consequence, and temperature is never surfaced at all.

**Temperature defaults.** `DEFAULT_PRIMARY_ENDPOINT` currently ships `temperature: 0.7` and every call inherits it, including CV and cover-letter generation. 0.7 is a chat default, not a document default — it is why the same profile produces a materially different CV on each run.

- [ ] Default **generation** endpoints to a low temperature (**0.2 suggested**); keep a higher value only where variation is wanted
- [ ] Expose temperature in Settings with a plain-language label — *"Lower = more predictable and closer to your profile. Higher = more varied wording."* Not a bare `0.0–1.0` slider
- [ ] Verify the value actually reaches the request on every adapter. `OpenAICompatibleAdapter` and `WebLLMAdapter` both pass `endpoint.temperature`; confirm Anthropic and Gemini do too

**Guidance in the picker.** State the trade rather than leaving the user to discover it:

> **Scoring** works well on a small local model — that is what the in-browser option is for.
> **Generating a CV or cover letter** is a harder task. A larger model produces a noticeably better document. If you are using the in-browser model, expect to edit the result.

- [ ] Add the copy to `en.json` / `es.json` under `onboarding.*`, inline and always visible, alongside the P1.4 privacy blocks
- [ ] Where a user generates with a small local model configured, say so once at the point of generation — an acknowledgement, not a refusal, and not a silent degrade
- [ ] Do **not** frame the in-browser option as a compromise. It is the right tool for scoring, which is the function nobody can do by hand

**Recommended models, current at runtime.**

- [ ] Cloud path: derive recommendations from the live `listModels()` call added in P1.2 rather than a hardcoded list. Pair with the `:free` filter
- [ ] Local server path (Ollama / LM Studio): recommendations must come from the endpoint's own `/v1/models`, not from a pinned list. `listModels()` already does this and the wizard does not use it
- [ ] Local WebLLM path: `WEBLLM_MODELS` stays hardcoded — it is version-pinned to the installed `@mlc-ai/web-llm` and correctly belongs in code (as P1.2 already notes)
- [ ] Any model name that must be written down goes in **one** place with a comment saying it will rot. The current `COMMON_MODELS` chips are the cautionary example — deleted in P1.1

---

## P1B — Prompt & Output Simplification · 2–3 days

**Goal:** the app produces a parseable result on a small local model, and the prompts stop teaching the model to invent things. Justified by usability — a generation that fails to parse is a spinner ending in an error, which is the most common failure on target hardware.

**Source:** [[../../../dispatch/15-quiver-prompt-review|dispatch/15]] §9. Measurements there are against v3.9.3.

> [!NOTE] Not a correctness programme
> Per the philosophy, there is **no output validation, no fabrication detection and no grounding check** in this phase. Everything here is about reliable parsing, prompt size, and not shipping a prompt that demonstrates the wrong behaviour.

### P1B.1 — Structured output · 1 day

Ollama, llama.cpp and LM Studio all accept `response_format: {type: "json_schema"}`; WebLLM accepts it on `chat.completions.create`. Quiver passes none of them — `OpenAICompatibleAdapter.ts:26` sends only `{model, messages, temperature, max_tokens, stream}`.

- [ ] Add `responseFormat?: object` to `ModelEndpoint` (`types/llm.ts`)
- [ ] Pass it through `OpenAICompatibleAdapter` and `WebLLMAdapter`; feature-detect and fall back to the current free-text path on a `400`
- [ ] Define one JSON Schema per output type — CV, cover letter, score — colocated with the types they mirror
- [ ] **Delete `CV_JSON_FORMAT` and `CL_JSON_FORMAT`** (`prompts.ts:59` and `:378`). The schema carries the shape; the ~500-token worked example carried only content, and the content was `"BSc Computer Science"`, `"MIT"`, `"Led a team of 5 engineers"` and `"Reduced deployment time by 40%"` — a demonstration of exactly the invention the task statement asks against
- [ ] Reduce `MAX_RETRIES` from 3 to 1 in `cvBuilderService` and `clBuilderService`. Four sequential attempts at a 16k prompt on a local 2B model is minutes of spinner
- [ ] Note that attempts 0 and 1 currently send **byte-identical messages** — the repair turn only appends at `attempt >= 2`. Whatever the final retry count, make every attempt differ from the last

### P1B.2 — Prompts reduced to the task statement · 0.5 day

- [ ] CV generation: *"Build a CV from the profile below for the target job. Use only information the profile contains. Return JSON matching the schema."* Delete the `GENERAL OPTIMIZATION GUIDELINES` block and the eight-clause `RULES` list
- [ ] Cover letter: same. **Fill the seven mechanical fields in code** — `date`, `salutation`, `closing`, `senderName`, `senderTitle`, `position`, `companyName` are values the app already holds; asking the model for them is seven more chances to get something wrong
- [ ] Delete the two explicit fabrication instructions: *"infer plausible metrics from context"* (`prompts.ts:158`) and *"suggest 1–2 skills the candidate might reasonably claim … even if not explicitly listed"* (`prompts.ts:261`)
- [ ] Replace `DEFAULT_PROFILE_MARKDOWN` with `MINIMAL_PROFILE_MARKDOWN` — both already exist in `config/defaults.ts`. A new user's first screen should obviously be a blank form, not a fictional person's finished CV
- [ ] Re-add quality guidance **one line at a time on evidence** if output turns out too bland, rather than restoring the block wholesale

### P1B.3 — `num_ctx`, and stop truncating silently · 0.5 day

`num_ctx` appears nowhere in `src/`. The runtime therefore applies its own default and silently discards whatever does not fit, then answers as if the request were complete. The assembled CV request measures ~16,750 tokens.

- [ ] Set the context length explicitly on the OpenAI-compatible request
- [ ] Estimate the assembled request before sending; when it will not fit, fail with a legible message naming the shortfall instead of letting the runtime truncate
- [ ] **30-minute check:** run one generation against local Ollama and compare `prompt_eval_count` against what was sent, to confirm the truncation direction

### P1B.4 — Scoring / generation split · 1 day

Scoring is the function nobody can perform by hand and is therefore what the in-browser model must do well. `analyzeJobPosting` currently sends the **full profile** (~15,375 tokens) plus a seven-field schema including a complete cover letter, with **no retry**.

- [ ] Give in-app scoring its own call, budgeted to **~3,300 tokens**: cached profile digest (~800–1,200) + truncated posting (~2,000) + ~120-token instruction → `{score, reason}`
- [ ] **Cache the digest** against the profile, not the job. Regenerate on profile edit. This is what makes scoring many postings affordable locally
- [ ] Reuse the extension's `parseScoreAndReason` (`background.ts`) rather than writing a new parser — it already falls back to a bare-number regex and clamps to 0–100
- [ ] Move tips / CV recommendations / salary / summary to a user-initiated call on the generation provider
- [ ] **Delete `coverLetterDraft` from the analysis schema.** It duplicates `clBuilderService`, and 300 tokens of free prose inside a JSON string is where parsing breaks
- [ ] *Suggestion, not a gate:* score twenty postings you already have opinions about and check the ordering before tuning the digest size

### P1B.5 — `mergeProfileFromUpload` · 0.5–1 day

The current function replaces the user's entire profile with the model's regeneration of it — no diff, no preview, no undo. **A tool that silently overwrites what the user typed with no way back is a bad tool** regardless of precision standard. Same applies to `profileChatService.extractUpdatedProfile`, which replaces the whole profile with whatever follows an `"UPDATED_PROFILE:"` marker a small model will not emit consistently.

**Decision required — see [[../../../dispatch/15-quiver-prompt-review|dispatch/15]] §9 P3:**

- [ ] **Option A** — delete the LLM path; upload → extract → side-by-side → user copies what they want. Ships today
- [ ] **Option B** — LLM returns *additive* proposals `[{section, proposed_text}]`, applied by code on approval; never returns the whole profile. Nearly free once P1B.1 exists

> Overlaps **P2.3 — Import-file honesty and a real diff**. P1B.5 is the service-layer half; P2.3 is the UI half. Do them together.

### P1B.6 — Dead code · 0.5 day

- [ ] Delete `optimizeCv` and the nine unreachable optimization-mode prompts (~1,900 tokens). `CVBuilder.tsx:94` passes no options, so `mode` is always `"standard"` and `PromptContext` is entirely unreachable. `audit`, `hiring-manager` and `ats-optimize` are decent and generic — recoverable from git if any is a feature rather than an abandoned experiment
- [ ] Delete `background.scorePrompt` from `en.json` and `es.json` — `buildScorePrompt` is hardcoded inline
- [ ] Delete the never-read `PromptContext.recommendations` and `.jobDescription`
- [ ] **Request host permissions from the popup at configuration time.** `ensureHostPermission` (`background.ts:290`) calls `chrome.permissions.request()` from a background message handler with no user gesture; MV3 rejects it, the error is caught and warned, and the fetch then fails. Cloud and LAN endpoints likely cannot be granted from the overlay path at all — a broken feature, not a hygiene item

---

## P2 — First-Run & Credibility · 3–4 days

**Goal:** the product does not undermine its own claims, and does not fail an obvious review check.

### P2.1 — Accessibility · 1.5–2 days

Measured across every page and every extension surface — `aria-*`, `role=`, `htmlFor` and `tabIndex` counts are **zero in all seven files**, including the 1,787-line Settings page.

The `Label` component is Radix's `LabelPrimitive.Root`, which associates via `htmlFor`. `htmlFor` is passed nowhere. Labels are visual siblings of their inputs, so **no form control in the application is programmatically labelled.**

Mechanical work, and the highest credibility-per-hour available before publishing.

- [ ] Add `id` / `htmlFor` pairs to every form control. Priority order: `Config.tsx` (densest) → `OnboardingWizard.tsx` (first thing anyone meets) → `Profile.tsx` → `AnalysisHub.tsx`
- [ ] Fix the bare `<label>` at `AnalysisHub.tsx:110`
- [ ] Give the onboarding modal `role="dialog"`, `aria-modal="true"`, a focus trap, and Escape handling
- [ ] Convert the Cloud/Local toggle to `role="tablist"` / `role="tab"` with `aria-selected`; the ☁️/💻 emoji need text alternatives
- [ ] `StepDots` — add `aria-label` and an `aria-live` region so wizard progress is announced
- [ ] Extension surfaces: same treatment for `sidepanel.tsx`, `popup.tsx`, `overlay.ts`
- [ ] Set `<html lang>` from the active i18n locale in `index.html` and `sidepanel.html` — both hardcode `lang="en"` while the app ships en + es
- [ ] Verify with axe DevTools or Lighthouse; record the before/after score in [[../50-Testing/Test Cases]]

### P2.2 — Side panel is visually a different product · 1 day

`sidepanel.html` hardcodes a dark theme (`background: #0f172a; color: #f1f5f9`) with **no `prefers-color-scheme` and no theme wiring** — zero matches for `dark` or `theme` in either file. A light-theme user gets a black side panel on the extension's main surface.

`sidepanel.tsx` (575 lines) uses inline `style={{}}` with hardcoded hex — `#ef4444`, `#94a3b8`, `#1e293b`, `#3b82f6` and six more — instead of the shadcn components and CSS variables used everywhere else.

- [ ] Move `sidepanel.tsx` onto the shared CSS variables from `src/styles/theme.css`
- [ ] Remove the hardcoded background from `sidepanel.html`; inherit the app's light/dark theme
- [ ] Replace inline styles with the shared `ui/` components where the bundle budget allows; where it does not, use CSS variables rather than literals
- [ ] Route extension errors through `AppError.userMessage` — the SPA does this correctly (`Profile.tsx:80`), the extension surfaces bypass it and can show a user `LLM request failed: 403 for http://.../v1/chat/completions`
- [ ] **Port the elapsed-seconds counter *into* the SPA.** `loadingSeconds` ("Analyzing (12s)") is a nicer touch than anything on the web side

### P2.3 — Import-file honesty and a real diff · 1 day

`Profile.tsx:61–92` + `profileMergeService.ts`. The button says **"Import file"** and the hint says *"merge an existing .md or .txt document"*. What happens is that the whole file plus the whole existing profile is POSTed to `getActiveEndpoint(config)` — which returns `config.primary`, by default a **cloud** endpoint — and an LLM rewrites the entire profile.

Two compounding problems:

1. **It contradicts the headline promise.** The README says *"all data stays in your browser unless you export."* This is an export of the most sensitive document in the app, and nothing in the UI says so at the moment it happens.
2. **The confirmation cannot show what changed.** The preview is `mergePreview.slice(0, 2000)` in a `max-h-48` (192 px) `<pre>`, as plain text with no diff. A real CV exceeds 2,000 characters, and Education sits near the end — so anything altered past that cutoff is **unviewable at the confirm step**. Then "Apply merge" replaces the whole profile. The only guard is a line in `MERGE_SYSTEM_PROMPT` asking the model not to invent credentials, which is a request, not a constraint.

- [ ] Rename the action to **"Import & merge with AI…"**
- [ ] Add body text naming the provider that will receive the file, with a distinct warning when the active endpoint is a cloud provider
- [ ] **Remove the 2,000-character cap** and replace the `<pre>` with a **line-level diff** of current vs merged, additions and removals highlighted. No dependency needed — an LCS over lines is ~40 lines of code
- [ ] Raise the preview container height; make it resizable
- [ ] Consider defaulting Education and Certifications to **preserved verbatim** unless the user opts in per-section
- [ ] Accept `.pdf` / `.docx`, or state the `.md`/`.txt` limitation up front rather than after the file picker

### P2.4 — Smaller consistency items · 0.5 day

- [ ] Unify focus rings — `focus:ring-blue-500/50` (`AnalysisHub.tsx:442`) vs `focus:ring-primary/50` (`OnboardingWizard.tsx:442`). Pick the token
- [ ] `AnalysisHub` renders its error card only inside the `!hasResult` branch, so a follow-up chat failure with a result on screen has no obvious surface
- [ ] Page-header gradients differ per page (blue→purple, green→teal, orange→red) with no stated system. Either document it as intentional or unify
- [ ] `Config.tsx` at 1,787 lines is the "Quiver feels cluttered" problem already recorded in [[UI-Restructure-Proposals]] — not in scope here, but a visitor meets it before they meet that doc

---

## P3 — Repository Hygiene · 4–6 h

### P3.1 — `.gitattributes` · **BLOCKER** · 30 min

83 tracked files currently show as modified on line endings alone: **28,590 insertions, 28,590 deletions**, and `git diff --ignore-all-space` is empty — pure CRLF churn, zero substantive change. Census: **94 tracked files contain CR, 97 are pure LF.** `core.autocrlf` is unset locally and globally, and no `.gitattributes` exists on any branch.

Without this, the first contributor on macOS or Linux opens a ~28,000-line diff on their first save.

- [ ] Add `.gitattributes`:
  ```gitattributes
  * text=auto eol=lf
  *.ps1 text eol=crlf
  *.png binary
  *.canvas text eol=lf
  ```
- [ ] Run `git add --renormalize .` as a **single isolated commit**, touching nothing else
- [ ] Optionally set `core.autocrlf=true` locally to stop it recurring

### P3.2 — CI · 2 h

No CI exists. The lockfile **is** cross-platform complete — it contains every `@esbuild/*`, `@rollup/*` and `lightningcss-*` platform variant — so `ubuntu-latest` will install correctly.

- [ ] Add `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 22, cache: npm }
        - run: npm ci
        - run: npm run typecheck
        - run: npm run test
        - run: npm run build
        - run: npm run build:ext
  ```
- [ ] Add the status badge to the README (P4)

**Expected duration: 3–5 minutes**, dominated by `npm ci` over 482 packages — ~2–3 min cold, ~40 s warm via the `cache: npm` key.

> [!WARNING] Do not put `qa:*` in CI
> The QA suites are PowerShell (`scripts/qa.ps1`), drive `opencode run --agent qa` against a local LLM, and need `@playwright/mcp` plus a browser. They cannot run on a hosted runner. Keep them as the local pre-release gate documented in [[Public Beta Release]].

**P0 is a hard prerequisite** — CI cannot go green until the deps, typecheck and test items are done.

### P3.3 — Dependency advisories · 1 h

Licences are clean: 388 packages inspected, all permissive (330 MIT, 21 Apache-2.0, 19 ISC, 6 BlueOak-1.0.0, 3 BSD-3-Clause, and single-digit others). **No GPL/AGPL/LGPL/SSPL/BUSL/Elastic.** MPL-2.0 (`lightningcss`) is file-level copyleft and fine as an unmodified dependency; CC-BY-4.0 is `caniuse-lite`, data with attribution. All compatible with MIT.

- [ ] **Run `npm audit --omit=dev`** — this was not checkable offline and is the one open dependency question
- [ ] Address anything High or Critical; document accepted Moderates
- [ ] `glob@10.5.0` carries a deprecation notice — transitive and dev-only, low priority
- [ ] Review `typescript@^6.0.3` and `vitest@^4.1.7` — both very recent majors
- [ ] Consider adding a scheduled `npm audit` job to CI

### P3.4 — Housekeeping · 1 h

- [x] Delete `Temp_Design-analysis/` — 5 tracked files, of which `artemis-quiver-directions.html` is **2.2 MB** of base64-embedded fonts, the largest file in the repo by 6×. The directory name says "Temp"
- [x] Add `test-results/` to `.gitignore` and untrack `test-results/.last-run.json`, a Playwright run artifact
- [x] Replace the homelab address `192.168.8.171:1234` with `<your-lm-studio-host>:1234` in `AGENTS.md:48`, `CLAUDE.md:69`, `30-Bugs-and-Fixes/_Index.md:387`, `20-APIs/Local LLM Integration.md:85`, `60-Roadmap/Public Beta Release.md:53`
- [ ] Docs pass before the vault ships publicly:
  - [ ] Convert ~300 `file:///F:/Dev/Artemis_Quiver/...` Obsidian absolute links to repo-relative — broken for every reader
  - [ ] Remove `F:\Dev\Artemis_Flow\...` and `F:\Dev\BrainVault\...` references from `90-Meta/Flow-Integration.md` — they name private sibling work by path
  - [ ] Remove the home-town example from `90-Meta/Flow-Integration.md:176`
  - [ ] De-name the "Bruno" attributions in `UI-Restructure-Proposals.md`, `Flow-Integration*.md`, and `src/extension/background.ts:560`

> [!TIP] Ship the vault
> `40-Development/Open Source Quick Wins.md` is the strongest portfolio artifact in the repo — a library survey with bundle budgets, explicit libraries-to-avoid reasoning, and a correct call that browser-only IMAP is impossible. That reads as senior judgement. Publish the vault after the cleanup above, not instead of it.

---

## P4 — README Rewrite · 4–6 h

The current README is competent install documentation. Its actual job is **evidence of engineering judgement**, and it omits all three of the things worth looking at.

### Defects in the current file

- [ ] "React 18" in Tech stack while `package.json` pins `@types/react ^19.2.15` — contradictory on the one page a reviewer definitely reads
- [ ] **Zero screenshots**, despite three unused ones sitting in `src/assets/onboarding/` (`overlay-badge.png`, `overlay-expanded.png`, `popup-add-site.png`). A Chrome extension with no picture of itself is a hard sell
- [ ] No licence section, no `CONTRIBUTING.md`, no `SECURITY.md`, no `.github/` at all
- [ ] `npm run release:ext` and the whole zip-release section are written for an audience of one — a visitor cannot run it, it pushes to a repo they do not own. Move to a maintainer doc
- [ ] No architecture section — nothing on the dual Vite configs, the ISOLATED/MAIN world split, hash routing, or the provider adapter layer

### Proposed outline

1. **Title + one-line description + CI badge + licence badge**
2. **Screenshot first** — the overlay badge on a real job page, above the fold
3. **What it does** — keep the current bullets, they are good
4. **Why it exists** — the honest framing. Built to solve the author's own job search; the Figma Make origin **named here**, on his terms
5. **Install** — extension via Releases; then the web app
6. **How it works** — a short architecture section:
   - Provider adapter layer, four providers, dual-slot primary/secondary routing
   - Local-first data: everything in IndexedDB via Dexie, no backend, no telemetry
   - Extension: runtime content-script registration, ISOLATED vs MAIN world split
7. **⭐ Engineering notes** — the section that earns the visit:
   - **VRAM-aware model ladder with GPU device-loss downgrade.** `WEBLLM_MODELS` is a four-rung ladder ordered by `vramGB`; `vram.ts` probes `requestAdapterInfo()`, classifies integrated vs discrete, estimates available VRAM and applies a 0.8 safety factor. The adapter matches `device lost|device removed|requestDevice|DXGI_ERROR|message port closed|disconnected|no response|timed out`, counts consecutive failures, and **steps down a rung after two**. The non-obvious part is that it treats *a dead service worker* as the same failure class as *a lost GPU device* — both mean "this engine is not coming back in place" — and recovers identically. Say this explicitly; it is the best code in the repo
   - **Least-privilege MV3 permission model.** `permissions` is `["scripting","storage","activeTab","sidePanel"]`; `host_permissions` is **localhost only**; `*://*/*` is `optional_host_permissions`, granted per site at runtime; there are **no static `content_scripts`** — overlays are registered dynamically via `chrome.scripting.registerContentScripts()` and reconciled from `chrome.storage.onChanged`. Most job-tool extensions ask for `<all_urls>` on install. Note that contrast
   - **Defensive LLM output handling** — `extractJsonObject()`'s three-tier fallback: raw parse → fenced block → brace-slice
   - **Typed i18n** — `i18next.d.ts` augments `CustomTypeOptions` so a mistyped translation key fails `tsc --noEmit`
8. **Privacy** — a real section, not a bullet. What stays local, what is sent when a cloud provider is selected, and that the choice is explicit at first run (P1.4)
9. **Development** — scripts table (keep), test/typecheck instructions, project layout
10. **Contributing / Licence / Acknowledgements**

- [ ] Rewrite to the outline above
- [ ] Add the three existing screenshots
- [ ] Add `CONTRIBUTING.md` and `SECURITY.md`
- [ ] Move maintainer-only release instructions out of the README

---

## P5 — Verification Gate · 1–2 h

Run before publication. Extends the existing QA gate in [[Public Beta Release]].

```bash
npm ci                  # from a clean clone, no existing node_modules
npm run typecheck       # must be 0 errors
npm run test            # must be 144/144
npm run build
npm run build:ext
npm audit --omit=dev
```

- [ ] All of the above green **from a fresh clone in a fresh directory** — not the working tree
- [ ] Load `Artemis_Quiver_extension/` unpacked on a **fresh Chrome profile**
- [ ] Walk first-run onboarding as a stranger would: cloud path with a new OpenRouter free key, end to end to a first successful analysis
- [ ] Repeat on the local path on a machine **without** a capable GPU — confirm it fails gracefully and steers to cloud
- [ ] Confirm the side panel renders correctly in **both** light and dark themes
- [ ] Lighthouse/axe accessibility pass on the SPA; record the score
- [ ] Confirm CI is green on a pull request, not just on `main`

---

## Sequencing

```
P0 (3–4 h)  ──►  P3.1 .gitattributes (30 min)  ──►  P1 onboarding (3–4 d)
   │                      │                              │
   │                      └──►  P3.2 CI (2 h) ───────────┤
   │                                                     ▼
   │                                          P1B prompts & output (2–3 d)
   │                                                     │
   └────────────────────────────────────────►  P2 (3–4 d)
                                                         │
                                          P4 README (4–6 h)
                                                         │
                                          P5 gate (1–2 h)
```

**Rationale:** P0 first because CI cannot go green without it. `.gitattributes` immediately after and before any bulk editing, so P1 and P1B do not generate line-ending noise. P1 before P1B because the provider and model-guidance decisions in P1.2 and P1.6 determine what P1B's prompts are being tuned against — there is no point sizing a scoring budget before knowing which models people will actually be pointed at. P4 last among the work items, so the README describes what actually shipped.

**P1B.5 pairs with P2.3** (import-file honesty and a real diff) — service layer and UI layer of the same defect. If P2 slips past publication, pull P2.3 forward and do it with P1B.5.

**Minimum viable publication** — P0 + P3.1 + P3.3 + P0.4's licence decision, roughly **half a day** — produces a repo that builds and is legally clean, but does not fix the first-run experience. **Recommended** is P0 → P3.1 → P1 → P1B → P3.2 → P4 → P5, about **seven to eight days**, which gets a working first run, output that parses on a small model, and an honest README.

**If P1B has to be cut down**, the order within it by value-per-hour is **P1B.1 (structured output) → P1B.3 (`num_ctx`) → P1B.5 (merge) → P1B.2 → P1B.6 → P1B.4**. P1B.1 alone removes the largest single cause of failed generations and deletes the worked example in the same change. P1B.4 is the most work and the least urgent, because the extension's scoring path already works.

P2 can follow publication if needed, though the accessibility work (P2.1) is the item most likely to be noticed by exactly the audience this is aimed at.

---

## Related

- [[../../../dispatch/15-quiver-prompt-review|dispatch/15 — Quiver prompt review]] — prompt inventory with token counts, output-handling analysis, and the source of P1B and P1.6
- [[Public Beta Release]] — extension distribution; § Open Questions is answered by P1
- [[Plan|Development Plan & Backlog]] — Sprint 9c/9d overlap with P0.2 and P1
- [[../20-APIs/Local LLM Integration|LLM Integration]] — provider architecture context for P1
- [[../40-Development/WebLLM Stability and Service Worker|WebLLM Stability]] — the ladder and device-loss design featured in P4
- [[../30-Features/Error Handling & Error Codes|Error Handling & Error Codes]] — `AppError` / `userMessage`, relevant to P1.3 and P2.2
- [[UI-Restructure-Proposals|UI Restructure Proposals]] — overlapping UI concerns, not in scope here
- [[../90-Meta/CHANGELOG|CHANGELOG]]
