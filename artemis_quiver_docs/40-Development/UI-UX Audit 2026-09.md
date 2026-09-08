---
tags: [ui, ux, design, accessibility, responsive, audit]
status: planning
last_updated: 2026-09-08
---

# UI/UX Audit — 2026-09

Visual walkthrough of the web app via Playwright (desktop 1440px, tablet 768px, phone 390px,
and a dark-mode check), driven by a real onboarding + analysis flow against a local Ollama
model. Goal: find concrete bugs and inconsistencies before deciding on a broader visual
rework. Not a redesign proposal — that's a separate decision once these are triaged.

## Findings

### 1. Sidebar doesn't collapse below ~700px — [[Sidebar.tsx]]:75 (Medium-High)

`<aside className="w-72 ...">` is a fixed 288px width with no responsive variant and no
mobile drawer/hamburger pattern. `RootLayout.tsx` gives the sidebar a fixed slot and the
`<main>` the remaining `flex-1` space, so below ~700px window width the content column gets
squeezed hard; at 390px wide it's reduced to ~100px and text wraps one character per line
(see `hub-mobile.png`). Tablet width (768px) is fine; the failure is specifically narrow
desktop windows, split-screen/tiled layouts, and small Chromebook-class screens.

**Context**: this is a Chrome extension's companion web app, so true phone usage isn't
realistic — but a narrowed or tiled browser window is. Worth fixing (a standard
collapsible-sidebar-behind-a-toggle pattern below `md:`), but it's a "make it robust" fix,
not "the app is broken for most users."

### 2. Onboarding logo clipped off-screen on short/narrow viewports (Medium)

The `AQ` logo mark at the top of the onboarding wizard renders partially above the visible
viewport on a 390×812 screen, and there's no way to scroll up to see it — the scrollable
area's top bound already excludes it (see `onboarding-1-mobile.png`). Looks like a
vertically-centered flex/transform container that doesn't account for content taller than
viewport. First-run bug, so it's the first thing a new mobile-width user would see.

### 3. Model suggestion chips are wrong for 3 of 4 providers — [[Config.tsx]]:891-899 (Medium)

`COMMON_MODELS` is a hardcoded list of Ollama-tag-style names (`llama3.2:3b`,
`deepseek-r1:7b`, ...) shown as quick-pick chips under **both** Primary and Secondary model
fields, for **any** non-WebLLM provider — OpenRouter, OpenAI, Anthropic, Gemini, and
self-hosted alike. These tags aren't valid model IDs for OpenRouter/OpenAI/Anthropic/Gemini,
only for a local Ollama-style server. Worse, they're redundant now that a live "list models"
button (fetches the real catalog from whatever endpoint is configured) sits right next to
the field. Recommend either gating the chips to only the local/self-hosted case, or dropping
them in favor of the live fetch.

### 4. Cloud/Local segmented toggle uses emoji icons (Low)

The ☁️/💻 emoji in the onboarding and Settings provider toggle render inconsistently across
platforms (tiny/clipped in this Chromium build — see `onboarding-2-desktop.png`). The rest
of the nav already uses `lucide-react` icons consistently; swapping these two for
lucide equivalents (`Cloud`, `Laptop` or similar) would fix the rendering and match the rest
of the icon language.

### 5. Large empty-state placeholders feel dated (Low, design-taste)

The Job Posting textarea on Analysis Hub renders at a large fixed min-height regardless of
content, and empty states ("No analyses yet", empty textarea) are plain text/gray boxes with
no icon or illustration. Not a bug, but it's the biggest contributor to the "conceptualized a
while ago" feeling — a SaaS-dashboard template look rather than something considered. Same
pattern shows up on Cover Letter Builder's empty state.

### 6. Missing favicon (Low)

`favicon.ico` 404s on every page load. Trivial, but visible in devtools on a public product.

### 7. Sidebar separator bled past the sidebar edge — [[Sidebar.tsx]]:118 (Fixed 2026-09-08)

Reported directly by a user screenshot: the horizontal rule between the nav list and
"Recent Analyses" extended well past the sidebar's right border into the main content area.
Root cause: `<Separator className="mx-3" />` combines `width: 100%` (resolves against the
`<aside>`'s content box) with a 12px margin on each side — percentage widths and margins
aren't netted against each other in CSS, so the margin necessarily pushes the element past
its container. Fixed by moving to padding on a wrapping div instead of margin on the
separator (`<div className="px-3"><Separator /></div>`), the standard pattern for this
component. No other `<Separator className="m...">` usages found elsewhere in the codebase.

## What's already solid — keep

- **Dark mode** works well: good contrast, no broken components, respects
  `prefers-color-scheme` by default with a manual override in Settings. No rework needed.
- Settings page structure (collapsible Primary/Secondary Model sections, tabbed AI
  Model/General/Extension/Flow) is clear and scales reasonably well down to tablet width.
- The Job Analysis result screen (score ring, tips, CV suggestions, cover letter draft) reads
  well and is the strongest screen in the app visually — see the README screenshots.

## Not investigated this pass

CV Builder / Cover Letter Builder page at narrow widths, the extension's side panel and
popup (separate bundle, likely needs its own narrow-width check since it's a genuinely
narrow surface by design), and a full accessibility pass (contrast ratios, focus order,
screen-reader labels).

## Next step

This list is bug-fix-sized, not a redesign. A broader "modernize the visual language" pass
(typography scale, spacing system, color palette, empty-state illustrations) is a separate,
bigger decision — worth agreeing on direction (incremental polish vs. a deeper pass) before
starting, since it touches every page.
