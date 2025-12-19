# Data Model: PENDING Shape Guard

**Feature**: 027-pending-shape-guard  
**Date**: 2025-12-17

## Overview

This feature does not introduce new data entities. It operates on the existing `Company.businessShape` field.

## Existing Entities (Referenced)

### Company

| Field         | Type          | Description                                  |
| ------------- | ------------- | -------------------------------------------- |
| id            | string        | Unique identifier                            |
| businessShape | BusinessShape | PENDING, RETAIL, DISTRIBUTION, MANUFACTURING |
| name          | string        | Company name                                 |

### BusinessShape Enum

```prisma
enum BusinessShape {
  PENDING
  RETAIL
  DISTRIBUTION
  MANUFACTURING
}
```

## State Machine

```
PENDING ─────[Shape Selection]────→ RETAIL/DISTRIBUTION/MANUFACTURING
   │                                           │
   │ (Operations blocked)                      │ (Operations allowed)
   ▼                                           ▼
[Guard rejects]                           [Guard allows]
```

## Request Context

The guard operates on the request context, not persisted data:

| Context Property          | Type          | Source            |
| ------------------------- | ------------- | ----------------- |
| req.company               | Company       | Auth middleware   |
| req.company.businessShape | BusinessShape | DB lookup in auth |

## No Schema Changes Required

- ✅ `BusinessShape` enum already exists
- ✅ `Company.businessShape` field already exists
- ✅ No new tables or fields needed
