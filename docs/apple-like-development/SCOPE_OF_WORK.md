# Scope of Work (Phase 0–3)

Dokumen ini mendefinisikan **apa yang dikerjakan** dan **apa yang sengaja tidak dikerjakan**.

---

## Phase 0 — Foundation

### IN SCOPE

#### Modules

- Inventory (AVG, policy, stock movement)
- Procurement (PO → Bill → Journal)
- Sales (SO → Invoice → Stock)
- Accounting (Journal, posting)
- Payment (partial, saga, idempotent)

#### Technical

- Saga orchestration
- Compensation logic
- Idempotency
- Concurrency guard
- Core integration tests

---

### OUT OF SCOPE

- UI polish
- Reporting
- Approval workflow
- FIFO/LIFO
- Multi-currency

---

## Phase 1 — User-Facing

### IN SCOPE

- CRUD UI
- Draft vs Posted UX
- RBAC basic
- Read-only reports

---

### OUT OF SCOPE

- Advanced analytics
- Custom workflow builder
- Automation rules

---

## Phase 2 — Hardening

### IN SCOPE

- Observability (logs, trace, saga log)
- Invariant checker job
- Performance baseline
- Admin repair tools

---

### OUT OF SCOPE

- Horizontal scaling
- Event streaming
- Multi-region deployment

---

## Phase 3 — Accounting Completeness

### IN SCOPE

- Closing period
- Journal locking
- Adjusting entries
- Audit trail
- Export (CSV/Excel)

---

### OUT OF SCOPE

- Tax engine kompleks
- Regulatory automation
- Localization accounting rules

---

## Definition of "Not Scope Creep"

Sebuah request **DITOLAK** jika:

- Melanggar guardrail
- Mengaburkan invariant
- Membuat error path implicit
- Mengurangi auditability

---

## Final Note

> Phase 0–3 bukan tentang fitur banyak.
> Ini tentang **sistem yang tidak berbohong**.
