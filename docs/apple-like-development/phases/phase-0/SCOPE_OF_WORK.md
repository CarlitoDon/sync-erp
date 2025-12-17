# Phase 0: Scope of Work

**Foundation — System Correctness**

## IN SCOPE

### Modules

- Inventory (AVG, policy, stock movement)
- Procurement (PO → Bill → Journal)
- Sales (SO → Invoice → Stock)
- Accounting (Journal, posting)
- Payment (partial, saga, idempotent)

### Technical

- Saga orchestration
- Compensation logic
- Idempotency
- Concurrency guard
- Core integration tests

---

## OUT OF SCOPE

- UI polish
- Reporting
- Approval workflow
- FIFO/LIFO
- Multi-currency

---

## Exit Criteria ✅

- [x] Tidak ada silent failure
- [x] Tidak ada double side-effect
- [x] Semua write path dilindungi guard
- [x] Semua multi-step process menggunakan Saga

---

_Phase 0 completed: 2025-12-16_
