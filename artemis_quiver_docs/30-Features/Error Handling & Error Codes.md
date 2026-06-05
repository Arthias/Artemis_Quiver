---
tags: [feature, error-handling, error-codes, architecture]
status: active
last_updated: 2026-06-05
---

# Error Handling & Error Codes

A centralized error handling system that categorizes all application errors by domain, severity, and retry strategy. Every error has a registered code in `ERROR_CATALOG` so behavior is predictable and user-facing messages are consistent.

---

## Architecture

```
Error raised
    │
    ▼
AppError thrown with ErrorCode
    │
    ├─ code ──────────────► ERROR_CATALOG lookup → fills domain, severity, userMessage, retryable
    ├─ message ───────────► Technical detail (developer-facing)
    ├─ metadata ──────────► Runtime context (HTTP status, attempt count, raw response, etc.)
    │
    ▼
Caught in page component
    │
    ├─ err.userMessage ───► Displayed to user (contextual, non-technical)
    ├─ err.retryable ─────► Determines retry logic (cvBuilderService handles internally)
    └─ err.toJSON() ──────► Future: structured logging / telemetry
```

---

## Error Code Format

All error codes follow the pattern:

```
ERR_{DOMAIN}_{SPECIFIC}
```

Examples: `ERR_CV_JSON_PARSE`, `ERR_LLM_API_FAILURE`, `ERR_STORAGE_WRITE`

---

## Error Code Catalog

### LLM / AI Provider (`ErrorDomain.LLM`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_LLM_API_FAILURE` | ERROR | yes | immediate | The AI model server returned an error. Check Settings > Test connection. |
| `ERR_LLM_EMPTY_RESPONSE` | ERROR | yes | immediate | The AI model returned an empty response. Try again. |
| `ERR_LLM_TIMEOUT` | ERROR | yes | backoff | The request timed out. Try a shorter job description or check your model is responsive. |
| `ERR_LLM_CONNECTION_REFUSED` | CRITICAL | yes | backoff | Cannot connect to the AI model. Make sure the server is running and check Settings. |

### CV Builder (`ErrorDomain.CV`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_CV_JSON_PARSE` | ERROR | yes | corrective | The AI model returned an invalid format. Try adjusting your profile or job description. |
| `ERR_CV_SCHEMA_INVALID` | ERROR | yes | corrective | The AI model generated a CV that doesn't match the expected structure. Try again. |
| `ERR_CV_GENERATION_FAILED` | ERROR | no | — | CV generation failed after multiple attempts. Try a shorter profile or job description. |

### Cover Letter Builder (`ErrorDomain.CL`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_CL_GENERATION_FAILED` | ERROR | yes | immediate | Cover letter generation failed. Try again. |
| `ERR_CL_EDIT_FAILED` | ERROR | yes | immediate | Could not apply changes to the cover letter. Try again. |

### Job Analysis (`ErrorDomain.ANALYSIS`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_ANALYSIS_FAILED` | ERROR | yes | immediate | Job analysis failed. Try again. |
| `ERR_ANALYSIS_FOLLOWUP_FAILED` | ERROR | yes | immediate | Failed to get a response. Try again. |

### Profile (`ErrorDomain.PROFILE`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_PROFILE_MERGE_FAILED` | ERROR | yes | immediate | Could not merge the profile. Try again. |
| `ERR_PROFILE_CHAT_FAILED` | ERROR | yes | immediate | Assistant response failed. Try again. |

### Network (`ErrorDomain.NETWORK`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_NETWORK_TIMEOUT` | ERROR | yes | backoff | The request timed out. Check your connection and try again. |
| `ERR_NETWORK_ABORTED` | WARNING | yes | immediate | The request was cancelled. |

### Generic (`ErrorDomain.APP`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_UNKNOWN` | ERROR | no | — | Something went wrong. Try again. |

---

## Key File

| File | Purpose |
|------|---------|
| `src/app/utils/errors.ts` | `ErrorDomain` / `ErrorSeverity` enums, `ErrorCodes` constant object, `ERROR_CATALOG` registry, `AppError` class |
| `src/app/utils/errorLogger.ts` | `logAppError()` structured console logger, `withErrorLogging()` wrapper |
| `src/app/utils/jsonParse.ts` | `extractJsonObject()` with optional `errorCode` parameter |
| `src/app/services/llmService.ts` | `chatCompletion()` throws AppError for all failure modes (HTTP, timeout, empty, connection refused) |
| `src/app/services/jobAnalysisService.ts` | Validates analysis JSON, throws `ANALYSIS_FAILED` AppError |
| `src/app/services/clBuilderService.ts` | Wraps LLM calls in `CL_GENERATION_FAILED` / `CL_EDIT_FAILED` AppError |
| `src/app/services/profileMergeService.ts` | Wraps LLM call in `PROFILE_MERGE_FAILED` AppError |
| `src/app/services/profileChatService.ts` | Wraps LLM call in `PROFILE_CHAT_FAILED` AppError |

---

## Usage Guide

### Throwing an error

```typescript
import { AppError, ErrorCodes } from "../utils/errors";

// Simple — userMessage comes from the catalog
throw new AppError(ErrorCodes.CV_JSON_PARSE);

// With custom technical message (overrides catalog.message)
throw new AppError(ErrorCodes.CV_JSON_PARSE, "Trailing comma at line 42");

// With runtime metadata (for debugging)
throw new AppError(ErrorCodes.LLM_API_FAILURE, undefined, { httpStatus: 503, model: "gemma-4-e2b" });
```

### Catching and displaying

```typescript
import { AppError, ErrorCodes } from "../utils/errors";
import { logAppError } from "../utils/errorLogger";

try {
  await generateCv(...);
} catch (err) {
  logAppError(err, { phase: "generateCV" });   // Structured console log
  if (err instanceof AppError) {
    setError(err.userMessage);                   // User-facing, clean
    if (err.retryable) showRetryButton();        // Offer retry
  } else {
    setError("Something went wrong.");           // Non-AppError fallback
  }
}
```

### Adding a new error code

1. Add the code string to the `ErrorCodes` const object in `errors.ts`
2. Add a record to `ERROR_CATALOG` with all fields
3. The code is now available for `new AppError(ErrorCodes.YOUR_NEW_CODE)`

### Error-Aware JSON Parsing

```typescript
import { extractJsonObject } from "../utils/jsonParse";
import { ErrorCodes } from "../utils/errors";

// Default: throws CV_JSON_PARSE on failure
const data = extractJsonObject(llmResponse);

// Custom error code per domain:
const data = extractJsonObject(llmResponse, ErrorCodes.ANALYSIS_FAILED);
```

---

## Retry Strategies

| Strategy | Description | Used For |
|----------|-------------|----------|
| `immediate` | Retry immediately with same prompt | Transient API failures |
| `corrective` | Re-send with error feedback attached | JSON parse / schema failures |
| `backoff` | Add delay between retries | Timeouts, connection issues |
| (unset) | No retry | Non-recoverable errors |

The CV builder service handles retries internally with up to 3 retries (4 total attempts) and corrective feedback to the LLM on attempts 3+.

---

## ErrorRecord Interface

```typescript
interface ErrorRecord {
  code: string;                    // "ERR_DOMAIN_SPECIFIC"
  domain: ErrorDomain;             // Which subsystem
  severity: ErrorSeverity;         // How bad
  message: string;                 // Technical description
  userMessage: string;             // What to show the user
  retryable: boolean;              // Can we retry?
  retryStrategy?: "immediate" | "corrective" | "backoff";
  httpStatus?: number;             // HTTP status if applicable
  debugHint?: string;              // Root cause hint for developers
}
```
