import type { LlmConfig, ProviderType } from "../types/llm";
import { DEFAULT_PRIMARY_ENDPOINT, DEFAULT_SECONDARY_ENDPOINT } from "../types/llm";

export const DEFAULT_PROFILE_MARKDOWN = `# Professional Profile

## Overview
Senior Software Engineer with 8+ years of experience building scalable distributed systems.

## Skills
- **Languages**: JavaScript, TypeScript, Python, Go
- **Frameworks**: React, Node.js, Django, FastAPI
- **Cloud**: AWS (EC2, S3, Lambda), GCP, Docker, Kubernetes
- **Databases**: PostgreSQL, MongoDB, Redis

## Experience

### Senior Software Engineer | Tech Corp
*2021 - Present*
- Led development of microservices architecture serving 10M+ users
- Improved system performance by 40% through optimization initiatives
- Mentored team of 5 junior engineers

### Software Engineer | StartupXYZ
*2018 - 2021*
- Built real-time data processing pipeline handling 1M events/day
- Implemented CI/CD pipeline reducing deployment time by 60%
- Collaborated with product team on feature development

## Education
**Bachelor of Science in Computer Science**
University of Technology, 2018

## Certifications
- AWS Certified Solutions Architect
- Certified Kubernetes Administrator (CKA)
`;

// WebLLM (in-browser, WebGPU-based local inference) is unreliable across
// hardware — it crashes on machines without a compatible/capable GPU. It
// remains available as an explicit opt-in from Settings, but new installs
// should default to a cloud provider so the app works out of the box on
// any machine. OpenRouter is used as the default cloud target since it
// exposes an OpenAI-compatible API surface and has been confirmed to work
// reliably where a direct Gemini connection did not.
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  providerMode: "cloud",
  primary: {
    ...DEFAULT_PRIMARY_ENDPOINT,
    label: "OpenRouter",
    provider: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
  },
  secondary: DEFAULT_SECONDARY_ENDPOINT,
  secondaryUse: "never",
  autoSaveProfile: true,
};

// Sensible base-URL defaults per cloud provider, used both to placeholder and
// to auto-fill the Base URL field in Settings when the user switches
// provider. Providers not listed here (e.g. openai-compatible, which fronts
// arbitrary self-hosted/local servers) keep the existing localhost-style
// placeholder instead.
export const PROVIDER_DEFAULT_BASE_URLS: Partial<Record<ProviderType, string>> = {
  "google-gemini": "https://generativelanguage.googleapis.com",
};

export const MINIMAL_PROFILE_MARKDOWN = `# Professional Profile

## Overview
Add a short summary of your background and career goals.

## Skills
- 

## Experience

### Role | Company
*Dates*
- Key achievement

## Education
`;


