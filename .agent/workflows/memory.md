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

1. Load existing memory at `.agent/rules/memory.md`.

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

5. Write updated memory back to `.agent/rules/memory.md`.

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
