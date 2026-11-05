"""Serve frozen variants with one shared, unmodified vendor archive."""
from pathlib import Path, PurePosixPath
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
import mimetypes
import zipfile
import sys

ROOT = Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        parts = PurePosixPath(unquote(urlsplit(self.path).path)).parts
        if ".." in parts:
            self.send_error(400)
            return
        if len(parts) >= 3 and parts[1] in ("source", "with", "without"):
            rel = "/".join(parts[2:])
            if not (ROOT / parts[1] / rel).is_file():
                with zipfile.ZipFile(ROOT / "runtime.zip") as z:
                    try:
                        data = z.read(rel)
                    except KeyError:
                        self.send_error(404)
                        return
                self.send_response(200)
                self.send_header("Content-Type", mimetypes.guess_type(rel)[0] or "application/octet-stream")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
        super().do_GET()
if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Open http://127.0.0.1:{port}/comparison.html", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
