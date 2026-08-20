/* ==========================================================================
   UI · Fondo con balones
   La capa de más atrás, detrás incluso del fondo de escenario. Solo se ve en
   el onboarding y por los bordes; existe para que la pantalla nunca sea un
   blanco plano.
   ========================================================================== */

import { $ } from '../core/util.js';
import { S } from '../core/store.js';
import { ballSVG } from '../core/sports.js';

export function paintBackdrop() {
  const host = $('#backdrop');
  if (!host) return;

  /* Antes de configurar el negocio se muestran los cinco deportes, uno por
     sitio y en este orden: los sitios más grandes se llevan los balones más
     distintos entre sí. Si se cicla una lista corta, el fondo se llena de
     pelotas casi iguales y todo parece una cancha de tenis. */
  const ALL = ['futbol', 'voleibol', 'paintball', 'padel', 'tenis'];
  const sports = S?.business?.sports?.length ? S.business.sports : ALL;

  /* Posiciones decididas a mano, nada aleatorio: los balones tienen que poder
     verse de verdad sin pelearse nunca con el contenido. Van al borde,
     grandes y a medio salir, con un halo de color detrás. */
  const spots = [
    { x: 21, y: 58, s: 24, r: -14, o: .11, b: 0 },
    { x: 86, y: -6, s: 20, r: 22,  o: .12, b: 0 },
    { x: 89, y: 62, s: 24, r: -8,  o: .09, b: 0 },
    { x: 47, y: 80, s: 17, r: 30,  o: .10, b: 0 },
    { x: 65, y: 10, s: 12, r: -24, o: .07, b: 1 },
    { x: 30, y: 90, s: 19, r: 12,  o: .08, b: 1 }
  ];
  const place = S ? spots : spots.slice(0, sports.length);

  host.innerHTML = place.map((p, i) => {
    const sport = sports[i % sports.length];
    return `<span class="bg-ball bg-ball--${sport} ${p.b ? 'is-soft' : ''}" style="
      --x:${p.x}vw; --y:${p.y}vh; --s:${p.s}vmin; --r:${p.r}deg; --o:${p.o}; --d:${i * 2.3}s">
      <span class="bg-halo" aria-hidden="true"></span>${ballSVG(sport)}</span>`;
  }).join('');

  document.body.dataset.sports = sports.join(' ');
}
