---
tags: [index, bugfixes, issues, resolved]
status: completed
last_updated: 2026-05-28
---

# 🐛 Bugs & Fixes — Resolution Log

All bugs discovered and fixed in Artemis Quiver.

> [!TIP] Usage
> Always check this page **before** implementing fixes to avoid duplicate work or missing context.

## 2026-05-28: trim() Safety Issues (Commit: 2c97a87)

### Issue #1: Analysis Hub → CV Builder "Implement" button failed with LLM error (400)

**Error Message:**
```json
LLM request failed (400): {"error":"'messages' array must only contain objects with a 'role' field that is in [user, assistant, system, tool]. Got 'format'."}
```

**Root Cause:** Invalid role `"format"` used in chat messages instead of `"system"`.

**Status:** ✅ **ALREADY FIXED** in HEAD codebase - analysis showed HEAD version already had correct `role: "user"` usage.

---

### Issue #2: CV Builder "Generate CV" threw TypeError

**Error Message:**
```javascript
jobDescription?.trim is not a function
```

**Root Cause:** Unsafe optional chaining followed by `.trim()` throws when value is `undefined`, not just non-string.

**Fix Applied:**
```typescript
// Before ❌
const jobPart = jobDescription?.trim()
  ? `\n\n## Target job\n\n${jobDescription}`
  : "\n\n(No specific job — general CV from profile.)";

// After ✅ - Type-safe string validation
const jobPart = typeof jobDescription === "string" && jobDescription.trim().length > 0
  ? `\n\n## Target job\n\n${jobDescription}`
  : "\n\n(No specific job — general CV from profile.)";
```

**Location:** `src/app/services/cvBuilderService.ts` line 17

---

### Issue #3: Cover Letter Builder threw TypeError (4 instances)

Same issue across all 4 input parameters in CL generation:
- companyName  
- position  
- jobDescription  
- seedDraft

**Fix Applied to All:**
```typescript
// Before ❌ - Unsafe pattern
const company = options.companyName?.trim() || "the company";
// ... similar for role, jobPart, seedPart

// After ✅ - Type-safe pattern
const company = typeof options.companyName === "string" && options.companyName.trim() 
  ? options.companyName.trim() : "the company";
// ... same pattern applied to all 4 parameters
```

**Location:** `src/app/services/clBuilderService.ts` lines 18-23

---

## Pattern Applied

All fixes prevent `TypeError: xxx?.trim is not a function` by explicitly checking:
1. The value is actually a string, AND  
2. Has non-zero trimmed length

---

## 2026-05-28: CV Builder JS Runtime & Import Resolution Fixes

### Issue #4: Vite import resolution failed — `../types/cv` resolved to directory, not file

**Error Message:**
```
[plugin:vite:import-analysis] Failed to resolve import "../types/cv" from "src/app/services/cvBuilderService.ts". Does the file exist?
```

**Root Cause:** `src/app/types/cv` was a **directory** (containing misplaced copies of renderer files from `src/app/components/cv/`), not a `.ts` file.

**Fix Applied:**
- Created `src/app/types/cv.ts` — barrel file re-exporting from canonical `src/types/cv.ts`
- Fixed relative import paths in `src/app/components/cv/renderingEngine.ts` and duplicates

**Location:** `src/app/types/cv.ts` (created), `src/app/components/cv/renderingEngine.ts:16`

---

### Issue #5: Syntax error in canonical type file

**Error Message:**
```
ERROR: Expected ";" but found ">"
```

**Root Cause:** `src/types/cv.ts:92` had an extra `>` in the type export:
```typescript
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>>; // note >> at end
```

**Fix Applied:** Removed the duplicate `>`.

**Location:** `src/types/cv.ts:92`

---

### Issue #6: Missing `error` state variable in CVBuilder

**Error Message:**
```
ReferenceError: error is not defined at CVBuilder
```

**Root Cause:** `setError()` was called but `const [error, setError] = useState(...)` was never declared.

**Fix Applied:** Added `const [error, setError] = useState<string | null>(null)`.

**Location:** `src/app/pages/CVBuilder.tsx:37`

---

### Issue #7: Textarea missing `onChange` handler

**Warning:**
```
Warning: You provided a `value` prop to a form field without an `onChange` handler.
```

**Root Cause:** Job description `<Textarea>` had `value={jobDescription}` but no `onChange` handler.

**Fix Applied:** Added `onChange={(e) => setJobDescription(e.target.value)}`.

**Location:** `src/app/pages/CVBuilder.tsx:253`

---

### Issue #8: LLM returned 400 — invalid `role: "format"`

**Error Message:**
```
'messages' array must only contain objects with a 'role' field that is in [user, assistant, system, tool]. Got 'format'.
```

**Root Cause:** `cvBuilderService.ts` used `role: "format"` for schema injection messages. LMStudio's OpenAI-compatible API only accepts `user`, `assistant`, `system`, `tool`.

**Fix Applied:** Changed both `role: "format"` occurrences to `role: "system"`.

**Location:** `src/app/services/cvBuilderService.ts:70,94`

---

### Issue #9: JSON parse failed — LLM wrapped JSON in markdown fences

**Error Message:**
```
Invalid JSON structure generated. Please check console for details.
```

**Root Cause:** The LLM wrapped JSON output inside ` ```json ... ``` ` markdown code fences. `CVBuilder.tsx` used raw `JSON.parse()`.

**Fix Applied:** Replaced `JSON.parse(content)` with `extractJsonObject(content)`.

**Location:** `src/app/pages/CVBuilder.tsx:60`

---

### Issue #10: CV rendered blank — LLM output format didn't match schema

**Symptom:** JSON parsed successfully but iframe showed empty document.

**Root Cause:** The LLM generated sections keyed by type name (`{"summary": "text..."}`) instead of using the expected `type` discriminator (`{"type": "summary", "content": "text..."}`). The Zod schema `.toString()` was unreadable to the LLM.

**Fix Applied:**
1. Replaced cryptic Zod schema dump in prompts with a clear JSON example
2. Added `normalizeCvJson()` function that converts key-based format to type-based format
3. Both `generateCv()` and `editCv()` now pass output through the normalizer

**Location:** `src/app/services/cvBuilderService.ts`

---

## 2026-05-28: Session Sync & Analysis Hub Refinements (Session 2)

### Issue #11: Sidebar session click sometimes shows prompt instead of results

**Symptom:** Clicking a recent analysis in the sidebar would sometimes show the analysis results and other times show the editable prompt textarea.

**Root Cause:** `AnalysisContext.tsx:48` — The `useEffect` had `profileData.draftJobPosting` and `profileData.analysisSessions` in its dependency array. The `loadSession()` function calls `persistAnalysisState()`, which updates `profileData.analysisSessions`, triggering the effect to reset `currentResult`, `currentMarkdown`, and `activeSessionId` back to `null`.

**Fix Applied:** Changed dependency array from `[activeProfileId, profileData.draftJobPosting, profileData.analysisSessions]` to `[activeProfileId]`. Profile switches still reset correctly, but session operations within the same profile no longer get wiped.

**Location:** `src/app/context/AnalysisContext.tsx:55`

---

### Issue #12: CV rendered with dark background in dark mode

**Symptom:** When the app theme is set to dark, the CV preview iframe showed a dark background, making text unreadable.

**Root Cause:** `renderingEngine.ts` set explicit text colors (`#1e293b`, `#1a202c`) but never set an explicit `background`. The iframe inherited parent context styling in some browsers.

**Fix Applied:** Added `background: #ffffff` to `body` CSS in all three theme styles (modern, classic, minimal) and the default case.

**Location:** `src/components/cv/renderingEngine.ts:68,81,93,96`

---

### Issue #13: Minimal theme CSS overridden by default case

**Symptom:** Minimal theme rendered identical to the default fallback instead of its intended styling.

**Root Cause:** Missing `break` statement after `case "minimal"` in the theme switch — execution fell through to the `default` case, overwriting `styleRules`.

**Fix Applied:** Added `break;` after the minimal theme block.

**Location:** `src/components/cv/renderingEngine.ts:94`

---

### Issue #14: CSS escaping broke font-family declarations

**Symptom:** Font family strings in CSS (`'Inter', sans-serif`) were HTML-escaped to `&#x27;Inter&#x27;, sans-serif`, breaking font rendering in the iframe.

**Root Cause:** `escapeHtml()` was applied to the entire CSS string before injection into `<style>` tag. This was intended to prevent XSS via `primaryColor` but it corrupted legitimate CSS syntax.

**Fix Applied:** Replaced `escapeHtml(styleRules.replace(...))` with regex validation of `primaryColor` (`/^#[0-9A-Fa-f]{6}$/`). The CSS is now injected raw; only the color value is sanitized.

**Location:** `src/components/cv/renderingEngine.ts:111-116`

---

### Issue #15: Redundant past analyses dropdown

**Symptom:** Analysis Hub had both a sidebar "Recent Analyses" section and a page-level `<Select>` dropdown, both doing the same thing. If not perfectly aligned, clicking one would produce inconsistent state.

**Fix Applied:** Removed the dropdown entirely. Session navigation is now exclusively via the sidebar.

**Location:** `src/app/pages/AnalysisHub.tsx` (removed)

---

### Issue #16: Duplicate files scattered in wrong locations

**Symptom:** After the CV builder refactor, 7 duplicate files were left in `src/app/types/cv/`, `src/app/components/cv/`, and `src/app/cv.ts`, causing import confusion and stale code.

**Fix Applied:** Deleted all 7 duplicates. Canonical files remain at `src/components/cv/` and `src/types/`. Updated all import paths to point to canonical locations.

**Files Deleted:**
- `src/app/types/cv/CVRenderer.tsx`
- `src/app/types/cv/renderingEngine.ts`
- `src/app/types/cv/renderingEngine.test.ts`
- `src/app/components/cv/CVRenderer.tsx`
- `src/app/components/cv/renderingEngine.ts`
- `src/app/components/cv/renderingEngine.test.ts`
- `src/app/cv.ts`

---

## Related Documentation

- [[../00-Index/MOC|Map of Content]] — Project documentation index
- [[../30-Features/Analysis Hub|Analysis Hub]] — Job analysis flow
- [[../30-Features/Document Builders|Document Builders]] — CV & Cover Letter Studio  
- [[../10-Architecture/Context Providers|Context Providers]] — State management
