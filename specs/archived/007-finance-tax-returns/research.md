# Research: Finance Tax & Accruals

**Feature**: Finance Tax, Returns & Accruals
**Status**: Completed

## 1. Needs Clarification Resolution

No unresolved clarifications. Business logic for Tax (VAT In/Out) and Accruals verified with user.

## 2. Technology Choices

### Tax Calculation

- **Decision**: Backend calculation in `InvoiceService`/`BillService`.
- **Rationale**: Tax logic determines financial liability; must be authoritative and secure, not trusted from client.
- **Alternatives**: Frontend calc (Too risky), Database stored procedure (Too complex for MVP).

### Accrual Handling

- **Decision**: Trigger Journal Entry immediately on `InventoryService.processGoodsReceipt`.
- **Rationale**: Real-time accounting provides accurate "Stock Received Not Billed" liability.
- **Implementation**:
  - `InventoryService` calls `JournalService.postGoodsReceipt`.
  - `BillService` calls `JournalService.postBill` (clearing Suspense).

## 3. Implementation Patterns

### Journal Entry Splitting

- **Pattern**: Multi-line journals.
- **Current**: 2 lines (Dr/Cr).
- **New**: 3+ lines (Dr AR, Cr Revenue, Cr Tax).
- **Impact**: `JournalService.create` supports array of lines; need strictly typed helpers.

### Sales Return Reversal

- **Pattern**: "Contra-Revenue" / "Contra-COGS".
- **Logic**:
  - Physical: Stock + N.
  - Financial: Dr Inventory Asset, Cr COGS.
  - No impact on Revenue until Credit Note (out of scope, handled via Invoice adjustment if needed).

## 4. Risks & Mitigations

- **Risk**: Rounding errors on Tax.
- **Mitigation**: Use `Decimal` (Prisma) consistently. Calculate tax per line item or subtotal? -> **Default to Subtotal** to match standard invoice/bill practices (Total \* Rate).

- **Risk**: Moving Average Cost changes between Shipment and Return.
- **Mitigation**: Returns should ideally use the _Original Cost_ of the specific shipment if traceable. MVP approach: Use _Current Average Cost_ if tracing is complex, or _Original Cost_ if FIFO/Batch is available.
  - **Decision**: Use Current Average Cost for MVP to simplify `InventoryService` logic, as precise lot tracking isn't specified.
