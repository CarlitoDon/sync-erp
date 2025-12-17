# Phase 1: Exit Criteria

Menentukan kapan Phase 1 **selesai**.

Tanpa exit criteria, Phase 1 tidak pernah selesai.

---

## Phase 1 is COMPLETE when:

### Documentation Complete

- [ ] All Phase 1 flows documented in USER_FLOWS.md
- [ ] All state machines defined in STATE_MACHINES.md
- [ ] All API contracts specified in API_CONTRACTS.md
- [ ] All user-facing errors cataloged in ERROR_CATALOG.md
- [ ] RBAC matrix defined in RBAC_MATRIX.md
- [ ] UI guard rules specified in UI_GUARD_RULES.md

---

### Technical Requirements

- [ ] No frontend-calculated state (backend owns reality)
- [ ] All write APIs idempotent
- [ ] All cross-aggregate operations use Saga
- [ ] All Sagas have compensation logic
- [ ] All user-facing errors mapped to ERROR_CATALOG

---

### Functional Requirements

- [ ] Invoice flow: Create → Post → Pay (complete)
- [ ] Bill flow: Create → Post → Pay (complete)
- [ ] Sales Order flow: Create → Confirm → Invoice
- [ ] Purchase Order flow: Create → Confirm → Bill
- [ ] Stock movements recorded correctly
- [ ] Journals balanced (debit == credit)

---

### Quality Gates

- [ ] All flows have integration tests
- [ ] All state transitions tested
- [ ] All error cases covered
- [ ] No `console.log` in production code
- [ ] No `any` types in business logic

---

### User Experience

- [ ] User non-teknis bisa menjalankan flow utama
- [ ] Loading states prevent double-submit
- [ ] Confirmation dialogs for destructive actions
- [ ] Clear error messages (from ERROR_CATALOG)

---

## Phase 1 is NOT complete if:

- ❌ Any flow requires "workaround"
- ❌ Any state transition is undefined
- ❌ Any error shows generic message
- ❌ Frontend makes business decisions
- ❌ Data can be corrupted via UI

---

## Sign-off Checklist

| Criteria                    | Approved By | Date |
| :-------------------------- | :---------- | :--- |
| Documentation complete      |             |      |
| Technical requirements met  |             |      |
| Functional requirements met |             |      |
| Quality gates passed        |             |      |
| UX requirements satisfied   |             |      |

---

_Document required before Phase 1 work proceeds._
