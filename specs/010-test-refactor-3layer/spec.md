# Feature Specification: Test Refactor for 3-Layer API Architecture

**Feature Branch**: `010-test-refactor-3layer`  
**Created**: 2025-12-12  
**Status**: Draft  
**Input**: User description: "penyesuaian test setelah refactor api menjadi 3 layer. target semua test files passed"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fix Existing Service Unit Tests (Priority: P1)

Sebagai developer, saya ingin semua unit test untuk service layer berjalan dengan benar setelah refaktor ke 3-layer architecture, sehingga saya bisa yakin business logic tetap berfungsi seperti sebelumnya.

**Why this priority**: Service layer adalah inti business logic. Tanpa test yang jalan, tidak ada jaminan bahwa logic tetap benar setelah refaktor.

**Independent Test**: Dapat ditest dengan menjalankan `npm run test --workspace=@sync-erp/api` dan memverifikasi semua service tests pass.

**Acceptance Scenarios**:

1. **Given** existing service test files (15 files), **When** refaktor mock ke repository layer, **Then** semua test cases dalam file tersebut berjalan (tidak 0 test)
2. **Given** service tests yang mock repository, **When** test dijalankan, **Then** hasil test sama seperti sebelum refaktor (pass/fail logic sama)

---

### User Story 2 - Fix Route/Controller Tests (Priority: P1)

Sebagai developer, saya ingin route tests (yang test HTTP endpoint) berfungsi dengan benar dengan service layer yang baru, sehingga API contract tetap terjaga.

**Why this priority**: Route tests memvalidasi HTTP layer. Saat ini gagal karena service memanggil repository yang tidak di-mock dengan benar.

**Independent Test**: Dapat ditest dengan menjalankan route tests dan memverifikasi semua endpoint masih mengembalikan response yang diharapkan.

**Acceptance Scenarios**:

1. **Given** route test files mocking services, **When** tests dijalankan, **Then** tidak ada "Server Error" dari service layer
2. **Given** controller menggunakan service baru, **When** route tests dijalankan, **Then** semua assertions pass

---

### User Story 3 - Create Repository Mock Infrastructure (Priority: P2)

Sebagai developer, saya ingin memiliki shared mock untuk repository layer, sehingga service tests dapat di-isolasi dari database dengan konsisten.

**Why this priority**: Foundation untuk testing 3-layer. Tanpa repository mocks, tidak bisa unit test service layer dengan benar.

**Independent Test**: Dapat ditest dengan memverifikasi file mock ada dan digunakan oleh minimal 1 service test.

**Acceptance Scenarios**:

1. **Given** repository mock utilities, **When** diimport di service test, **Then** dapat mock semua CRUD operations per entity
2. **Given** centralized mock file, **When** perlu update mock behavior, **Then** hanya perlu update di satu tempat

---

### User Story 4 - Maintain Test Coverage (Priority: P3)

Sebagai developer, saya ingin memastikan test coverage tidak berkurang setelah refaktor, sehingga quality assurance tetap terjaga.

**Why this priority**: Nice-to-have tapi penting untuk long-term. Memastikan refaktor tidak menghilangkan test scenarios yang sudah ada.

**Independent Test**: Dapat ditest dengan membandingkan jumlah test cases sebelum dan sesudah refaktor.

**Acceptance Scenarios**:

1. **Given** test suite yang di-refaktor, **When** dihitung jumlah test cases, **Then** jumlahnya minimal sama dengan sebelum refaktor
2. **Given** critical business logic, **When** test coverage diperiksa, **Then** semua critical paths masih tercover

---

### Edge Cases

- Apa yang terjadi jika repository mock lupa di-reset antar test? → Harus ada beforeEach reset
- Bagaimana menangani service yang memanggil service lain? → Mock dependency service juga
- Bagaimana jika service method berubah signature? → Update test menyesuaikan

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST memiliki mock utilities untuk semua repository classes
- **FR-002**: System MUST dapat menjalankan semua 15 service unit tests tanpa error
- **FR-003**: System MUST dapat menjalankan semua route tests dengan service mocks yang benar
- **FR-004**: Service tests MUST mock repository layer, bukan Prisma client langsung
- **FR-005**: Test mocks MUST reset state sebelum setiap test case
- **FR-006**: System MUST support mocking cross-service dependencies

### Key Entities

- **Repository Mocks**: Mock implementations untuk setiap repository class (AccountRepository, InvoiceRepository, dll)
- **Service Mocks**: Mock implementations untuk service layer (sudah ada di `services.mock.ts`)
- **Test Factories**: Utilities untuk generate test data yang konsisten

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Semua 15 service test files menjalankan test cases (tidak ada file dengan 0 tests)
- **SC-002**: `npm run test --workspace=@sync-erp/api` exit dengan code 0 (semua tests pass)
- **SC-003**: Tidak ada "Server Error" atau unhandled exceptions di test output
- **SC-004**: Total test count minimal sama dengan sebelum refaktor
