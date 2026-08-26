'use client';

import { useLayoutEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { CourtPlan } from '@/components/Ball';
import { esDeporte, SPORTS, type SportId } from '@/lib/sports';
import type { Rol } from '@/lib/types';

/* ==========================================================================
   El fondo a sangre

   Tres tratamientos, no uno por sección:

     · `is-court`   — la cancha del deporte a sangre. Solo Canchas.
     · `is-stadium` — la noche de estadio. TODO lo demás.
     · `is-plain`   — superficie sobria, cuando el dueño apaga la foto.

   La noche de estadio es el fondo por defecto de toda la app y Canchas es la
   única excepción. Por eso funciona: cuando el fondo cambia, cambia porque
   estás mirando otro deporte, no porque cambiaste de pestaña. Un fondo que
   cambia en cada sección deja de significar algo.

   Va en una capa propia detrás del área de contenido y no en el `background`
   de la vista: así el rail queda fuera, la foto no se arrastra con el scroll
   y las tarjetas pueden flotar encima en vidrio.
   ========================================================================== */

export function ViewChrome({
  slug,
  rol,
  fondo,
  fotosCancha
}: {
  slug: string;
  rol: Rol;
  /** El dueño puede apagar el escenario desde Ajustes. */
  fondo: 'estadio' | 'sobrio' | 'propio';
  /** La foto que el dueño subió para cada deporte, si la hay. */
  fotosCancha: Partial<Record<SportId, string>>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const enCanchas = pathname === `/${slug}/canchas`;
  const pedido = params.get('deporte');
  const deporte: SportId | null =
    enCanchas && pedido && esDeporte(pedido) ? pedido : enCanchas ? 'futbol' : null;

  const vista = pathname.split('/')[2] ?? 'panel';
  const bleed = deporte ? 'court' : fondo === 'sobrio' ? 'plain' : 'stadium';

  /* De estos atributos cuelgan las superficies oscuras de media aplicación:
     sin `data-bleed` la cabecera vuelve a tinta clara sobre la foto y no se
     lee. Con `useLayoutEffect` para que quede puesto antes de pintar. */
  useLayoutEffect(() => {
    const b = document.body.dataset;
    b.view = vista;
    b.role = rol;
    b.bleed = bleed;
    if (deporte) b.sport = deporte; else delete b.sport;
  }, [vista, rol, bleed, deporte]);

  /* `useLayoutEffect` llega DESPUÉS de la primera pintura del navegador, y de
     estos atributos cuelga si la cabecera va en blanco o en tinta. Este
     script los deja puestos en el HTML que sale del servidor, así que no hay
     un fotograma con el título negro sobre la foto oscura. */
  const marcas = (
    <script
      dangerouslySetInnerHTML={{
        __html:
          `(function(d){var b=d.body.dataset;b.view=${JSON.stringify(vista)};` +
          `b.role=${JSON.stringify(rol)};b.bleed=${JSON.stringify(bleed)};` +
          (deporte ? `b.sport=${JSON.stringify(deporte)};` : 'delete b.sport;') +
          '})(document)'
      }}
    />
  );

  if (deporte) {
    const src = fotosCancha[deporte] ?? SPORTS[deporte].photo;
    return (
      <div className={`view-bg is-court media--${deporte}`} aria-hidden="true">
        {marcas}
        <span className="media-wash" />
        <CourtPlan sport={deporte} />
        {/* Ansiosa a propósito: es el elemento más grande de la vista y está
            sobre el pliegue por definición. Diferirla deja la sección con el
            campo dibujado hasta que el navegador se digne. */}
        <img
          className="media-img ok"
          src={src}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <span className="vb-grain" />
        <span className="vb-scrim" />
      </div>
    );
  }

  /* Sobrio es quitar la FOTO, no cambiar de mundo: `data-bleed` se queda
     puesto con otro valor porque de él cuelgan las superficies oscuras. Sin
     él la aplicación entera se volvía clara de golpe, que no es lo que
     promete un botón que dice "sin foto". */
  if (fondo === 'sobrio') {
    return (
      <div className="view-bg is-plain" aria-hidden="true">
        {marcas}
        <span className="vb-grain" />
      </div>
    );
  }

  return (
    <div className="view-bg is-stadium" aria-hidden="true">
      {marcas}
      <span className="vb-photo" />
      <span className="vb-beams" />
      <span className="vb-grain" />
      <span className="vb-scrim" />
    </div>
  );
}
