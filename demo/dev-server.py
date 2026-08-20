#!/usr/bin/env python3
"""Servidor de desarrollo sin caché y con soporte de rangos.

`python3 -m http.server` cachea con Last-Modified y el navegador se queda con
el JS viejo después de cada edición. Este manda no-store y siempre sirve lo
que hay en disco.

Además atiende peticiones `Range`, que el módulo estándar ignora: contesta
200 con el archivo entero y el navegador lo da por bueno. Para el JS y el CSS
da igual, pero un `<video>` sin rangos no puede saltar en el tiempo —
`currentTime` simplemente no se mueve— y en producción sí puede, porque
Vercel los atiende. Es la clase de diferencia que hace que algo funcione al
desplegar y no en local, o al revés.

    python3 dev-server.py     → http://localhost:5173
"""
import http.server, os, re

RANGO = re.compile(r'bytes=(\d*)-(\d*)')


class Dev(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def send_head(self):
        cabecera = self.headers.get('Range')
        if not cabecera:
            return super().send_head()

        m = RANGO.match(cabecera.strip())
        if not m:
            return super().send_head()

        ruta = self.translate_path(self.path)
        if os.path.isdir(ruta) or not os.path.isfile(ruta):
            return super().send_head()

        total = os.path.getsize(ruta)
        ini, fin = m.group(1), m.group(2)
        if ini == '':
            # `bytes=-500` son los ÚLTIMOS 500, no los primeros.
            largo = min(int(fin or 0), total)
            ini, fin = total - largo, total - 1
        else:
            ini = int(ini)
            fin = int(fin) if fin else total - 1
            fin = min(fin, total - 1)

        if ini > fin or ini >= total:
            self.send_response(416)
            self.send_header('Content-Range', 'bytes */%d' % total)
            self.end_headers()
            return None

        f = open(ruta, 'rb')
        f.seek(ini)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(ruta))
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (ini, fin, total))
        self.send_header('Content-Length', str(fin - ini + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        # copyfile() lee hasta EOF, así que el trozo se limita aquí.
        self.wfile.write(f.read(fin - ini + 1))
        f.close()
        return None


os.chdir(os.path.dirname(os.path.abspath(__file__)))
print('Sportplatz → http://localhost:5173')
http.server.HTTPServer(('127.0.0.1', 5173), Dev).serve_forever()
