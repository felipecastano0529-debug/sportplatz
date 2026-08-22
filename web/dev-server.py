#!/usr/bin/env python3
"""Servidor local de la web pública. Sin build: solo sirve archivos.
   python3 web/dev-server.py  →  http://localhost:5180"""
import http.server, os, socketserver, sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 5180

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PUERTO), H) as s:
    print(f"http://localhost:{PUERTO}", flush=True)
    s.serve_forever()
