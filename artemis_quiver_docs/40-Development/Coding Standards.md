---
tags: [development, code-style, standards]
status: completed
last_updated: 2026-05-22
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
