/* ==========================================================================
   UI · Movimiento
   Toda animación arranca del valor actual en pantalla y es interrumpible.
   Con prefers-reduced-motion se degrada a un cross-fade corto: se conserva
   el cambio de opacidad, que ayuda a entender, y se quita el desplazamiento.
   ========================================================================== */

import { money } from '../core/util.js';

export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* `snap` insinúa inercia, no rebota. Estaba en 1.4 —un 40 % de sobreimpulso—
   y a esa altura el movimiento se lee a juguete, no a material. DESIGN.md ya
   lo acotaba a "solo tras un gesto con inercia"; 1.12 es la misma curva que
   `--ease-pop`, así que CSS y JS por fin se mueven igual. */
export const SPRING = {
  soft: 'cubic-bezier(.22,1,.36,1)',
  snap: 'cubic-bezier(.34,1.12,.48,1)'
};

/* `fill: 'both'` es necesario mientras la animación corre —sin él el elemento
   parpadea en su estado final antes de empezar— pero al terminar hay que
   soltarlo: un `transform` retenido, aunque sea la identidad, convierte al
   elemento en el contenedor de bloque de todo `position: fixed` que tenga
   dentro. La barra de navegación del celular se anclaba al `.shell` y
   terminaba a 2.400 px del viewport en vez de pegada abajo. */
function soltarAlTerminar(anim) {
  /* Cancelar, no fijar. Nada en el CSS oculta lo que entra —el estado de
     reposo de una tarjeta ya es visible—, así que soltar la animación la
     devuelve exactamente a donde tiene que estar. `commitStyles` haría lo
     contrario de lo que se busca: escribe `translate3d(0,0,0)` inline, y un
     transform inline, aunque sea la identidad, vuelve a crear el contenedor
     de bloque que rompía la barra fija del celular. */
  anim?.finished.then(() => anim.cancel()).catch(() => {});
}

export function enter(node, { y = 10, delay = 0, dur = 420, bounce = false } = {}) {
  if (!node) return;
  if (REDUCED) {
    soltarAlTerminar(node.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 160, fill: 'both', delay }));
    return;
  }
  soltarAlTerminar(node.animate(
    [{ opacity: 0, transform: `translate3d(0,${y}px,0)` }, { opacity: 1, transform: 'none' }],
    { duration: dur, delay, easing: bounce ? SPRING.snap : SPRING.soft, fill: 'both' }
  ));
}

/* 38–55 ms entre elementos. Más lento se siente lento, no elegante. */
export function stagger(nodes, opts = {}) {
  nodes.forEach((n, i) => enter(n, { ...opts, delay: (opts.delay || 0) + i * (opts.step ?? 45) }));
}

/* Luz especular que sigue al puntero sobre las superficies. Un solo listener
   delegado —sobrevive a cada re-render— y estrangulado a un frame, porque
   escribir una variable CSS recalcula estilo en todo el subárbol. */
export function initSpotlight() {
  if (REDUCED || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const SEL = '.card, .stat, .court, .tn-card, .sport-card, .day, .pod, .team-card, .pl-card';
  let queued = false, last = null;
  document.addEventListener('pointermove', (e) => {
    const el = e.target instanceof Element ? e.target.closest(SEL) : null;
    if (!el) return;
    last = { el, x: e.clientX, y: e.clientY };
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!last) return;
      const r = last.el.getBoundingClientRect();
      last.el.style.setProperty('--mx', ((last.x - r.left) / r.width * 100).toFixed(1) + '%');
      last.el.style.setProperty('--my', ((last.y - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }, { passive: true });
}

/* Conteo animado para las métricas del panel. */
export function countUp(node, to, format = money) {
  if (REDUCED) { node.textContent = format(to); return; }
  const t0 = performance.now(), dur = 900;
  const tick = (t) => {
    if (!node.isConnected) return;   // la vista cambió a mitad del conteo
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 4);
    node.textContent = format(to * e);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
