import { Ball } from './Ball';
import { SPORT_IDS, type SportId } from '@/lib/sports';

/* ==========================================================================
   El fondo de balones

   La capa de más atrás, detrás incluso del fondo de escenario. Existe para
   que la pantalla nunca sea un blanco plano.

   Las posiciones están decididas a mano, nada aleatorio: los balones tienen
   que poder verse de verdad sin pelearse nunca con el contenido. Van al
   borde, grandes y a medio salir, con un halo de color detrás.
   ========================================================================== */

const SITIOS = [
  { x: 21, y: 58, s: 24, r: -14, o: 0.11, blur: false },
  { x: 86, y: -6, s: 20, r: 22,  o: 0.12, blur: false },
  { x: 89, y: 62, s: 24, r: -8,  o: 0.09, blur: false },
  { x: 47, y: 80, s: 17, r: 30,  o: 0.10, blur: false },
  { x: 65, y: 10, s: 12, r: -24, o: 0.07, blur: true },
  { x: 30, y: 90, s: 19, r: 12,  o: 0.08, blur: true }
];

/**
 * `sports` son los deportes del complejo. El orden importa: los sitios más
 * grandes se llevan los balones más distintos entre sí. Si se cicla una
 * lista corta, el fondo se llena de pelotas casi iguales y todo parece una
 * cancha de tenis — por eso el reparto por defecto no es alfabético.
 */
export function Backdrop({ sports }: { sports?: SportId[] }) {
  const lista = sports?.length
    ? sports
    : (['futbol', 'voleibol', 'paintball', 'padel', 'tenis'] as SportId[]);

  const usar = lista.filter(s => SPORT_IDS.includes(s));
  if (!usar.length) return null;

  return (
    <div id="backdrop" aria-hidden="true">
      {SITIOS.map((p, i) => {
        const sport = usar[i % usar.length];
        return (
          <span
            key={i}
            className={`bg-ball bg-ball--${sport}${p.blur ? ' is-soft' : ''}`}
            style={{
              '--x': `${p.x}vw`,
              '--y': `${p.y}vh`,
              '--s': `${p.s}vmin`,
              '--r': `${p.r}deg`,
              '--o': p.o,
              '--d': `${i * 2.3}s`
            } as React.CSSProperties}
          >
            <span className="bg-halo" aria-hidden="true" />
            <Ball sport={sport} />
          </span>
        );
      })}
    </div>
  );
}
