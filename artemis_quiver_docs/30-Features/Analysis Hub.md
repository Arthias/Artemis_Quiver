---
tags: [feature, analysis, job-hunting]
status: completed
last_updated: 2026-05-22
---

# 🔍 Analysis Hub

The **Analysis Hub** is the gateway interface of Artemis Quiver, allowing users to parse, score, and evaluate job postings against their active master profile.

---

## 🛠️ User Workflow Flowchart

The following diagram illustrates how the Job Analysis flow processes user inputs and coordinates handoffs to other systems:

```mermaid
graph TD
    Start([1. Paste Job Posting]) --> Input[2. Input Draft Job Description]
    Input --> RunAnalysis[3. Click 'Analyze Job Posting']
    RunAnalysis --> LLMCall{4. Query Local LLM API}
    LLMCall -->|Success| SaveSession[5. Create & Save AnalysisSession]
    LLMCall -->|Fail| DisplayError[Display Host/Config Error]
    SaveSession --> RenderUI[6. Render Score, Summary & Tips]
    
    RenderUI --> HandoffCV[Click 'Open CV Builder']
    RenderUI --> HandoffCL[Click 'Edit in CL Builder']
    
    HandoffCV --> SetHandoffCV[Set BuilderHandoff Context]
    SetHandoffCV --> NavCV[Navigate to /cv-builder]
    
    HandoffCL --> SetHandoffCL[Set BuilderHandoff Context]
    SetHandoffCL --> NavCL[Navigate to /cl-builder]
```

---

## 🧱 Key UI Elements

Located in [AnalysisHub.tsx](file:///F:/Dev/Artemis_Quiver/src/app/pages/AnalysisHub.tsx):

### 1. Past Session Selector
- Renders a `<Select>` dropdown displaying the candidate's last 50 analyses.
- Selecting an item invokes `loadSession(id)`, loading past text, scoring, and cover letters from `localStorage` immediately.

### 2. Job Input Field & Button
- Renders a multi-line `<Textarea>` for job descriptions.
- The **Analyze Job Posting** button initiates the `analyze()` method from `AnalysisContext`.

### 3. Match Score Circular Indicator
- Displays the match score (0–100%) dynamically inside an SVG circular progress meter.
- Categorizes scores into badges:
  - `80% - 100%`: **Strong Match** (blue/green accent)
  - `60% - 79%`: **Good Match**
  - `40% - 59%`: **Moderate Match**
  - `0% - 39%`: **Stretch Role**

### 4. CV & Cover Letter Handoff Triggers
- **CV Optimization Card**: Lists the 3-5 suggestions for improving the resume. The "Open CV Builder" button saves the suggestions to `BuilderHandoffContext` and navigates the browser to `/cv-builder`.
- **Cover Letter Card**: Renders the raw letter output. The "Edit in Builder" button transfers the letter draft to `BuilderHandoffContext` and redirects the user to `/cl-builder`.
