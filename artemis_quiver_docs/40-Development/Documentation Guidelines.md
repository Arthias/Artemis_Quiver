---
tags: [development, guidelines, documentation]
status: completed
last_updated: 2026-05-28
---

# Documentation Guidelines

Standards and best practices for maintaining the Artemis Quiver docs vault.

---

## Structure & Naming

### Folder Numbering
- `00-Index/` — Map of Content and top-level navigation
- `10-Architecture/` — Code architecture, state flow, storage
- `20-APIs/` — LLM connectors, prompt templates
- `30-Features/` — Feature documentation
- `30-Bugs-and-Fixes/` — Bug resolution log
- `40-Development/` — Dev guidelines, coding standards
- `50-Testing/` — Test plans and QA scenarios
- `60-Roadmap/` — Sprint planning and backlog
- `90-Meta/` — Changelogs, implementation summaries

### File Naming
- Use **Title Case with Spaces**: `Context Providers.md`, `AI Prompt Templates.md`
- Avoid underscores, snake_case, or ALL_CAPS in filenames
- Navigation via `00-Index/MOC.md` (single source of truth, no per-folder index files)

### File Placement
- Every file belongs inside a numbered folder — no orphan files at the vault root
- Bug fixes go in `30-Bugs-and-Fixes/_Index.md`
- Changelogs and implementation notes go in `90-Meta/`

---

## YAML Frontmatter

Every `.md` file MUST have frontmatter with these fields:

```yaml
---
tags: [tag1, tag2]
status: completed       # or: draft, in-progress
last_updated: 2026-05-28
---
```

- `tags` — At least one tag for discoverability
- `status` — `completed`, `in-progress`, `draft`
- `last_updated` — Date in YYYY-MM-DD format
- Frontmatter must be properly closed with `---`

---

## Links

- Use **wiki links** `[[Target]]` for Obsidian compatibility
- Use relative paths from the file's location (e.g. `[[../10-Architecture/Context Providers]]`)
- Do NOT use URL-encoded spaces (`%20`) in wiki links — use real spaces
- Dead links must be removed or fixed immediately
- Prefer wiki links over Markdown links for internal vault references

---

## Content Conventions

- Use `# Title` (H1) for page title, then `## Section` (H2) for major sections
- Use callouts (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`) for emphasis
- Use fenced code blocks with language tags for all code examples
- Keep lines under 100 characters where practical
- Use Mermaid or ASCII diagrams for architecture flows

---

## Bug Fix Log Format

Each bug entry in `30-Bugs-and-Fixes/_Index.md` should follow this format:

```markdown
### Issue #N: Short title

**Error Message:**
```
...
```

**Root Cause:** Brief explanation.

**Fix Applied:** What was done, with before/after code if relevant.

**Location:** `path/file.ts:line`
```

---

## Changelog Format

Entries in `90-Meta/CHANGELOG.md` use semantic versioning with this structure:

```markdown
## [vX.Y.Z] - YYYY-MM-DD

### ✨ Features Added
### 🐛 Bug Fixes
### 📁 Files Created / Modified
### 🔧 Breaking Changes
```

---

## When Adding New Documentation

1. Place file in appropriate numbered folder
2. Add YAML frontmatter with `tags`, `status`, `last_updated`
3. Add wiki link in `00-Index/MOC.md`
4. Use Title Case with Spaces naming
5. Check for broken links before committing
6. Update `last_updated` in existing docs when modifying
