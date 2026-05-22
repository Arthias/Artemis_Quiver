# Artemis Quiver - Development Plan

## Project Overview
Artemis Quiver is a job hunting automation engine that helps users analyze job postings against their professional profile, generates optimized CVs and cover letters, and provides interview preparation tips.

## Current Status
- **UI Complete**: All frontend interfaces have been implemented using React + Vite + Tailwind CSS
- **Core Pages**: AnalysisHub, Profile, CVBuilder, CoverLetterBuilder, Config
- **Navigation**: Sidebar with route-based navigation
- **Missing**: Actual AI integration, persistence, PDF generation, and real functionality

## Architecture Overview

### Frontend Stack
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Routing**: React Router v7
- **State Management**: React hooks (useState, useEffect)
- **HTTP Client**: To be implemented (fetch/axios for API calls)

### Backend/Layer Architecture
Since this is a frontend-focused application with local LLM integration:
- **UI Layer**: React components in `/src`
- **Service Layer**: To be created (`/src/services`) for API communication
- **Utility Layer**: Helper functions (`/src/utils`)
- **Configuration**: Centralized config management (`/src/config`)
- **Persistence**: Local storage/indexedDB or file system access

### Key Directories
```
/src
  /components     - Reusable UI components (buttons, forms, cards, etc.)
  /pages          - Page components (AnalysisHub, Profile, etc.)
  /services       - API service layer (to be created)
  /utils          - Utility functions (to be created)
  /config         - Configuration management (to be enhanced)
  /hooks          - Custom React hooks (to be created)
```

## Implementation Plan

### Phase 1: Infrastructure Setup
1. **Environment Configuration**
   - Set up environment variables for API endpoints
   - Configure Vite for proxying if needed
   - Set up ESLint/Prettier if desired

2. **Service Layer Foundation**
   - Create API service for LLM communication
   - Implement request/response handling
   - Add error handling and retry logic

### Phase 2: Core AI Integration
1. **LLM Service Implementation**
   - Support for Ollama (local)
   - Support for LMStudio (local)
   - Optional: OpenAI API, Anthropic API, Gemini API
   - Streaming response support for chat

2. **Analysis Engine**
   - Replace mock implementation in AnalysisHub
   - Implement job description analysis against user profile
   - Generate matching score, salary range, tips, recommendations

### Phase 3: Feature Implementation
1. **CV Builder Enhancement**
   - Replace mock CV generation with AI-powered generation
   - Implement AI chat for CV editing
   - Add PDF export functionality

2. **Cover Letter Builder Enhancement**
   - Replace mock cover letter generation with AI-powered generation
   - Implement AI chat for cover letter editing
   - Add PDF export functionality

3. **Profile Management**
   - Implement persistence for user profile (markdown file)
   - Enable file upload for additional context
   - Implement AI-powered profile optimization chat

### Phase 4: Polish & Integration
1. **Configuration Integration**
   - Connect service layer to Config page settings
   - Implement dynamic provider/model switching
   - Add API key validation

2. **Persistence Layer**
   - Implement local storage for chat history
   - Implement file system persistence for profiles
   - Add export/import functionality

3. **Testing & Validation**
   - Test all AI integrations
   - Validate PDF generation quality
   - Ensure responsive design works

## Detailed Tasks

### 1. Environment Setup (Task #1)
- [ ] Create `.env` file for environment variables
- [ ] Configure API endpoints for local LLMs
- [ ] Set up proxy configuration if needed
- [ ] Install any additional dependencies (axios, etc.)

### 2. API Service Layer (Foundation for multiple tasks)
- [ ] Create `/src/services/llmService.ts`
- [ ] Implement base API client with configuration
- [ ] Add support for different LLM providers:
  - Ollama API (`http://localhost:11434`)
  - LMStudio API (`http://localhost:1234`)
- [ ] Implement request formatting for each provider
- [ ] Add streaming response handling
- [ ] Add error handling and timeout management
- [ ] Create utility functions for prompt formatting

### 3. Job Analysis Integration (Task #2)
- [ ] Modify `/src/pages/AnalysisHub.tsx`
- [ ] Import and use LLM service
- [ ] Replace mock analysis with real API calls
- [ ] Implement prompt engineering for:
  - Job description analysis
  - Skills matching
  - Salary range estimation
  - Interview tips generation
  - CV improvement recommendations
  - Cover letter drafting
- [ ] Add loading states and error handling
- [ ] Parse and validate AI responses

### 4. CV Builder Enhancement (Task #3)
- [ ] Modify `/src/pages/CVBuilder.tsx`
- [ ] Replace mock CV generation with AI-powered generation
- [ ] Implement AI chat functionality for CV editing
- [ ] Create prompts for:
  - CV generation from profile + job description
  - CV editing based on user requests
  - Section-specific modifications
- [ ] Implement PDF generation using jsPDF or react-pdf
- [ ] Add download functionality

### 5. Cover Letter Builder Enhancement (Task #4)
- [ ] Modify `/src/pages/CLBuilder.tsx`
- [ ] Replace mock cover letter generation with AI-powered generation
- [ ] Implement AI chat functionality for cover letter editing
- [ ] Create prompts for:
  - Cover letter generation from profile + job + company info
  - Cover letter editing based on user requests
  - Tone adjustment (formal, enthusiastic, concise, etc.)
- [ ] Implement PDF generation
- [ ] Add download functionality

### 6. PDF Generation (Task #5)
- [ ] Choose PDF library (jsPDF, react-pdf, or html2pdf)
- [ ] Create reusable PDF generation utilities
- [ ] Implement CV-specific styling and layout
- [ ] Implement cover letter styling and layout
- [ ] Add print/preview functionality

### 7. Data Persistence (Task #6)
- [ ] Implement profile storage:
  - Save/load profile.md to local storage or file system
  - Handle markdown editing and saving
  - Implement auto-save based on configuration
- [ ] Implement chat history persistence:
  - Store conversations per session/entity
  - Retrieve history when returning to chats
- [ ] Implement session history for AnalysisHub
- [ ] Add export/import functionality for data backup

### 8. Real-time AI Chat (Task #7)
- [ ] Enhance chat components in:
  - Profile page (AI Assistant tab)
  - CV Builder (AI Assistant panel)
  - Cover Letter Builder (AI Assistant panel)
- [ ] Implement streaming responses for better UX
- [ ] Add typing indicators
- [ ] Implement message formatting (markdown support)
- [ ] Add copy/paste functionality for responses

### 9. Configuration Integration (Task #8)
- [ ] Enhance `/src/pages/Config.tsx` to actually save settings
- [ ] Create configuration context or hook
- [ ] Make LLM service configurable based on:
  - Selected provider (anthropic, gemini, openrouter, lmstudio)
  - API keys from config
  - Model selection
  - Temperature and other parameters
- [ ] Add connection testing functionality
- [ ] Implement fallback mechanisms

### 10. Profile Context Integration (Task #9)
- [ ] Create profile context or hook for accessing user data
- [ ] Ensure all AI functions have access to current profile
- [ ] Implement profile update propagation
- [ ] Add validation for profile completeness

## Technical Implementation Details

### LLM Service Interface
```typescript
interface LLMService {
  generateText(prompt: string, options?: GenerationOptions): Promise<string>;
  generateTextStream(prompt: string, options?: GenerationOptions): ReadableStream<string>;
  chat(messages: ChatMessage[], options?: GenerationOptions): Promise<string>;
  chatStream(messages: ChatMessage[], options?: GenerationOptions): ReadableStream<string>;
}

interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  [key: string]: any;
}
```

### Provider-Specific Implementation
**Ollama**: 
- Endpoint: `http://localhost:11434/api/generate`
- Model specification in request body
- Streaming via SSE

**LMStudio**:
- Endpoint: `http://localhost:1234/v1/completions` or `/v1/chat/completions`
- OpenAI-compatible API
- Similar to OpenAI API format

### Prompt Engineering Guidelines
1. **Job Analysis Prompt**:
   ```
   Analyze this job description against the user's professional profile.
   Provide:
   1. Match percentage (0-100)
   2. Estimated salary range
   3. 3-5 key interview preparation tips
   4. CV improvement recommendations
   5. Draft cover letter
   
   Job Description: [JOB_DESCRIPTION]
   
   User Profile: [USER_PROFILE]
   ```

2. **CV Generation Prompt**:
   ```
   Generate a professional CV based on the user's profile and targeting this job description.
   
   User Profile: [USER_PROFILE]
   Target Job: [JOB_DESCRIPTION]
   
   Format as markdown with clear sections:
   - Contact Information
   - Professional Summary
   - Skills
   - Experience
   - Education
   - Certifications
   ```

3. **Cover Letter Prompt**:
   ```
   Generate a tailored cover letter for this position at this company.
   
   User Profile: [USER_PROFILE]
   Job Description: [JOB_DESCRIPTION]
   Company Name: [COMPANY_NAME]
   Position: [POSITION_TITLE]
   
   Format as a professional business letter.
   ```

## Development Guidelines

### Code Style
- Follow existing code style in the project
- Use TypeScript strict mode
- Extract reusable components
- Keep functions small and focused
- Add JSDoc comments for complex functions

### State Management
- Use React hooks for local component state
- Consider Context API for global state (profile, configuration)
- Avoid over-engineering for this scope

### Error Handling
- Implement consistent error handling in service layer
- Show user-friendly error messages in UI
- Log errors for debugging
- Provide retry mechanisms where appropriate

### Performance Considerations
- Debounce input where appropriate
- Implement loading states for all async operations
- Optimize re-renders with useCallback/useMemo
- Consider virtualization for long lists if needed

## Testing Strategy

### Manual Testing
1. Test each AI provider separately
2. Verify PDF generation quality
3. Test chat functionality with streaming responses
4. Validate data persistence across sessions
5. Test responsive design on different screen sizes

### Automated Testing (Future)
- Consider adding unit tests for utility functions
- Add integration tests for service layer
- Add end-to-end tests for critical user flows

## Deployment Considerations
Since this is primarily a frontend application:
- Can be deployed as static site (Vercel, Netlify, etc.)
- LLM services need to be running separately (local or remote)
- Consider build-time environment variable injection
- Add service worker for offline capabilities if desired

## Risks and Mitigations

### Risk: LLM API Unreliability
- Mitigation: Implement retry logic, fallback responses, clear error messages

### Risk: Token Limit Exceeded
- Mitigation: Truncate long inputs, summarize content, implement chunking strategy

### Risk: Slow Response Times
- Mitigation: Implement streaming responses, add loading skeletons, set reasonable timeouts

### Risk: Privacy Concerns
- Mitigation: Ensure API keys are stored locally, clarify data usage in documentation

## Next Steps for Other Agents

1. **Begin with Environment Setup** (Task #1)
   - Set up configuration for local LLMs
   - Verify connections to Ollama and LMStudio

2. **Proceed with Core AI Integration** 
   - Start with Job Analysis (Task #2) as it's central to the application
   - Then move to CV Builder (Task #3) and Cover Letter Builder (Task #4)

3. **Implement Supporting Features**
   - PDF generation (Task #5)
   - Persistence (Task #6)
   - Real-time chat (Task #7)
   - Configuration integration (Task #8)
   - Profile context (Task #9)

4. **Follow the Implementation Order**
   - Tasks can be worked on in parallel where dependencies allow
   - Service layer should be established first
   - UI modifications depend on the service layer

## Communication and Coordination
- Update task status using the task management system
- Create new tasks for discovered sub-tasks
- Report blockers early
- Share useful utility functions or patterns discovered