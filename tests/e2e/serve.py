"""Static server that mimics GitHub Pages project hosting: <root> is served under /pdd-georgia/."""
import functools, http.server, threading
from pathlib import Path

BASE = "/pdd-georgia/"


class _Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if not path.startswith(BASE):
            return "/nonexistent"
        return super().translate_path("/" + path[len(BASE):])

    def send_error(self, code, message=None, explain=None):
        """Like Pages: a missing file answers 404 with the site's own 404.html when there is one."""
        page = Path(self.directory) / "404.html"
        if code != 404 or not page.exists():
            return super().send_error(code, message, explain)
        body = page.read_bytes()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def log_message(self, *a):
        pass


class _Server(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        pass  # the browser aborting a media download is not an error


def serve(root):
    """Starts a server for `root` in a thread; returns (base_url, shutdown)."""
    h = functools.partial(_Handler, directory=str(root))
    srv = _Server(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_address[1]}{BASE}", srv.shutdown
