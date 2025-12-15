---
description: Analyze codebase and generate/update AI agent instructions
---

## User Input

```text
$ARGUMENTS
```

You may consider user input for specific focus areas (if not empty).

## Outline

Analyze this codebase to generate or update `.agent/rules/instructions.md` for guiding AI coding agents.

## Execution Flow

1. **Source Existing AI Conventions**

   Search for existing AI instruction files:

   ```
   **/{.github/copilot-instructions.md,AGENT.md,AGENTS.md,CLAUDE.md,GEMINI.md,.cursorrules,.windsurfrules,.clinerules,.cursor/rules/**,.windsurf/rules/**,.clinerules/**,README.md,.agent/rules/**}
   ```

2. **Analyze Codebase Architecture**

   Focus on discovering essential knowledge that helps AI agents be immediately productive:
   - **Big Picture Architecture**: Major components, service boundaries, data flows, and the "why" behind structural decisions
   - **Developer Workflows**: Build, test, debug commands that aren't obvious from file inspection
   - **Project Conventions**: Patterns that differ from common practices
   - **Integration Points**: External dependencies, cross-component communication

3. **Key Analysis Points for This Project**

   For Sync ERP specifically, analyze:
   - Monorepo structure (`apps/`, `packages/`)
   - Controller → Service → Repository layering
   - Multi-tenant isolation patterns
   - Feature-based frontend architecture
   - Zod schema validation patterns
   - TypeScript configuration inheritance

4. **Generate/Update Instructions**

   If `.agent/rules/instructions.md` exists:
   - Merge intelligently - preserve valuable content
   - Update outdated sections
   - Remove obsolete patterns

   If creating new:
   - Start with project overview
   - Document architecture patterns
   - Include specific code examples
   - Reference key files that exemplify patterns

5. **Writing Guidelines**
   - Write concise, actionable instructions (~50-100 lines)
   - Use markdown structure with headers
   - Include specific examples from THIS codebase
   - Avoid generic advice ("write tests", "handle errors")
   - Document only discoverable patterns, not aspirational
   - Reference key files/directories that exemplify patterns

6. **Output Format**

   ```markdown
   # AI Agent Instructions for [Project Name]

   ## Architecture Overview

   [Brief description with ASCII diagram if helpful]

   ## Key Patterns

   [Project-specific patterns with code examples]

   ## Development Workflow

   [Commands, build process, testing]

   ## Do's and Don'ts

   [Project-specific rules, derived from constitution]

   ## Key Files Reference

   [Important files to understand patterns]
   ```

7. **Cross-Reference with Constitution**

   Read `.agent/rules/constitution.md` and ensure instructions align with principles:
   - Architecture & Dependency Flow
   - Shared Type Contracts
   - Layered Backend
   - Schema-First Development
   - etc.

8. **Write and Confirm**
   - Write to `.agent/rules/instructions.md`
   - Ask for feedback on unclear or incomplete sections
   - Iterate based on user input

## Example Output Structure

```markdown
# AI Agent Instructions for Sync ERP

## Architecture

- Monorepo: `apps/` (web, api) + `packages/` (shared, database)
- Frontend ↔ Backend via HTTP/REST only
- Backend uses Controller → Service → Repository

## Patterns

- Use `apiAction()` for API calls with toast feedback
- Use `useConfirm()` instead of `window.confirm()`
- Schema-first: Add fields to Zod before frontend/backend

## Commands

- `npm run dev` - Start dev servers
- `npx tsc --noEmit` - TypeScript check (source of truth)
- `cd packages/shared && npm run build` - Rebuild shared

## Don't

- Don't use `this` in frontend services
- Don't create manual interfaces for API types (use z.infer)
- Don't access database from Controllers or Services
```
