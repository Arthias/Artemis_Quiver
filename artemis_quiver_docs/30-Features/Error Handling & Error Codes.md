---
tags: [feature, error-handling, error-codes, architecture]
status: active
last_updated: 2026-06-13
---

# Error Handling & Error Codes

Centralized error system. Every error registered in `ERROR_CATALOG` with code, domain, severity, user message, retry strategy. Source: `src/app/utils/errors.ts`.

## Architecture

```
AppError thrown with ErrorCode → ERROR_CATALOG lookup → domain/severity/userMessage/retryable
Caught in page component → err.userMessage shown to user → err.retryable → retry logic
```

Error code format: `ERR_{DOMAIN}_{SPECIFIC}` (e.g. `ERR_CV_JSON_PARSE`)

## Error Catalog

### LLM / AI (`ErrorDomain.LLM`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_LLM_API_FAILURE` | ERROR | yes | immediate | AI model server error. Check Settings > Test connection. |
| `ERR_LLM_EMPTY_RESPONSE` | ERROR | yes | immediate | AI returned empty response. Try again. |
| `ERR_LLM_TIMEOUT` | ERROR | yes | backoff | Request timed out. Try shorter job description or check model. |
| `ERR_LLM_CONNECTION_REFUSED` | CRITICAL | yes | backoff | Cannot connect. Verify server running, check Settings. |

### CV Builder (`ErrorDomain.CV`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_CV_JSON_PARSE` | ERROR | yes | corrective | Invalid format from AI. Adjust profile or job description. |
| `ERR_CV_SCHEMA_INVALID` | ERROR | yes | corrective | CV doesn't match expected structure. Try again. |
| `ERR_CV_GENERATION_FAILED` | ERROR | no | — | Generation failed after multiple attempts. Try shorter input. |

### Cover Letter (`ErrorDomain.CL`)

| Code | Severity | Retryable | User Message |
|------|----------|-----------|-------------|
| `ERR_CL_GENERATION_FAILED` | ERROR | yes immediate | Generation failed. Try again. |
| `ERR_CL_EDIT_FAILED` | ERROR | yes immediate | Could not apply changes. Try again. |

### Analysis (`ErrorDomain.ANALYSIS`)

| Code | Severity | Retryable | User Message |
|------|----------|-----------|-------------|
| `ERR_ANALYSIS_FAILED` | ERROR | yes immediate | Job analysis failed. Try again. |
| `ERR_ANALYSIS_FOLLOWUP_FAILED` | ERROR | yes immediate | Follow-up failed. Try again. |

### Profile (`ErrorDomain.PROFILE`)

| Code | Severity | Retryable | User Message |
|------|----------|-----------|-------------|
| `ERR_PROFILE_MERGE_FAILED` | ERROR | yes immediate | Merge failed. Try again. |
| `ERR_PROFILE_CHAT_FAILED` | ERROR | yes immediate | Assistant response failed. Try again. |

### Network (`ErrorDomain.NETWORK`)

| Code | Severity | Retryable | Strategy | User Message |
|------|----------|-----------|----------|-------------|
| `ERR_NETWORK_TIMEOUT` | ERROR | yes | backoff | Request timed out. Check connection. |
| `ERR_NETWORK_ABORTED` | WARNING | yes | immediate | Request cancelled. |

### Generic (`ErrorDomain.APP`)

| Code | Severity | Retryable | User Message |
|------|----------|-----------|-------------|
| `ERR_UNKNOWN` | ERROR | no | Something went wrong. Try again. |

## Retry Strategies

| Strategy | Behavior | Used For |
|----------|----------|----------|
| `immediate` | Retry same prompt | Transient API failures |
| `corrective` | Re-send with error feedback | JSON parse/schema failures |
| `backoff` | Delay between retries | Timeouts, connection issues |
| (unset) | No retry | Non-recoverable errors |

CV builder retries up to 3 times with corrective feedback on attempts 3+.

## Key Files

| File | Role |
|------|------|
| `src/app/utils/errors.ts` | `AppError`, `ErrorCodes`, `ERROR_CATALOG`, enums |
| `src/app/utils/errorLogger.ts` | `logAppError()`, `withErrorLogging()` |
| `src/app/utils/jsonParse.ts` | `extractJsonObject()` with optional errorCode param |
| Service files | Each wraps LLM calls in domain-specific AppErrors |
