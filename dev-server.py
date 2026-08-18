#!/usr/bin/env python3
"""Servidor de desarrollo sin caché.

`python3 -m http.server` cachea con Last-Modified y el navegador se queda con
el JS viejo después de cada edición. Este manda no-store y siempre sirve lo
que hay en disco.

    python3 dev-server.py     → http://localhost:5173
"""
import http.server, os

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print('Sportplatz → http://localhost:5173')
http.server.HTTPServer(('127.0.0.1', 5173), NoCache).serve_forever()
