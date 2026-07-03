# CARLA CUSTOMER ORDER AUDIT — BLOCKER REPORT
## Santi Living WhatsApp Web Customer-by-Customer Audit
## Date: 2026-05-26 21:XX WIB
## Status: ❌ BLOCKED — Audit Detail NOT COMPLETE

---

## EXECUTIVE SUMMARY

Audit customer-by-customer WhatsApp Web Santi Living **terblokir** pada tahap membuka conversation detail. Sidebar inventory berhasil, tetapi CUA driver tidak bisa membuka chat individual untuk baca full conversation.

---

## WHAT WAS ACCOMPLISHED

### Sidebar Inventory (SUCCESS)
- **68 chat entries** berhasil di-extract dari WhatsApp Web sidebar via `page.get_text()` dan `page.query_dom()`
- **24 named customer chats** (prefix "Cust SL -") teridentifikasi
- **~35 unnamed number chats** (+62...) teridentifikasi
- **9 non-customer chats** (internal/admin/personal) tercatat

### Sidebar Preview Data (AVAILABLE)
Dari sidebar preview saja, data berikut sudah terlihat:

| Chat | Date | Order-Relevant Preview |
|------|------|----------------------|
| +62 813-2885-8960 | 5/19/2026 | KKN quote: 10 unit kasur, 30 Jun-30 Jul 2026, Rp5,500,000, free ongkir |
| Cust SL - Tri Minomartani | Sunday | "maguwo ongkir 60k yaa ka" — ongkir mention |
| +62 878-9387-0098 | Sunday | "maguwo ongkir 60k yaa ka" — same ongkir (duplicate?) |
| Cust SL - Hernawan Donoharjo | 5/18/2026 | "Baik terimakasih" — post-quote confirmation |
| +62 821-1693-9446 | 5/15/2026 | "boleh tolong dikonfirmasi pesanan jadi/tidak" — pending order |
| Cust SL - Alex Seyegan | 5/9/2026 | "halo mas armada otw yaa" — delivery in progress |
| +62 822-1327-9864 | 5/10/2026 | "50rb ongkir antar-jemput pickup" — ongkir |
| +62 877-1666-6740 | Friday | "kasur busa + sprei + bantal" — item mention |
| +62 817-4117-080 | Thursday | "diskon kalau lebih dari 3 hari" — pricing discussion |
| +62 812-8025-011 | Thursday | "monggo dicek pesanannya" — order review |
| Cust SL - Helena Tajem | Today | Pinned message — likely important order |
| Cust SL - Abdillah Ngestiharjo | Today 19:46 | Pinned message — likely important order |

**Pricelist template seen in multiple chats:**
- Single 90 = Rp35,000/day
- Single 100 = Rp40,000/day
- Double 120 = Rp45,000/day
- Queen 160 = Rp55,000/day
- King 180 = Rp65,000/day

---

## BLOCKER DETAILS

### Problem
Cannot open individual chat conversations in WhatsApp Web via CUA driver. The right panel remains on `intro-panel` (WhatsApp welcome screen) instead of loading conversation content.

### Technical Evidence
1. **AX Tree**: 1151 elements loaded, but all are sidebar/chat-list elements. No `#main`, no `[data-testid="conversation-panel"]`, no `[data-testid="conversation-panel-messages"]`, no `.message-in`, no `.message-out`.

2. **DOM State**: `document.getElementById('main')` returns `null`. Panel testids found: only `chatlist-panel-archived-button` and `intro-panel`.

3. **Pixel Click Attempts**:
   - x=304, y=437 (CSS DOM coords from getBoundingClientRect): No effect on chat opening
   - x=300, y=675 (screenshot coords, user-corrected): Opened Cua Driver window instead of chat
   - x=328, y=86 (search bar coords): No search activation

4. **Element Index Click**: AXRow [105] "Cust SL - Bu Pujo Nogotirto" — `AXPress` attempted but element only advertises `AXShowMenu, AXScrollToVisible`, not `AXPress`. Action was likely a no-op.

5. **JavaScript Click Dispatch**: `dispatchEvent(new MouseEvent('click'))` on chat cells — WhatsApp React SPA does not respond to synthetic DOM clicks.

### Root Cause Hypothesis
- WhatsApp Web uses React with custom event handling that doesn't respond to standard DOM click events
- CUA pixel click coordinates may be offset due to window chrome, scaling, or WhatsApp's responsive layout
- The window may be partially off-screen or on a different Space, causing click coordinates to map incorrectly
- WhatsApp Web may require specific gesture patterns (e.g., mousedown+mouseup sequence) that synthetic clicks don't replicate

---

## WHAT CANNOT BE DONE WITHOUT FIXING BLOCKER

1. ❌ Read full conversation history per customer
2. ❌ Extract INVOICE PEMESANAN messages
3. ❌ Parse order details: Tanggal Kirim, Tanggal Ambil, DP, Sisa Pelunasan
4. ❌ Identify item lines with qty and price from chat
5. ❌ Distinguish final orders from duplicates/revisions/superseded
6. ❌ Extract payment evidence (DP transfer screenshots, confirmation messages)
7. ❌ Build complete customer-order-audit CSV

---

## RECOMMENDED NEXT STEPS

### Option A: Fix CUA Coordinate Mapping
1. Bring WhatsApp window to foreground (raise_window=true)
2. Take fresh screenshot with `get_window_state`
3. Visually identify exact pixel coordinates of first chat row
4. Click with corrected coordinates
5. Verify conversation panel loads (check for `#main` or `conversation-panel-messages`)

### Option B: WhatsApp Export/DB Extraction
1. Use WhatsApp Web's built-in export feature (if available for Business)
2. Or access WhatsApp local storage/IndexedDB for message data
3. Parse exported data programmatically

### Option C: WhatsApp Business API
1. If Santi Living has WhatsApp Business API access, use API to retrieve message history
2. More reliable than UI scraping

### Option D: Manual Human Export
1. Ask human operator to manually scroll through chats and export/copy conversation data
2. Human can navigate WhatsApp Web normally where CUA fails

---

## SIDEBAR DATA ALREADY COLLECTED

Full sidebar inventory with chat names, timestamps, and preview text is available in the progress log file:
`/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-customer-order-audit-2026-05-26/customer-order-audit-progress-log.md`

---

## OUTPUT FILES

| File | Status | Content |
|------|--------|---------|
| customer-order-audit-progress-log.md | ✅ Written | Sidebar inventory, blocker details |
| customer-order-audit-2026-05-26.csv | ❌ Not created | Needs conversation data |
| customer-order-lines-audit-2026-05-26.csv | ❌ Not created | Needs conversation data |
| customer-order-audit-2026-05-26.md | ❌ Not created | Needs conversation data |

---

## CARLA CUSTOMER ORDER AUDIT BLOCKED

**Total sidebar chats inventoried**: 68
**Named customer chats**: 24
**Unnamed number chats**: ~35
**Order-relevant preview data**: ~12 chats with order/invoice/ongkir hints
**Full conversations extracted**: 0
**Orders fully audited**: 0

**Blocker**: Cannot open WhatsApp Web chat conversations via CUA driver. Right panel stays on intro-panel. Pixel clicks and element clicks fail to activate chat rows.

**Confidence**: HIGH that blocker is real (3+ attempts with different coordinate systems and methods)
