# Carla Extension Input Report — Santi Living Rental Extensions
**Date:** 2026-05-28
**Scope:** Preflight read-only analysis of 3 extension rows from Pengiriman sheet
**Company:** Santi Living (`f023d223-f787-4007-9660-1bfa155c6ec4`)
**Status:** PREFLIGHT ONLY — NO WRITES EXECUTED

---

## 1. Extension Rows Summary

| Row | Customer | Period | Total (Rp) | Items | Status |
|-----|----------|--------|------------|-------|--------|
| 13 | Feris | 2026-03-25 → 2026-03-26 | 239,000 | Double 120 ×2, Queen 160 ×2 | READY (parent found) |
| 14 | Feris | 2026-03-26 → 2026-03-27 | 131,000 | Double 120 ×1, Queen 160 ×1 | READY (parent found) |
| 16 | Yani | 2026-03-24 → 2026-03-25 | 80,000 | Queen 160 ×1 | **BLOCKED** (parent missing) |

---

## 2. Feris Parent Order — FOUND

**Order:** RNT-202605-00044
**ID:** `0346c980-42ad-442f-b432-e58e0a42cc2e`
**Partner:** Cust SL - Feris Sardonoharjo (`e2f307e4-138c-428e-a0e6-6be618852686`)
**Source:** SL-WA-017
**Period:** 2026-03-22 → 2026-03-24
**Status:** DRAFT, PENDING payment
**Subtotal:** Rp 638,000 | Delivery: Rp 47,000 | Total: Rp 685,000
**Current extensions:** 0 (none yet)

### Order Items (for extension mapping)

| Line ID | Bundle Name | Bundle ID | Qty | Unit Price | Subtotal |
|---------|-------------|-----------|-----|------------|----------|
| `02482d44-0363-4e00-be6e-71e899b961cb` | Paket Queen 160 | `eb015eaf-12d0-49cb-a0ca-27c5aa9e1d09` | 3 | 59,000 | 354,000 |
| `cfeb0ac4-ac84-4e5f-b126-14df1640f968` | Paket Double 120 | `aaa6e786-891a-4071-b9a1-94b3b2946c7a` | 2 | 49,000 | 196,000 |
| `431d851e-9dba-4bbc-b206-8f5340ab9767` | Paket Single 100 | `d96e5cec-3a69-4bb6-8b40-8429676e93d1` | 1 | 44,000 | 88,000 |

---

## 3. Extension Row 13 — Feris (2026-03-25 → 2026-03-26)

### Item Mapping

| Source Item | Qty | Maps to Order Line | Bundle ID | Unit Price |
|-------------|-----|-------------------|-----------|------------|
| PAKET Double 120 | 2 | `cfeb0ac4-ac84-4e5f-b126-14df1640f968` | `aaa6e786-891a-4071-b9a1-94b3b2946c7a` | 49,000 |
| PAKET Double 160/Queen 160 | 2 | `02482d44-0363-4e00-be6e-71e899b961cb` | `eb015eaf-12d0-49cb-a0ca-27c5aa9e1d09` | 59,000 |

### Amount Breakdown

| Component | Calculation | Amount |
|-----------|-------------|--------|
| Double 120 ×2 | 2 × 49,000 | 98,000 |
| Queen 160 ×2 | 2 × 59,000 | 118,000 |
| **Item subtotal** | | **216,000** |
| **Row total (source)** | | **239,000** |
| **Gap (delivery/fee)** | 239,000 − 216,000 | **23,000** |

### Proposed `rental_order_extend` call (NOT YET EXECUTED)

```json
{
  "orderId": "0346c980-42ad-442f-b432-e58e0a42cc2e",
  "newEndDate": "2026-03-26T17:00:00.000Z",
  "items": [
    {
      "rentalOrderItemId": "cfeb0ac4-ac84-4e5f-b126-14df1640f968",
      "quantity": 2,
      "additionalAmount": 98000,
      "notes": "Extension: PAKET Double 120 x2, 1 day late return"
    },
    {
      "rentalOrderItemId": "02482d44-0363-4e00-be6e-71e899b961cb",
      "quantity": 2,
      "additionalAmount": 118000,
      "notes": "Extension: PAKET Queen 160 x2, 1 day late return"
    }
  ],
  "additionalAmount": 23000,
  "reason": "Late return extension per Pengiriman sheet row 13",
  "isPaid": true,
  "paidAt": "2026-03-26T12:00:00.000Z",
  "businessDate": "2026-03-26T12:00:00.000Z",
  "allowHistorical": true,
  "updateOrderTotal": true,
  "updateOrderDates": false
}
```

**⚠️ ISSUE:** The 23,000 gap (delivery/pickup fee for the extension) has no dedicated `deliveryFee` field in `rental_order_extend`. The order-level `additionalAmount` COULD absorb it, but it's unclear whether the ERP would correctly categorize this as a delivery charge vs. rental revenue.

---

## 4. Extension Row 14 — Feris (2026-03-26 → 2026-03-27)

### Item Mapping

| Source Item | Qty | Maps to Order Line | Bundle ID | Unit Price |
|-------------|-----|-------------------|-----------|------------|
| PAKET Double 120 | 1 | `cfeb0ac4-ac84-4e5f-b126-14df1640f968` | `aaa6e786-891a-4071-b9a1-94b3b2946c7a` | 49,000 |
| PAKET Double 160/Queen 160 | 1 | `02482d44-0363-4e00-be6e-71e899b961cb` | `eb015eaf-12d0-49cb-a0ca-27c5aa9e1d09` | 59,000 |

### Amount Breakdown

| Component | Calculation | Amount |
|-----------|-------------|--------|
| Double 120 ×1 | 1 × 49,000 | 49,000 |
| Queen 160 ×1 | 1 × 59,000 | 59,000 |
| **Item subtotal** | | **108,000** |
| **Row total (source)** | | **131,000** |
| **Gap (delivery/fee)** | 131,000 − 108,000 | **23,000** |

### Proposed `rental_order_extend` call (NOT YET EXECUTED)

```json
{
  "orderId": "0346c980-42ad-442f-b432-e58e0a42cc2e",
  "newEndDate": "2026-03-27T17:00:00.000Z",
  "items": [
    {
      "rentalOrderItemId": "cfeb0ac4-ac84-4e5f-b126-14df1640f968",
      "quantity": 1,
      "additionalAmount": 49000,
      "notes": "Extension: PAKET Double 120 x1, 1 day late return"
    },
    {
      "rentalOrderItemId": "02482d44-0363-4e00-be6e-71e899b961cb",
      "quantity": 1,
      "additionalAmount": 59000,
      "notes": "Extension: PAKET Queen 160 x1, 1 day late return"
    }
  ],
  "additionalAmount": 23000,
  "reason": "Late return extension per Pengiriman sheet row 14",
  "isPaid": true,
  "paidAt": "2026-03-27T12:00:00.000Z",
  "businessDate": "2026-03-27T12:00:00.000Z",
  "allowHistorical": true,
  "updateOrderTotal": true,
  "updateOrderDates": false
}
```

**⚠️ SAME ISSUE:** 23,000 delivery/fee gap — same as row 13.

---

## 5. Extension Row 16 — Yani (2026-03-24 → 2026-03-25)

### Search Results

| Search Method | Query | Result |
|---------------|-------|--------|
| notesContains "Yani" | `rental_order_list(notesContains="Yani")` | 0 results |
| notesContains "Andari" | `rental_order_list(notesContains="Andari")` | 0 results (only Tri Minomartani) |
| Partner ID filter | `partnerId=53b6be9b...` (dony/yani minomartani) | 0 orders |
| notesContains "minomartani" | `rental_order_list(notesContains="minomartani")` | 1 result: RNT-202605-00023 (Tri, not Yani) |

### Conclusion

**BLOCKED: Parent order for Yani not found in Sync ERP.**

Per user instruction: "if missing, do not create extension, report that parent order must be imported first."

The validation report references ORD-011 as "Yani Andari" but this order was not in the WhatsApp extraction CSV and does not exist in the ERP. The parent order must be imported before extensions can be created.

---

## 6. Tool Capability Analysis

### `rental_order_extend` Parameter Support

| Parameter | Available | Used for |
|-----------|-----------|----------|
| `orderId` | ✅ | Parent order UUID |
| `newEndDate` | ✅ | Extension end date |
| `items[]` | ✅ | Per-item extension details |
| `items[].rentalOrderItemId` | ✅ | Map to parent order line |
| `items[].quantity` | ✅ | Units being extended |
| `items[].additionalAmount` | ✅ | Per-item rental charge |
| `additionalAmount` (order-level) | ✅ | **Could absorb delivery fee gap** |
| `deliveryFee` | ❌ | **NOT AVAILABLE** |
| `additionalDeliveryFee` | ❌ | **NOT AVAILABLE** |
| `isPaid` | ✅ | Mark as paid |
| `paidAt` | ✅ | Payment date |
| `businessDate` | ✅ | Journal date |
| `allowHistorical` | ✅ | Allow past dates |
| `updateOrderTotal` | ✅ | Recalculate total |

### Delivery Fee Gap Analysis

Both Feris extension rows have a **Rp 23,000 gap** between item subtotals and row totals:
- Row 13: Items = 216,000, Total = 239,000, Gap = 23,000
- Row 14: Items = 108,000, Total = 131,000, Gap = 23,000

This likely represents additional delivery/pickup fees for the extension period. The `rental_order_extend` tool has **no dedicated `deliveryFee` field** for extensions.

**Options:**
1. Use order-level `additionalAmount: 23000` — would add to total but may not be categorized as delivery revenue
2. Add 23,000 to one of the per-item `additionalAmount` values — would inflate that item's revenue
3. **Wait for tool enhancement** — add `deliveryFee` or `additionalDeliveryFee` support to `rental_order_extend`

---

## 7. Decision Required

### ✅ Ready to Execute (after delivery fee resolution)
- **Feris Row 13**: Parent found, items mapped, amounts calculated
- **Feris Row 14**: Parent found, items mapped, amounts calculated

### ❌ Blocked
- **Yani Row 16**: Parent order not in ERP — must import ORD-11/Yani first

### ⚠️ Needs Decision
- **Delivery fee handling**: How to account for the 23,000 per-extension gap?
  - Option A: Use `additionalAmount` at order level (accepts total but may miscategorize)
  - Option B: Inflate one item's `additionalAmount` (mathematically works but semantically wrong)
  - Option C: Enhance `rental_order_extend` tool to support `deliveryFee` field before proceeding

---

## 8. Key IDs Reference

| Entity | ID |
|--------|-----|
| Company: Santi Living | `f023d223-f787-4007-9660-1bfa155c6ec4` |
| Feris Parent Order | `0346c980-42ad-442f-b432-e58e0a42cc2e` (RNT-202605-00044) |
| Feris Partner | `e2f307e4-138c-428e-a0e6-6be618852686` |
| Queen 160 Line | `02482d44-0363-4e00-be6e-71e899b961cb` |
| Double 120 Line | `cfeb0ac4-ac84-4e5f-b126-14df1640f968` |
| Single 100 Line | `431d851e-9dba-4bbc-b206-8f5340ab9767` |
| Yani Partner | `53b6be9b-ebc1-4c59-abb6-6f5a17393f30` (no orders) |

---

**Next Steps:**
1. Decide on delivery fee handling approach
2. If using `additionalAmount` at order level → proceed with Feris rows 13 & 14
3. Import Yani's parent order (ORD-11) before creating Yani extension
4. After writes: verify with `rental_order_get` and update this report with extension IDs
