#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
from pathlib import Path


BASE = Path(__file__).resolve().parent
CHAT_DIR = BASE / "visible-chat-texts"
OUT_CSV = BASE / "visible-chat-invoice-candidates.csv"


def compact(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    return text.strip()


def one_line(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\u00a0", " ")).strip()


def rupiah_to_int(value: str) -> int | None:
    if not value:
        return None
    digits = re.sub(r"[^0-9]", "", value)
    return int(digits) if digits else None


def field(block: str, name: str, next_names: list[str]) -> str:
    next_pat = "|".join(re.escape(n) for n in next_names)
    pat = rf"{re.escape(name)}\s*:?\s*(.*?)(?=\s+(?:{next_pat})\s*:|\s+Detail Pesanan|\s+Ongkir\s*:|\s+Subtotal|\s+Total Pembayaran|\s+DP 30%|\s+Sisa Pelunasan|\s+Catatan|\s*$)"
    m = re.search(pat, block, re.I)
    return m.group(1).strip(" :-") if m else ""


def amount_field(block: str, label: str) -> tuple[str, int | None]:
    m = re.search(rf"{re.escape(label)}\s*:?\s*(Rp\s*[0-9][0-9.\-, ]*)", block, re.I)
    raw = m.group(1).strip() if m else ""
    return raw, rupiah_to_int(raw)


def invoice_blocks(text: str) -> list[str]:
    marker = "INVOICE PEMESANAN"
    blocks = []
    starts = [m.start() for m in re.finditer(marker, text, re.I)]
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(text)
        chunk = text[start:end]
        thank = re.search(r"Terima kasih sudah mempercayakan Santi Living", chunk, re.I)
        if thank:
            chunk = chunk[: thank.end()]
        blocks.append(one_line(chunk))
    return blocks


def extract_items(block: str) -> str:
    m = re.search(r"Detail Pesanan(?:\s*\([^)]*\))?\s*(.*?)(?=\s+Subtotal Sewa\s*:|\s+Ongkir\s*:|\s+Total Pembayaran\s*:|\s+DP 30%|\s+Catatan|\s*$)", block, re.I)
    if not m:
        return ""
    items = m.group(1).strip()
    items = re.sub(r"\s*•\s*", " | ", items).strip(" |")
    return items


def main() -> int:
    rows = []
    for path in sorted(CHAT_DIR.glob("*.txt")):
        text = compact(path.read_text(errors="replace"))
        if "INVOICE PEMESANAN" not in text:
            continue
        header = text.splitlines()[0] if text.splitlines() else ""
        for idx, block in enumerate(invoice_blocks(text), 1):
            total_raw, total = amount_field(block, "Total Pembayaran")
            dp_raw, dp = amount_field(block, "DP 30%")
            if not dp_raw:
                dp_raw, dp = amount_field(block, "DP")
            sisa_raw, sisa = amount_field(block, "Sisa Pelunasan")
            rows.append(
                {
                    "source_file": str(path.relative_to(BASE)),
                    "chat_header": header,
                    "invoice_occurrence": idx,
                    "is_revision": "REVISI" in block.upper(),
                    "nama": field(block, "Nama", ["Lokasi", "Tanggal Kirim", "Tanggal Kembali", "Tanggal Ambil", "Durasi Sewa"]),
                    "lokasi": field(block, "Lokasi", ["Tanggal Kirim", "Tanggal Kembali", "Tanggal Ambil", "Durasi Sewa"]),
                    "tanggal_kirim": field(block, "Tanggal Kirim", ["Tanggal Kembali", "Tanggal Ambil", "Durasi Sewa"]),
                    "tanggal_ambil": field(block, "Tanggal Ambil", ["Tanggal Kembali", "Durasi Sewa"]),
                    "tanggal_kembali": field(block, "Tanggal Kembali", ["Tanggal Ambil", "Durasi Sewa"]),
                    "durasi": field(block, "Durasi Sewa", ["Detail Pesanan", "Ongkir", "Subtotal Sewa", "Total Pembayaran"]),
                    "items": extract_items(block),
                    "ongkir_raw": field(block, "Ongkir", ["Subtotal Sewa", "Total Pembayaran", "DP 30%", "Sisa Pelunasan", "Catatan"]),
                    "total_raw": total_raw,
                    "total_idr": total if total is not None else "",
                    "dp_raw": dp_raw,
                    "dp_idr": dp if dp is not None else "",
                    "sisa_raw": sisa_raw,
                    "sisa_idr": sisa if sisa is not None else "",
                    "block_excerpt": block[:1400],
                }
            )
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["source_file"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"invoice_rows={len(rows)}")
    print(f"out={OUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
