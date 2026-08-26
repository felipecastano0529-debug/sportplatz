'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { navDe, inicioDe, type Destino } from '@/lib/nav';
import { initials } from '@/lib/util';
import type { Rol } from '@/lib/types';
import { HojaMas } from './HojaMas';

/* ==========================================================================
   El rail

   Metal negro mate a la izquierda en escritorio; barra inferior de cuatro
   destinos más una hoja "Más" en el celular. El CSS ya resuelve las dos
   formas: aquí solo hay que marcar con `data-tab` lo que cabe abajo.

   Es cliente porque necesita saber en qué ruta estás para marcar el activo.
   Nada más: los datos llegan ya resueltos desde el layout.
   ========================================================================== */

export function NavRail({
  slug,
  rol,
  nombreComplejo,
  logoUrl,
  nombrePersona,
  avatarUrl,
  email
}: {
  slug: string;
  rol: Rol;
  nombreComplejo: string;
  logoUrl: string | null;
  nombrePersona: string;
  avatarUrl: string | null;
  email: string | null;
}) {
  const pathname = usePathname();
  const [masAbierto, setMasAbierto] = useState(false);

  const destinos = navDe(rol);
  const activo = destinoActivo(destinos, slug, pathname);
  const enPestana = !!activo?.tab;

  // El rail del jugador lleva SU nombre y su cara; el del staff, el negocio.
  const esJugador = rol === 'jugador';
  const titulo = esJugador ? nombrePersona : nombreComplejo;
  const subtitulo = esJugador ? 'Jugador' : rolLabel(rol);

  return (
    <>
      <aside className="nav">
        <Link className="nav-brand" href={`/${slug}/${inicioDe(rol)}`}>
          {logoUrl ? (
            <span className="brand-logo">
              <img src={logoUrl} alt="" />
            </span>
          ) : (
            <img className="logo" src="/assets/marca/logo.png" alt="" width={256} height={256} />
          )}
          <span className="nav-brand-txt">
            <b>{nombreComplejo}</b>
            <em>{subtitulo}</em>
          </span>
        </Link>

        <nav className="nav-list" aria-label="Secciones">
          {destinos.map(d => {
            const on = activo?.id === d.id;
            return (
              <Link
                key={d.id}
                className={`nav-item${on ? ' is-on' : ''}`}
                href={`/${slug}/${d.href}`}
                data-tab={d.tab ? '' : undefined}
                aria-current={on ? 'page' : undefined}
              >
                <span className="nav-ic"><Icon name={d.icon} /></span>
                <span className="nav-txt">
                  <b>{d.label}</b>
                  <em>{d.hint}</em>
                </span>
              </Link>
            );
          })}

          {/* Solo existe en el celular: el CSS lo esconde en escritorio, donde
              el rail entero ya está a la vista. */}
          <button
            type="button"
            className="nav-item nav-more"
            onClick={() => setMasAbierto(true)}
            aria-haspopup="dialog"
            aria-current={enPestana ? undefined : 'page'}
          >
            <span className="nav-ic"><Icon name="ajustes" /></span>
            <span className="nav-txt">
              <b>Más</b>
              <em>Todo lo demás</em>
            </span>
          </button>
        </nav>

        <div className="nav-foot">
          <div className="nav-user">
            {avatarUrl ? (
              <span className="avatar avatar--img">
                <img src={avatarUrl} alt="" />
              </span>
            ) : (
              <span className="avatar">{initials(titulo)}</span>
            )}
            <span className="nav-user-txt">
              <b>{nombrePersona}</b>
              <em>{email ?? subtitulo}</em>
            </span>
          </div>
        </div>
      </aside>

      {masAbierto && (
        <HojaMas
          slug={slug}
          rol={rol}
          activo={activo?.id}
          nombrePersona={nombrePersona}
          email={email}
          onCerrar={() => setMasAbierto(false)}
        />
      )}
    </>
  );
}

function rolLabel(rol: Rol) {
  return rol === 'dueno' ? 'Dueño' : rol === 'operador' ? 'Mostrador' : 'Jugador';
}

/**
 * El destino más específico que casa con la ruta. Se compara el trozo más
 * largo primero porque `j/torneos` y `torneos` comparten sufijo: ordenarlo al
 * revés dejaba el jugador marcando la sección del dueño.
 */
function destinoActivo(destinos: Destino[], slug: string, pathname: string) {
  return destinos
    .slice()
    .sort((a, b) => b.href.length - a.href.length)
    .find(d => pathname === `/${slug}/${d.href}` || pathname.startsWith(`/${slug}/${d.href}/`));
}
