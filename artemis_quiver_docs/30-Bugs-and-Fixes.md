---
tags: [bugfixes, issues, resolved]
status: completed  
last_updated: 2026-05-28
---

# 🐛 Bugs & Fixes — Resolution Log

This page tracks all bugs discovered and fixed in Artemis Quiver.

> [!TIP] Usage
> Always check this page **before** implementing fixes to avoid duplicate work or missing context.

## 2026-05-28: trim() Safety Issues (Commit: 2c97a87)

### Issue #1: Analysis Hub → CV Builder "Implement" button failed with LLM error (400)

**Error Message:**
```\json
LLM request failed (400): {"error":"'messages' array must only contain objects with a 'role' field that is in [user, assistant, system, tool]. Got 'format'."}
```

**Root Cause:** Invalid role `"format"` used in chat messages instead of `"system"`.

**Status:** ✅ **ALREADY FIXED** in HEAD codebase - analysis showed HEAD version already had correct `role: "user"` usage.

---

### Issue #2: CV Builder "Generate CV" threw TypeError

**Error Message:**
```\javascript
jobDescription?.trim is not a function
```

**Root Cause:** Unsafe optional chaining followed by `.trim()` throws when value is `undefined`, not just non-string. TypeScript's optional chaining returns `undefined` but `.trim()` expects a string type.

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

This ensures `.trim()` is only called on valid strings with content that needs trimming.

---

## Test Results After Fix

✅ Build successful: `npm run build` completes in ~1.7s  
✅ No TypeScript compilation errors  
✅ Minimal change applied (5 lines modified)  

**Commits:** f6d8c18 → 2c97a87  
Pushed to: https://github.com/Arthias/Artemis_Quiver.git (branch: main)

---

## Related Documentation

- [README.md](../../README.md) — Project overview and routes
- [[30-Features/Analysis%20Hub|Analysis Hub]] — Job analysis flow
- [[30-Features/Document%20Builders|Document Builders]] — CV & Cover Letter Studio  
- [[10-Architecture/Context%20Providers|Context Providers]] — State management

---

## Additions Needed (Future)

If you encounter new bugs, add entries here following this same format. See `artemis_quiver_docs/50-Testing/Test Cases.md` for test coverage guidance.
