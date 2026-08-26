'use client';

import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/util';

/* ==========================================================================
   UI · Movimiento

   Portado de `demo/app/ui/motion.js`. Las curvas y las duraciones son las
   mismas de `DESIGN.md §10.5`: nunca `ease-in` en UI, solo `transform` y
   `opacity`, y todo se apaga con `prefers-reduced-motion` en el mismo sitio
   donde se enciende.
   ========================================================================== */

/* `snap` insinúa inercia, no rebota: es la misma curva que `--ease-pop`, así
   que CSS y JS se mueven igual. */
export const SPRING = {
  soft: 'cubic-bezier(.22,1,.36,1)',
  snap: 'cubic-bezier(.34,1.12,.48,1)'
};

export function usaMovimientoReducido() {
  const [reducido, setReducido] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducido(mq.matches);
    const f = () => setReducido(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return reducido;
}

/**
 * Entrada escalonada de una lista. 38–55 ms entre elementos: más lento se
 * siente lento, no elegante.
 *
 * `fill: 'both'` hace falta mientras corre, pero al terminar se SUELTA. Un
 * `transform` retenido, aunque sea la identidad, convierte al elemento en el
 * contenedor de bloque de todo `position: fixed` que tenga dentro — y la
 * barra de navegación del celular terminaba a 2.400 px del viewport en vez
 * de pegada abajo.
 */
export function Entra({
  children,
  y = 16,
  step = 55,
  delay = 0,
  className
}: {
  children: React.ReactNode;
  y?: number;
  step?: number;
  delay?: number;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodos = host.current?.querySelectorAll<HTMLElement>('[data-anim]');
    if (!nodos?.length) return;

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anims: Animation[] = [];

    nodos.forEach((n, i) => {
      const opciones: KeyframeAnimationOptions = {
        duration: reducido ? 160 : 420,
        delay: delay + i * (reducido ? 0 : step),
        easing: SPRING.soft,
        fill: 'both'
      };
      const cuadros = reducido
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: `translate3d(0,${y}px,0)` }, { opacity: 1, transform: 'none' }];

      const a = n.animate(cuadros, opciones);
      anims.push(a);
      // Cancelar, no fijar: nada en el CSS oculta lo que entra, así que
      // soltar la animación lo devuelve exactamente a donde tiene que estar.
      a.finished.then(() => a.cancel()).catch(() => {});
    });

    return () => anims.forEach(a => { try { a.cancel(); } catch {} });
  }, [y, step, delay]);

  return <div ref={host} className={className}>{children}</div>;
}

/** Conteo animado para las métricas del panel. */
export function Contador({ a, formato = money }: { a: number; formato?: (n: number) => string }) {
  const nodo = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = nodo.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = formato(a);
      return;
    }

    let vivo = true;
    const t0 = performance.now();
    const dur = 900;

    const tick = (t: number) => {
      if (!vivo || !el.isConnected) return;   // la vista cambió a mitad del conteo
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = formato(a * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => { vivo = false; };
  }, [a, formato]);

  /* El valor final ya viene en el HTML del servidor: si JavaScript no llega
     —o llega tarde— el dueño ve su número, no un cero. */
  return <span ref={nodo}>{formato(a)}</span>;
}

/**
 * Luz especular que sigue al puntero sobre las superficies. Un solo listener
 * delegado y estrangulado a un frame, porque escribir una variable CSS
 * recalcula estilo en todo el subárbol.
 */
export function Foco() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const SEL = '.card, .stat, .court, .tn-card, .sport-card, .day, .pod, .team-card, .pl-card';
    let encolado = false;
    let ultimo: { el: Element; x: number; y: number } | null = null;

    const mover = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest(SEL) : null;
      if (!el) return;
      ultimo = { el, x: e.clientX, y: e.clientY };
      if (encolado) return;
      encolado = true;
      requestAnimationFrame(() => {
        encolado = false;
        if (!ultimo) return;
        // `getBoundingClientRect` sobre algo que NO se anima: aquí es seguro.
        const r = ultimo.el.getBoundingClientRect();
        (ultimo.el as HTMLElement).style.setProperty(
          '--mx', (((ultimo.x - r.left) / r.width) * 100).toFixed(1) + '%');
        (ultimo.el as HTMLElement).style.setProperty(
          '--my', (((ultimo.y - r.top) / r.height) * 100).toFixed(1) + '%');
      });
    };

    document.addEventListener('pointermove', mover, { passive: true });
    return () => document.removeEventListener('pointermove', mover);
  }, []);

  return null;
}
