import type { LlmConfig } from "../types/llm";
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

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  providerMode: "local",
  primary: { ...DEFAULT_PRIMARY_ENDPOINT, provider: "webllm", model: "Llama-3.2-3B-Instruct-q4f32_1-MLC", baseUrl: "" },
  secondary: DEFAULT_SECONDARY_ENDPOINT,
  secondaryUse: "never",
  autoSaveProfile: true,
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


