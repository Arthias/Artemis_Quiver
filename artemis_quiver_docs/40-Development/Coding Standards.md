---
tags: [development, code-style, standards]
status: completed
last_updated: 2026-05-28
---

# 🛠️ Coding Standards & Structure Conventions

This document guides TypeScript, React, and CSS standards for extending Artemis Quiver. Following these standards keeps the codebase clean, legible, and easy for AI agents and human developers to collaborate on.

---

## 🗂️ Codebase Folder Structure

Structure new files according to the established architecture in `src/app/`:

```text
src/app/
├── components/
│   ├── layouts/       # Site outline layouts (e.g., RootLayout)
│   ├── navigation/    # Navigation bars, headers, Sidebars
│   ├── ui/            # shadcn/ui primitive design blocks
│   └── workspace/     # Workspace-specific components (e.g., ProfileSwitcher)
├── config/            # Default settings and state initializers
├── context/           # React context provider files (state management)
├── pages/             # Route-level page components
├── providers/         # Global provider bootstrap (AppProviders)
├── services/          # Pure modules for API calls and prompting
├── types/             # Explicit TypeScript interface declarations
└── utils/             # Helper functions (localStorage, time formatting, downloads)
```

---

## TypeScript & React Best Practices

- **Strict Typing**: Avoid the `any` type. Use explicit types, interfaces, or type assertions.
- **Functional Components**: Build views as functional components using the `export function ComponentName()` syntax.
- **Hook Placement**: Declare hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) at the very top of components. Memoize intensive computations or event callback functions.
- **Decoupled API Logic**: Never make direct `fetch` API requests inside page components. Place network and LLM prompts inside `src/app/services/` and import them.

---

## 🎨 Styling & Component Rules

Artemis Quiver uses **Tailwind CSS** layered on CSS variables for styling.

- **Tailwind Utilities**: Apply Tailwind utility classes for structural and spacing configurations (Flexbox, Grid, Padding/Margin).
- **CSS Variables**: Color tokens should refer to shadcn's theme variables (e.g. `bg-background`, `text-foreground`, `border-border`) so that Light and Dark mode styles match automatically.
- **Accessibility**: Ensure form fields, buttons, and selects include description tags and conform to standard keyboard navigation patterns.
- **Icon Packages**: Use `lucide-react` for standard UI symbols and icons.

---

## 🔬 Static Analysis — Fallow

[Fallow](https://docs.fallow.tools/quickstart) is the project's static analysis tool for catching dead code, duplication, and complexity issues before they compound. Run it as part of every feature implementation workflow.

### When to run

| Phase | Command | Purpose |
|---|---|---|
| Before writing code | `npx fallow` | Baseline — know the current state |
| After implementation | `npx fallow dead-code` | Check no unused files/exports/deps were left behind |
| Before commit | `npx fallow dupes` | Catch accidental copy-paste duplication |
| During refactors | `npx fallow health` | Identify complexity regressions |
| Periodic cleanup | `npx fallow fix --dry-run` | Preview automatic cleanup candidates |

### Expected quality gates

- **0 unused files** — every file should be reachable from an entry point
- **0 unused dependencies** — `npm ls` should match actual imports
- **0 unresolved imports** — all import paths must resolve
- **Maintainability Index ≥85** (good) — if new code drops MI below 85, refactor before merging
- **Clone groups ≤0** for new code — extract shared logic into functions/components rather than duplicating

### Workflow integration

1. **Before starting a feature**, run `npx fallow` and save the baseline output.
2. **During development**, use `npx fallow dead-code` after adding exports to confirm they're consumed, and `npx fallow dupes` periodically to catch accidental clones.
3. **After completing**, verify no regressions: `npx fallow` metrics should be at least as good as the baseline (fewer dead files/exports, same or better MI).
4. **For refactoring targets** surfaced by `npx fallow health` — prioritize by the `pri` score (higher = better ROI). Low-effort items (e.g., removing dead exports) should be cleaned immediately; high-effort items (e.g., extracting large functions) should be scheduled into the next sprint.
5. **Suppress false positives** sparingly with `// fallow-ignore-next-line <rule>` — prefer fixing the underlying issue. If suppressing, add a brief comment explaining why.

### Config

Fallow auto-detects project structure. No config file is required. When customization is needed (e.g., custom entry points or rule severity), create `.fallowrc.json` in the project root:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/fallow-rs/fallow/main/schema.json",
  "entry": ["src/app/*.tsx", "src/app/services/*.ts"],
  "ignorePatterns": ["**/*.generated.ts", "**/__tests__/**"],
  "rules": {
    "unused-files": "error",
    "unused-exports": "warn",
    "unused-types": "off"
  }
}
```

The `.fallow/` directory and `cache.bin` / `churn.bin` are gitignored automatically.
