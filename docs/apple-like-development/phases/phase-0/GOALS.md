# Phase 0: Goals

**Theme**: System Correctness Foundation

## Primary Goal

> Sistem **benar secara domain**, **aman dari race condition**, dan **bisa diaudit**, bahkan saat gagal.

## Success Means

- Tidak ada silent failure
- Tidak ada double side-effect
- Tidak ada state "kelihatannya sukses tapi datanya salah"

## Explicit Outcomes

- Semua write path dilindungi guard
- Semua multi-step process menggunakan Saga
- Semua side-effect bisa direverse atau dilacak

## Anti-Goals

- Kecepatan development > kebenaran data
- UX convenience > domain integrity
- "Nanti juga bisa dibenerin di DB"

---

_Phase 0 completed: 2025-12-16_
