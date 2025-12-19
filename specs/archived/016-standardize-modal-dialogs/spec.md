# Feature Specification: Standardize Modal Dialogs

**Feature Branch**: `16-standardize-modal-dialogs`  
**Created**: 2025-12-14  
**Status**: Draft  
**Input**: User description: "prefer dialog modal seperti create bill di halaman lainnya seperti create new supplier harusnya pop up form. menyeluruh ya!"

## User Scenarios & Testing

### User Story 1 - Consistent Create Experience (Priority: P1)

Sebagai pengguna aplikasi, saya ingin semua form "Create New" menggunakan popup modal yang konsisten, sehingga pengalaman pengguna seragam di seluruh aplikasi dan tidak mengganggu tampilan list yang sedang dilihat.

**Why this priority**: Konsistensi UX adalah fondasi untuk pengalaman pengguna yang baik. Pengguna tidak perlu mempelajari pattern baru untuk setiap halaman.

**Independent Test**: Buka halaman Suppliers → klik "+ Add Supplier" → form muncul sebagai popup modal, bukan inline form yang menggeser konten.

**Acceptance Scenarios**:

1. **Given** pengguna berada di halaman Suppliers, **When** klik "+ Add Supplier", **Then** form muncul sebagai popup modal dengan overlay semi-transparan.

2. **Given** pengguna berada di halaman Customers, **When** klik "+ Add Customer", **Then** form muncul sebagai popup modal dengan overlay semi-transparan.

3. **Given** pengguna berada di halaman Products, **When** klik "+ Add Product", **Then** form muncul sebagai popup modal dengan overlay semi-transparan.

4. **Given** pengguna berada di halaman Finance (CoA tab), **When** klik "+ Add Account", **Then** form muncul sebagai popup modal dengan overlay semi-transparan.

---

### User Story 2 - Modal Behavior Consistency (Priority: P2)

Sebagai pengguna, saya ingin semua modal memiliki behavior yang sama (tutup dengan klik overlay, tombol Cancel), sehingga interaksi predictable.

**Why this priority**: Behavior yang konsisten mengurangi learning curve dan frustasi pengguna.

**Independent Test**: Buka modal → klik area overlay (di luar form) → modal tertutup.

**Acceptance Scenarios**:

1. **Given** modal sedang terbuka, **When** pengguna klik overlay (area semi-transparan di luar modal), **Then** modal tertutup.

2. **Given** modal sedang terbuka, **When** pengguna klik tombol "Cancel", **Then** modal tertutup dan form direset.

3. **Given** modal sedang terbuka dengan form terisi, **When** submit berhasil, **Then** modal tertutup dan list direfresh.

---

### User Story 3 - Order Forms as Modal (Priority: P3)

Sebagai pengguna, saya ingin form "Create Order" (Sales Order, Purchase Order) juga menggunakan modal daripada inline form, sehingga konsisten dengan pattern lainnya.

**Why this priority**: Meskipun form order lebih kompleks, konsistensi tetap penting. Modal dapat discroll jika konten panjang.

**Independent Test**: Buka halaman Sales Orders → klik "+ New Order" → form muncul sebagai popup modal (scrollable jika panjang).

**Acceptance Scenarios**:

1. **Given** pengguna berada di halaman Sales Orders, **When** klik "+ New Order", **Then** form muncul sebagai popup modal yang scrollable.

2. **Given** pengguna berada di halaman Purchase Orders, **When** klik "+ New Order", **Then** form muncul sebagai popup modal yang scrollable.

---

### Edge Cases

- Apa yang terjadi jika pengguna mengisi form lalu klik overlay? Modal tertutup tanpa menyimpan (atau konfirmasi jika ada unsaved changes).
- Apa yang terjadi jika form panjang melebihi viewport? Modal scrollable dengan max-height.
- Apa yang terjadi jika validation error? Modal tetap terbuka, error message ditampilkan.

## Requirements

### Functional Requirements

- **FR-001**: Form "Create Supplier" HARUS menggunakan popup modal, bukan inline form.
- **FR-002**: Form "Create Customer" HARUS menggunakan popup modal, bukan inline form.
- **FR-003**: Form "Create Product" HARUS menggunakan popup modal, bukan inline form.
- **FR-004**: Form "Create Account" (Finance page) HARUS menggunakan popup modal, bukan inline form.
- **FR-005**: Form "Create Sales Order" HARUS menggunakan popup modal, bukan inline form.
- **FR-006**: Form "Create Purchase Order" HARUS menggunakan popup modal, bukan inline form.
- **FR-007**: Semua modal HARUS menutup saat overlay diklik.
- **FR-008**: Semua modal HARUS memiliki tombol "Cancel" yang berfungsi.
- **FR-009**: Modal dengan konten panjang HARUS scrollable.
- **FR-010**: Overlay modal HARUS semi-transparan dengan z-index yang benar (konten modal di atas overlay).

### Pages to Update

| Page                         | Current Behavior | Target Behavior |
| ---------------------------- | ---------------- | --------------- |
| Suppliers.tsx                | Inline form      | Modal popup     |
| Customers.tsx                | Inline form      | Modal popup     |
| Products.tsx                 | Inline form      | Modal popup     |
| Finance.tsx (Create Account) | Inline form      | Modal popup     |
| SalesOrders.tsx              | Inline form      | Modal popup     |
| PurchaseOrders.tsx           | Inline form      | Modal popup     |

### Reference Implementation

Gunakan pattern yang sudah ada di:

- `AccountsPayable.tsx` - Create Bill modal
- `JournalEntries.tsx` - Create Journal Entry modal

## Success Criteria

### Measurable Outcomes

- **SC-001**: Semua 6 halaman yang teridentifikasi menggunakan modal popup setelah implementasi.
- **SC-002**: Semua modal menutup dalam waktu kurang dari 100ms saat overlay diklik.
- **SC-003**: Zero instance inline form toggle (`showForm && <div className="bg-white...`) tersisa di codebase.
- **SC-004**: Pengalaman pengguna konsisten - pattern yang sama di semua halaman.
- **SC-005**: Tidak ada z-index bug - modal content selalu clickable di atas overlay.

## Constitution Compliance

### Frontend Architecture Checklist

- [ ] **Feature Isolation**: Logic in `src/features` (not global pages/components)
- [ ] **Component Abstraction**: Modal pattern extracted to reusable component if repeated
- [ ] **Hook Abstraction**: Any repeated logic extracted to custom hook
- [ ] **No Copy-Paste**: Modal structure consistent, no duplicate patterns
- [ ] **Global Error Handling**: Errors handled via Axios interceptor, not per-page try-catch
- [ ] **Success Toasts**: Using `apiAction()` helper, not direct toast imports
- [ ] **Confirmation Dialogs**: Using `useConfirm()` hook, not native `window.confirm()`
- [ ] **Systematic Updates**: All instances updated when changing patterns (grep verified)

## Assumptions

- Modal pattern dari `AccountsPayable.tsx` adalah reference yang benar (overlay dengan rgba, z-index proper, relative z-10 pada content).
- Form fields dan validation logic tidak berubah, hanya wrapper yang berubah dari inline ke modal.
- Akan membuat `FormModal.tsx` sebagai reusable component untuk menghindari code duplication (sesuai Constitution VI - DRY Patterns).
- Unsaved changes confirmation adalah out-of-scope untuk fitur ini (dapat ditambahkan di iterasi berikutnya).
