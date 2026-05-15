export const config = {
  providers: {
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
    lmstudio: {
      baseUrl: process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1",
    },
  },
};
