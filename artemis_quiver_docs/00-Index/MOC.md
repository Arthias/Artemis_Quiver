---
tags: [index, MOC]
status: completed
last_updated: 2026-05-28
---
---

# 🏹 Artemis Quiver — Map of Content (MOC)

Welcome to the internal documentation vault for **Artemis Quiver** — a job hunting automation engine. This vault is organized using Obsidian to enable fast onboarding, clear architectural understanding, and seamless API / test reference tracking.

> [!TIP]
> Use `Ctrl+Click` (or `Cmd+Click`) on any internal link (e.g. `[[Note Name]]`) to navigate directly to it within Obsidian. Press `Ctrl+O` to search all notes.

---

## 🗺️ Documentation Map

### 🏛️ 1. Architecture & State Flow
Detailed guides on how the application components, providers, and local persistence interact.
- [[30-Bugs-and-Fixes|🐛 Bug Fixes Log]] — Check this **first** before fixing any issues or implementing changes.
- [[10-Architecture/Component Tree|React Route & Component Hierarchy]] — How pages and subcomponents are mapped.
- [[10-Architecture/Context Providers|Context Providers & State Management]] — Manifests, active sessions, and builder handoffs.
- [[10-Architecture/Local Storage|Local Storage & Eviction (LRU)]] — Data schemas and profile rotation rules.

### 🔌 2. APIs & LLM Connectors
How Artemis Quiver connects to local models and structured prompts.
- [[20-APIs/Local LLM Integration|Local LLM Setup & Proxies]] — Connectors for LMStudio and Ollama.
- [[20-APIs/AI Prompt Templates|Prompt Engineering Specs]] — Prompts for analysis, merges, CV, and Cover Letters.

### ✨ 3. Core Features
Deep dives into the functional areas of the application.
- [[30-Features/Analysis Hub|Analysis Hub]] — Parsing job descriptions and returning scoring.
- [[30-Features/Profile Workspace|Profile Workspace]] — Workspace profile lifecycle and import merges.
- [[30-Features/Document Builders|CV & Cover Letter Builders]] — Refinement chats and Markdown outputs.

### 🛠️ 4. Development & Coding Guidelines
Conventions, tool setups, and credits.
- [[40-Development/Coding Standards|Coding Standards]] — Tech stack rules, Tailwind theme, and code patterns.
- [[40-Development/Guidelines|System Guidelines]] — Operational guardrails for developing Artemis Quiver.
- [[40-Development/Attributions|Attributions]] — Libraries, design resources, and open-source credits.

### 🧪 5. Testing & Validation
Use cases and test plans.
- [[50-Testing/Test Cases|QA Scenarios & Test Cases]] — Step-by-step manual and automated test pathways.

### 📅 6. Project Roadmap & Backlog
Tracking sprint progress and deferred work.
- [[60-Roadmap/Plan|Development Plan & Backlog]] — Sprint progress status and future features (formerly `PLAN.md`).

---

## 🎨 Visual Architecture Map
Open [[Architecture Map.canvas]] to view a visual flowchart connecting layout pages, contexts, and background services in a unified spatial whiteboard.
