# Sync ERP Lead Import Dry-Run Plan

**Generated:** 2026-05-26
**Source:** `lead-closing-extraction.csv`
**Company:** Santi Living (`f023d223-f787-4007-9660-1bfa155c6ec4`, shape: RENTAL, status: ACTIVE)
**Method:** Read-only MCP dry-run. No writes performed.

---

## Summary

| Action | Count | Description |
|--------|------:|-------------|
| `create_customer_candidate` | 54 | WA status=closing_or_customer, no ERP match |
| `create_lead_candidate` | 27 | WA status=lead_open, no ERP match |
| `manual_review` | 1 | Group chat, no phone number |
| **Total** | **82** | |

- **update_existing:** 0 — no phone-level match found in existing partners
- **skip_duplicate:** 0 — no CSV-to-CSV duplicate phones detected
- **Existing ERP partners:** 1 SUPPLIER only (Santi Mebel Godean, landline 0274797349 — no overlap)

---

## Matching Rules Applied

1. **Normalize phone:** strip non-digits, strip leading zeros
2. **Exact phone match to existing partner:**
   - If same type context → `update_existing` (confidence 1.0)
   - If type mismatch → `skip_duplicate` (confidence 1.0)
3. **No phone match + `lead_open`** → `create_lead_candidate`
4. **No phone match + `closing_or_customer`** → `create_customer_candidate`
5. **Group chat without phone** → `manual_review`

---

## Confidence Scoring

| Scenario | Confidence |
|----------|----------:|
| closing_or_customer + "Cust SL" display_name prefix | 0.95 |
| closing_or_customer, no prefix | 0.85 |
| lead_open + "Cust SL" prefix (anomaly — likely converted lead) | 0.85 |
| lead_open, standard | 0.80 |
| Group chat / no phone | 0.50 |

---

## Action: create_customer_candidate (54 rows)

High-confidence customer records. All have WA status `closing_or_customer` and display names prefixed with "Cust SL". Recommended for batch `partner_create` with `type=CUSTOMER`.

### Notable sub-groups by WA label:

| WA Labels | Count | Notes |
|-----------|------:|-------|
| Order complete | 40 | Standard completed orders |
| Important\|Down payment | 4 | Down payment customers |
| Down payment\|Harus diambil | 2 | Pickup pending |
| Harus diambil | 1 | Pickup required |
| Paid\|Order complete | 1 | Fully paid |
| Down payment | 1 | DP received |

### Full list:

| Row | Display Name | Phone | Labels |
|----:|--------------|-------|--------|
| 2 | Cust SL - Abdillah Ngestiharjo | 62818466089 | Important\|Down payment |
| 4 | Cust SL - Aryadi Banguntapan | 628170010902 | Order complete |
| 5 | Cust SL - Adhitama HOS Cokro | 6287871133044 | Order complete |
| 7 | Cust SL - Andi JaMal | 6281215588861 | Important\|Down payment |
| 8 | Cust SL - Wening Mlati | 6282335425066 | Order complete |
| 11 | Cust SL - Ling Santa Persada Homestay | 6281385097390 | Order complete |
| 12 | Cust SL - Misfa Tempel | 6285832714409 | Order complete |
| 13 | Cust SL - Yayoe Jl. Wonosari | 6281248143123 | Order complete |
| 14 | Cust SL - Bu Pujo Nogotirto | 6281394444515 | Order complete |
| 15 | Cust SL - dony/ yani minomartani | 628562039023 | Order complete |
| 17 | Cust SL - Fendy Banguntapan | 6282385609159 | Order complete |
| 18 | Cust SL - Meilina UMY | 6281212234326 | Harus diambil |
| 20 | Cust SL - Antoni Seyegan | 628121521832 | Order complete |
| 21 | Cust SL - Imron Joglo Brongkol Godean | 6289696484565 | Order complete |
| 26 | Cust SL - Andhi Kalya Hotel | 628155610481 | Order complete |
| 27 | Cust SL - Alfrida Wirogunan | 6281230519177 | Order complete |
| 29 | Cust SL - Supriyanto Ambarketawang | 6285624395440 | Down payment\|Harus diambil |
| 30 | Cust SL - Armyda Gamping | 6285921349614 | Order complete |
| 31 | Cust SL - Dzaky Seyegan | 6289665791131 | Order complete |
| 32 | Cust SL - Vivi Mergangsan | 6287838575705 | Order complete |
| 34 | Cust SL - Via Gamping | 6285190308218 | Order complete |
| 35 | Cust SL - Anik Ngestiharjo | 6281227924008 | Order complete |
| 36 | Cust SL - Agashi UNY | 6282338662649 | Order complete |
| 37 | Cust SL - Lucky Tajem | 6281215110310 | Order complete |
| 38 | Cust SL d@π1€£ - Jakal KM9 | 6281397301312 | Order complete |
| 39 | Cust SL - Wahida Sedayu | 6285646882241 | Order complete |
| 41 | Cust SL Harza Arbaha Wates KP | 6285799318717 | Order complete |
| 42 | Cust SL - Abdul Aziz Godean | 6282227705849 | Order complete |
| 44 | Cust SL - Nita Seyegan | 6285712418222 | Order complete |
| 45 | Cust SL - M. Lutfi Sinduharjo | 6281328128489 | Important\|Down payment |
| 48 | Cust SL - Baby Tamantirto | 6282136362874 | Paid\|Order complete |
| 50 | Cust SL - Muji Jakal Km19 | 6287834253458 | Order complete |
| 52 | Cust SL - Aries Concat | 6281215220235 | Order complete |
| 54 | Cust SL - Intan Griya Alvita | 6287876861286 | Order complete |
| 55 | Cust SL - Felis/ Ella Jitar Dukuh | 6285710320538 | Order complete |
| 57 | Cust SL - Nisrina Kotagede | 6285642610313 | Order complete |
| 58 | Cust SL Nawang - Klaci Godean Py | 6282324941015 | Order complete |
| 59 | Cust SL - Salsaa Sariharjo | 6281213820322 | Order complete |
| 62 | Cust SL - Alex Seyegan | 6289501636933 | Order complete |
| 63 | Cust SL - Feris Sardonoharjo | 628569999396 | Order complete |
| 64 | Cust SL - Taufik Minggir | 6281390712119 | Order complete |
| 65 | Cust SL - Hernawan Donoharjo | 628175410313 | Order complete |
| 66 | Cust SL - Zami Seyegan | 6281904112333 | Order complete |
| 67 | Cust SL - Uwie Kraton | 62818997070 | Order complete |
| 68 | Cust SL - Retno Sedayu | 6281350241158 | Down payment\|Harus diambil |
| 70 | Cust SL - Jhon BT XT Square | 6281239888400 | Order complete |
| 72 | Cust SL - Tri Minomartani | 6281903788728 | Important\|Down payment |
| 73 | Cust SL - Harmawan KulProg | 6283197713255 | Order complete |
| 75 | Cust SL - Intan Bumijo | 6281318004556 | Order complete |
| 77 | Cust SL - Asti Bantul | 6285163192520 | Order complete |
| 79 | Cust SL - Experian Kemusuk Bantul | 6289604406383 | Order complete |
| 80 | Cust SL - Emma Wirogunan | 62895360123666 | Order complete |
| 81 | Cust SL - Helena Tajem | 628125433935 | Order complete |
| 82 | Cust SL - Bp Adani Palagan 12,5 | 6285725809938 | Order complete |

---

## Action: create_lead_candidate (27 rows)

Prospective leads with WA label `Lead` and status `lead_open`. No ERP match. Lower priority for import — consider importing as `type=CUSTOMER` with a note/tag, or defer.

### Anomaly leads (display_name has "Cust SL" prefix but WA label=Lead):

| Row | Display Name | Phone | Note |
|----:|--------------|-------|------|
| 40 | Cust SL - Zani Tirtoadi Mlati | 6289691900017 | May be a converted customer still labeled Lead |
| 61 | Cust SL - MasJok Kalasan | 6281973909090 | May be a converted customer still labeled Lead |

### Standard leads:

| Row | Display Name | Phone | Pushname |
|----:|--------------|-------|----------|
| 1 | Dian Budiadi😊 | 6281905054497 | Dian Budiadi😊 |
| 3 | wiwik widarti | 6287739734291 | wiwik widarti |
| 9 | Irma Yunita C. | 6282138717461 | Irma Yunita C. |
| 10 | rnd | 6285943694452 | rnd |
| 16 | . | 628989294185 | . |
| 19 | Hedy | 6281326994964 | Hedy |
| 22 | Lelita Marwindra | 6282131073252 | Lelita Marwindra |
| 23 | Laila | 6281129400905 | Laila |
| 24 | Ratna sari Dewi (larisa) | 6288228974828 | Ratna sari Dewi (larisa) |
| 25 | A.Mel Shakilla | 628995168584 | A.Mel Shakilla |
| 28 | Kristian Nicho | 6281329594456 | Kristian Nicho |
| 33 | KenanShanum | 6285927424148 | KenanShanum |
| 43 | NRRA | 6281392786118 | NRRA |
| 46 | Iin Karunia Natalia | 6289690624796 | Iin Karunia Natalia |
| 47 | Lusi Tres | 6285728906080 | Lusi Tres |
| 49 | dziaayyu | 6289653423622 | dziaayyu |
| 51 | Sri Mulyani | 628174111456 | Sri Mulyani |
| 53 | sheen | 628158274834 | sheen |
| 56 | Sari | 62818438279 | Sari |
| 60 | Martuti | 628995046433 | Martuti |
| 69 | Yuanita | 6285643892627 | Yuanita |
| 71 | Pipit | 6282138722251 | Pipit |
| 74 | Eko Prasetyo | 6285600973714 | Eko Prasetyo |
| 76 | Gunawan | 6281325862434 | Gunawan |
| 78 | Yoga S | 6282220004826 | Yoga S |

---

## Action: manual_review (1 row)

| Row | Chat ID | Chat Type | Labels | Issue |
|----:|---------|-----------|--------|-------|
| 6 | 120363422057960855@g.us | group | Down payment | Group chat — no phone number. Needs manual identification of the actual customer behind this conversation. |

---

## ERP State (Reference)

| Entity | Detail |
|--------|--------|
| Company ID | `f023d223-f787-4007-9660-1bfa155c6ec4` |
| Company Name | Santi Living |
| Business Shape | RENTAL |
| Onboarding Status | ACTIVE |
| Existing Partners | 1 (SUPPLIER: Santi Mebel Godean, phone 0274797349) |
| Existing CUSTOMER Partners | 0 |
| Phone overlap | None |

---

## Risks & Notes

1. **No existing customers in ERP** — all 81 phone-matched rows are net-new creates. No risk of duplicates against current ERP data.
2. **Phone format variability** — all CSV phones are Indonesian format (62xxx). Some are shorter (e.g. `62818997070`, `62818438279`). These may be incomplete/typo numbers. Recommend validation before create.
3. **Group chat (row 6)** — labeled "Down payment" but has no phone. Could be a business group or order coordination chat. Manual identification required.
4. **Anomaly leads** — rows 40 and 61 have "Cust SL" prefix in display_name but WA label=Lead. These may be former customers whose WA label was not updated.
5. **Special characters in display_name** — row 38 has `d@π1€£` and row 82 has comma in name. Ensure `partner_create` handles Unicode and escaping.
6. **No write tools were called** — this plan is purely read-only. Actual import requires explicit operator approval and write tool access.

---

## Files Produced

| File | Purpose |
|------|---------|
| `sync-erp-lead-import-plan.csv` | Machine-readable plan with all 82 rows, actions, confidence, reasons |
| `sync-erp-lead-import-plan.md` | This human-readable report |

---

## Next Steps (Requires Write Access)

1. **Prioritize `create_customer_candidate` (54)** — batch `partner_create` with `type=CUSTOMER`, phone, pushname as name
2. **Review `create_lead_candidate` (27)** — decide: import as customer, or create a separate lead pipeline
3. **Resolve `manual_review` (1)** — identify the group chat customer manually
4. **Validate phone completeness** — flag short numbers (< 10 digits after 62 prefix) for manual check
5. **After create** — re-run partner_list to capture new IDs, then link to rental orders/invoices as needed
