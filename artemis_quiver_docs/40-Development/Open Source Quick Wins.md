# Open Source Library Survey — Quick Wins

Survey of well-maintained open source libraries for the next phases of development.
Focus: 2025-2026, React 18, TypeScript strict, minimal bundle overhead.

## Project Context

| Metric | Value |
|--------|-------|
| Stack | React 18, Vite 6, Tailwind v4, shadcn/ui, React Router v7, Dexie.js |
| Tests | 124 (vitest), service-level only — no component tests |
| Bundle | 340KB main app + 230KB react-vendor + 96KB dexie + 6MB web-llm runtime |
| TypeScript | `strict` with `noUncheckedIndexedAccess` |
| Licensing | MIT-only additions preferred |

## Tier 2 — Next Sprint

### Rich Markdown Editing (Profile Page)

**Library:** `@uiw/react-md-editor` v4.1.1
**Bundle:** ~20KB gzipped
**Status:** Recommended

Problems solved:
- Profile page uses a plain `<textarea>` with no toolbar, no live preview
- No Markdown syntax highlighting while editing
- No way to insert formatting without knowing Markdown syntax

Migration: Drop-in replacement for the current textarea. Provides toolbar, split-pane live preview, dark mode, i18n. Based on textarea (not CodeMirror/Monaco), so it stays lightweight.

```
npm install @uiw/react-md-editor
```

Replace `<textarea value={profile} onChange={...} />` with:
```tsx
import MDEditor from "@uiw/react-md-editor";
<MDEditor value={profile} onChange={setProfile} />
```

### Drag & Drop Kanban (Sprint 10)

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable` v6.3.1
**Bundle:** ~15KB gzipped
**Status:** Recommended

Problems solved:
- Sprint 10 requires a Kanban board with drag-drop across columns
- `react-beautiful-dnd` is deprecated (archived by Atlassian)
- `react-dnd` is heavier, boilerplate-heavy

`@dnd-kit` is modern, accessible, and maintained. `@dnd-kit/sortable` is purpose-built for Kanban columns. React 18 compatible, TS types included.

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Form Validation (Builders)

**Library:** `react-hook-form` v7.83.0 + `@hookform/resolvers` + Zod
**Bundle:** ~10KB (react-hook-form) + negligible resolvers
**Status:** Recommended

Problems solved:
- All forms use manual `useState` + ad-hoc validation
- Zod schemas already exist for CV, CL, and configuration — unused for form validation
- No dirty tracking, no error state management, no wizard persistence

The Zod integration (`@hookform/resolvers/zod`) lets existing schemas drive validation directly.

```bash
npm install react-hook-form @hookform/resolvers
```

Pattern:
```tsx
const { register, handleSubmit, formState: { errors } } = useForm<CLContent>({
  resolver: zodResolver(CLContentSchema)
});
```

### API Mocking for Tests

**Library:** `msw` (Mock Service Worker) v2.15.0
**Bundle:** Dev only
**Status:** Recommended

Problems solved:
- All 124 tests mock LLM calls via `vi.mock("../llmService")` at the module level
- Module-level mocking is fragile — changes to import paths break tests silently
- No way to reuse mock handlers across test + dev environment

MSW intercepts at the network level. Handlers are portable (vitest + browser dev). Eliminates the need for `vi.mock` on service modules.

```bash
npm install --save-dev msw
```

```typescript
// handlers.ts
export const handlers = [
  http.post("*/v1/chat/completions", () => HttpResponse.json({ choices: [{ message: { content: "..." } }] })),
];

// setup: vitest.config.ts → setupFiles
// dev: public/mockServiceWorker.js → npx msw init
```

### Component Tests

**Library:** `@testing-library/react` v16 + `@testing-library/user-event` v14
**Bundle:** Dev only
**Status:** Recommended

Problems solved:
- Zero component tests — all 124 tests are service/logic level
- UI regressions invisible to CI (broken buttons, missing handlers, layout errors)

Add `@testing-library/react` for rendering components + `user-event` for realistic interactions.

```bash
npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Update `vitest.config.ts`:
```typescript
setupFiles: ["./src/test-setup.ts"],
```

## Tier 3 — Roadmap

### Proper PDF Export

**Library:** `@react-pdf/renderer` v4.5.1
**Bundle:** ~100KB
**Status:** Consider (medium effort, high gain)

Problems solved:
- Current PDF uses hidden iframe + `window.print()` hack
- PDF output and interactive preview use completely separate rendering pipelines
- Visual alignment drifts over time (documented in bug log)

Migration requires rewriting CV/CL components to use `@react-pdf/primitives` (`Document`, `Page`, `Text`, `View`). Not a drop-in replacement — the rendering engine would need a parallel PDF component tree.

Strategy: Keep existing iframe for now. Migrate if visual divergence bugs keep recurring.

```bash
npm install @react-pdf/renderer
```

### State Management for High-Churn State

**Library:** `zustand` v5.0.14
**Bundle:** ~1KB, 0 dependencies
**Status:** Consider (incremental migration)

Problems solved:
- 5 React Context providers with complex state
- Context causes unnecessary re-renders on unrelated state changes
- State not accessible outside React (useful for extension bridge, error logging)

Recommendation: Use Zustand for *new* state (Kanban board, builder wizard, UI preferences). Don't refactor existing Context unless they become performance bottlenecks.

```bash
npm install zustand
```

Pattern:
```typescript
import { create } from "zustand";
const useBuilderStore = create<BuilderStore>((set) => ({
  step: "input",
  setStep: (step) => set({ step }),
}));
```

### Virtual Scrolling

**Library:** `@tanstack/react-virtual` v3.14.8
**Bundle:** ~5KB
**Status:** Consider (if needed)

Problems solved:
- 50-session limit in AnalysisHub is hardcoded
- If limit is raised, rendering 500+ session items in the sidebar causes DOM bloat

Not urgent — only implement if session lists grow beyond 500+ items.

```bash
npm install @tanstack/react-virtual
```

### Match Score Charts

**Library:** `recharts` v3.10.1
**Bundle:** ~150KB (includes D3 dependency)
**Status:** Not recommended yet

The current SVG circle indicator works well. Recharts only makes sense if multi-dimensional scoring is added (radar chart for skill match, bar for per-section scores). 150KB is significant for a minor visual upgrade.

### Email Integration (Sprint 10 bonus)

**Status:** Cannot be done browser-only

Browser JavaScript cannot open raw TCP connections — IMAP is a TCP-level protocol. True browser IMAP requires a backend proxy (Node/Deno). Options:

1. Write a thin Node server that exposes REST endpoints for IMAP ops
2. Use a service like Mailgun/Postmark API (not local-first)
3. Skip IMAP entirely — manual status updates only

Recommendation: Document as a "requires backend" item for Sprint 10. Do not attempt browser-only IMAP.

## Libraries to Avoid

| Library | Issue |
|---------|-------|
| `react-beautiful-dnd` | Deprecated, archived by Atlassian |
| `Monaco editor` | 2MB+ for a markdown textarea — overkill. Stick with `@uiw/react-md-editor` |
| `emailjs-imap-client` | Unmaintained since 2019. Browser-incompatible (needs TCP socket shim) |
| `react-pdf` | Viewer only, not a generator. Confusing name with `@react-pdf/renderer` |
| `highlight.js` | Heavy auto-detection. Use Prism.js if needed |

## Bundle Impact Summary

| Tier | Libraries | Total Gzip |
|------|-----------|------------|
| T1 (done) | sonner + react-error-boundary | ~6KB |
| T2 | @uiw/react-md-editor + @dnd-kit + react-hook-form + msw + @testing-library/react | ~45KB (all dev except md-editor) |
| T3 | @react-pdf/renderer + zustand + @tanstack/react-virtual + recharts | ~256KB (pick selectively) |

## Current Gap: Missing Libraries

| Category | Currently Using | Gap |
|----------|----------------|-----|
| Toast notifications | ❌ None | ✅ Added `sonner` (T1) |
| Error boundaries | ❌ None | ✅ Added `react-error-boundary` (T1) |
| Bundle splitting | ❌ None | ✅ Added `manualChunks` + `React.lazy` (T1) |
| Date formatting | ❌ None | Still gap — consider `date-fns` if date formatting grows |
| UUID generation | `crypto.randomUUID()` | Works everywhere modern. No library needed. |
| Markdown rendering | `react-markdown` + `remark-gfm` | Already covered |
| Schema validation | `zod` | Already covered |
| Rich text editing | ❌ None | T2 candidate (`@uiw/react-md-editor`) |
| Drag & drop | ❌ None | T2 candidate (`@dnd-kit`) |
| Form management | ❌ None | T2 candidate (`react-hook-form`) |
| API test mocking | ❌ None | T2 candidate (`msw`) |
| Component tests | ❌ None | T2 candidate (`@testing-library/react`) |
| PDF generation | hidden iframe print hack | T3 candidate (`@react-pdf/renderer`) |
| State management | React Context (5 providers) | T3 candidate (`zustand`, incremental) |
| Virtual scroll | ❌ None | T3 if needed |
| Charts | inline SVG circles | T3 if multi-dim scoring added |
