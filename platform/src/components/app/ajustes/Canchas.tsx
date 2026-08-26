'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { Ball } from '@/components/Ball';
import { SubirFoto } from '@/components/app/SubirFoto';
import { EditarCancha } from '@/components/app/canchas/CanchaAcciones';
import { crearCancha, borrarCancha, guardarFotoCancha } from '@/lib/actions/negocio';
import { money, thousands, readNum } from '@/lib/util';
import { SPORTS, SPORT_IDS, type SportId } from '@/lib/sports';
import type { Cancha } from '@/lib/types';

/* ==========================================================================
   Ajustes · Las canchas, una por una

   Renombrar, tarifar, cambiar la foto y agregar. Es el sitio donde el
   negocio deja de ser una plantilla: sus canchas se llaman como se llaman de
   verdad y llevan su propia foto.
   ========================================================================== */

export function CanchasAjustes({
  slug,
  complejoId,
  canchas
}: {
  slug: string;
  complejoId: string;
  canchas: Cancha[];
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [, arrancar] = useTransition();

  const quitar = (c: Cancha) => {
    arrancar(async () => {
      const r = await borrarCancha(slug, c.id);
      if (r.error) { toast(r.error, 'warn'); return; }
      // Desactivar y no borrar cuando tiene historia: sus reservas quedarían
      // huérfanas y el histórico dejaría de cuadrar.
      toast(r.aviso ?? `${c.nombre} eliminada`, r.aviso ? 'info' : 'ok');
      router.refresh();
    });
  };

  return (
    <>
      <ul className="set-courts">
        {canchas.map(c => (
          <li className="set-court" key={c.id}>
            <span className="set-court-ball"><Ball sport={c.deporte} /></span>
            <span className="set-court-txt">
              <b>{c.nombre}</b>
              <em>
                {SPORTS[c.deporte].name} · {money(c.precio)} la hora
                {!c.activa && ' · desactivada'}
              </em>
            </span>
            <span className="set-court-tools">
              <SubirFoto
                complejoId={complejoId}
                tipo="cancha"
                id={c.id}
                tieneFoto={!!c.foto_url}
                etiqueta={c.nombre}
                variante="bar"
                onGuardar={(url: string) => guardarFotoCancha(slug, c.id, url)}
              />
              <EditarCancha
                slug={slug}
                cancha={{ id: c.id, nombre: c.nombre, precio: c.precio, activa: c.activa }}
              />
              <button className="mini" onClick={() => quitar(c)}>Quitar</button>
            </span>
          </li>
        ))}
        {!canchas.length && <li className="empty">Todavía no hay canchas.</li>}
      </ul>

      <button className="btn btn-secondary btn-sm" onClick={() => setCreando(true)}>
        <Icon name="plus" />Agregar cancha
      </button>

      {creando && (
        <DialogoNueva
          slug={slug}
          canchas={canchas}
          onCerrar={() => setCreando(false)}
          onHecho={() => { setCreando(false); router.refresh(); }}
        />
      )}
    </>
  );
}

function DialogoNueva({
  slug, canchas, onCerrar, onHecho
}: {
  slug: string;
  canchas: Cancha[];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  // Se prellena con el deporte que ya tiene, si tiene alguno: casi siempre la
  // cancha nueva es una más de lo mismo.
  const inicial = (canchas[0]?.deporte ?? 'futbol') as SportId;
  const [deporte, setDeporte] = useState<SportId>(inicial);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState(SPORTS[inicial].price);
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const cambiarDeporte = (id: SportId) => {
    setDeporte(id);
    // El precio de mercado sugerido, para no dejar el campo en cero.
    const mismas = canchas.filter(c => c.deporte === id);
    setPrecio(mismas.length ? mismas[0].precio : SPORTS[id].price);
  };

  const guardar = () => {
    setError(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await crearCancha(slug, { deporte, nombre, precio });
        if (r.error) { setError(r.error); resolver(false); return; }
        toast('Cancha agregada');
        onHecho();
        resolver(true);
      });
    });
  };

  return (
    <Modal
      title="Agregar cancha"
      confirm="Agregar"
      confirmando={enVuelo}
      onConfirm={guardar}
      onClose={onCerrar}
    >
      <span className="field-label">Deporte</span>
      <div className="filters" style={{ marginBottom: 'var(--s5)' }}>
        {SPORT_IDS.map(id => (
          <button
            type="button"
            key={id}
            className={`pill${id === deporte ? ' is-on' : ''}`}
            onClick={() => cambiarDeporte(id)}
          >
            <Ball sport={id} className="pill-ball" />
            {SPORTS[id].short}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <label className="field field-full">
          <span className="field-label">Nombre</span>
          <input
            className="input"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            maxLength={28}
            placeholder={`Ej. ${SPORTS[deporte].short} ${
              canchas.filter(c => c.deporte === deporte).length + 1}`}
          />
        </label>

        <label className="field field-full">
          <span className="field-label">Precio por hora</span>
          <span className="price-input price-input-lg">
            <i>$</i>
            <input
              type="text"
              inputMode="numeric"
              value={thousands(precio)}
              onChange={e => setPrecio(readNum(e.target.value))}
            />
            <em>/ hora</em>
          </span>
        </label>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}
    </Modal>
  );
}
