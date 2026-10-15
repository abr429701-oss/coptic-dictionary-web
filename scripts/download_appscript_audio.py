#!/usr/bin/env python3
"""Download only the public audio files referenced by the Apps Script dictionary tab."""
from __future__ import annotations

import csv
import concurrent.futures
import io
import os
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHEET_ID = os.environ.get("APP_SCRIPT_SHEET_ID", "17n8MgiCIe4xVRXqM7W74zCSeqwo6pX8L-Pj2wSsl0ek")
CSV_FILE = os.environ.get("APP_SCRIPT_CSV_FILE", "")
OUT = ROOT / "audio-appscript"


def get_csv() -> str:
    if CSV_FILE:
        return Path(CSV_FILE).read_text(encoding="utf-8-sig")
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv"
    request = urllib.request.Request(url, headers={"User-Agent": "coptic-dictionary-audio-sync/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8-sig")


def audio_id(link: str) -> str:
    match = re.search(r"/d/([A-Za-z0-9_-]+)", link) or re.search(r"[?&]id=([A-Za-z0-9_-]+)", link)
    return match.group(1) if match else ""


def download(item: tuple[str, str]) -> tuple[bool, int]:
    fid, link = item
    OUT.mkdir(parents=True, exist_ok=True)
    for ext in ("ogg", "mp3", "wav", "m4a"):
        existing = OUT / f"{fid}.{ext}"
        if existing.is_file() and existing.stat().st_size > 100:
            return True, 0
    url = f"https://drive.google.com/uc?export=download&id={fid}"
    error = None
    for attempt in range(2):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=40) as response:
                data = response.read()
            if len(data) < 100 or data.lstrip().startswith((b"<!DOCTYPE", b"<html")):
                raise ValueError("Drive returned an HTML/empty response")
            if data.startswith(b"OggS"):
                ext = "ogg"
            elif data.startswith(b"ID3") or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
                ext = "mp3"
            elif data.startswith(b"RIFF"):
                ext = "wav"
            else:
                ext = "mp3" if "mp3" in link.lower() else "ogg"
            (OUT / f"{fid}.{ext}").write_bytes(data)
            return True, len(data)
        except Exception as exc:  # noqa: BLE001
            error = exc
            if attempt == 0:
                time.sleep(1)
    return False, 0


def main() -> None:
    try:
        rows = list(csv.reader(io.StringIO(get_csv())))
    except Exception as exc:  # noqa: BLE001
        print(f"Could not refresh reference audio list; keeping existing local files: {exc}")
        return
    items = []
    seen = set()
    for row in rows[2:]:
        link = row[1].strip() if len(row) > 1 else ""
        fid = audio_id(link)
        if fid and fid not in seen:
            items.append((fid, link))
            seen.add(fid)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(download, items))
    ok = sum(success for success, _ in results)
    total_bytes = sum(size for _, size in results)
    print(f"Apps Script audio assets: {ok}/{len(items)} available; downloaded {total_bytes / 1e6:.2f} MB this run.")


if __name__ == "__main__":
    main()
