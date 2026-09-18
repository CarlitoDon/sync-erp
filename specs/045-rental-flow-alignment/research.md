# Technical Research: Rental Flow Alignment (Feature 045)

## 1. Accounting Integration & Double-Entry Ledger (Option A)

### Context & Decision
During clarification, Option A was ratified: all financial transactions across the rental lifecycle (down payment, 70% settlement upon delivery, extensions, damage/cleaning fees, and cancellation refunds) MUST automatically trigger balanced dual-entry journals (`JournalEntry` & `JournalLine`) in the Sync ERP Finance module.

### General Ledger Account Mapping
Based on the ratified Chart of Accounts (COA) in `packages/database/prisma/seed.ts` and `apps/api/src/modules/accounting/`:

| Transaction Type | Debit Account | Credit Account | Journal Reference Pattern |
|------------------|---------------|----------------|---------------------------|
| **1. Down Payment (~30% DP)** | Kas / Bank (`1000`/`1100`/`1200`) | Uang Muka Sewa / Customer Deposits (`2200`) | `Rental DP: {orderNumber}` |
| **2. Serah Terima & Pelunasan 70%** | Kas / Bank (`1000`/`1200`) [Sisa 70%]<br>Uang Muka Sewa (`2200`) [Kliring DP 30%] | Pendapatan Sewa (`4200`) [Subtotal Sewa]<br>Pendapatan Ongkir/Sewa (`4200`) [Delivery Fee] | `Rental Release: {orderNumber}` |
| **3. Perpanjangan (Extension)** | Kas / Bank (`1000`/`1200`) | Pendapatan Sewa (`4200`) [Biaya Sewa Tambahan]<br>Pendapatan Ongkir/Sewa (`4200`) [Biaya Armada Ekstra] | `Rental Extension: {orderNumber}` |
| **4. Tagihan Denda Cuci / Rusak (Return)** | Kas / Bank (`1000`/`1200`) | Pendapatan Denda / Sewa (`4200`) | `Rental Damage Fee: {orderNumber}` |
| **5. Refund Pembatalan (Cancel)** | Uang Muka Sewa (`2200`) | Kas / Bank (`1000`/`1200`) | `Rental Refund DP: {orderNumber}` |

### Rationale
- Zero manual journal input eliminates accounting discrepancies between operational status and cash flow balances.
- Automatic clearing of `2200` (Customer Deposits / Uang Muka) upon unit release correctly shifts liability into earned revenue (`4200`) at the exact moment the service period starts (`ACTIVE`).
- Dual-entry rules strictly satisfy `totalDebit == totalCredit` in every transaction client (`Prisma.TransactionClient`).

### Alternatives Considered
- *Manual journal entries by accounting staff*: Rejected. Prone to human error, delayed revenue recognition, and synchronization lag.
- *Single-entry cash register logging*: Rejected. Violates the core ERP constitution requiring double-entry accounting integrity.

---

## 2. Elimination of Pseudo Security Deposit & Unified Release Settlement

### Context & Decision
The existing system architecture had an artifact from a theoretical rental model: requiring a large security deposit (`RentalDeposit`), withholding it during the lease, and calculating a deposit refund or deduction at return. 

In Santi Living's real SOP:
1. Customers do NOT pay a held cash security deposit.
2. Booking commitment is a flexible down payment (DP ~30%).
3. The remaining balance (70%) is collected directly by the delivery driver upon arrival (Cash / QRIS / Transfer).
4. Physical damage or stain fees at return are billed on the spot directly to the customer.

### Technical Approach
- Repurpose `depositAmount` in `RentalOrder` to represent the **Down Payment (DP)** amount to maintain backwards database schema compatibility without breaking existing migrations.
- Enhance `ReleaseRentalOrderInput` in `@sync-erp/shared` to include payment settlement parameters (`settlementAmount`, `paymentMethod`, `paymentAccountId`, `notes`).
- In `RentalOrderFulfillmentService.releaseOrder`:
  - Verify and record settlement payment.
  - Automatically update `rentalPaymentStatus` to `CONFIRMED` (Lunas).
  - Automatically set `paymentConfirmedAt = new Date()`.
  - Dispatch `postRentalReleaseSettlement` journal posting in the same database transaction.

### Rationale
- Simplifies operational flow: Admin verifies driver's WhatsApp photo/receipt and completes release + payment confirmation in a single click.
- Fixes the bug where released orders remained labeled as "Belum Bayar" (`PENDING`).

### Alternatives Considered
- *Separate payment step after release*: Rejected. Field operations confirm that release and payment happen concurrently upon physical handover. A two-step UI leads to forgotten payment records.

---

## 3. Dynamic Unit Status Routing on Return (Clean vs Soiled/Damaged)

### Context & Decision
Previously, `RentalReturnService.processReturn` changed unit status to `RETURNED` and then `finalizeReturn` shifted units to `CLEANING`. This caused clean mattresses to be locked out of available stock unnecessarily.

In Santi Living's real SOP:
- Over 90% of mattresses return in good condition and can be rented out immediately.
- Only units with urine stains, spills, or physical tears need washing or repairs.

### Technical Approach
- During `processReturn`, inspect the `condition` and `damageSeverity` of each unit in `ProcessReturnInput.units`:
  - If `condition === 'GOOD' || condition === 'NEW'` and no damage severity: Transition unit directly to `UnitStatus.AVAILABLE`.
  - If `condition === 'FAIR' || condition === 'NEEDS_REPAIR'` or `damageSeverity` is present: Transition unit directly to `UnitStatus.MAINTENANCE`.
- Immediate damage billing: If damage charges are calculated, record on-the-spot payment settlement and post `postRentalDamageFee` journal.
- Order immediately marks as `RentalOrderStatus.COMPLETED`.

### Rationale
- Restores immediate inventory turnover for clean units without manual multi-step cleanup clicks.
- Isolates dirty units in `MAINTENANCE` so they cannot be allocated to new booking drafts.

---

## 4. Partial vs Full Extension & Extra Logistics Fleet Fee

### Context & Decision
When a group or customer rents multiple beds (e.g., 3 beds) and only 1 bed needs to stay longer:
- Full extension: Extends all units, no extra trip needed until the new date.
- Partial extension: Extends selected units only. Because the driver now has to make two separate pickup trips (Trip 1 for the 2 returning beds, Trip 2 for the 1 extended bed), an extra fleet fee (`deliveryFee` / `extraFleetFee`) must be billed.

### Technical Approach
- Leverage existing `RentalOrderExtension` model which already contains `deliveryFee`, `deliveryFeeLabel`, and `items` (`RentalOrderExtensionItem`).
- Support explicit unit selection (`rentalOrderItemId` or unit assignment mapping) in `ExtendRentalOrderInput`.
- Pass `deliveryFee` to extension total and record journal posting crediting rental revenue and logistics fee.
- Update each unit's effective return date independently in the UI (`RentalItemsTable` and `UnitAssignmentsCard`).

---

## 5. Overdue Management as Graceful Daily Rental Extension

### Context & Decision
Customer rooms are occasionally locked during scheduled pickup, or customers request an extra day last minute. Santi Living SOP does not impose punitive late penalties that alienate customers. Instead, overdue days are converted into regular daily rentals.

### Technical Approach
- Introduce an action procedure `convertOverdueToExtension` or extend existing `extendOrder` with a daily rate calculator.
- Calculate additional days: `ceil((now - rentalEndDate) / 1 day)`.
- Apply proportional daily rental rate.
- Pre-generate a WhatsApp template: *"Halo Kak [Name], sewa kasur diperpanjang s.d. [Date Baru]. Total perpanjangan [Rp X]. Mohon konfirmasi transfer ya Kak. Terima kasih!"*

---

## Summary of Architectural Consensus
All decisions respect the repository's strict architecture:
- Schema updates originate in `packages/shared/src/validators/rental.ts`.
- Types inferred using `z.infer`.
- All operations scoped by `companyId`.
- No `any` anywhere.
