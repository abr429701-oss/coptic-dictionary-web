#!/usr/bin/env python3
"""Local live preview: rebuilds _site on source changes and reloads open browsers."""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8765"))
_state_lock = threading.Lock()
_build_id = "boot"


def snapshot() -> dict[str, tuple[int, int]]:
    result = {}
    excluded = {".git", "_site", "node_modules", "__pycache__"}
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in excluded]
        for name in files:
            path = Path(base) / name
            try:
                stat = path.stat()
                result[str(path.relative_to(ROOT))] = (stat.st_mtime_ns, stat.st_size)
            except OSError:
                pass
    return result


def build() -> None:
    global _build_id
    subprocess.run(["node", "scripts/build-site.mjs", "data/dictionary.json", "_site"], cwd=ROOT, check=True)
    digest = hashlib.sha1(json.dumps(snapshot(), sort_keys=True).encode()).hexdigest()[:12]
    with _state_lock:
        _build_id = digest
    print(f"Live preview built: {digest}", flush=True)


def watch() -> None:
    previous = snapshot()
    while True:
        time.sleep(0.8)
        current = snapshot()
        if current != previous:
            # Briefly coalesce editor writes/saves before building.
            time.sleep(0.25)
            current = snapshot()
            try:
                build()
                previous = current
            except Exception as exc:  # noqa: BLE001
                print(f"Live rebuild failed; previous preview remains available: {exc}", flush=True)
                previous = current


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(OUT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/__dev_version":
            with _state_lock:
                body = _build_id.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path in ("/", "/index.html") and (OUT / "index.html").is_file():
            body = (OUT / "index.html").read_text(encoding="utf-8")
            live = '''<script>window.__DEV_LIVE__=true;(()=>{let v="";setInterval(async()=>{try{const r=await fetch("/__dev_version",{cache:"no-store"});const n=await r.text();if(v&&n!==v){location.reload()}v=n}catch(e){}},700)})();</script>'''
            body = body.replace("</head>", live + "</head>")
            data = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        return super().do_GET()

    def log_message(self, fmt, *args):
        print("[preview] " + (fmt % args), flush=True)


def main() -> None:
    build()
    threading.Thread(target=watch, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Live preview listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
