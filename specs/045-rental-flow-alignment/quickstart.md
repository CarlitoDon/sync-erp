# Quickstart Guide: Validating Real Rental Flow Alignment (Feature 045)

## Prerequisites
1. Sync ERP local environment running (`npm run dev:api` and `npm run dev:web`).
2. Active company with business shape `RENTAL` or `HYBRID`.
3. Default accounts seeded (`1000` Cash, `1200` Bank, `2200` Customer Deposits, `4200` Rental Income).
4. At least 3 rental mattress units available (`UnitStatus.AVAILABLE`).

---

## Validation Scenarios

### Scenario 1: Booking Draft to DP Confirmation & Serial Locking
1. **Action**: Open web app at `/rentals/orders/new`. Create order with customer "Budi", select 2 mattresses, 3 days duration. Total = Rp 300.000.
2. **Verification 1**: Order status is `DRAFT`. In inventory, mattresses remain `AVAILABLE` (no serial codes locked).
3. **Action**: Click "Confirm Order". Input DP Rp 100.000 via BCA (`1200`). Submit.
4. **Verification 2**:
   - Order status becomes `CONFIRMED`.
   - 2 mattress units transition to `RESERVED`.
   - General Ledger shows new journal: `Rental DP: RO-XXXX` (Debet Bank `1200` Rp 100.000, Kredit Uang Muka Sewa `2200` Rp 100.000).

---

### Scenario 2: Delivery, Serah Terima & Pelunasan 70% di Lokasi
1. **Action**: Open the confirmed order detail. Click "Release Units (Serah Terima)".
2. **Input**: Verify mattress condition (`GOOD`), enter remaining payment Rp 200.000 via Cash (`1000`), submit.
3. **Verification**:
   - Order status transitions to `ACTIVE`.
   - Order payment chip displays `Lunas` (`CONFIRMED`).
   - Units transition from `RESERVED` to `RENTED`.
   - General Ledger shows journal: `Rental Release: RO-XXXX`:
     - Debet Kas `1000`: Rp 200.000
     - Debet Uang Muka Sewa `2200`: Rp 100.000 (clearing DP)
     - Kredit Pendapatan Sewa `4200`: Rp 300.000

---

### Scenario 3: Partial Extension with Extra Fleet Trip Fee
1. **Action**: In the active order, open the Extension menu. Choose "Partial Extension".
2. **Input**: Select Unit 1 (extend 2 days, Rp 100.000). Enter "Biaya Tambahan Armada": Rp 25.000. Total = Rp 125.000. Method: QRIS/Bank. Submit.
3. **Verification**:
   - Unit 1 effective return date extends by 2 days; Unit 2 return date remains unchanged.
   - Extension record saved with `deliveryFee = 25000` and label "Biaya Tambahan Armada".
   - General Ledger journal posted for Rp 125.000 crediting rental & fleet income.

---

### Scenario 4: Return Inspection & Stained Unit Isolation to MAINTENANCE
1. **Action**: Click "Return Units (Kembalikan)".
2. **Input**:
   - Unit 1: Condition `GOOD` -> No damage.
   - Unit 2: Condition `FAIR`, damage note "Noda ompol", damage fee Rp 50.000, payment Cash. Submit.
3. **Verification**:
   - Order status transitions to `COMPLETED`.
   - Unit 1 transitions to `AVAILABLE` (instantly ready for new booking).
   - Unit 2 transitions to `MAINTENANCE` (isolated for laundry/repairs).
   - General Ledger records damage fee journal: Debet Kas Rp 50.000, Kredit Pendapatan Denda `4200` Rp 50.000.
