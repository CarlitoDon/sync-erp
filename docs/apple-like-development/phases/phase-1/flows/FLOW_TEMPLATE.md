# Flow Template

Copy this template for each new flow. Fill in all sections.

**Reference**: [GOLDEN_FLOW_POST_INVOICE.md](./GOLDEN_FLOW_POST_INVOICE.md)

---

## 1. Flow Definition

| Property      | Value                             |
| :------------ | :-------------------------------- |
| **Flow Name** | [Name]                            |
| **Domain**    | [O2C / P2P / Inventory / Finance] |
| **Actor**     | [Role]                            |
| **Intent**    | [What this flow accomplishes]     |

---

## 2. Preconditions (Hard Guards)

```txt
Company:
- [condition]

Entity:
- [condition]

Inventory:
- [condition if applicable]

Concurrency:
- [condition]
```

---

## 3. API Contract

```http
[METHOD] /api/[endpoint]
Headers:
  Idempotency-Key: [required/optional]

Response:
  [status] [result]
```

### Idempotency Rule

```txt
Scope: [SCOPE_NAME]
Key: [entityId + companyId]
```

---

## 4. High-Level Sequence

```
UI
 ↓
Controller
 ↓
Policy Guards
 ↓
Idempotency Lock
 ↓
[SagaName]
   ├─ Step 1: [action]
   ├─ Step 2: [action]
   └─ Step 3: [action]
 ↓
Response
```

---

## 5. Detailed Saga Steps

### Step 0 — Saga Lock

```txt
Lock entity: [Entity(id)] FOR UPDATE
```

### Step 1 — [Step Name]

**Action**: [What happens]

**Invariant**:

```txt
[invariant expression]
```

**Failure**: [What causes failure]

**Compensation**:

```txt
[How to reverse]
```

### Step 2 — [Step Name]

**Action**: [What happens]

**Invariant**:

```txt
[invariant expression]
```

**Compensation**:

```txt
[How to reverse]
```

### Step 3 — [Step Name]

**Action**: [What happens]

**Invariant**: [constraint]

---

## 6. Compensation Matrix

| Step Failed | Compensation Required |
| :---------- | :-------------------- |
| Step 1      | [None / list steps]   |
| Step 2      | [list steps]          |
| Step 3      | [list steps]          |

---

## 7. Idempotency Behavior

### Retry after success

- [behavior]

### Retry during PROCESSING

- [behavior]

---

## 8. Error Taxonomy

| Code         | When        | Retryable |
| :----------- | :---------- | :-------: |
| [ERROR_CODE] | [condition] |   ✅/❌   |

---

## 9. Resulting State (Post-Conditions)

```txt
Entity:
- [state]

Related:
- [side effects]

System:
- [idempotency state]
- [saga log state]
```

---

_Flow documented: [date]_
