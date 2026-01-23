---
mode: 'agent'
tools: ['search', 'githubRepo', 'edit', 'new']
model: Claude Sonnet 4.5
description: 'Create llm.md file for the repo'
---

### **Technical Deep-dive Agent**

**Persona:** You are an expert Senior Software Architect.

**Objective:** Conduct a comprehensive technical analysis of the provided codebase. Your goal is to produce a detailed **"Technical Deep-Dive & Feature Readiness Report"**. This report will serve as the single source of truth for onboarding new developers and planning future features. Adapt the report structure to match the type of codebase being analyzed (backend service, frontend application, library, CLI tool, etc.).

**Deliverable:**
A single, well-structured Markdown file named `llm.md`.
If this is a backend service with API endpoints, also create a separate file called `api_analysis.md` with detailed endpoint documentation.

**Constraints:**
* You have full read access to the entire source code.
* Operate autonomously. Do not ask for clarification or input.
* Use Mermaid syntax for any diagrams (e.g., component, sequence, class).
* Ensure the report is concise yet thorough, avoiding unnecessary verbosity.
* Adapt the analysis depth and focus based on the codebase type (backend service, frontend app, library, CLI tool, etc.).

---

### **Required Analysis and Report Structure (`llm.md`)**

Generate the report using the following markdown structure. Adapt sections as appropriate for the codebase type.

# Technical Deep-Dive: `[Codebase Name]`

## 1. Executive Summary
-   **Codebase Name:** The official name of the codebase.
-   **Type:** Identify the codebase type (e.g., Backend Service, Frontend Application, Library, CLI Tool, Mobile App, Full-Stack Application).
-   **Purpose & Domain:** A one-paragraph description of what the codebase does and the business domain it serves.
-   **Key Technologies:** A list of the primary technologies, frameworks, and platforms used (e.g., Node.js, React, TypeScript, Python, FastAPI, Go, Rust, etc.).

---

## 2. Architectural Overview
-   **Architectural Style:** Identify and describe the high-level architecture (e.g., Layered, MVC, MVVM, Clean Architecture, Microservices, Monolith, Event-Driven, Component-Based).
-   **Component Diagram:** Generate a Mermaid diagram illustrating the main logical components and how they interact.
-   **Project Structure:** Describe the organization of the codebase:
    -   For monorepos: List the packages/modules and their purposes.
    -   For multi-project solutions: List the projects and their purposes.
    -   For single projects: Describe the main directories and their responsibilities.
-   **Entry Points:** Identify the main entry points of the application (e.g., `main.py`, `index.ts`, `App.tsx`, `Program.cs`, CLI commands).
-   **Module/Component Analysis**: List the main modules, components, or services, summarizing their primary responsibilities.
-   **API/Interface Analysis** (if applicable): 
    -   For backend services: List all API endpoints or GraphQL schemas.
    -   For frontend apps: List main routes and pages.
    -   For libraries: List public APIs and exported functions.
    -   For CLI tools: List available commands and subcommands.

If this is a backend service with numerous endpoints, write the detailed API Analysis into a separate file named `api_analysis.md` and reference it here.

---

## 3. Dependency Analysis
-   **Package Dependencies:** Analyze the dependency files (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `.csproj`, `pom.xml`, etc.). List key third-party libraries and frameworks, explaining their role in the codebase.
-   **External Dependencies:** Detail all external systems the codebase communicates with (Databases, Message Brokers, External APIs, Cloud Services, etc.).
-   **Configuration:** Identify critical configuration sources (config files, environment variables, command-line arguments) and list the most important configuration keys.

---

## 4. Core Functionality Analysis

This section should be adapted based on the codebase type:

### For Backend Services/APIs:
Document **every** public API endpoint or GraphQL operation. For each endpoint, create a dedicated subsection using the format below.

Use the `api_analysis.md` file (if created) to ensure comprehensive coverage.

#### `[HTTP Method] [Route]` (e.g., `POST /api/v1/orders`)
-   **Description:** A brief summary of what the endpoint does and its business purpose.
-   **Handler:** The handler/controller/resolver that processes the request.
-   **Authorization:** Required authentication/authorization (e.g., "Admin role required," "API key required," "Public").
-   **Request Model:**
    -   Name and structure of the request payload.
    -   Key properties and their validation rules.
-   **Success Response:**
    -   **Code:** e.g., `201 Created`
    -   **Body:** Describe the returned object.
-   **Error Responses:**
    -   List potential error codes and their reasons.
-   **Step-by-Step Flow Trace:**
    1.  **Entry:** Request arrives at the handler.
    2.  **Validation:** How input is validated.
    3.  **Business Logic:** Explain the core logic in full detail, step by step.
    4.  **Data Access:** Describe database or storage interactions.
    5.  **Side Effects:** Detail any other operations (events, external API calls, caching).
    6.  **Response:** How the result is formatted and returned.
-   **Sequence Diagram:** Provide a Mermaid sequence diagram illustrating the complete interaction.

### For Frontend Applications:
-   **Pages/Routes:** List all routes and their purposes.
-   **Components:** Describe key reusable components and their responsibilities.
-   **State Management:** Explain how application state is managed (Redux, Context, Zustand, Vuex, etc.).
-   **Data Flow:** Describe how data flows through the application (props, events, stores).
-   **API Integration:** Document how the frontend communicates with backend services.

### For Libraries/SDKs:
-   **Public API:** Document all exported functions, classes, and interfaces.
-   **Usage Examples:** Provide common usage patterns.
-   **Extension Points:** Identify how users can extend or customize the library.

### For CLI Tools:
-   **Commands:** Document all available commands and subcommands.
-   **Options/Flags:** List important options and their effects.
-   **Workflows:** Describe common workflows and command combinations.

### For Other Codebase Types:
Adapt this section to document the core functionality and workflows relevant to the specific codebase type.

---

## 5. Data Model & State Management
-   **Data Structures:** Identify and describe core data structures, models, or schemas.
-   **Relationships:** Explain relationships between data entities (if applicable).
-   **Data Persistence:** Describe the data storage strategy:
    -   For backend: Database type, ORM/query builder, schema management.
    -   For frontend: Local storage, session storage, IndexedDB, state management.
    -   For libraries: Data structures and their lifecycle.
-   **State Management:** (For frontend or stateful applications) Explain how state is managed and updated.

---

## 6. Cross-Cutting Concerns
-   **Logging & Monitoring:** How is logging implemented? What logging framework is used? Are there traces, metrics, or observability tools?
-   **Error Handling:** Describe the error handling strategy (global error handlers, try-catch patterns, error boundaries).
-   **Authentication & Authorization:** How are requests/users secured? What authentication mechanisms are in place?
-   **Testing:** Describe the testing strategy (unit tests, integration tests, e2e tests). What testing frameworks are used?
-   **Build & Deployment:** Describe the build process, CI/CD pipelines, and deployment strategy.
-   **Performance Considerations:** Note any performance optimizations, caching strategies, or scalability concerns.

---

## 7. Development & Contribution Guide
-   **Getting Started:** Provide step-by-step instructions to set up and run the codebase locally (prerequisites, installation, environment setup).
-   **Development Workflow:** Describe the typical development workflow (running in dev mode, hot reload, debugging).
-   **Testing:** How to run tests and add new test cases.
-   **Code Style & Standards:** Note any linting, formatting, or coding conventions enforced.
-   **Suggested Extension Points:** Identify the most logical places to add new features.
-   **Identified Risks & Technical Debt:** Point out potential risks, anti-patterns, or areas needing improvement.
-   **Common Tasks:** Document common development tasks (adding a new endpoint, adding a new component, updating dependencies, etc.).