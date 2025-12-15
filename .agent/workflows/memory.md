---
description: Update project memory with decisions, issues, patterns, or notes
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding.

## Outline

You are updating the project memory at `.agent/rules/memory.md`. This file stores key decisions, known issues, and frequently used patterns.

Follow this execution flow:

1. Check if `.agent/rules/memory.md` exists:
   - If **exists**: Load and read existing content
   - If **not exists**: Create it using `write_to_file` with this template:

   ```markdown
   ---
   trigger: always_on
   ---

   <!--
   MEMORY SYNC REPORT
   Version: 1.0.0 (Initial)
   Added Sections:
   - Project Overview
   - Key Decisions Log
   - Known Issues & Workarounds
   - Frequently Used Patterns
   Last Updated: [TODAY'S DATE]
   -->

   # Project Memory

   **Version**: 1.0.0 | **Last Updated**: [TODAY'S DATE]

   ## Overview

   | Property     | Value                              |
   | ------------ | ---------------------------------- |
   | Project      | [Project Name]                     |
   | Type         | [Project Type]                     |
   | Stack        | [Tech Stack]                       |
   | Constitution | See `.agent/rules/constitution.md` |

   ---

   ## Key Decisions Log

   > Decisions that affect future development. Add new entries at top.

   ---

   ## Known Issues & Workarounds

   > Persistent issues that need workarounds. Mark RESOLVED when fixed.

   | Issue | Status | Workaround |
   | ----- | ------ | ---------- |

   ---

   ## Frequently Used Patterns

   ---

   ## Update Guidelines

   1. **Version Bump**: MAJOR.MINOR.PATCH following semver
   2. **Adding Decisions**: Add at TOP of Key Decisions Log with date
   3. **Sync Report**: Update HTML comment at top when modifying
   ```

2. Parse user input to determine the type of memory entry:
   - **Decision**: Keywords like "ingat", "remember", "keputusan", "decision", "gunakan", "use", "pakai"
   - **Issue**: Keywords like "issue", "bug", "masalah", "workaround"
   - **Pattern**: Keywords like "pattern", "pola", "snippet", "code"

3. Create the appropriate entry:

   **For Decisions** (add to Key Decisions Log):

   ```markdown
   ### [YYYY-MM-DD] [Short Title]

   **Decision**: [What was decided]
   **Rationale**: [Why this decision was made]
   **Reference**: [Constitution principle if applicable, or N/A]
   ```

   **For Issues** (add row to Known Issues table):

   ```markdown
   | [Issue description] | KNOWN | [Workaround if any] |
   ```

   **For Patterns** (add to Frequently Used Patterns):

   ````markdown
   ### [Pattern Name]

   ```typescript
   // code example
   ```
   ````

   ```

   ```

4. Update the MEMORY SYNC REPORT:
   - Increment version (PATCH for entries, MINOR for new sections)
   - Update `Last Updated` date to today
   - Document what was added

5. Use the `multi_replace_file_content` or `replace_file_content` tool to update `.agent/rules/memory.md`:
   - Use `multi_replace_file_content` when updating multiple non-contiguous sections (e.g., SYNC REPORT + Key Decisions Log)
   - Use `replace_file_content` for single contiguous block changes
   - **NEVER** use shell commands like `cat` to overwrite the file

6. Confirm to user what was added.

## Examples

**Input**: "ingat untuk selalu pakai apiAction untuk API calls"
**Action**: Add decision entry about using apiAction

**Input**: "issue: modal tidak close setelah submit"
**Action**: Add row to Known Issues table

**Input**: "pattern useDebounce untuk search"
**Action**: Add code pattern entry

## Rules

- Always add new decisions at TOP of Key Decisions Log (newest first)
- Use today's date in ISO format (YYYY-MM-DD)
- Keep entries concise but informative
- Reference Constitution principles when applicable
- If unclear what type of entry, ask user for clarification
