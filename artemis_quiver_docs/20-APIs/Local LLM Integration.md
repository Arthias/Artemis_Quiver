---
tags: [api, llm, local]
status: completed
last_updated: 2026-05-28
---

# 🔌 Local LLM Setup & Proxies

Artemis Quiver integrates with local Large Language Models (LLMs) to ensure full privacy. All job analysis and document generations are processed locally on the user's machine without cloud dependencies.

This note documents the integration points, endpoint configurations, and connection testing protocols.

---

## 🎛️ Supported Providers

Artemis Quiver supports two primary local LLM servers: **LMStudio** (OpenAI-compatible) and **Ollama**.

| Feature | LMStudio | Ollama |
|---|---|---|
| **API Endpoint** | `/v1/chat/completions` (OpenAI format) | `/api/chat` (Ollama custom format) |
| **Request Protocol** | Standard JSON | Standard JSON |
| **Streaming** | Disabled (standard fetch) | Disabled (standard fetch) |
| **Default Server URL** | `/api/lmstudio` (proxied to port `1234`) | `http://localhost:11434` (default port) |

---

## 🔀 Vite Dev Server Proxies

In [vite.config.ts](file:///F:/Dev/Artemis_Quiver/vite.config.ts), proxy settings route request paths to local servers to prevent CORS (Cross-Origin Resource Sharing) blockages:

```typescript
server: {
  proxy: {
    "/api/lmstudio": {
      target: "http://192.168.8.171:1234", // Target development host
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/lmstudio/, ""),
    },
  },
}
```

---

## 💻 API Client Request Payloads

The underlying API engine is located in [llmService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/llmService.ts):

### 1. LMStudio (OpenAI-compatible) Request
- **URL:** `${serverUrl}/v1/chat/completions`
- **Method:** `POST`
- **Body:**
```json
{
  "model": "google/gemma-4-e2b",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "stream": false
}
```

### 2. Ollama Request
- **URL:** `${serverUrl}/api/chat`
- **Method:** `POST`
- **Body:**
```json
{
  "model": "gemma2",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false,
  "options": {
    "temperature": 0.7
  }
}
```

---

## ⏱️ Abort Controllers and Timeouts

- **General Requests:** Standard generations (CV, CL, Job Analysis) have a **120-second (2 minute) timeout** limit.
- **Connection Test:** Validations have a **30-second timeout** limit.
- **Handling Timeout Errors:** If a request exceeds the limit, the `AbortController` throws a custom `AbortError` which surfaces in the UI as:
  > *Request timed out. Try a smaller job posting or check the LLM server.*
