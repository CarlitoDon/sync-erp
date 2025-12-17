# Apple-Like Development Series

This directory contains the foundational documents for the "Apple-Like" pivot of Sync ERP. These documents define the philosophy, architecture, and operational rules for building an opinionated, user-centric ERP.

## Core Documents (All Phases)

| Document                               | Purpose                                    |
| :------------------------------------- | :----------------------------------------- |
| [GOALS.md](./GOALS.md)                 | What we're building — per phase objectives |
| [GUARDRAILS.md](./GUARDRAILS.md)       | Non-negotiable engineering rules           |
| [SCOPE_OF_WORK.md](./SCOPE_OF_WORK.md) | In-scope vs out-of-scope per phase         |
| [ROADMAP.md](./ROADMAP.md)             | Master phase plan (0→1→2→3)                |

## Directory Structure

```text
docs/apple-like-development/
├── GOALS.md              # Phase 0-3 objectives
├── GUARDRAILS.md         # Non-negotiable rules
├── SCOPE_OF_WORK.md      # In/out of scope
├── ROADMAP.md            # Master plan
├── README.md             # This index
│
├── phases/               # Phase-specific documentation
│   ├── phase-0/          # ✅ Foundation (complete)
│   ├── phase-1/          # 🚧 MVP (in progress)
│   ├── phase-2/          # ⏳ Hardening (planned)
│   └── phase-3/          # ⏳ Accounting (planned)
│
├── guides/               # Evergreen implementation guides
│   ├── ARCHITECTURE-MAP.md
│   ├── MODULE-EXAMPLE.md
│   └── ADAPTATION.md
│
├── features/             # Feature-specific designs
│   └── onboarding/
│
└── archive/              # Completed/superseded docs
```

## Phase Navigation

| Phase | Status         | Theme                        | Folder                        |
| :---- | :------------- | :--------------------------- | :---------------------------- |
| 0     | ✅ Complete    | System Correctness           | [phase-0/](./phases/phase-0/) |
| 1     | 🚧 In Progress | Usability Without Compromise | [phase-1/](./phases/phase-1/) |
| 2     | ⏳ Planned     | Operational Resilience       | [phase-2/](./phases/phase-2/) |
| 3     | ⏳ Planned     | Accounting & Compliance      | [phase-3/](./phases/phase-3/) |

## Reading Order

1. **[GOALS.md](./GOALS.md)** — Understand the "why" per phase
2. **[GUARDRAILS.md](./GUARDRAILS.md)** — Understand the hard rules
3. **[SCOPE_OF_WORK.md](./SCOPE_OF_WORK.md)** — Understand what's in/out
4. **[phases/phase-1/](./phases/phase-1/)** — Current phase details

## Anti-Goals (Seluruh Phase)

- Kecepatan development > kebenaran data
- UX convenience > domain integrity
- "Nanti juga bisa dibenerin di DB"

---

## Adding a New Phase

1. Create folder: `phases/phase-{n}/`
2. Add `README.md` with status and phase-specific docs
3. Update consolidated docs (GOALS, GUARDRAILS, SCOPE_OF_WORK)
4. Update `ROADMAP.md` with phase details
