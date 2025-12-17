# Phase 2: Guardrails

**Non-Negotiable Rules for Hardening Phase**

## 1. Observability Rules

### 1.1 Traceability

- Setiap request harus punya trace ID
- Error harus bisa dilacak dari frontend ke DB

### 1.2 Saga Logging

- Semua Saga step harus logged
- Compensation attempts harus visible

---

## 2. Invariant Monitoring

### 2.1 Checker Jobs

- Invariant checker harus scheduled
- Violations harus alert, bukan silent

### 2.2 No Silent Corruption

- Anomali data harus detectible
- Auto-repair hanya dengan audit trail

---

## 3. Performance Baseline

### 3.1 Measurement

- Response time baseline per endpoint
- Query performance tracked

### 3.2 Degradation Alerts

- Performance regression harus visible
- Load testing before major release

---

## 4. Admin Tools

### 4.1 Repair Without DB Hack

- Admin repair tools harus via API
- No direct DB manipulation in production

### 4.2 Audit Trail

- Semua admin action harus logged
- Who, when, what changed
