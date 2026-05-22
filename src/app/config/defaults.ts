import type { LlmConfig } from "../types/llm";

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

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: "lmstudio",
  serverUrl: "/api/lmstudio",
  model: "google/gemma-4-e2b",
  temperature: 0.7,
  autoSaveProfile: true,
};

export const STORAGE_KEYS = {
  llmConfig: "artemis-llm-config",
  profile: "artemis-profile",
  analysisSessions: "artemis-analysis-sessions",
  draftJobPosting: "artemis-draft-job-posting",
} as const;
