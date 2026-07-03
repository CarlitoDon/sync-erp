#!/usr/bin/env python3
"""Reconcile Carla Telegram PDFs against current Santi Living ERP/order mapping.

The PDFs are generated from local Carla scripts. Reading the source arrays is
more reliable here than OCR/PDF text extraction, and it keeps the reconciliation
auditable without mutating Sync ERP.
"""

from __future__ import annotations

import ast
import csv
from collections import Counter
from pathlib import Path


BASE = Path("/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26")
CARLA = Path("/Users/wecik/.hermes/profiles/carla")

WHATSAPP_REPORT_SCRIPT = CARLA / "scripts/generate_whatsapp_report.py"
ORDER_REPORT_SCRIPT = CARLA / "scripts/generate_orders_pdf.py"
PDF_WHATSAPP = CARLA / "output/santi_living_whatsapp_leads_closings.pdf"
PDF_ORDER_REPORT = CARLA / "output/santi_living_orders_report.pdf"
PDF_TELEGRAM_ORDER_REPORT = Path("/Users/wecik/Downloads/Telegram Desktop/santi_living_orders_report.pdf")

CURRENT_ERP_LEDGER = BASE / "santi-living-rental-orders-final-after-fix-ledger-2026-05-27.csv"
CLOSING_LABEL_MAPPING = BASE / "santi-living-closing-label-full-mapping-2026-05-27.csv"

OUT_CSV = BASE / "carla-telegram-pdf-reconciliation-2026-05-27.csv"
OUT_MD = BASE / "carla-telegram-pdf-reconciliation-2026-05-27.md"


def literal_assignment(path: Path, name: str):
    module = ast.parse(path.read_text(errors="replace"))
    for node in module.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == name:
                    return ast.literal_eval(node.value)
    raise KeyError(f"{name} not found in {path}")


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def norm_name(name: str) -> str:
    return (
        name.lower()
        .replace("cust sl - ", "")
        .replace("cust sl ", "")
        .replace(".", "")
        .replace(",", "")
        .strip()
    )


def rp(value: int | str) -> str:
    n = int(value or 0)
    return "Rp" + f"{n:,}".replace(",", ".")


def main() -> None:
    leads = literal_assignment(WHATSAPP_REPORT_SCRIPT, "leads")
    pdf_closings = literal_assignment(WHATSAPP_REPORT_SCRIPT, "closings")
    pdf_orders = literal_assignment(ORDER_REPORT_SCRIPT, "orders_compact")
    erp_rows = read_csv(CURRENT_ERP_LEDGER)
    label_rows = read_csv(CLOSING_LABEL_MAPPING)

    erp_by_ref = {row["invoice_ref"]: row for row in erp_rows if row.get("invoice_ref")}
    erp_refs = set(erp_by_ref)
    pdf_refs = {row["note"] for row in pdf_closings if row.get("note", "").startswith("SL-INV-")}
    label_by_name = {norm_name(row.get("display_name", "")): row for row in label_rows if row.get("display_name")}

    rows: list[dict[str, str | int]] = []

    for closing in pdf_closings:
        invoice_ref = closing["note"] if closing["note"] != "-" else ""
        erp = erp_by_ref.get(invoice_ref)
        key = norm_name(closing["name"])
        label = label_by_name.get(key)
        if invoice_ref and erp:
            status = "already_in_sync_erp"
            action = "No new ERP input from this PDF row."
        elif not invoice_ref and label:
            status = "pdf_zero_total_label_known_needs_invoice_detail"
            action = "Open/export full customer chat; do not infer rental price."
        elif not invoice_ref:
            status = "pdf_zero_total_not_in_label_mapping_needs_chat_export"
            action = "Find/export full customer chat; PDF confirms customer name/date only."
        else:
            status = "pdf_invoice_not_in_current_erp"
            action = "Review invoice against current ERP before input."

        rows.append(
            {
                "source": "carla_whatsapp_leads_closings_pdf",
                "customer": closing["name"],
                "pdf_date": closing["date"],
                "invoice_ref": invoice_ref,
                "pdf_total_idr": closing["total"],
                "erp_order_number": erp.get("order_number", "") if erp else "",
                "erp_total_idr": erp.get("total_idr", "") if erp else "",
                "label_mapping_status": label.get("mapping_status", "") if label else "",
                "reconciliation_status": status,
                "evidence": str(PDF_WHATSAPP),
                "action": action,
            }
        )

    for ref in sorted(erp_refs - pdf_refs):
        erp = erp_by_ref[ref]
        rows.append(
            {
                "source": "current_sync_erp_ledger_after_bayu_fix",
                "customer": erp["partner_name"],
                "pdf_date": "",
                "invoice_ref": ref,
                "pdf_total_idr": "",
                "erp_order_number": erp["order_number"],
                "erp_total_idr": erp["total_idr"],
                "label_mapping_status": "",
                "reconciliation_status": "in_sync_erp_not_in_carla_pdf",
                "evidence": str(CURRENT_ERP_LEDGER),
                "action": "Keep in ERP; this was added after Carla's 26-order PDF snapshot.",
            }
        )

    for label in label_rows:
        status = label.get("mapping_status", "")
        if status.startswith("ready_to_input"):
            rows.append(
                {
                    "source": "native_sqlite_or_browser_note_mapping",
                    "customer": label["display_name"],
                    "pdf_date": "",
                    "invoice_ref": "",
                    "pdf_total_idr": "",
                    "erp_order_number": "",
                    "erp_total_idr": "",
                    "label_mapping_status": status,
                    "reconciliation_status": "ready_extra_not_in_carla_pdf_not_in_erp",
                    "evidence": label.get("evidence", ""),
                    "action": label.get("proposed_action", ""),
                }
            )

    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    status_counts = Counter(str(row["reconciliation_status"]) for row in rows)
    label_status_counts = Counter(row["mapping_status"] for row in label_rows)
    pdf_nominal = [row for row in pdf_closings if row["total"] > 0]
    pdf_zero = [row for row in pdf_closings if row["total"] == 0]
    erp_total = sum(int(row["total_idr"]) for row in erp_rows)
    pdf_total = sum(int(row["total"]) for row in pdf_closings)
    order_pdf_total = sum(int(row["totalAmount"]) for row in pdf_orders)

    zero_lines = "\n".join(
        f"| {row['name']} | {row['date']} | {row['note']} | {label_by_name.get(norm_name(row['name']), {}).get('mapping_status', 'not_in_label_mapping')} |"
        for row in pdf_zero
    )
    ready_lines = "\n".join(
        f"| {row['display_name']} | {row['mapping_status']} | {row.get('evidence', '')} | {row.get('reason', '')} |"
        for row in label_rows
        if row.get("mapping_status", "").startswith("ready_to_input")
    )
    status_lines = "\n".join(f"| `{k}` | {v} |" for k, v in sorted(status_counts.items()))
    label_status_lines = "\n".join(f"| `{k}` | {v} |" for k, v in sorted(label_status_counts.items()))

    OUT_MD.write_text(
        f"""# Carla Telegram PDF Reconciliation - 2026-05-27

## Result

- Carla WhatsApp PDF source checked: `{PDF_WHATSAPP}`
- Carla Telegram order PDF checked: `{PDF_TELEGRAM_ORDER_REPORT}`
- Carla local order PDF checked: `{PDF_ORDER_REPORT}`
- WhatsApp PDF total chat rows: {len(leads) + len(pdf_closings)}
- WhatsApp PDF leads/inquiry: {len(leads)}
- WhatsApp PDF closing/customer rows: {len(pdf_closings)}
- WhatsApp PDF closings with nominal: {len(pdf_nominal)}
- WhatsApp PDF zero-total closings: {len(pdf_zero)}
- WhatsApp PDF nominal total: {rp(pdf_total)}
- Carla order PDF Sync ERP snapshot: {len(pdf_orders)} orders, {rp(order_pdf_total)}
- Current Sync ERP ledger after Bayu fix: {len(erp_rows)} orders, {rp(erp_total)}
- WhatsApp Business closing/customer label rows from local DB: {len(label_rows)}

## Interpretation

Carla's Telegram PDF is useful, but it does not mean there are 50 rental orders ready for ERP. It combines leads and closings:

- 45 rows are leads/inquiries.
- 32 rows are closing/customer rows.
- Only 26 of those 32 have invoice refs and nominal totals in the PDF.
- The 6 remaining closing/customer rows have no invoice ref or total in the PDF, so they are evidence to investigate, not safe ERP input.

The current ERP has 27 orders because `SL-INV-031` Bayu was added after Carla's 26-order PDF snapshot. Separately, the deeper SQLite/browser-note mapping found 2 ERP-ready historical/additional rows not present in Carla's PDF: Fendy and Nisrina.

## Reconciliation Status Counts

| Status | Count |
|---|---:|
{status_lines}

## Label Mapping Status Counts

| Label mapping status | Count |
|---|---:|
{label_status_lines}

## Carla PDF Zero-Total Closings

| Customer | PDF date | PDF invoice ref | Existing label mapping status |
|---|---:|---|---|
{zero_lines}

## ERP-Ready Rows Found Outside Carla PDF

| Customer | Status | Evidence | Reason |
|---|---|---|---|
{ready_lines}

## Files

- `{OUT_CSV}`
- `{OUT_MD}`
""",
        encoding="utf-8",
    )

    print(f"wrote {OUT_CSV}")
    print(f"wrote {OUT_MD}")


if __name__ == "__main__":
    main()
