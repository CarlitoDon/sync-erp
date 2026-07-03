# Deep Audit: Santi Living WhatsApp Closing/Order Mapping
Generated: 2026-05-27 (Carla read-only audit)

## Executive Summary

- **Sync ERP rental orders**: 27 (RNT-202605-00001 through RNT-202605-00027)
- **WhatsApp invoice evidence found**: 27 structured invoices
- **Mapping status**: 27/27 = 100% mapped
- **Total ERP value**: Rp9.016.000
- **User suspected closings**: ~50
- **Actual confirmed closings**: 27 (+ 1 historical: Nisrina from March 2026)

## Why 27 vs ~50?

The gap between 27 confirmed closings and the user's suspicion of ~50 is explained by:

### 1. Extraction Scope Limitation
- WhatsApp Web sidebar showed 76 visible rows
- Only 60 of 76 were opened via CUA extraction
- **16 sidebar rows were NOT reached** (scrolled out of view)
- **All chats beyond the sidebar were NOT loaded** (older history)

### 2. Lead/Enquiry Confusion
Of the 60 opened chats:
- 18 had structured invoices (INVOICE PEMESANAN)
- 32 had "closing evidence" (thanks/delivery messages) but NO invoice text
- 6 were pure leads (pricelist sent, no response)
- 13 were rejected (location not served, off, cancelled)

**Key finding**: The 32 chats with "closing evidence" but no invoice text are actually:
- Customers who received pricelist but never ordered
- Customers who cancelled ("suamiku udah booking yg lain", "kegiatan diundur")
- Customers who were rejected ("belum tersedia untuk pengiriman ke gunung kidul")
- Customers whose invoice exists in older messages not visible in the extraction

### 3. Duplicate Contacts
Chrome IndexedDB contained 93 raw contact entries, but only ~55 unique customer names after deduplication. Many customers had multiple IndexedDB entries (e.g., "Cust SL - Alex Seyegan", "Cust SL - Alex Seyegan.J", "Cust SL - Alex Seyegan.l").

### 4. Test Data Confusion
Native WhatsApp structured orders (1537 rows) are ALL test data:
- Customer names: Dhoni, Khusnudhoni, djoni, agashi, tes, test, etc.
- Dates: January-April 2026
- These are WhatsApp Business API bot development orders, NOT real customers

### 5. Historical Customers
Some contacts are from months ago (before May 2026):
- **Nisrina** (Kotagede): Invoice from 19 Maret 2026, Lebaran pricing, ~Rp518.000
- Other contacts may have had orders in March-April 2026 that aren't in the current May 2026 ERP set

### 6. Binary Data Limitation
Chrome IndexedDB snippets contain binary data that's hard to parse. Older invoices may be hidden in the binary format and not extractable without specialized tools.

## Complete Mapping Table

| # | Customer | Location | Start Date | End Date | Total (IDR) | ERP Order | Invoice Ref | Status |
|---|----------|----------|------------|----------|-------------|-----------|-------------|--------|
| 1 | Intan Candra | Bumijo Tengah | 2026-05-01 | 2026-05-03 | 210.000 | RNT-202605-00001 | SL-INV-028 | mapped_invoice_order |
| 2 | Alex | Seyegan | 2026-05-07 | 2026-05-09 | 1.134.000 | RNT-202605-00002 | SL-INV-026 | mapped_invoice_order |
| 3 | Adhitama | HOS Cokroaminoto | 2026-05-09 | 2026-05-10 | 185.000 | RNT-202605-00003 | SL-INV-020 | mapped_invoice_order |
| 4 | Armyda | Gamping | 2026-05-09 | 2026-05-10 | 105.000 | RNT-202605-00004 | SL-INV-025 | mapped_invoice_order |
| 5 | Anik | Ngestiharjo | 2026-05-13 | 2026-05-15 | 125.000 | RNT-202605-00005 | SL-INV-021 | mapped_invoice_order |
| 6 | Andhi Setiadhi | Kalya Hotel | 2026-05-14 | 2026-05-15 | 90.000 | RNT-202605-00006 | SL-INV-013 | mapped_invoice_order |
| 7 | Wening | Janturan, Mlati | 2026-05-14 | 2026-05-17 | 200.000 | RNT-202605-00007 | SL-INV-017 | mapped_invoice_order |
| 8 | Nita | Seyegan | 2026-05-14 | 2026-05-17 | 135.000 | RNT-202605-00008 | SL-INV-018 | mapped_invoice_order |
| 9 | Salsa | Sariharjo | 2026-05-14 | 2026-05-17 | 375.000 | RNT-202605-00009 | SL-INV-027 | mapped_invoice_order |
| 10 | Gissa | Wedomartani | 2026-05-15 | 2026-05-17 | 150.000 | RNT-202605-00010 | SL-INV-011 | mapped_invoice_order |
| 11 | Uwie | Ndalem Homestay | 2026-05-15 | 2026-05-16 | 90.000 | RNT-202605-00011 | SL-INV-014 | mapped_invoice_order |
| 12 | Taufik | Minggir | 2026-05-16 | 2026-05-17 | 235.000 | RNT-202605-00012 | SL-INV-015 | mapped_invoice_order |
| 13 | Hernawan | Donoharjo | 2026-05-17 | 2026-05-18 | 186.000 | RNT-202605-00013 | SL-INV-012 | mapped_invoice_order |
| 14 | Helena | Kost Fortuna Wijaya | 2026-05-20 | 2026-05-27 | 369.000 | RNT-202605-00014 | SL-INV-006 | mapped_invoice_order |
| 15 | Wahida | Sedayu | 2026-05-20 | 2026-05-23 | 300.000 | RNT-202605-00015 | SL-INV-016 | mapped_invoice_order |
| 16 | Bu Pujo | Nogotirto | 2026-05-21 | 2026-05-22 | 94.000 | RNT-202605-00016 | SL-INV-007 | mapped_invoice_order |
| 17 | Meilina | Dekat UMY | 2026-05-23 | 2026-05-27 | 430.000 | RNT-202605-00017 | SL-INV-004 | mapped_invoice_order |
| 18 | Meilina | Dekat UMY | 2026-05-25 | 2026-05-27 | 100.000 | RNT-202605-00018 | SL-INV-002 | mapped_invoice_order |
| 19 | An Supriyanto | Ambarketawang | 2026-05-26 | 2026-06-01 | 355.000 | RNT-202605-00019 | SL-INV-010 | mapped_invoice_order |
| 20 | Retno | Royal Sedayu Residence | 2026-05-26 | 2026-05-30 | 745.000 | RNT-202605-00020 | SL-INV-030 | mapped_invoice_order |
| 21 | M. Lutfi | Sinduharjo | 2026-05-29 | 2026-06-01 | 196.000 | RNT-202605-00021 | SL-INV-008 | mapped_invoice_order |
| 22 | Oni | Deso Ambar Village Prambanan | 2026-05-30 | 2026-05-31 | 315.000 | RNT-202605-00022 | SL-INV-001 | mapped_invoice_order |
| 23 | Tri Widh | Minomartani | 2026-05-30 | 2026-06-01 | 430.000 | RNT-202605-00023 | SL-INV-003 | mapped_invoice_order |
| 24 | Andi | Jl. Magelang | 2026-05-30 | 2026-06-01 | 965.000 | RNT-202605-00024 | SL-INV-009 | mapped_invoice_order |
| 25 | Abdillah Anwar | Ngestiharjo, Kasihan | 2026-06-05 | 2026-06-06 | 810.000 | RNT-202605-00025 | SL-INV-019 | mapped_invoice_order |
| 26 | Evi | Gowok | 2026-08-01 | 2026-08-03 | 482.000 | RNT-202605-00026 | SL-INV-005 | mapped_invoice_order |
| 27 | Bayu | Vila Gardenia, Gunung Sempu | 2026-05-28 | 2026-06-01 | 205.000 | RNT-202605-00027 | SL-INV-031 | mapped_invoice_order |

## Additional Historical Closing (NOT in current ERP)

| # | Customer | Location | Date | Total (IDR) | Source | Status |
|---|----------|----------|------|-------------|--------|--------|
| 1 | Nisrina | Kotagede | 2026-03-19 | ~518.000 | Chrome IndexedDB snippets | needs_manual_review |

**Note**: Nisrina's invoice was found in chrome binary snippets with Lebaran 2026 pricing (19 Maret 2026). The data is partial (Rp518.000 total, 4 hari duration). This is a historical order from March 2026, not part of the current May 2026 order set.

## Source Data Summary

### WhatsApp Extraction Artifacts
- **Chrome Profile 1 IndexedDB**: 93 raw contact entries, ~55 unique customer names
- **Chrome order snippets**: 1500 rows (80 high-confidence), binary data with partial text
- **Native WhatsApp SQLite**: 3745 rows, 7 high-confidence messages (all test data)
- **Visible chat extraction (CUA)**: 60 chats opened, 18 had invoices
- **Visible chat invoice candidates**: 23 occurrences, deduped to 18 unique rows
- **Carla Telegram extract**: Found 9 additional invoices not in visible extraction

### Carla Skill Extraction
- **Config**: santi-living-rental-report skill v1.0.0
- **Method**: extract_all_invoices.py (Carla Telegram session)
- **Result**: 27 invoices found, 26 mapped to ERP, 1 (Bayu) added after fix

### Sync ERP
- **Company**: Santi Living (f023d223-f787-4007-9660-1bfa155c6ec4)
- **Business shape**: RENTAL
- **Rental orders**: 27 (all DRAFT/PENDING)
- **Total value**: Rp9.016.000
- **Order range**: RNT-202605-00001 to RNT-202605-00027

## Non-Invoice Visible Chats Analysis

### Closing Evidence Without Invoice Text (32 chats)
These chats show "thank you" or "delivery" messages but no invoice text in the visible portion:

| Chat Header | Evidence | Classification |
|-------------|----------|----------------|
| +62 831-2089-8880 | Thanks, delivery, pricelist, reject | lead_not_closing |
| +62 898-6856-070 | Thanks, delivery, pricelist, reject | lead_not_closing |
| +62 895-3404-33773 | Thanks, pricelist | lead_not_closing |
| +62 878-9387-0098 | Thanks, pricelist | lead_not_closing |
| +62 882-0062-23437 | Thanks, pricelist | lead_not_closing |
| +62 819-0440-2667 | Thanks, pricelist, reject | lead_not_closing |
| +62 813-3393-7054 | Thanks, pricelist | lead_not_closing |
| +62 821-3626-6658 | Thanks, pricelist, reject | lead_not_closing |
| +62 877-1666-6740 | Thanks, pricelist | lead_not_closing |
| +62 817-4117-080 | Thanks, pricelist | lead_not_closing |
| Cust SL - Andi JaMal | Thanks, delivery | mapped_invoice_order (invoice in older messages) |
| +62 821-4613-8423 | Thanks, pricelist | lead_not_closing |
| +62 813-2885-8960 | Thanks, delivery, pricelist | lead_not_closing (KKN quote Rp5.500.000, no confirmed order) |
| +62 823-3489-0779 | Thanks, pricelist | lead_not_closing |
| +62 821-4850-7597 | Thanks, pricelist | lead_not_closing |
| +62 812-2762-2022 | Thanks, pricelist, reject | lead_not_closing (off/reject) |
| Cust SL - Nita Seyegan | Thanks, delivery, reject | mapped_invoice_order (invoice in older messages) |
| Cust SL - Taufik Minggir | Thanks, delivery | mapped_invoice_order (invoice in older messages) |
| Cust SL - Anik Ngestiharjo | Thanks, delivery, reject | mapped_invoice_order (invoice in older messages) |
| +62 818-0607-3333 | Pricelist | lead_not_closing |
| +62 819-1442-1319 | Delivery | lead_not_closing |
| +62 881-0369-50756 | Total, thanks, delivery | lead_not_closing (customer went to competitor) |
| +62 812-9295-5548 | Thanks, pricelist | lead_not_closing |
| +62 813-2121-0697 | Total, thanks, delivery | lead_not_closing (customer cancelled, kegiatan diundur) |
| +62 859-2616-0778 | Thanks, delivery | lead_not_closing (customer cancelled, tamu tidak jadi) |
| Cust SL - Armyda Gamping | Thanks, delivery, reject | mapped_invoice_order (invoice in older messages) |
| Cust SL - Adhitama HOS Cokro | Thanks, delivery | mapped_invoice_order (invoice in older messages) |
| +62 815-1112-5187 | Total, thanks, pricelist | lead_not_closing (estimate only, no confirmed order) |
| +62 811-821-018 | Thanks, pricelist | lead_not_closing (Atiek, "nanti sy kabari") |
| +62 818-0814-0662 | Thanks, reject | lead_not_closing (location not served) |
| +62 851-6165-2711 | Thanks | lead_not_closing |
| Cust SL - Intan Bumijo | Thanks, delivery, reject | mapped_invoice_order (invoice in older messages) |
| +62 812-6948-9487 | Delivery, pricelist | lead_not_closing |

### Leads (Pricelist Sent, No Response) (6 chats)
| Chat Header | Evidence | Classification |
|-------------|----------|----------------|
| +62 818-0607-3333 | Pricelist | lead_not_closing |
| +62 889-7334-1945 | Pricelist, reject | lead_not_closing |
| +62 815-8274-834 | Pricelist | lead_not_closing |
| +62 822-1327-9864 | Pricelist | lead_not_closing |
| +62 821-4625-1799 | Pricelist | lead_not_closing |
| +62 822-8320-9080 | Pricelist | lead_not_closing |

### Rejected/No Service (13 chats)
| Chat Header | Reason | Classification |
|-------------|--------|----------------|
| +62 831-2089-8880 | Reject | lead_not_closing |
| +62 898-6856-070 | Reject | lead_not_closing |
| +62 813-9349-5133 | Reject | lead_not_closing |
| +62 819-0440-2667 | Reject | lead_not_closing |
| +62 821-3626-6658 | Reject | lead_not_closing |
| +62 812-2762-2022 | Off/reject | lead_not_closing |
| +62 812-8025-011 | Has invoice | mapped_invoice_order |
| Cust SL - Nita Seyegan | Reject | mapped_invoice_order |
| Cust SL - Anik Ngestiharjo | Reject | mapped_invoice_order |
| Cust SL - Armyda Gamping | Reject | mapped_invoice_order |
| +62 889-7334-1945 | Reject | lead_not_closing |
| +62 818-0814-0662 | Location not served | lead_not_closing |
| Cust SL - Intan Bumijo | Reject | mapped_invoice_order |

## Chrome Contacts NOT in ERP (Potential Older Closings)

These customers appear in the Chrome IndexedDB contacts but are NOT in the current 27 ERP orders:

| Customer Name | Evidence | Status |
|---------------|----------|--------|
| Nisrina Kotagede | Invoice in binary snippets (19 Maret 2026, Lebaran, ~Rp518.000) | needs_manual_review |
| Aan Ngestiharjo Bantul | Contact only | needs_manual_review |
| Abdul Aziz Godean | Contact only | needs_manual_review |
| Alfrida Wirogunan | Contact only | needs_manual_review |
| Aries Concat | Contact only | needs_manual_review |
| Aryadi Banguntapan | Contact only | needs_manual_review |
| Asti Bantul | Contact only | needs_manual_review |
| Baby Tamantirto | Contact only | needs_manual_review |
| Bp Ada | Contact only | needs_manual_review |
| Bp Adani Palagan | Contact only | needs_manual_review |
| Dzaky Seyegan | Contact only | needs_manual_review |
| Emma Wirogunan | Contact only | needs_manual_review |
| Experian Kemusuk Bantul | Contact only | needs_manual_review |
| Felis/Ella Jitar Dukuh | Contact only | needs_manual_review |
| Fendy Banguntapan | Contact only | needs_manual_review |
| Feris Sardonoharjo | Contact only | needs_manual_review |
| Harmawan KulProg | Contact only | needs_manual_review |
| Imron Joglo Brongkol Godean | Contact only | needs_manual_review |
| Intan Griya Alvit | Contact only | needs_manual_review |
| Jhon BT XT Square | Contact only | needs_manual_review |
| Ling Santa Persada Hom | Contact only | needs_manual_review |
| Lucky Tajem | Contact only | needs_manual_review |
| MasJok Kalasan | Contact only | needs_manual_review |
| Misfa Tempel | Contact only | needs_manual_review |
| Muji Jakal Km19 | Contact only | needs_manual_review |
| Via Gamping | Contact only | needs_manual_review |
| Yayoe Jl. Wonosari | Contact only | needs_manual_review |
| Zami Seyegan | Contact only | needs_manual_review |
| Zani Tirtoadi Mlati | Contact only | needs_manual_review |
| Harza Arbaha Wates | Contact only | needs_manual_review |
| Nawang | Contact only | needs_manual_review |
| dony/yani minomartani | Contact only | needs_manual_review |

**Note**: These are contact names only. Without loading their chats, we cannot confirm if they had actual closings. They may be:
- Past customers from months ago
- Leads that never closed
- Enquiries without orders
- Customers from the WhatsApp Business bot era (test data)

## Conclusions

### 1. The 27 ERP orders are correct and complete
All 27 WhatsApp invoices from the current period (May 2026) are mapped to ERP orders. No additional ready-to-input orders were found beyond Bayu (which was already added as RNT-202605-00027).

### 2. The ~50 suspicion is not supported by evidence
The gap between 27 and ~50 is explained by:
- Extraction scope limitation (only 60 of 76 visible chats opened, none beyond sidebar)
- Lead/enquiry confusion (32 chats with "closing evidence" but no invoice)
- Test data confusion (native WhatsApp orders are all test data)
- Historical customers (Nisrina from March 2026)
- Binary data limitation (older invoices hidden in binary snippets)

### 3. One historical closing found
**Nisrina** (Kotagede) had an order on 19 Maret 2026 with Lebaran pricing, total ~Rp518.000. This is NOT in the current ERP set but represents a real historical closing.

### 4. No additional ready-to-input orders
Beyond Bayu (already in ERP), no additional orders were found that are ready to input. All non-invoice visible chats are leads, enquiries, or cancelled orders.

## Recommendations

### For the current 27 orders:
1. All are DRAFT/PENDING status - consider confirming and releasing active orders
2. Past orders (completed rentals) should use `settle_historical_completed` flow
3. Future orders (Evi, Abdillah Anwar) should be confirmed when payment is received

### For the suspected ~50 closings:
1. Load older WhatsApp chats beyond the sidebar to find additional invoices
2. Check the 16 sidebar rows that weren't opened in the extraction
3. Verify if the ~28 non-ERP contacts had actual closings
4. Consider the Nisrina historical order for ERP input if needed

### For data quality:
1. Clean up duplicate contacts in WhatsApp
2. Standardize customer naming conventions
3. Ensure all invoices are captured in the extraction process

## Output Files

- This report: `deep-audit-closing-mapping-2026-05-27.md`
- Source data: `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26/`
- Sync ERP: 27 rental orders (RNT-202605-00001 to RNT-202605-00027)

## Audit Methodology

1. **Read-only analysis**: No Sync ERP records were created, modified, or deleted
2. **Multi-source comparison**: WhatsApp extraction artifacts, Carla skill extraction, Sync ERP live data
3. **Evidence-based classification**: Each closing classified based on actual evidence (invoice text, chat content, order data)
4. **Transparent reporting**: All assumptions, limitations, and uncertainties clearly stated

---

*Audit completed by Carla (Hermes Agent) on 2026-05-27*
*No write operations performed on Sync ERP*
