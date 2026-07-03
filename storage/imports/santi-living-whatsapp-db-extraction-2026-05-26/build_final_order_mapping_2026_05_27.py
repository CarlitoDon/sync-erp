#!/usr/bin/env python3
"""Build final Santi Living rental order mapping from Carla/WhatsApp evidence.

Inputs are intentionally local artifacts:
- Carla Telegram/WhatsApp extraction script containing invoice blocks.
- Codex visible-chat extraction CSV for chats that were opened directly.
- Sync ERP read-back JSON captured from Carla MCP.

The script is read-only. It writes audit CSV/MD artifacts only.
"""

from __future__ import annotations

import ast
import csv
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


BASE = Path("/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26")
CARLA_INVOICE_SCRIPT = Path("/Users/wecik/.hermes/profiles/carla/skills/santi-living-rental-report/extract_all_invoices.py")
ERP_RESULT = Path("/var/folders/cw/ntt40hs509zcy86s7jfx6r6c0000gp/T/hermes-results/call_1842d996900845029ace49da.txt")
VISIBLE_CSV = BASE / "visible-chat-invoice-candidates-deduped.csv"

LEDGER_OUT = BASE / "santi-living-rental-orders-final-current-ledger-2026-05-27.csv"
SOURCE_NOT_IN_ERP_OUT = BASE / "santi-living-rental-orders-source-not-in-erp-2026-05-27.csv"
REPORT_OUT = BASE / "santi-living-rental-orders-final-current-report-2026-05-27.md"

MONTHS = {
    "januari": 1,
    "februari": 2,
    "maret": 3,
    "april": 4,
    "mei": 5,
    "juni": 6,
    "juli": 7,
    "agustus": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "desember": 12,
}


def norm_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def compact(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def money_to_int(value: str | None) -> int | None:
    if not value:
        return None
    digits = re.sub(r"[^0-9]", "", value)
    return int(digits) if digits else None


def fmt_idr(value: int | None) -> str:
    if value is None:
        return ""
    return f"Rp{value:,}".replace(",", ".")


def parse_indo_date(value: str | None) -> str:
    if not value:
        return ""
    text = value.strip()
    if "," in text:
        text = text.split(",", 1)[1].strip()
    parts = text.split()
    if len(parts) < 3:
        return ""
    day = int(re.sub(r"[^0-9]", "", parts[0]))
    month = MONTHS[parts[1].lower()]
    year = int(re.sub(r"[^0-9]", "", parts[2]))
    return f"{year:04d}-{month:02d}-{day:02d}"


def utc_iso_to_jakarta_date(value: str) -> str:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    local = dt.astimezone(timezone(timedelta(hours=7)))
    return local.date().isoformat()


def extract_between(block: str, start_pat: str, end_pat: str) -> str:
    match = re.search(start_pat + r"\s*(.*?)\s*(?=" + end_pat + r")", block, re.I | re.S)
    return compact(match.group(1)) if match else ""


def parse_invoice_block(raw: str, source_type: str, source_file: str) -> dict[str, Any]:
    block = compact(raw)
    name = extract_between(block, r"Nama:", r"Lokasi:")
    location = extract_between(block, r"Lokasi:", r"Tanggal Kirim:")
    send_raw = extract_between(block, r"Tanggal Kirim:", r"Tanggal Ambil:")
    pickup_raw = extract_between(block, r"Tanggal Ambil:", r"Durasi Sewa:")
    duration = extract_between(block, r"Durasi Sewa:", r"Detail Pesanan")
    items = extract_between(block, r"Detail Pesanan(?: Tambahan)?(?: \([^)]*\))?", r"(?:Subtotal Sewa|Total sewa kasur|Ongkir|Diskon|Total Pembayaran)")
    if not items:
        items = extract_between(block, r"Detail Pesanan(?: Tambahan)?(?: \([^)]*\))?", r"(?:Ongkir|Total Pembayaran)")
    ongkir_match = re.search(r"(Ongkir(?: Tambahan)?\s*:\s*.*?)(?=\s+Total Pembayaran|\s+DP|\s+Sisa Pelunasan|\s+Catatan:|$)", block, re.I)
    total_match = re.search(r"Total Pembayaran\s*:\s*(Rp[\d.]+)", block, re.I)
    dp_match = re.search(r"DP\s*(?:30%)?\s*:?\s*((?:Rp[\d.]+)(?:\s*-\s*Rp[\d.]+\s*:\s*Rp[\d.]+)?)", block, re.I)
    remaining_match = re.search(r"Sisa Pelunasan\s*:\s*(Rp[\d.]+)", block, re.I)
    subtotal_match = re.search(r"Subtotal Sewa\s*:\s*(Rp[\d.]+)", block, re.I)

    dp_raw = compact(dp_match.group(1)) if dp_match else ""
    dp_values = [money_to_int(v) for v in re.findall(r"Rp[\d.]+", dp_raw)]

    return {
        "source_type": source_type,
        "source_file": source_file,
        "customer": name,
        "location": location,
        "start_date_raw": send_raw,
        "end_date_raw": pickup_raw,
        "start_date": parse_indo_date(send_raw),
        "end_date": parse_indo_date(pickup_raw),
        "duration": duration,
        "items": items,
        "ongkir_raw": compact(ongkir_match.group(1)) if ongkir_match else "",
        "subtotal_idr": money_to_int(subtotal_match.group(1)) if subtotal_match else None,
        "total_idr": money_to_int(total_match.group(1)) if total_match else None,
        "dp_raw": dp_raw,
        "dp_basis_idr": dp_values[0] if dp_values else None,
        "dp_effective_idr": dp_values[-1] if dp_values else None,
        "sisa_idr": money_to_int(remaining_match.group(1)) if remaining_match else None,
        "invoice_text": block,
    }


def load_carla_source() -> list[dict[str, Any]]:
    text = CARLA_INVOICE_SCRIPT.read_text()
    match = re.search(r"sample_text\s*=\s*(\"\"\".*?\"\"\")", text, re.S)
    if not match:
        raise RuntimeError("sample_text not found in Carla invoice script")
    sample_text = ast.literal_eval(match.group(1))
    header = re.compile(r"INVOICE PEMESANAN(?:\s*TAMBAHAN)?(?:\s*\(REVISI\))?\s*Sewa Kasur Santi Living by Santi Mebel Godean", re.I)
    matches = list(header.finditer(sample_text))
    rows: list[dict[str, Any]] = []
    for idx, m in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(sample_text)
        raw = sample_text[m.start():end]
        row = parse_invoice_block(raw, "carla_telegram_whatsapp_extract", str(CARLA_INVOICE_SCRIPT))
        if row.get("customer") and row.get("total_idr"):
            rows.append(row)
    return rows


def load_visible_source() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with VISIBLE_CSV.open(newline="") as f:
        for raw in csv.DictReader(f):
            rows.append(
                {
                    "source_type": "codex_visible_whatsapp_chat_extract",
                    "source_file": raw["source_file"],
                    "customer": raw["nama"],
                    "location": raw["lokasi"],
                    "start_date_raw": raw["tanggal_kirim"],
                    "end_date_raw": raw["tanggal_ambil"],
                    "start_date": parse_indo_date(raw["tanggal_kirim"]),
                    "end_date": parse_indo_date(raw["tanggal_ambil"]),
                    "duration": raw["durasi"],
                    "items": raw["items"],
                    "ongkir_raw": raw["ongkir_raw"],
                    "subtotal_idr": None,
                    "total_idr": money_to_int(raw["total_raw"]),
                    "dp_raw": raw["dp_raw"],
                    "dp_basis_idr": money_to_int(raw["dp_raw"]),
                    "dp_effective_idr": money_to_int(raw["dp_raw"]),
                    "sisa_idr": money_to_int(raw["sisa_raw"]),
                    "invoice_text": raw["block_excerpt"],
                }
            )
    return rows


def parse_note_fields(notes: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in notes.splitlines():
        if "=" in line and not line.startswith("INVOICE"):
            key, value = line.split("=", 1)
            fields[key] = value
    return fields


def load_erp_orders() -> list[dict[str, Any]]:
    payload = json.loads(ERP_RESULT.read_text())
    data = json.loads(payload["result"])
    rows: list[dict[str, Any]] = []
    for item in data["items"]:
        fields = parse_note_fields(item.get("notes") or "")
        rows.append(
            {
                "erp_order_id": item["id"],
                "order_number": item["orderNumber"],
                "invoice_ref": fields.get("invoice_ref", ""),
                "customer": fields.get("customer", ""),
                "partner_name": (item.get("partner") or {}).get("name", ""),
                "location": item.get("deliveryAddress") or "",
                "start_date": utc_iso_to_jakarta_date(item["rentalStartDate"]),
                "end_date": utc_iso_to_jakarta_date(item["rentalEndDate"]),
                "total_idr": int(item["totalAmount"]),
                "subtotal_idr": int(item["subtotal"]),
                "delivery_fee_idr": int(item.get("deliveryFee") or 0),
                "discount_idr": int(item.get("discountAmount") or 0),
                "dp_recorded_idr": money_to_int(fields.get("dp")),
                "sisa_recorded_idr": money_to_int(fields.get("remaining")),
                "status": item["status"],
                "payment_status": item["rentalPaymentStatus"],
                "notes": item.get("notes") or "",
            }
        )
    return rows


def key(row: dict[str, Any]) -> tuple[str, str, str, int | None]:
    return (norm_text(row.get("customer")), row.get("start_date") or "", row.get("end_date") or "", row.get("total_idr"))


def source_matches_erp(source: dict[str, Any], erp: dict[str, Any]) -> bool:
    if source.get("total_idr") != erp.get("total_idr"):
        return False
    if source.get("start_date") != erp.get("start_date"):
        return False
    if source.get("end_date") != erp.get("end_date"):
        return False
    src_name = norm_text(source.get("customer"))
    erp_name = norm_text(erp.get("customer"))
    partner = norm_text(erp.get("partner_name"))
    return bool(src_name and (src_name in erp_name or erp_name in src_name or src_name in partner))


def find_source_for_order(order: dict[str, Any], sources: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [s for s in sources if source_matches_erp(s, order)]
    if not candidates:
        return None
    candidates.sort(key=lambda s: 0 if s["source_type"].startswith("codex_visible") else 1)
    return candidates[0]


def is_superseded_source(source: dict[str, Any], erp_orders: list[dict[str, Any]]) -> tuple[bool, str]:
    if source.get("customer") == "Intan Candra" and source.get("total_idr") == 120000:
        return True, "superseded by current Intan Candra 2-night invoice Rp210.000 / SL-INV-028"
    for erp in erp_orders:
        if norm_text(source.get("customer")) == norm_text(erp.get("customer")) and source.get("start_date") == erp.get("start_date"):
            if source.get("end_date") != erp.get("end_date") or source.get("total_idr") != erp.get("total_idr"):
                return True, f"possible earlier revision superseded by {erp['order_number']} / {erp['invoice_ref']}"
    return False, ""


def main() -> None:
    erp_orders = load_erp_orders()
    sources = load_visible_source() + load_carla_source()

    matched_source_ids: set[int] = set()
    ledger_rows: list[dict[str, Any]] = []
    for order in sorted(erp_orders, key=lambda r: r["order_number"]):
        source = find_source_for_order(order, sources)
        if source:
            matched_source_ids.add(id(source))
        dp_note = ""
        if order["customer"] == "Intan Candra":
            dp_note = "ERP note stores dp=63000, invoice text also states Rp63.000 - Rp36.000 : Rp27.000; review before payment posting."
        ledger_rows.append(
            {
                "mapping_status": "mapped",
                "order_number": order["order_number"],
                "invoice_ref": order["invoice_ref"],
                "customer": order["customer"],
                "partner_name": order["partner_name"],
                "location": order["location"],
                "start_date": order["start_date"],
                "end_date": order["end_date"],
                "duration": source.get("duration") if source else "",
                "items": source.get("items") if source else "",
                "ongkir_raw": source.get("ongkir_raw") if source else "",
                "subtotal_idr": order["subtotal_idr"],
                "delivery_fee_idr": order["delivery_fee_idr"],
                "discount_idr": order["discount_idr"],
                "total_idr": order["total_idr"],
                "dp_recorded_idr": order["dp_recorded_idr"],
                "dp_effective_source_idr": source.get("dp_effective_idr") if source else "",
                "sisa_recorded_idr": order["sisa_recorded_idr"],
                "sisa_source_idr": source.get("sisa_idr") if source else "",
                "erp_status": order["status"],
                "erp_payment_status": order["payment_status"],
                "source_type": source.get("source_type") if source else "sync_erp_notes_only",
                "source_file": source.get("source_file") if source else "",
                "review_note": dp_note,
            }
        )

    source_not_in_erp: list[dict[str, Any]] = []
    for source in sources:
        if id(source) in matched_source_ids:
            continue
        superseded, reason = is_superseded_source(source, erp_orders)
        # Avoid duplicate source rows from visible + Carla for the same invoice.
        source_key = key(source)
        already_mapped = any(key(row) == source_key for row in ledger_rows)
        if already_mapped:
            continue
        if superseded:
            status = "superseded"
        else:
            status = "source_not_in_erp"
        source_not_in_erp.append(
            {
                "mapping_status": status,
                "customer": source["customer"],
                "location": source["location"],
                "start_date": source["start_date"],
                "end_date": source["end_date"],
                "duration": source["duration"],
                "items": source["items"],
                "ongkir_raw": source["ongkir_raw"],
                "total_idr": source["total_idr"],
                "dp_effective_idr": source["dp_effective_idr"],
                "sisa_idr": source["sisa_idr"],
                "source_type": source["source_type"],
                "source_file": source["source_file"],
                "review_note": reason,
                "invoice_text": source["invoice_text"],
            }
        )

    # Deduplicate source-only rows by customer/date/total/source status.
    deduped_source_only: list[dict[str, Any]] = []
    seen = set()
    for row in source_not_in_erp:
        row_key = (row["mapping_status"], norm_text(row["customer"]), row["start_date"], row["end_date"], row["total_idr"])
        if row_key not in seen:
            seen.add(row_key)
            deduped_source_only.append(row)
    source_not_in_erp = deduped_source_only

    with LEDGER_OUT.open("w", newline="") as f:
        fieldnames = list(ledger_rows[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(ledger_rows)

    with SOURCE_NOT_IN_ERP_OUT.open("w", newline="") as f:
        fieldnames = list(source_not_in_erp[0].keys()) if source_not_in_erp else [
            "mapping_status",
            "customer",
            "location",
            "start_date",
            "end_date",
            "duration",
            "items",
            "ongkir_raw",
            "total_idr",
            "dp_effective_idr",
            "sisa_idr",
            "source_type",
            "source_file",
            "review_note",
            "invoice_text",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(source_not_in_erp)

    current_source_only = [r for r in source_not_in_erp if r["mapping_status"] == "source_not_in_erp"]
    superseded = [r for r in source_not_in_erp if r["mapping_status"] == "superseded"]
    mapped_total = sum(r["total_idr"] for r in ledger_rows)
    current_source_only_total = sum(r["total_idr"] for r in current_source_only if r["total_idr"])
    dp_total = sum((r["dp_recorded_idr"] or 0) for r in ledger_rows)
    sisa_total = sum((r["sisa_recorded_idr"] or 0) for r in ledger_rows)

    missing_table = "\n".join(
        f"| {r['customer']} | {r['location']} | {r['start_date']} | {r['end_date']} | {fmt_idr(r['total_idr'])} | {fmt_idr(r['dp_effective_idr'])} | {fmt_idr(r['sisa_idr'])} | {r['source_type']} |"
        for r in current_source_only
    ) or "| - | - | - | - | - | - | - | - |"
    superseded_table = "\n".join(
        f"| {r['customer']} | {r['start_date']} | {r['end_date']} | {fmt_idr(r['total_idr'])} | {r['review_note']} |"
        for r in superseded
    ) or "| - | - | - | - | - |"

    REPORT_OUT.write_text(
        f"""# Santi Living Rental Order Mapping Final Check - 2026-05-27

## Result

- Sync ERP rental orders checked: {len(ledger_rows)}
- Sync ERP mapped to WhatsApp/Carla evidence: {sum(1 for r in ledger_rows if r['mapping_status'] == 'mapped')}
- Sync ERP mapped total: {fmt_idr(mapped_total)}
- Sync ERP recorded DP total: {fmt_idr(dp_total)}
- Sync ERP recorded remaining total: {fmt_idr(sisa_total)}
- Current WhatsApp/Carla source invoices not yet in ERP: {len(current_source_only)}
- Current source-not-in-ERP total: {fmt_idr(current_source_only_total)}
- Superseded invoice evidence excluded from current ledger: {len(superseded)}

## Current Source Not In ERP

| Customer | Location | Start | End | Total | DP | Remaining | Source |
|---|---|---:|---:|---:|---:|---:|---|
{missing_table}

## Superseded / Not Current

| Customer | Start | End | Total | Reason |
|---|---:|---:|---:|---|
{superseded_table}

## Notes

- The official current ERP set still has 26 draft rental orders totaling {fmt_idr(mapped_total)}.
- Carla's Telegram session `20260527_093417_e20d22` explicitly found 27 WhatsApp invoices vs 26 ERP orders and identified Bayu as not in ERP.
- This report corrects that comparison by adding Retno from direct visible-chat extraction and excluding the older Intan Candra one-night invoice as superseded. On that basis, the current source universe is 27 orders totaling {fmt_idr(mapped_total + current_source_only_total)}.
- Intan Candra needs DP review before payment posting: ERP note has `dp=63000`, but invoice text also says `Rp63.000 - Rp36.000 : Rp27.000`.
- This script did not mutate Sync ERP.

## Output Files

- `{LEDGER_OUT}`
- `{SOURCE_NOT_IN_ERP_OUT}`
""",
        encoding="utf-8",
    )

    print(json.dumps({
        "erp_orders": len(ledger_rows),
        "erp_mapped_total": mapped_total,
        "source_not_in_erp": current_source_only,
        "superseded": superseded,
        "ledger": str(LEDGER_OUT),
        "source_not_in_erp_file": str(SOURCE_NOT_IN_ERP_OUT),
        "report": str(REPORT_OUT),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
