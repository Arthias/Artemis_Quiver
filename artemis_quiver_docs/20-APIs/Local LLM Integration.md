---
tags: [api, llm, local, providers]
status: completed
last_updated: 2026-06-04
---

# 🔌 LLM Integration — Provider Architecture

Artemis Quiver uses a **provider adapter architecture** to support multiple LLM backends. The service layer routes requests through registered `ProviderAdapter` implementations based on the configured `ProviderType`.

---

## 🎛️ Supported Providers

| Provider | Type | Adapter | API Key | List Models |
|---|---|---|---|---|
| LMStudio | `openai-compatible` | `OpenAICompatibleAdapter` | Optional | `GET /v1/models` |
| Ollama (compat mode) | `openai-compatible` | `OpenAICompatibleAdapter` | Optional | `GET /v1/models` |
| OpenAI | `openai-compatible` | `OpenAICompatibleAdapter` | Required | `GET /v1/models` |
| OpenRouter | `openai-compatible` | `OpenAICompatibleAdapter` | Required | `GET /v1/models` |
| Groq | `openai-compatible` | `OpenAICompatibleAdapter` | Required | `GET /v1/models` |
| Together AI | `openai-compatible` | `OpenAICompatibleAdapter` | Required | `GET /v1/models` |
| Anthropic Claude | `anthropic` | `AnthropicAdapter` | Required | N/A (manual input) |
| Google Gemini | `google-gemini` | `GeminiAdapter` | Required | `GET /v1/models` |
| WebLLM (future) | `webllm` | Not yet implemented | N/A | Downloaded models |

---

## 🔌 Provider Adapter Interface

Each adapter implements [ProviderAdapter.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/provider/ProviderAdapter.ts):

```typescript
interface ProviderAdapter {
  chatCompletion(messages: ChatMessage[], endpoint: ModelEndpoint, options?): Promise<string>;
  listModels(endpoint: ModelEndpoint): Promise<string[]>;
  testConnection(endpoint: ModelEndpoint): Promise<string>;
}
```

Adapters are resolved by [registry.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/provider/registry.ts):

```typescript
function getAdapter(provider: ProviderType): ProviderAdapter
```

---

## 🧠 Dual Model Slots

Each profile has two independently configurable `ModelEndpoint` slots:

| Slot | Default Provider | Default Base URL | Default Model |
|---|---|---|---|
| **Primary** | `openai-compatible` | `/api/lmstudio` | `google/gemma-4-e2b` |
| **Secondary** | `openai-compatible` | `/api/ollama` | `llama3.2:3b` |

Secondary routing via `secondaryUse`:
- `"never"` — Use primary only
- `"fallback"` — Retry secondary on primary failure
- `"quick-tasks"` — Classification/scoring to secondary, generation to primary
- `"always"` — Use secondary only

---

## 🔀 Vite Dev Server Proxies

In [vite.config.ts](file:///F:/Dev/Artemis_Quiver/vite.config.ts), proxy settings route request paths to local servers to prevent CORS blockages:

```typescript
server: {
  proxy: {
    "/api/lmstudio": {
      target: "http://192.168.8.171:1234",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/lmstudio/, ""),
    },
    "/api/ollama": {
      target: "http://localhost:11434",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/ollama/, ""),
    },
  },
}
```

For cloud APIs (OpenAI, Anthropic, OpenRouter), use direct URLs — they include CORS headers.

---

## 💻 API Client Request Payloads

The underlying service layer is [llmService.ts](file:///F:/Dev/Artemis_Quiver/src/app/services/llmService.ts).

All adapters route through the OpenAI-compatible format:

### OpenAI-Compatible Request (used by LMStudio, Ollama, OpenAI, OpenRouter, Groq, etc.)
- **URL:** `{baseUrl}/v1/chat/completions`
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

### Anthropic Native Request
- **URL:** `{baseUrl}/v1/messages`
- **Method:** `POST`
- **Body:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "system": "...",
  "messages": [{ "role": "user", "content": "..." }],
  "max_tokens": 1024,
  "temperature": 0.7
}
```

### Gemini Native Request
- **URL:** `{baseUrl}/v1/models/{model}:generateContent`
- **Method:** `POST`
- **Body:**
```json
{
  "contents": [{ "role": "user", "parts": [{ "text": "..." }] }],
  "generationConfig": { "temperature": 0.7, "maxOutputTokens": 1024 }
}
```

---

## ⏱️ Abort Controllers and Timeouts

- **General Requests:** Standard generations have a **120-second (2 minute)** timeout.
- **Connection Test:** Validations have a **30-second** timeout.
- **Handling Timeout Errors:** If a request exceeds the limit, `AppError(LLM_TIMEOUT)` surfaces in the UI.
