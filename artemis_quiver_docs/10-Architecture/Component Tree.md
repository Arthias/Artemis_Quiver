---
tags: [architecture, ui]
status: completed
last_updated: 2026-05-28
---

# 🌲 Component Tree & Routing Architecture

This note maps the user interface structure, page layout, and component nesting of Artemis Quiver.

---

## 🗺️ Application Entry Point

The application starts in [main.tsx](file:///F:/Dev/Artemis_Quiver/src/main.tsx) and bootstrap files:

1. **`main.tsx`**: Renders `App.tsx` wrapped in `StrictMode`.
2. **`App.tsx`**: Renders `<AppProviders>` around the `<RouterProvider router={router} />` from React Router v7.

---

## 🧩 Provider Stack

State context flows down through the following nested providers in [AppProviders.tsx](file:///F:/Dev/Artemis_Quiver/src/app/providers/AppProviders.tsx):

```text
WorkspaceProfileProvider
 └── ConfigProvider
      └── ProfileProvider
           └── AnalysisProvider
                └── BuilderHandoffProvider
                     └── [Router Page Outlet]
```

*For details on what each context stores, see [[10-Architecture/Context Providers|Context Providers & State Management]].*

---

## 🚏 Routes and Layout Hierarchy

All routes are declared in [routes.tsx](file:///F:/Dev/Artemis_Quiver/src/app/routes.tsx) and managed by React Router v7. They are structured as children under `<RootLayout>`:

```text
RootLayout (src/app/components/layouts/RootLayout.tsx)
 ├── Sidebar (src/app/components/navigation/Sidebar.tsx)
 │    └── ProfileSwitcherModal (src/app/components/workspace/ProfileSwitcherModal.tsx)
 └── Page Outlet (Main view area)
      ├── AnalysisHub (/)
      ├── Profile (/profile)
      ├── CVBuilder (/cv-builder)
      ├── CLBuilder (/cl-builder)
      └── Config (/config)
```

---

## 📄 Key Page Components

Each page component resides in `src/app/pages/`:

### 1. Analysis Hub (`/`)
- **File:** [AnalysisHub.tsx](file:///F:/Dev/Artemis_Quiver/src/app/pages/AnalysisHub.tsx)
- **Role:** Main page where users paste job descriptions to analyze them against the active profile. Shows match scores and session history.

### 2. Profile Workspace (`/profile`)
- **File:** [Profile.tsx](file:///F:/Dev/Artemis_Quiver/src/app/pages/Profile.tsx)
- **Role:** Markdown editor for the active master professional profile. Includes imports, file diff previews, and the AI Profile Assistant chat interface.

### 3. CV Studio (`/cv-builder`)
- **File:** [CVBuilder.tsx](file:///F:/Dev/Artemis_Quiver/src/app/pages/CVBuilder.tsx)
- **Role:** Renders the generated CV. Offers a sidebar chat interface to edit/refine the CV and export it to Markdown.

### 4. Cover Letter Studio (`/cl-builder`)
- **File:** [CLBuilder.tsx](file:///F:/Dev/Artemis_Quiver/src/app/pages/CLBuilder.tsx)
- **Role:** Renders the generated cover letter. Offers a sidebar chat interface to edit/refine the cover letter and export it.

### 5. Settings (`/config`)
- **File:** [Config.tsx](file:///F:/Dev/Artemis_Quiver/src/app/pages/Config.tsx)
- **Role:** Configuration interface for per-profile LLM Provider endpoints (Ollama/LMStudio), theme styling, and auto-save options.
