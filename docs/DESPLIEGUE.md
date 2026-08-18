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

**`assets/` también va con `no-cache`, y no con un día de caché como estuvo al
principio.** Ese día de caché costó un rato de depuración: se reemplazó la foto
de tenis conservando el nombre y el navegador siguió sirviendo la vieja durante
horas, sin ni siquiera preguntar al servidor. Con `must-revalidate` no basta —
dentro de la ventana de `max-age` el navegador ni pregunta.

Como las fotos se reemplazan a mano y conservan el nombre, la única opción
honesta sin build es revalidar siempre: se paga una petición condicional por
imagen, no los bytes. El día que haya build con nombres con hash, esto puede
volver a cachearse para siempre.

## Cabeceras de seguridad

`nosniff`, `Referrer-Policy`, `X-Frame-Options` y una `Permissions-Policy` que
apaga cámara, micrófono, ubicación y pagos. La app no usa ninguna de esas cuatro
cosas, así que negarlas es gratis y cierra la puerta si algún día se inyecta algo.

## Qué NO está desplegado

No hay backend. Todo el estado vive en el IndexedDB del visitante: cada persona
que abra el link configura su propio complejo y no ve el de nadie más. Eso es lo
correcto para un demo, y es exactamente lo que habría que cambiar para un
producto real.

## Al reemplazar una imagen: sube `ASSET_V`

En `app/core/sports.js` hay una constante:

```js
export const ASSET_V = '3';
```

Se anexa como `?v=N` a las fotos del proyecto. **Súbela cada vez que reemplaces
una imagen conservando el nombre.**

Sin build no hay nombres con hash, así que esto hace de hash a mano. Sin ello,
un navegador que ya tenga la URL cacheada sigue mostrando la vieja — y, peor, si
guardó un **404** de cuando el archivo aún no existía, se queda mostrando el
respaldo dibujado para siempre. Pasó de verdad con la foto de tenis: cambiar la
cabecera de caché no rescata a quien ya está envenenado, porque la cabecera
nueva solo se aplica a respuestas nuevas. Lo único que lo cura es cambiar la URL.

Los fondos de estadio llevan su `?v=` escrito a mano en `themes/momentum.css`,
porque salen de CSS y no de JavaScript. Súbelos a la vez.
