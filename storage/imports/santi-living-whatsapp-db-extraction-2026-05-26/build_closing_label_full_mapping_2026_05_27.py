#!/usr/bin/env python3
"""Build a full mapping for WhatsApp Business closing labels vs Sync ERP orders.

This report is intentionally conservative: a WhatsApp label is not treated as an
ERP-ready rental order unless dates, items, ongkir/total, and source evidence are
available from the local exports.
"""

from __future__ import annotations

import csv
import json
import re
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


BASE = Path(
    "/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/"
    "santi-living-whatsapp-db-extraction-2026-05-26"
)
LEADS = Path(
    "/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/"
    "santi-living-whatsapp-leads-2026-05-26/lead-closing-extraction.csv"
)
ERP_LEDGER = BASE / "santi-living-rental-orders-final-after-fix-ledger-2026-05-27.csv"
NOTES = BASE / "browser-indexeddb-notes.csv"
NATIVE_DB = BASE / "raw/native-whatsapp/ChatStorage.backup.sqlite"

OUT_CSV = BASE / "santi-living-closing-label-full-mapping-2026-05-27.csv"
OUT_MD = BASE / "santi-living-closing-label-full-mapping-2026-05-27.md"

JAKARTA = ZoneInfo("Asia/Jakarta")


MANUAL_NATIVE_EVIDENCE: dict[str, dict[str, str]] = {
    # Complete invoice/order details found in this pass.
    "139358954885259@lid": {
        "mapping_status": "ready_to_input_complete_invoice",
        "confidence": "high",
        "evidence": "native:ZWAMESSAGE:66254",
        "reason": (
            "Complete Fendy invoice found: 18 Mar 2026 to 25 Mar 2026, "
            "Paket Single 100 x2, subtotal Rp616.000, ongkir net Rp26.000, "
            "total Rp642.000; follow-up says kekurangan Rp442.000."
        ),
        "proposed_action": "Input draft rental order; payment remains pending unless payment evidence is confirmed.",
    },
    "273821462470758@lid": {
        "mapping_status": "ready_to_input_complete_note_invoice",
        "confidence": "high",
        "evidence": "browser-note:idx=1; native:ZWAMESSAGE:61781",
        "reason": (
            "Complete Nisrina note invoice found: 19 Mar 2026 to 23 Mar 2026, "
            "Paket Queen 160 x2, subtotal Rp472.000, ongkir Rp46.000, "
            "total Rp518.000. Note says sudah dp but DP amount is not present."
        ),
        "proposed_action": "Input draft rental order; do not post DP amount yet.",
    },
    # Complete-ish but duplicate/revision ambiguity.
    "184482367803447@lid": {
        "mapping_status": "needs_review_duplicate_order_candidate",
        "confidence": "medium",
        "evidence": "native:ZWAMESSAGE:32128; native:ZWAMESSAGE:32155",
        "reason": (
            "Agashi has two order-confirmation texts: RNT-000025 total Rp20.000 "
            "for 29-30 Jan 2026 and RNT-000026 total Rp40.000 for 29-31 Jan 2026. "
            "Need decide which one is the final real order before ERP input."
        ),
        "proposed_action": "Open/export Agashi chat or use final operational evidence to choose one version.",
    },
    # Partial schedule/payment evidence. Not enough to safely price.
    "98810017661056@lid": {
        "mapping_status": "partial_order_evidence_no_total",
        "confidence": "medium",
        "evidence": "native:ZWAMESSAGE:42158",
        "reason": (
            "Adani/Suparmi Palagan schedule found with dates and items "
            "(Single 100 x4, Queen 160 x2, sprei x6, bantal x8), but no total/ongkir/payment."
        ),
        "proposed_action": "Need invoice/customer chat or payment evidence before ERP order input.",
    },
    "187445375189162@lid": {
        "mapping_status": "partial_schedule_and_payment_no_invoice_total",
        "confidence": "medium",
        "evidence": "native:ZWAMESSAGE:61765; native:ZWAMESSAGE:61776",
        "reason": (
            "Lucky schedule found (Single 90 x1, 17-18 Mar 2026) and payment note "
            "Lucky Rp93.000 lunas, but no invoice/ongkir breakdown."
        ),
        "proposed_action": "Need customer invoice/chat to avoid reverse-engineering price.",
    },
    "266648917377034@lid": {
        "mapping_status": "partial_schedule_and_dp_no_invoice_total",
        "confidence": "medium",
        "evidence": "native:ZWAMESSAGE:61765; native:ZWAMESSAGE:61778",
        "reason": (
            "Felis/Ella schedule found (Queen 160 x1, Single 100 x1, 17-23 Mar 2026) "
            "and DP Rp300.000, but no total/ongkir."
        ),
        "proposed_action": "Need invoice/customer chat before ERP order input.",
    },
    "239435937521900@lid": {
        "mapping_status": "partial_payment_no_invoice",
        "confidence": "low",
        "evidence": "native:ZWAMESSAGE:72525",
        "reason": "Muji payment note says DP Rp320.000, but no date/items/total invoice found.",
        "proposed_action": "Need invoice/customer chat before ERP order input.",
    },
    "80573636808926@lid": {
        "mapping_status": "partial_payment_no_invoice",
        "confidence": "low",
        "evidence": "native:ZWAMESSAGE:72525",
        "reason": "Experian payment note says lunas Rp136.000, but no date/items/ongkir invoice found.",
        "proposed_action": "Need invoice/customer chat before ERP order input.",
    },
    "61633401467054@lid": {
        "mapping_status": "partial_pickup_schedule_no_total",
        "confidence": "low",
        "evidence": "native:ZWAMESSAGE:86529",
        "reason": "Harmawan pickup schedule found (Single 90 x3), but no start date/total/ongkir invoice.",
        "proposed_action": "Need invoice/customer chat before ERP order input.",
    },
    "109165200580843@lid": {
        "mapping_status": "partial_pickup_schedule_no_total",
        "confidence": "low",
        "evidence": "native:ZWAMESSAGE:86529",
        "reason": "Aryadi pickup schedule found (Double 120 x4), but no start date/total/ongkir invoice.",
        "proposed_action": "Need invoice/customer chat before ERP order input.",
    },
    "93565912920222@lid": {
        "mapping_status": "partial_schedule_no_total",
        "confidence": "low",
        "evidence": "native:ZWAMESSAGE:82976; native:ZWAMESSAGE:85621; native:ZWAMESSAGE:87651",
        "reason": "Emma schedule/contact fragments found, but no invoice total or detailed order.",
        "proposed_action": "Need invoice/customer chat before ERP order input.",
    },
    "132392517918962@lid": {
        "mapping_status": "partial_schedule_no_total",
        "confidence": "low",
        "evidence": "native:ZWAMESSAGE:82976; native:ZWAMESSAGE:84713",
        "reason": "Misfa schedule/contact fragments found, but no invoice total or detailed order.",
        "proposed_action": "Need invoice/customer chat before ERP order input.",
    },
    "58553473724608@lid": {
        "mapping_status": "partial_contact_schedule_no_total",
        "confidence": "low",
        "evidence": "native:ZWAMESSAGE:75056",
        "reason": "Jhon BT/Marjono contact/address fragment found, but no invoice total or dates.",
        "proposed_action": "Need invoice/customer chat before ERP order input.",
    },
}


def normalize(value: str) -> str:
    value = re.sub(r"\bcust\s*sl\b", " ", value.lower())
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def key_tokens(value: str) -> list[str]:
    tokens = normalize(value).split()
    return [token for token in tokens if token not in {"pak", "bu", "bp", "mas", "mbak", "mba", "an"}]


def safe_match(contact_name: str, partner_name: str) -> bool:
    contact = key_tokens(contact_name)
    partner = key_tokens(partner_name)
    if not contact or not partner:
        return False
    if contact == partner:
        return True
    # Require the first distinctive token and one additional token for fuzzy names.
    if contact[0] == partner[0] and len(set(contact) & set(partner)) >= 2:
        return True
    return False


def dt_from_mac_abs(value: float | int | None) -> str:
    if value is None:
        return ""
    return datetime.fromtimestamp(float(value) + 978307200, timezone.utc).astimezone(JAKARTA).strftime(
        "%Y-%m-%d %H:%M:%S %Z"
    )


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_note_evidence() -> dict[str, str]:
    evidence: dict[str, str] = {}
    if not NOTES.exists():
        return evidence
    for row in load_csv(NOTES):
        chat_jid = row.get("chat_jid", "")
        content = row.get("content", "")
        if "INVOICE PEMESANAN" in content:
            evidence[chat_jid] = f"browser-note:idx={row.get('idx', '')}: {re.sub(r'\\s+', ' ', content)[:400]}"
    return evidence


def native_hits_for_names(names: list[str]) -> dict[str, str]:
    if not NATIVE_DB.exists():
        return {}
    result: dict[str, str] = {}
    with sqlite3.connect(f"file:{NATIVE_DB}?mode=ro&immutable=1", uri=True) as con:
        con.row_factory = sqlite3.Row
        for name in names:
            terms = [token for token in key_tokens(name) if len(token) >= 4][:3]
            snippets = []
            for term in terms:
                rows = con.execute(
                    """
                    select m.Z_PK, m.ZMESSAGEDATE, s.ZPARTNERNAME, m.ZTEXT
                    from ZWAMESSAGE m
                    left join ZWACHATSESSION s on s.Z_PK = m.ZCHATSESSION
                    where m.ZTEXT is not null and lower(m.ZTEXT) like ?
                    order by m.ZMESSAGEDATE asc
                    limit 3
                    """,
                    (f"%{term.lower()}%",),
                ).fetchall()
                for row in rows:
                    text = re.sub(r"\s+", " ", row["ZTEXT"] or "").strip()
                    snippets.append(
                        f"native:{row['Z_PK']} {dt_from_mac_abs(row['ZMESSAGEDATE'])} "
                        f"{row['ZPARTNERNAME']}: {text[:180]}"
                    )
            if snippets:
                seen = []
                for snippet in snippets:
                    if snippet not in seen:
                        seen.append(snippet)
                result[name] = " | ".join(seen[:5])
    return result


def main() -> None:
    closing_rows = [row for row in load_csv(LEADS) if row["status_bucket"] == "closing_or_customer"]
    erp_rows = load_csv(ERP_LEDGER)
    note_evidence = load_note_evidence()
    # Kept available for future forensic expansion, but not used for generic
    # label-only rows because name-only hits produce too many false positives
    # from unrelated personal and Santi Mebel chats.
    native_index = native_hits_for_names([row["display_name"] for row in closing_rows])

    output_rows: list[dict[str, str]] = []
    for row in closing_rows:
        erp_matches = [erp for erp in erp_rows if safe_match(row["display_name"], erp["partner_name"])]
        if erp_matches:
            status = "erp_mapped_exact"
            confidence = "high"
            evidence = "; ".join(
                f"{match['invoice_ref']} {match['order_number']} total={match['total_idr']}"
                for match in erp_matches
            )
            reason = "Exact/safe customer-name match to current Sync ERP rental order ledger."
            proposed_action = "No new order; verify payment/fulfillment separately."
        elif row["chat_id"] in MANUAL_NATIVE_EVIDENCE:
            item = MANUAL_NATIVE_EVIDENCE[row["chat_id"]]
            status = item["mapping_status"]
            confidence = item["confidence"]
            evidence = item["evidence"]
            reason = item["reason"]
            proposed_action = item["proposed_action"]
        else:
            status = "label_only_needs_chat_export"
            confidence = "low"
            evidence_parts = []
            if row["chat_id"] in note_evidence:
                evidence_parts.append(note_evidence[row["chat_id"]])
            evidence = " || ".join(evidence_parts)
            reason = (
                "WhatsApp Business closing label exists, but local exports do not expose a complete "
                "invoice/order body with dates, item lines, ongkir, and total."
            )
            proposed_action = "Open/export this chat body before Sync ERP input; do not infer price from SKU."
            if row["chat_type"] == "group":
                status = "group_label_needs_identification"
                reason = "Labeled WhatsApp group has no single customer identity in the label export."
                proposed_action = "Open/export group chat and identify the actual customer/order."

        output_rows.append(
            {
                "chat_id": row["chat_id"],
                "phone": row["phone"],
                "display_name": row["display_name"],
                "labels": row["labels"],
                "primary_label": row["primary_label"],
                "last_chat_at": row["last_chat_at"],
                "mapping_status": status,
                "confidence": confidence,
                "erp_matches": evidence if status == "erp_mapped_exact" else "",
                "evidence": "" if status == "erp_mapped_exact" else evidence,
                "reason": reason,
                "proposed_action": proposed_action,
            }
        )

    fields = [
        "chat_id",
        "phone",
        "display_name",
        "labels",
        "primary_label",
        "last_chat_at",
        "mapping_status",
        "confidence",
        "erp_matches",
        "evidence",
        "reason",
        "proposed_action",
    ]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(output_rows)

    status_counts = Counter(row["mapping_status"] for row in output_rows)
    primary_counts = Counter(row["primary_label"] for row in output_rows)
    erp_order_count = len(erp_rows)
    erp_order_total = sum(int(row["total_idr"]) for row in erp_rows)
    erp_exact_rows = [row for row in output_rows if row["mapping_status"] == "erp_mapped_exact"]
    ready_rows = [
        row
        for row in output_rows
        if row["mapping_status"]
        in {"ready_to_input_complete_invoice", "ready_to_input_complete_note_invoice"}
    ]
    review_rows = [
        row
        for row in output_rows
        if row["mapping_status"] not in {"erp_mapped_exact"}
    ]

    lines = [
        "# Santi Living Closing Label Full Mapping - 2026-05-27",
        "",
        "## Summary",
        "",
        f"- WhatsApp `closing_or_customer` label rows: {len(output_rows)}",
        f"- Current Sync ERP `SL-INV-*` rental orders: {erp_order_count}",
        f"- Current Sync ERP `SL-INV-*` total: Rp{erp_order_total:,}".replace(",", "."),
        f"- Closing label rows safely matched to existing ERP orders: {len(erp_exact_rows)}",
        f"- ERP-ready additional rows found in this pass: {len(ready_rows)}",
        "",
        "The gap is real, but it is not safe to import all 55 labels as orders. A label means the chat was marked as closing/customer; it does not always contain a readable invoice in the exported data. Prices changed over time, so rows without invoice totals stay out of ERP.",
        "",
        "## Status Counts",
        "",
        "| Status | Count |",
        "|---|---:|",
    ]
    for status, count in sorted(status_counts.items()):
        lines.append(f"| `{status}` | {count} |")
    lines.extend(
        [
            "",
            "## Primary Label Counts",
            "",
            "| Primary label | Count |",
            "|---|---:|",
        ]
    )
    for status, count in sorted(primary_counts.items()):
        lines.append(f"| {status} | {count} |")

    lines.extend(
        [
            "",
            "## ERP-Ready Additional Rows",
            "",
            "| Customer | Status | Evidence | Action |",
            "|---|---|---|---|",
        ]
    )
    if ready_rows:
        for item in ready_rows:
            lines.append(
                f"| {item['display_name']} | `{item['mapping_status']}` | {item['evidence']} | {item['proposed_action']} |"
            )
    else:
        lines.append("| - | - | - | - |")

    lines.extend(
        [
            "",
            "## Remaining Rows To Review",
            "",
            "| Customer | Status | Evidence | Why not input yet |",
            "|---|---|---|---|",
        ]
    )
    for item in review_rows:
        if item["mapping_status"].startswith("ready_to_input"):
            continue
        lines.append(
            f"| {item['display_name'] or item['chat_id']} | `{item['mapping_status']}` | "
            f"{(item['evidence'] or item['erp_matches'] or '-')[:240]} | {item['reason']} |"
        )

    lines.extend(
        [
            "",
            "## Files",
            "",
            f"- `{OUT_CSV}`",
            f"- `{OUT_MD}`",
        ]
    )
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Wrote {OUT_CSV}")
    print(f"Wrote {OUT_MD}")
    print(dict(status_counts))


if __name__ == "__main__":
    main()
