#!/usr/bin/env python3
"""Enrich the local dictionary with the public dictionary tab from the Apps Script source.

Only the dictionary CSV export is fetched. The notification tab is read separately by
browser code using column B only; the IP tab and all other user-related columns are never read.
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from sheet_to_json import assign_ids, clean_coptic, load_registry, save_registry, word_key  # noqa: E402

SOURCE_ID = os.environ.get("APP_SCRIPT_SHEET_ID", "17n8MgiCIe4xVRXqM7W74zCSeqwo6pX8L-Pj2wSsl0ek")
SOURCE_CSV_FILE = os.environ.get("APP_SCRIPT_CSV_FILE", "")
OUT = Path(os.environ.get("OUT_JSON", ROOT / "data" / "dictionary.json"))
IDS_FILE = Path(os.environ.get("WORD_IDS_JSON", ROOT / "data" / "word_ids.json"))


def normalize_key(text: str) -> str:
    # Coptic jinkim/combining marks vary between the two source spreadsheets.
    key = word_key(clean_coptic(text))
    return re.sub(r"[\u0300-\u036f]", "", key).replace("`", "")


def download_source() -> str:
    if SOURCE_CSV_FILE:
        return Path(SOURCE_CSV_FILE).read_text(encoding="utf-8-sig")
    url = f"https://docs.google.com/spreadsheets/d/{SOURCE_ID}/export?format=csv"
    error = None
    for attempt in range(1, 4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "coptic-dictionary-enrichment/1.0"})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read().decode("utf-8-sig")
        except Exception as exc:  # noqa: BLE001
            error = exc
            print(f"Apps Script dictionary download attempt {attempt} failed: {exc}", file=sys.stderr)
            time.sleep(attempt * 3)
    raise RuntimeError(f"Could not download the public Apps Script dictionary: {error}")


def cell(row: list[str], index: int) -> str:
    return row[index].strip() if index < len(row) else ""


def audio_download_url(link: str) -> str:
    match = re.search(r"/d/([A-Za-z0-9_-]+)", link) or re.search(r"[?&]id=([A-Za-z0-9_-]+)", link)
    if not match:
        return ""
    file_id = match.group(1)
    for extension in ("ogg", "mp3", "wav", "m4a"):
        relative_path = f"audio-appscript/{file_id}.{extension}"
        if (ROOT / relative_path).is_file():
            return relative_path
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def main() -> None:
    records = json.loads(OUT.read_text(encoding="utf-8"))
    try:
        rows = list(csv.reader(io.StringIO(download_source())))
    except Exception as exc:  # noqa: BLE001
        print(f"Could not refresh Apps Script dictionary enrichment; keeping existing data: {exc}", file=sys.stderr)
        return
    header = ",".join(rows[0]).lower() if rows else ""
    if not rows or not ("قبط" in header or "coptic" in header):
        raise SystemExit("Unexpected Apps Script dictionary CSV; refusing to change dictionary.json.")

    reference: dict[str, list[dict]] = {}
    for row in rows[2:]:  # first row is headers, second is blank
        coptic = clean_coptic(cell(row, 3))
        meaning = cell(row, 2)
        if not coptic or not meaning:
            continue
        audio_link = cell(row, 1)
        match = {
            "coptic": coptic,
            "meaning": meaning,
            "english": cell(row, 4),
            "kind": cell(row, 5),
            "origin": cell(row, 6),
            "translation_fr": cell(row, 7),
            "translation_de": cell(row, 8),
            "audioUrl": audio_download_url(audio_link),
            "audioFilename": cell(row, 0),
        }
        reference.setdefault(normalize_key(coptic), []).append(match)

    current: dict[str, list[dict]] = {}
    for record in records:
        key = normalize_key(record.get("coptic", ""))
        if key:
            current.setdefault(key, []).append(record)

    matched_spellings = 0
    appended_rows = 0
    for key, matches in reference.items():
        if key in current:
            matched_spellings += 1
            for record in current[key]:
                record["referenceMatches"] = matches
            continue
        # Keep distinct source rows (meanings/audio) for spellings absent from the main corpus.
        for match in matches:
            record = {
                "coptic": match["coptic"],
                "greek": "",
                "pronunciation": "",
                "english": match["english"],
                "phonetic": "",
                "kind": match["kind"],
                "gender": "",
                "origin": match["origin"],
                "translation_en": match["english"],
                "translation_fr": match["translation_fr"],
                "translation_de": match["translation_de"],
                "meaning": match["meaning"],
                "referenceMatches": [match],
            }
            records.append(record)
            appended_rows += 1

    registry = load_registry(IDS_FILE)
    issued = assign_ids(records, registry)
    save_registry(registry, IDS_FILE)
    OUT.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Enriched {matched_spellings} Coptic spellings with Apps Script fields/audio; added {appended_rows} unmatched rows; issued {issued} stable ids; total {len(records)}.")


if __name__ == "__main__":
    main()
