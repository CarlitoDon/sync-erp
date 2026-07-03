#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import tempfile
import time
from pathlib import Path


BASE = Path(__file__).resolve().parent
VISIBLE_ROWS_JSON = BASE / "browser-visible-rows-export.json"
OUT_DIR = BASE / "visible-chat-texts"
MANIFEST_CSV = BASE / "browser-visible-chat-extraction-manifest.csv"
PID = 28231
WINDOW_ID = 10997


def run(args: list[str], timeout: int = 20) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, timeout=timeout, check=False)


def target_from_row(text: str) -> str:
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.fullmatch(r"\d+\s+unread messages?", line, re.I):
            continue
        if re.fullmatch(r"\d+", line):
            continue
        if line.startswith("Cust SL") or line.startswith("+62"):
            return line
    return text.splitlines()[0].strip() if text.splitlines() else ""


def slugify(value: str, fallback: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:80] or fallback


def get_ax_index(query: str) -> tuple[int | None, str]:
    args = {
        "pid": PID,
        "window_id": WINDOW_ID,
        "query": query,
        "screenshot_out_file": str(BASE / "tmp-ax-query.png"),
    }
    proc = run(["cua-driver", "get_window_state", json.dumps(args)], timeout=30)
    if proc.returncode != 0:
        return None, proc.stderr.strip() or proc.stdout.strip()
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        return None, f"json_decode_failed: {exc}: {proc.stdout[:500]}"
    tree = payload.get("tree_markdown") or ""
    matches = re.findall(r"\[(\d+)\]\s+AXRow", tree)
    if not matches:
        return None, tree[:1000]
    return int(matches[0]), tree[:1000]


def open_row(element_index: int) -> str:
    args = {"pid": PID, "window_id": WINDOW_ID, "element_index": element_index}
    proc = run(["cua-driver", "double_click", json.dumps(args)], timeout=20)
    return (proc.stdout + proc.stderr).strip()


def execute_chrome_js(js: str) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(js)
        js_path = f.name
    try:
        proc = run(
            [
                "osascript",
                "-e",
                f'set jsSource to read POSIX file "{js_path}"',
                "-e",
                'tell application "Google Chrome" to execute active tab of first window javascript jsSource',
            ],
            timeout=20,
        )
    finally:
        Path(js_path).unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip())
    return proc.stdout


def set_chat_list_scroll(row_index: int | str | None) -> None:
    try:
        idx = int(row_index or 0)
    except (TypeError, ValueError):
        idx = 0
    # WhatsApp's visible chat rows are roughly 76 px high. Place the target
    # around the middle/lower part of the sidebar so CUA's stamped click lands
    # inside the real window bounds.
    scroll_top = max(0, idx * 76 - 380)
    js = f"""
(() => {{
  const scrollables = Array.from(document.querySelectorAll('div'))
    .filter(e => e.scrollHeight > e.clientHeight + 50)
    .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
  const list = scrollables.find(e => (e.innerText || '').includes('Archived')) || scrollables[0];
  if (!list) return JSON.stringify({{ok:false, reason:'no_scrollable'}});
  list.scrollTop = {scroll_top};
  list.dispatchEvent(new Event('scroll', {{bubbles:true}}));
  return JSON.stringify({{ok:true, scrollTop:list.scrollTop}});
}})()
""".strip()
    execute_chrome_js(js)
    time.sleep(0.25)


def read_current_chat() -> dict[str, str]:
    js = """
JSON.stringify({
  title: document.title,
  url: location.href,
  mainText: document.getElementById('main')?.innerText || '',
  bodyStart: document.body.innerText.slice(0, 1000)
}, null, 2)
""".strip()
    try:
        stdout = execute_chrome_js(js)
    except RuntimeError as exc:
        return {"title": "", "url": "", "mainText": "", "bodyStart": str(exc)}
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return {"title": "", "url": "", "mainText": stdout, "bodyStart": ""}


def candidate_rows(limit: int | None = None) -> list[dict]:
    payload = json.loads(VISIBLE_ROWS_JSON.read_text())
    rows = []
    for row in payload.get("rows", []):
        text = row.get("text") or ""
        target = target_from_row(text)
        if not target:
            continue
        if not (target.startswith("Cust SL") or target.startswith("+62")):
            continue
        if "Admin " in target or "Santi Living" == target:
            continue
        row["target"] = target
        rows.append(row)
    return rows[:limit] if limit else rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--sleep", type=float, default=1.2)
    parser.add_argument("--skip-existing", action="store_true")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = candidate_rows(args.limit)
    manifest = []
    for n, row in enumerate(rows, 1):
        target = row["target"]
        slug = slugify(target, f"row-{row.get('index', n)}")
        out_path = OUT_DIR / f"{row.get('index', n):03d}-{slug}.txt"
        if args.skip_existing and out_path.exists():
            status = "skipped_existing"
            current = {"mainText": out_path.read_text(errors="replace"), "title": "", "url": ""}
            detail = ""
        else:
            set_chat_list_scroll(row.get("index"))
            ax_index, detail = get_ax_index(target)
            if ax_index is None:
                status = "ax_row_not_found"
                current = {"mainText": "", "title": "", "url": ""}
            else:
                open_detail = open_row(ax_index)
                time.sleep(args.sleep)
                current = read_current_chat()
                text = current.get("mainText") or ""
                out_path.write_text(text, encoding="utf-8")
                first_line = text.splitlines()[0] if text.splitlines() else ""
                normalized_target = target.lower().replace(" ", "")
                normalized_header = first_line.lower().replace(" ", "")
                status = "opened" if normalized_target[:12] in normalized_header else "invalid_header_mismatch"
                detail = f"ax_index={ax_index}; {open_detail[:240]}"
        text = current.get("mainText") or ""
        manifest.append(
            {
                "row_index": row.get("index"),
                "target": target,
                "source_row_text": row.get("text", ""),
                "output_file": str(out_path.relative_to(BASE)),
                "status": status,
                "chat_header": text.splitlines()[0] if text.splitlines() else "",
                "char_count": len(text),
                "has_invoice": "INVOICE PEMESANAN" in text,
                "has_total_pembayaran": "Total Pembayaran" in text,
                "detail": detail,
            }
        )
        print(f"[{n}/{len(rows)}] {status}: {target} chars={len(text)} invoice={'INVOICE PEMESANAN' in text}", flush=True)

    with MANIFEST_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "row_index",
                "target",
                "source_row_text",
                "output_file",
                "status",
                "chat_header",
                "char_count",
                "has_invoice",
                "has_total_pembayaran",
                "detail",
            ],
        )
        writer.writeheader()
        writer.writerows(manifest)
    print(f"manifest={MANIFEST_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
