import { BALLS, COURTS_SVG, SP_DEFS, type SportId } from '@/lib/sports';

/* ==========================================================================
   Iconografía de deporte

   Los balones y los planos de cancha son dibujos de la casa, no iconos de
   librería: van con volumen, con la costura real de cada balón y con el
   plano visto desde arriba de cada superficie.

   Se inyectan como marcado porque el original vive en `lib/sports.ts` como
   una constante del código —no hay ni una entrada de usuario en el camino—
   y transcribir cinco balones a JSX a mano solo añadiría erratas.
   ========================================================================== */

/** Los degradados, una sola vez para toda la página. Va en el layout raíz. */
export function SpDefs() {
  return <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: SP_DEFS }} />;
}

export function Ball({ sport, className = '' }: { sport: SportId; className?: string }) {
  return (
    <svg
      className={`ball ball--${sport} ${className}`.trim()}
      viewBox="0 0 100 100"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: BALLS[sport] ?? BALLS.futbol }}
    />
  );
}

/**
 * El plano de la cancha. No es un placeholder gris esperando a que suban una
 * foto: es el esquema real de la superficie, y se sostiene solo.
 *
 * `width: auto` en un `<svg>` dentro de flex lo colapsa (trampa 2 del
 * documento maestro), por eso las medidas las pone `.plan` en la hoja.
 */
export function CourtPlan({ sport }: { sport: SportId }) {
  return (
    <svg
      className="plan"
      viewBox="0 0 160 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g
        className="plan-g"
        dangerouslySetInnerHTML={{ __html: COURTS_SVG[sport] ?? COURTS_SVG.futbol }}
      />
    </svg>
  );
}
