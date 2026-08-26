'use client';

import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/Icon';
import { navDe } from '@/lib/nav';
import { salir } from '@/lib/actions/auth';
import type { Rol } from '@/lib/types';

/* ==========================================================================
   La hoja "Más" · solo celular

   Lo que no cabe en la barra inferior, en el orden en que se necesita: las
   secciones restantes, quién eres y la salida. No es un cajón de sastre —
   es la segunda pantalla de navegación, y por eso lleva las mismas
   etiquetas y los mismos iconos que el rail de escritorio.
   ========================================================================== */

export function HojaMas({
  slug,
  rol,
  activo,
  nombrePersona,
  email,
  onCerrar
}: {
  slug: string;
  rol: Rol;
  activo?: string;
  nombrePersona: string;
  email: string | null;
  onCerrar: () => void;
}) {
  const resto = navDe(rol).filter(d => !d.tab);

  return (
    <Modal title="Todo lo demás" confirm={null} onClose={onCerrar}>
      <nav className="mas-list" aria-label="Más secciones">
        {resto.map(d => (
          <Link
            key={d.id}
            className={`mas-item${activo === d.id ? ' is-on' : ''}`}
            href={`/${slug}/${d.href}`}
            onClick={onCerrar}
          >
            <span className="nav-ic"><Icon name={d.icon} /></span>
            <span className="mas-txt">
              <b>{d.label}</b>
              <em>{d.hint}</em>
            </span>
            <Icon name="right" className="ic ic-sm mas-go" />
          </Link>
        ))}
      </nav>

      <div className="mas-foot">
        <form action={salir}>
          <button type="submit" className="cuenta cuenta--dentro">
            <Icon name="logout" className="ic ic-sm" />
            <span className="cuenta-txt">
              <b>Salir de {nombrePersona}</b>
              <em>{email ?? 'Cerrar sesión'}</em>
            </span>
          </button>
        </form>
      </div>
    </Modal>
  );
}
