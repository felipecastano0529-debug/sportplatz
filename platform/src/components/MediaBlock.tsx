import { Ball, CourtPlan } from './Ball';
import type { SportId } from '@/lib/sports';

/* ==========================================================================
   El bloque de cancha

   Mientras no haya foto NO se ve un rectángulo gris: se dibuja el campo del
   deporte con el plano de la cancha encima y el balón de fondo. Se lee como
   una decisión, no como un hueco esperando contenido.

   `priority` existe porque este mismo bloque hace de fondo a sangre en
   Canchas —el elemento más grande de la vista, sobre el pliegue por
   definición— y ahí diferirlo deja la sección con el campo dibujado (la nota
   de `shell.js` sobre `loading="eager"`).
   ========================================================================== */

export function MediaBlock({
  sport,
  src,
  priority = false,
  children
}: {
  sport: SportId;
  src?: string | null;
  priority?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span className={`media media--${sport}`}>
      <span className="media-wash" aria-hidden="true" />
      <CourtPlan sport={sport} />
      <span className="media-ball" aria-hidden="true">
        <Ball sport={sport} />
      </span>
      {src && (
        /* `<img>` y no `next/image`: la fuente es una URL de Supabase
           Storage que cambia cada vez que el dueño sube otra, y el
           optimizador no aporta nada sobre un archivo que ya subimos
           comprimido desde el navegador. */
        <img
          className="media-img ok"
          src={src}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />
      )}
      {children}
    </span>
  );
}
