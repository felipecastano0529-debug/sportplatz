/* ==========================================================================
   UI · Vídeo de fondo

   El escenario de estadio, en movimiento.

   Vive FUERA de `#app`, y no es un capricho de organización: `renderApp`
   reasigna `innerHTML` de `#app` entero en cada navegación. Un `<video>` ahí
   dentro sería un nodo nuevo en cada clic del menú — vuelta a empezar, y
   vuelta a pedir el archivo.

   La foto fija de `.vb-photo` no se va a ninguna parte: es el póster. Se ve
   al instante, sostiene la vista mientras el vídeo llega, y se queda puesta
   para siempre en todos los casos en que el vídeo no debe correr.
   ========================================================================== */

import { conVersion } from '../core/sports.js';

const FUENTE = 'assets/fondos/estadio.mp4';

/* Cuánto dura la disolvencia de la costura del bucle, en segundos. */
const COSTURA = 0.6;

let video = null;

/* El clip es horizontal. En un viewport vertical, `cover` se queda con la
   franja central —alrededor del 22 % del ancho— y eso ya no es un estadio,
   es una mancha. Sumado a que son 5 MB por una conexión de datos, en móvil
   se queda la foto. */
const anchoSuficiente = matchMedia('(min-width: 48rem)');
const prefiereQuieto  = matchMedia('(prefers-reduced-motion: reduce)');
const ahorroDeDatos   = () => !!(navigator.connection && navigator.connection.saveData);

const debeCorrer = () =>
  anchoSuficiente.matches && !prefiereQuieto.matches && !ahorroDeDatos();

function montar() {
  const host = document.getElementById('vfondo');
  if (video || !host) return;

  video = document.createElement('video');
  video.muted = true;          // sin esto ningún navegador deja arrancar solo
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  video.src = conVersion(FUENTE);

  /* `playing` y no `canplay`: el fundido tiene que entrar cuando de verdad
     hay imagen moviéndose, no cuando el navegador calcula que podría haberla.
     Con `canplay` la foto se apartaba antes de tiempo y se veía el parpadeo. */
  video.addEventListener('playing',
    () => document.body.classList.add('vfondo-ok'), { once: true });

  // Respaldo para navegadores sin `requestVideoFrameCallback` (Firefox).
  if (!video.requestVideoFrameCallback) video.addEventListener('timeupdate', vigilarCostura);

  host.appendChild(video);
  vigilarCostura();

  // Si el navegador bloquea el arranque automático no se insiste: la foto fija
  // ya está puesta y es un fondo completo por sí sola.
  video.play().catch(desmontar);
}

/* El clip no cierra sobre sí mismo: la cámara se mueve durante los 25 s, y
   entre el último fotograma y el primero hay tanta diferencia como entre el
   principio y la mitad. Se buscó un par de puntos que enlazara limpio y el
   mejor de todo el clip apenas mejoraba el corte, así que no lo hay.

   La salida es disolver la costura, y el puente ya estaba puesto: la foto fija
   ES el fotograma 0. Se sube justo antes del final —tapando el vídeo, que
   queda debajo—, el vídeo vuelve a empezar por detrás, y cuando la foto se
   retira lo que aparece es la misma imagen que ella. Solo se cruza la ida; la
   vuelta es exacta. Y las dos están igualadas en luminancia, así que no hay
   escalón de brillo, solo un cambio de plano. */
function vigilarCostura() {
  if (!video) return;
  const quedan = video.duration - video.currentTime;
  document.body.classList.toggle('vfondo-costura',
    quedan >= 0 && quedan < COSTURA);
  // Por fotograma cuando se puede: `timeupdate` llega cada ~250 ms y la
  // ventana entera son 600, así que a veces la disolvencia empezaría tarde y
  // no le daría tiempo a llegar.
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(vigilarCostura);
}

function desmontar() {
  document.body.classList.remove('vfondo-ok', 'vfondo-costura');
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.load();                // suelta el búfer; sin esto se queda en memoria
  video.remove();
  video = null;
}

export function initVideoFondo() {
  const decidir = () => (debeCorrer() ? montar() : desmontar());
  anchoSuficiente.addEventListener('change', decidir);
  prefiereQuieto.addEventListener('change', decidir);
  decidir();
}

/**
 * Canchas tiene su propio fondo y tapa el vídeo entero. Decodificar 25 s de
 * 720p para que no lo vea nadie es gastar batería a cambio de nada.
 */
export function videoFondoVisible(visible) {
  if (!video) return;
  if (visible) video.play().catch(() => {});
  else video.pause();
}
