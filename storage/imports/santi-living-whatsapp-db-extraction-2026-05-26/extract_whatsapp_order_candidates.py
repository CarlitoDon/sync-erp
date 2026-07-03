#!/usr/bin/env python3
import csv
import hashlib
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


OUT = Path(__file__).resolve().parent
CHROME_LEVELDB = OUT / "raw" / "https_web.whatsapp.com_0.indexeddb.leveldb"
NATIVE_DB = OUT / "raw" / "native-whatsapp" / "ChatStorage.backup.sqlite"

JAKARTA = ZoneInfo("Asia/Jakarta")

KEYWORDS = [
    "invoice pemesanan",
    "tanggal kirim",
    "tanggal ambil",
    "dp",
    "pelunasan",
    "lunas",
    "sisa",
    "total",
    "subtotal",
    "ongkir",
    "kasur",
    "sprei",
    "bantal",
    "guling",
    "paket",
    "sewa",
    "antar",
    "jemput",
    "pickup",
    "single 90",
    "single 100",
    "double 120",
    "queen 160",
    "king 180",
    "cust sl",
    "santi living",
]

ORDER_STRONG = [
    "invoice pemesanan",
    "tanggal kirim",
    "tanggal ambil",
    "dp",
    "sisa pelunasan",
]


def clean_text(value: str) -> str:
    value = value.replace("\x00", " ")
    value = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]+", " ", value)
    value = value.replace("\r", "\n")
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]{2,}", " ", value)
    return value.strip()


def compact(value: str, max_len: int = 1800) -> str:
    value = clean_text(value)
    if len(value) <= max_len:
        return value
    return value[: max_len - 20].rstrip() + " ...[truncated]"


def norm(value: str) -> str:
    return re.sub(r"\W+", " ", value.lower()).strip()


def digest(value: str) -> str:
    return hashlib.sha1(norm(value).encode("utf-8", "ignore")).hexdigest()[:12]


def keyword_hits(text: str) -> list[str]:
    low = text.lower()
    return [k for k in KEYWORDS if k in low]


def confidence(text: str) -> str:
    low = text.lower()
    strong_count = sum(1 for k in ORDER_STRONG if k in low)
    if strong_count >= 2:
        return "HIGH"
    if strong_count == 1 or ("kasur" in low and ("ongkir" in low or "dp" in low or "total" in low)):
        return "MEDIUM"
    return "LOW"


def chat_hint(text: str) -> str:
    patterns = [
        r"Cust SL\s*[-–]?\s*[A-Za-z0-9 .,'/&()+]{2,80}",
        r"Santi Living[^,\n\r]{0,80}",
        r"\+?62[0-9][0-9 .-]{8,18}",
        r"120363[0-9]+@g\.us",
        r"628[0-9]+@s\.whatsapp\.net",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            return clean_text(m.group(0))[:100]
    return ""


def date_hint(text: str) -> str:
    patterns = [
        r"\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)[a-z]*\s+\d{4}\b",
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
        r"\b(?:Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)[^,\n\r]{0,60}",
        r"\b2026-\d{2}-\d{2}\b",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            return clean_text(m.group(0))[:100]
    return ""


def money_values(text: str) -> str:
    vals = re.findall(r"(?:Rp\s*)?\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?|\b\d{5,9}\b", text)
    seen = []
    for v in vals:
        if v not in seen:
            seen.append(v)
    return "; ".join(seen[:12])


def emit_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})


def sqlite_uri(path: Path) -> str:
    return f"file:{path}?mode=ro&immutable=1"


def mac_abs_to_jakarta(value) -> str:
    if value is None:
        return ""
    ts = float(value) + 978307200
    return datetime.fromtimestamp(ts, timezone.utc).astimezone(JAKARTA).strftime("%Y-%m-%d %H:%M:%S %Z")


def extract_native_messages() -> list[dict]:
    if not NATIVE_DB.exists():
        return []
    clauses = []
    params = []
    for k in KEYWORDS:
        clauses.append("lower(m.ZTEXT) like ?")
        params.append(f"%{k}%")
    # Focus on the 2026 operating period to keep this report relevant.
    jan_2026_mac_abs = datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp() - 978307200
    query = f"""
        select
          m.Z_PK,
          m.ZSTANZAID,
          m.ZMESSAGEDATE,
          m.ZISFROMME,
          m.ZFROMJID,
          m.ZTOJID,
          s.ZPARTNERNAME,
          s.ZCONTACTJID,
          m.ZTEXT
        from ZWAMESSAGE m
        left join ZWACHATSESSION s on s.Z_PK = m.ZCHATSESSION
        where m.ZTEXT is not null
          and m.ZMESSAGEDATE >= ?
          and ({' or '.join(clauses)})
        order by m.ZMESSAGEDATE asc, m.Z_PK asc
    """
    rows = []
    with sqlite3.connect(sqlite_uri(NATIVE_DB), uri=True) as con:
        con.row_factory = sqlite3.Row
        for r in con.execute(query, [jan_2026_mac_abs, *params]):
            text = clean_text(r["ZTEXT"] or "")
            hits = keyword_hits(text)
            if not hits:
                continue
            rows.append(
                {
                    "source": "native-whatsapp-chatstorage",
                    "message_pk": r["Z_PK"],
                    "stanza_id": r["ZSTANZAID"] or "",
                    "datetime_jakarta": mac_abs_to_jakarta(r["ZMESSAGEDATE"]),
                    "is_from_me": r["ZISFROMME"],
                    "chat_name": r["ZPARTNERNAME"] or "",
                    "chat_jid": r["ZCONTACTJID"] or "",
                    "from_jid": r["ZFROMJID"] or "",
                    "to_jid": r["ZTOJID"] or "",
                    "keywords": ";".join(hits),
                    "money_values": money_values(text),
                    "confidence": confidence(text),
                    "text": compact(text, 2400),
                    "hash": digest(text),
                }
            )
    return rows


def rx(pattern: str, text: str, flags: int = re.I | re.S) -> str:
    m = re.search(pattern, text, flags)
    if not m:
        return ""
    return clean_text(m.group(1))


def parse_rupiah(value: str) -> str:
    if not value:
        return ""
    if "gratis" in value.lower() or "free" in value.lower():
        return "0"
    m = re.search(r"(?:Rp\s*)?([0-9]{1,3}(?:[.\u00a0,][0-9]{3})+|[0-9]{4,9})", value)
    if not m:
        return ""
    digits = re.sub(r"\D", "", m.group(1))
    return digits


def normalize_order_id(text: str, fallback_pk: int) -> str:
    order_id = rx(r"Order ID:\s*\*?([A-Z0-9-]+)\*?", text, re.I)
    if order_id:
        return order_id
    legacy_name = rx(r"-\s*Nama:\s*([^\n\r]+)", text)
    date = rx(r"(?:Tanggal|Tanggal Mulai|Periode):\s*([^\n\r]+)", text)
    if legacy_name or date:
        return f"WA-LEGACY-{fallback_pk}"
    return f"WA-CANDIDATE-{fallback_pk}"


def item_lines(text: str) -> str:
    lines = []
    for line in text.splitlines():
        line = clean_text(line)
        if line.startswith("•") or re.match(r"^[*-]\s+\d+x\s", line, re.I):
            lines.append(line)
    return " | ".join(lines)


def extract_structured_native_orders() -> list[dict]:
    if not NATIVE_DB.exists():
        return []
    query = """
        select
          m.Z_PK,
          m.ZSTANZAID,
          m.ZMESSAGEDATE,
          m.ZISFROMME,
          s.ZPARTNERNAME,
          s.ZCONTACTJID,
          m.ZTEXT
        from ZWAMESSAGE m
        join ZWACHATSESSION s on s.Z_PK = m.ZCHATSESSION
        where s.ZPARTNERNAME = 'Santi Living Sewa Kasur'
          and m.ZTEXT is not null
          and (
            m.ZTEXT like '%Terima kasih sudah memesan%'
            or m.ZTEXT like '%Order ID:%'
            or m.ZTEXT like '%Halo, saya mau sewa:%'
            or m.ZTEXT like '%konfirmasi pembayaran%'
          )
        order by m.ZMESSAGEDATE asc, m.Z_PK asc
    """
    rows = []
    seen_order_status = set()
    with sqlite3.connect(sqlite_uri(NATIVE_DB), uri=True) as con:
        con.row_factory = sqlite3.Row
        for r in con.execute(query):
            text = clean_text(r["ZTEXT"] or "")
            if not text:
                continue
            order_id = normalize_order_id(text, r["Z_PK"])
            status = "candidate"
            low = text.lower()
            if "konfirmasi pembayaran" in low:
                status = "payment_confirmation"
            elif "terima kasih sudah memesan" in low:
                status = "order_received"
            elif "halo, saya mau sewa" in low:
                status = "rental_request"

            customer = rx(r"Halo Kak\s+\*([^*]+)\*", text) or rx(r"-\s*Nama:\s*([^\n\r]+)", text)
            period = rx(r"-\s*Periode:\s*([^\n\r]+)", text) or rx(r"Periode:\s*([^\n\r]+)", text)
            start = rx(r"-\s*Tanggal Mulai:\s*([^\n\r]+)", text) or rx(r"Mulai:\s*([^\n\r]+)", text)
            legacy_date = rx(r"-\s*Tanggal:\s*([^\n\r]+)", text) or rx(r"Tanggal:\s*([^\n\r]+)", text)
            duration = rx(r"-\s*Durasi:\s*([^\n\r]+)", text) or rx(r"Durasi:\s*([^\n\r]+)", text)
            total_kasur = rx(r"-\s*Total Kasur:\s*([^\n\r]+)", text)
            subtotal = rx(r"Subtotal(?:[^:]*):\s*([^\n\r]+)", text) or rx(r"-\s*Biaya Sewa:\s*([^\n\r]+)", text)
            ongkir_raw = rx(r"-\s*Ongkir:\s*([^\n\r]+)", text) or rx(r"Ongkir:\s*([^\n\r]+)", text)
            total_raw = (
                rx(r"\*TOTAL BAYAR:\s*([^\n\r*]+)\*", text)
                or rx(r"\*Total Pembayaran:\s*([^\n\r*]+)\*", text)
                or rx(r"Total Biaya:\s*([^\n\r]+)", text)
                or rx(r"-\s*Total:\s*([^\n\r]+)", text)
                or rx(r"Total:\s*([^\n\r]+)", text)
            )
            address = rx(r"-\s*Alamat:\s*([^\n\r]+)", text) or rx(r"Alamat:\s*([^\n\r]+)", text)
            maps = rx(r"(https://www\.google\.com/maps\?q=[^\s]+)", text, re.I)
            method = rx(r"Metode:\s*([^\n\r]+)", text)

            key = (order_id, status, compact(text, 180))
            if key in seen_order_status:
                continue
            seen_order_status.add(key)

            rows.append(
                {
                    "source": "native-whatsapp-santi-living-chat",
                    "message_pk": r["Z_PK"],
                    "stanza_id": r["ZSTANZAID"] or "",
                    "datetime_jakarta": mac_abs_to_jakarta(r["ZMESSAGEDATE"]),
                    "status_hint": status,
                    "order_id": order_id,
                    "customer_name": customer,
                    "period": period or legacy_date,
                    "start_date_raw": start,
                    "duration_raw": duration,
                    "total_kasur_raw": total_kasur,
                    "item_lines": item_lines(text),
                    "subtotal_raw": subtotal,
                    "subtotal_idr": parse_rupiah(subtotal),
                    "ongkir_raw": ongkir_raw,
                    "ongkir_idr": parse_rupiah(ongkir_raw),
                    "total_raw": total_raw,
                    "total_idr": parse_rupiah(total_raw),
                    "payment_method": method,
                    "address": address,
                    "maps": maps,
                    "is_from_me": r["ZISFROMME"],
                    "confidence": "HIGH" if status in {"order_received", "payment_confirmation"} and (order_id or customer) else "MEDIUM",
                    "text": compact(text, 3000),
                    "hash": digest(text),
                }
            )
    return rows


def decode_views(data: bytes) -> list[tuple[str, str]]:
    views = []
    for decoder in ("utf-8", "latin-1", "utf-16-le"):
        try:
            views.append((decoder, data.decode(decoder, "ignore")))
        except Exception:
            pass
    return views


def extract_chrome_snippets() -> list[dict]:
    if not CHROME_LEVELDB.exists():
        return []
    raw_rows = []
    seen = set()
    files = sorted([p for p in CHROME_LEVELDB.iterdir() if p.suffix in {".ldb", ".log"} or p.name.startswith("LOG")])
    for path in files:
        data = path.read_bytes()
        for decoder, text in decode_views(data):
            low = text.lower()
            for keyword in KEYWORDS:
                start = 0
                key = keyword.lower()
                while True:
                    idx = low.find(key, start)
                    if idx == -1:
                        break
                    left = max(0, idx - 900)
                    right = min(len(text), idx + 1600)
                    snippet = compact(text[left:right], 2400)
                    hits = keyword_hits(snippet)
                    if not hits:
                        start = idx + len(key)
                        continue
                    h = digest(f"{path.name}:{decoder}:{snippet}")
                    if h not in seen:
                        seen.add(h)
                        raw_rows.append(
                            {
                                "source": "chrome-profile-1-indexeddb-leveldb",
                                "source_file": path.name,
                                "decoder": decoder,
                                "char_index": idx,
                                "primary_keyword": keyword,
                                "keywords": ";".join(hits),
                                "chat_hint": chat_hint(snippet),
                                "date_hint": date_hint(snippet),
                                "money_values": money_values(snippet),
                                "confidence": confidence(snippet),
                                "text": snippet,
                                "hash": h,
                            }
                        )
                    start = idx + len(key)
    # Prefer stronger evidence and keep the output reviewable.
    score = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    raw_rows.sort(key=lambda r: (score.get(r["confidence"], 9), r["source_file"], int(r["char_index"])))
    return raw_rows[:1500]


def extract_chrome_contacts(chrome_rows: list[dict]) -> list[dict]:
    names = {}
    contact_re = re.compile(r"Cust SL\s*[-–]?\s*[A-Za-z0-9 .,'/&()+]{2,80}", re.I)
    for row in chrome_rows:
        for m in contact_re.finditer(row["text"]):
            name = clean_text(m.group(0))
            key = norm(name)
            if key and key not in names:
                names[key] = {
                    "chat_name": name,
                    "first_seen_source_file": row["source_file"],
                    "first_seen_hash": row["hash"],
                }
    if CHROME_LEVELDB.exists():
        for path in sorted([p for p in CHROME_LEVELDB.iterdir() if p.suffix in {".ldb", ".log"} or p.name.startswith("LOG")]):
            data = path.read_bytes()
            for decoder, text in decode_views(data):
                for m in contact_re.finditer(text):
                    name = clean_text(m.group(0))
                    name = re.split(r"\s{2,}|[\x00\n\r\t]|(?:Cust SL\s*[-–]?.*?)(?:Cust SL)", name)[0].strip()
                    key = norm(name)
                    if key and len(name) <= 100 and key not in names:
                        names[key] = {
                            "chat_name": name,
                            "first_seen_source_file": path.name,
                            "first_seen_hash": digest(f"{path.name}:{decoder}:{name}"),
                        }
    return sorted(names.values(), key=lambda r: r["chat_name"].lower())


def write_summary(native_rows: list[dict], chrome_rows: list[dict], contacts: list[dict]) -> None:
    native_high = sum(1 for r in native_rows if r["confidence"] == "HIGH")
    chrome_high = sum(1 for r in chrome_rows if r["confidence"] == "HIGH")
    structured_path = OUT / "native-santi-living-structured-orders.csv"
    structured_count = 0
    if structured_path.exists():
        with structured_path.open(encoding="utf-8") as f:
            structured_count = max(0, sum(1 for _ in f) - 1)
    md = OUT / "whatsapp-db-extraction-summary.md"
    lines = [
        "# Santi Living WhatsApp DB Extraction Summary",
        "",
        f"Generated: {datetime.now(JAKARTA).strftime('%Y-%m-%d %H:%M:%S %Z')}",
        "",
        "## Sources",
        "",
        f"- Chrome Profile 1 IndexedDB snapshot: `{CHROME_LEVELDB}`",
        f"- Native WhatsApp ChatStorage snapshot: `{NATIVE_DB}`",
        "",
        "## Results",
        "",
        f"- Chrome raw order snippets: {len(chrome_rows)} rows ({chrome_high} high-confidence snippets)",
        f"- Chrome `Cust SL` contacts recovered from raw snippets: {len(contacts)}",
        f"- Native WhatsApp 2026 keyword messages: {len(native_rows)} rows ({native_high} high-confidence messages)",
        f"- Native structured Santi Living orders/payment confirmations: {structured_count} rows",
        "",
        "## Interpretation",
        "",
        "- Chrome Profile 1 is the Santi Living profile and contains `Cust SL` customer names plus invoice/order snippets.",
        "- Chrome IndexedDB uses Chromium's custom IndexedDB LevelDB comparator, so normal LevelDB readers cannot open it directly. This extractor uses read-only binary snippet extraction from a local snapshot.",
        "- Native WhatsApp SQLite is parseable and useful as supporting evidence, especially internal Santi Living schedule/payment/order messages, but it is not treated as the sole customer source.",
        "- These outputs are candidate/evidence extraction only. They are not yet ERP-ready orders until a second pass groups snippets per customer, resolves duplicates/revisions, and confirms closing/payment status.",
        "",
        "## Output Files",
        "",
        "- `chrome-profile-1-order-snippets.csv`",
        "- `chrome-profile-1-cust-sl-contacts.csv`",
        "- `native-whatsapp-order-message-hits.csv`",
        "- `native-santi-living-structured-orders.csv`",
        "",
        "## Next Step",
        "",
        "Use the Chrome snippet CSV plus native support messages to build a customer-by-customer closing ledger. Do not input to Sync ERP until each order has invoice/order text, rental dates, item lines, ongkir, total, DP/payment status, and duplicate/revision status.",
        "",
    ]
    md.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    native_rows = extract_native_messages()
    structured_orders = extract_structured_native_orders()
    chrome_rows = extract_chrome_snippets()
    contacts = extract_chrome_contacts(chrome_rows)

    emit_csv(
        OUT / "native-whatsapp-order-message-hits.csv",
        native_rows,
        [
            "source",
            "message_pk",
            "stanza_id",
            "datetime_jakarta",
            "is_from_me",
            "chat_name",
            "chat_jid",
            "from_jid",
            "to_jid",
            "keywords",
            "money_values",
            "confidence",
            "text",
            "hash",
        ],
    )
    emit_csv(
        OUT / "chrome-profile-1-order-snippets.csv",
        chrome_rows,
        [
            "source",
            "source_file",
            "decoder",
            "char_index",
            "primary_keyword",
            "keywords",
            "chat_hint",
            "date_hint",
            "money_values",
            "confidence",
            "text",
            "hash",
        ],
    )
    emit_csv(
        OUT / "chrome-profile-1-cust-sl-contacts.csv",
        contacts,
        ["chat_name", "first_seen_source_file", "first_seen_hash"],
    )
    emit_csv(
        OUT / "native-santi-living-structured-orders.csv",
        structured_orders,
        [
            "source",
            "message_pk",
            "stanza_id",
            "datetime_jakarta",
            "status_hint",
            "order_id",
            "customer_name",
            "period",
            "start_date_raw",
            "duration_raw",
            "total_kasur_raw",
            "item_lines",
            "subtotal_raw",
            "subtotal_idr",
            "ongkir_raw",
            "ongkir_idr",
            "total_raw",
            "total_idr",
            "payment_method",
            "address",
            "maps",
            "is_from_me",
            "confidence",
            "text",
            "hash",
        ],
    )
    write_summary(native_rows, chrome_rows, contacts)
    print(f"chrome_rows={len(chrome_rows)}")
    print(f"chrome_contacts={len(contacts)}")
    print(f"native_rows={len(native_rows)}")
    print(f"structured_orders={len(structured_orders)}")


if __name__ == "__main__":
    main()
