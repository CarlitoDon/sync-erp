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

3. **Key Analysis Points** (Discover from codebase)

   Analyze based on what you find:
   - Project structure (monorepo, single app, etc.)
   - Framework patterns (React, Vue, Express, etc.)
   - Data layer patterns (ORM, raw SQL, API clients)
   - Validation patterns (Zod, Yup, Joi, etc.)
   - State management patterns
   - Testing patterns
   - Build/deploy configuration

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

   [Project-specific rules]

   ## Key Files Reference

   [Important files to understand patterns]
   ```

7. **Cross-Reference with Constitution** (if exists)

   If `.agent/rules/constitution.md` exists, read it and ensure instructions align with its principles.

8. **Write and Confirm**
   - Write to `.agent/rules/instructions.md`
   - Ask for feedback on unclear or incomplete sections
   - Iterate based on user input

## Example Output Structure

```markdown
# AI Agent Instructions for [Project Name]

## Architecture

- [Describe project structure discovered]
- [Describe key architectural patterns]

## Patterns

- [Pattern 1 with code example]
- [Pattern 2 with code example]

## Commands

- [Key development commands]
- [Build/test commands]

## Don't

- [Anti-patterns discovered or documented]
- [Common mistakes to avoid]
```
