---
tags: [meta, changelog, history]
status: completed
last_updated: 2026-06-13
---

# Changelog

## [v3.2.0] - June 10, 2026

**Strategic shift:** Local-first. Removed desktop app plans. Extension as primary delivery.

### Sprint 9b — WebLLM Direct Download (High Priority)
Prioritizing direct model download via WebLLM. Users pick model from catalog, one-click download + load via WebLLM. Privacy-first: all inference in-browser.

### Sprint 9a — Code Revision & Cleanup
- Extracted `InlineEdit` shared component (-158 lines duplicate code)
- Reverted Overlay ES module imports (MV3 content scripts can't use them)
- `.fallowrc.json` for proper entry points
- Replaced 6 `as any` in renderingEngine with type-safe `findSection<T>()`
- Typed `ExtensionBridgeContext` and `ErrorLogContext` message payloads
- Bug fixes: sidebar session click race, pending import ID tracking, LinkedIn PDF export, PDF header layout, export PDF second-click

## [v3.1.0] - June 5, 2026

- `clParser` cognitive complexity: 109→split into 7 helpers
- Extracted `shared.ts` for provider adapter utilities (-60 duplicated lines)
- Extracted `BuilderAssistantPanel`, `BuilderErrorDisplay`, `ThemeConfigPanel` (-100 duplicated lines)
- Removed unused `usePrintHandler.ts`, legacy localStorage migration code, 12 unused prompt functions

## [v3.0.0] - June 4, 2026

- Multi-provider LLM: `ProviderAdapter` interface (OpenAI-compatible, Anthropic, Google Gemini)
- Dual model slots (primary + secondary) with secondary routing strategies
- Config UI revamp with provider selector, API key, model list, temperature per slot
- Chrome Extension (MV3): one-click job import from any page, LinkedIn smart extraction
- Hash routing for extension compatibility
- IndexedDB migration via Dexie.js with one-shot localStorage → IndexedDB migration + self-healing

## [v2.8.0] - June 3, 2026

- Live theme application to interactive previews (Modern, Classic, Minimal)
- Skills category editing with drag-reorder
- CV Builder chat input matching CLBuilder pattern
- PDF export race condition fix (iframe onLoad + printPendingRef)

## [v2.7.0] - May 29, 2026

- CL Builder overhaul: structured JSON schema (CLContent) matching CV Builder pattern
- InteractiveCLPreview with inline editing on every field
- Themed HTML/PDF export for CL (3 themes)
- Retry with corrective feedback (up to 3 attempts)
- Copy plain text for application forms

## [v2.6.0] - May 29, 2026

- Centralized error code system: `ErrorCodes` + `ERROR_CATALOG` replacing ad-hoc enum
- All services throw `AppError` with domain-specific codes
- Structured logging (`errorLogger.ts`)
- Retry buttons on retryable errors

## [v2.5.0] - May 29, 2026

- CV retry with corrective feedback (up to 3 attempts on parse/schema errors)
- Interactive CV preview with inline click-to-edit

## [v2.4.0] - May 29, 2026

- Interactive CV Preview replacing static iframe
- Enhanced CV schema: name/title/location, bullets, categories
- Professional themes with print CSS
- Prompt updates for v3 schema

## [v2.3.0] - May 28, 2026

- Follow-up Chat on Analysis Hub with persistent history per session
- Quick-action suggestion pills (5 scenarios)
- 3 new tests for follow-up chat

## [v2.2.0] - May 28, 2026

- Centralized `prompts.ts` with 10 optimization modes + intent classifier
- `optimizeCv()` public API for targeted optimizations
- 5 new cvBuilderService tests

## [v2.1.0] - May 28, 2026

- Collapsible prompt view, two CV Optimization buttons, auto-generate handoff
- 46 tests across 8 files (vitest), strict TypeScript
- Bug fixes: session sync, dark theme, CSS escaping, missing break, PDF printing

## [v2.0.0] - May 28, 2026

- Structured JSON output with Zod validation
- Themed HTML rendering (Modern, Classic, Minimal)
- PDF export via hidden iframe printing
- XSS protection via content escaping

## [v1.0.0] - Original

Plain Markdown generation via chat completion, exported as `.md` via blob URLs.
