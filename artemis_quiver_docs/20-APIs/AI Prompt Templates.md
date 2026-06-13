---
tags: [api, llm, prompt-engineering]
status: completed
last_updated: 2026-06-13
---

# AI Prompt Templates & System Rules

Reference spec for system prompts. Source of truth in code (`src/app/services/prompts.ts` and per-service files). This doc catalogues modes and intent classification.

## Services & Prompt Files

| Service | File | Prompts |
|---------|------|---------|
| Job Analysis | `jobAnalysisService.ts` | `ANALYSIS_SYSTEM_PROMPT`, `FOLLOWUP_SYSTEM_PROMPT` |
| Profile Merge | `profileMergeService.ts` | Merge instructions |
| Profile Chat | `profileChatService.ts` | Assistant instructions |
| CV Builder | `cvBuilderService.ts` + `prompts.ts` | 10 optimization modes + edit prompt |
| CL Builder | `clBuilderService.ts` | Generation + edit prompts |

## CV Optimization Modes (prompts.ts)

| Mode | Type | Purpose |
|------|------|---------|
| `standard` | JSON | Full CV generation from profile |
| `summary-rewrite` | Text | Rewrite summary for role alignment |
| `bullet-optimize` | Text | Convert bullets to metrics/action verbs |
| `ats-optimize` | JSON | Keyword-optimize for ATS screening |
| `career-transition` | JSON | Reframe for field change |
| `audit` | Text | Critique vague/wordy areas |
| `work-history-align` | Text | Align language with target role |
| `skills-section` | Text | Categorize and prioritize skills |
| `headline` | Text | Generate value-prop headline |
| `hiring-manager` | Text | Roleplay critical feedback |

## Intent Classification

`classifyEditIntent()` in `prompts.ts` auto-detects mode from free-text via regex:

| Keywords | Mode |
|----------|------|
| `summary`, `rewrite`, `improve`, `polish` | `summary-rewrite` |
| `bullet`, `accomplishment`, `metric`, `action verb`, `star` | `bullet-optimize` |
| `ats`, `keyword`, `applicant tracking`, `screen` | `ats-optimize` |
| `career change`, `transition`, `transferable`, `switching` | `career-transition` |
| `audit`, `review`, `critique`, `vague`, `wordy` | `audit` |
| `align`/`tailor` + `job`/`role` | `work-history-align` |
| `skill`, `technical skill`, `tools section` | `skills-section` |
| `headline`, `tagline`, `value proposition`, `branding` | `headline` |
| `hiring manager`, `would you hire`, `interview` | `hiring-manager` |

## Common Prompt Rules

- All analysis prompts enforce: factual only, no invented skills/experience
- JSON-producing prompts require: single JSON object, no markdown fences, no extra text
- Follow-up prompts receive full conversation history + profile + job posting context
- Anti-cliché rules in CV prompts: avoid "results-driven", "team player", "go-getter"
