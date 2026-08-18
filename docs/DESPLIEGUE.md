# Despliegue

Sitio estático puro: sin build, sin dependencias, sin funciones. Vercel sirve la
carpeta tal cual.

```bash
vercel deploy --prod
```

## Por qué `vercel.json` fuerza revalidación

`vercel.json` no admite comentarios, así que el porqué vive aquí.

**HTML, JS y CSS van con `no-cache, must-revalidate`.** El proyecto no tiene
build ni hash en los nombres de archivo: `app/main.js` se llama igual antes y
después de cada despliegue. Con la caché por defecto, un visitante que ya entró
seguiría ejecutando el JS viejo contra el CSS nuevo, o al revés.

`no-cache` **no** significa "no guardar": el navegador guarda la copia y
pregunta al servidor si cambió. Si no cambió responde `304 Not Modified` y no se
vuelve a descargar. Se paga una petición, no el archivo.

**`assets/` va con un día de caché.** Las fotos pesan y cambian poco. Si
reemplazas una conservando el nombre, tarda hasta 24 h en propagarse a quien ya
la vio; para forzarlo antes, cámbiale el nombre.

## Cabeceras de seguridad

`nosniff`, `Referrer-Policy`, `X-Frame-Options` y una `Permissions-Policy` que
apaga cámara, micrófono, ubicación y pagos. La app no usa ninguna de esas cuatro
cosas, así que negarlas es gratis y cierra la puerta si algún día se inyecta algo.

## Qué NO está desplegado

No hay backend. Todo el estado vive en el IndexedDB del visitante: cada persona
que abra el link configura su propio complejo y no ve el de nadie más. Eso es lo
correcto para un demo, y es exactamente lo que habría que cambiar para un
producto real.
