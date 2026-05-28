---
tags: [development, guidelines]
status: completed
last_updated: 2026-05-28
---

# 📖 Operational Guidelines

These guidelines set operational boundaries and quality controls for developers and AI coding agents working on Artemis Quiver.

---

## 🏗️ Architectural Guardrails

- **Client-Side Operations**: The application operates completely client-side. Do not introduce remote server databases (like MongoDB, PostgreSQL) or external authentication layers (like Firebase Auth, Auth0) unless explicitly instructed by the user.
- **State Flow Compliance**: Always route profile and config operations through the context provider chain. Avoid writing ad-hoc local storage calls directly inside views; use `useWorkspace()`, `useConfig()`, and `useProfile()`.

---

## 🎨 UI & Design Principles

Artemis Quiver is styled using **Tailwind CSS** and **shadcn/ui** components. Follow these specifications:

- **Theme Compliance**: Ensure all custom components read theme tokens from Tailwind and support both Light and Dark modes. Utilize the `theme.ts` utility for runtime class updates.
- **Layout Integrity**: Opt for responsive layouts using Flexbox and Grid. Keep components focused, modular, and nested neatly.
- **Button Standards**:
  - *Primary Button*: Use for key actions (e.g., Run Analysis, Generate CV). Filled with the primary brand color.
  - *Secondary Button*: Use for helper options (e.g., Export .md, Import file). Outlined with clear borders.
  - *Tertiary/Ghost Button*: Use for soft interactions (e.g., Clear current, Dismiss onboarding).

---

## ⚡ Performance & Safety Limits

- **Memory Constraints**: The multi-profile manager restricts the browser database to a maximum of **3 profiles**. Keep profile storage payloads small by capping analysis session arrays to 50 entries.
- **Timeout Management**: Long-running LLM API queries must use the `AbortController` and respect the 120-second timeout ceiling to prevent lockups.
- **Hallucination Prevention**: Prompts must explicitly instruct models to remain factual, drawing only from candidate profile details.
