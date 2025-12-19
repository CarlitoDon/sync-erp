# Data Model: Prevent Journal Double-Posting

**Feature**: 024-fix-journal-double-post  
**Date**: 2025-12-16

---

## Schema Changes

### New Enum: JournalSourceType

```prisma
enum JournalSourceType {
  INVOICE       // From invoice posting
  BILL          // From bill posting
  PAYMENT       // From payment recording
  CREDIT_NOTE   // From credit note creation
  ADJUSTMENT    // Manual adjustment
}
```

### JournalEntry (Modified)

```prisma
model JournalEntry {
  id         String            @id @default(uuid())
  companyId  String
  reference  String?                  // Display text (existing)
  date       DateTime
  memo       String?
  sourceType JournalSourceType?       // NEW: Source document type
  sourceId   String?                  // NEW: Source document ID
  createdAt  DateTime          @default(now())

  company Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  lines   JournalLine[]

  @@index([companyId])
  @@unique([companyId, sourceType, sourceId])  // NEW: Prevent double-posting
}
```

---

## Field Definitions

| Field      | Type              | Required           | Description                                         |
| ---------- | ----------------- | ------------------ | --------------------------------------------------- |
| id         | String            | Yes                | UUID primary key                                    |
| companyId  | String            | Yes                | Tenant ID                                           |
| reference  | String            | No                 | Human-readable reference (e.g., "Invoice: INV-001") |
| date       | DateTime          | Yes                | Journal date (business event date)                  |
| memo       | String            | No                 | Additional notes                                    |
| sourceType | JournalSourceType | **NEW** (nullable) | Type of source document                             |
| sourceId   | String            | **NEW** (nullable) | ID of source document                               |
| createdAt  | DateTime          | Yes                | Record creation timestamp                           |

---

## Constraints

| Constraint  | Fields                              | Purpose                             |
| ----------- | ----------------------------------- | ----------------------------------- |
| Primary Key | `id`                                | Unique journal lookup               |
| Unique      | `(companyId, sourceType, sourceId)` | **NEW**: Prevent duplicate journals |
| Index       | `(companyId)`                       | Tenant queries                      |
| Foreign Key | `companyId` → Company               | Multi-tenant relation               |

---

## Unique Constraint Behavior

```
CASE 1: Same source document attempted twice
  (co-1, INVOICE, inv-001) ✓ First insert
  (co-1, INVOICE, inv-001) ✗ Blocked (P2002 error)

CASE 2: Different source documents
  (co-1, INVOICE, inv-001) ✓ Allowed
  (co-1, INVOICE, inv-002) ✓ Allowed

CASE 3: Manual entries (NULL source)
  (co-1, NULL, NULL) ✓ Allowed
  (co-1, NULL, NULL) ✓ Allowed (PostgreSQL treats NULLs as distinct)
```

---

## Migration Notes

- `sourceType` and `sourceId` are **nullable** for backward compatibility
- Existing journals will have NULL values (treated as manual entries)
- Unique constraint only enforces when both fields are non-null
- No data backfill required
