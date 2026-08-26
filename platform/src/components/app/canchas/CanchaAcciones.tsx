'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { guardarCancha } from '@/lib/actions/negocio';
import { money, thousands, readNum } from '@/lib/util';

/* ==========================================================================
   Editar una cancha

   Nombre y precio. El aviso de que el precio nuevo NO reescribe el pasado
   (R8) está a la vista dentro del diálogo, porque es exactamente la duda que
   frena a un dueño la primera vez que sube una tarifa.
   ========================================================================== */

export function EditarCancha({
  slug,
  cancha
}: {
  slug: string;
  cancha: { id: string; nombre: string; precio: number; activa: boolean };
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button className="btn btn-sm btn-secondary" onClick={() => setAbierto(true)}>
        <Icon name="pencil" />Editar
      </button>

      {abierto && (
        <Dialogo
          slug={slug}
          cancha={cancha}
          onCerrar={() => setAbierto(false)}
          onHecho={() => { setAbierto(false); router.refresh(); }}
        />
      )}
    </>
  );
}

function Dialogo({
  slug, cancha, onCerrar, onHecho
}: {
  slug: string;
  cancha: { id: string; nombre: string; precio: number; activa: boolean };
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [nombre, setNombre] = useState(cancha.nombre);
  const [precio, setPrecio] = useState(cancha.precio);
  const [activa, setActiva] = useState(cancha.activa);
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const guardar = () => {
    setError(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await guardarCancha(slug, cancha.id, { nombre, precio, activa });
        if (r.error) { setError(r.error); resolver(false); return; }
        toast(`${nombre.trim()} · ${money(precio)} la hora`);
        onHecho();
        resolver(true);
      });
    });
  };

  return (
    <Modal
      title={`Editar ${cancha.nombre}`}
      confirm="Guardar"
      confirmando={enVuelo}
      onConfirm={guardar}
      onClose={onCerrar}
    >
      <div className="form-grid">
        <label className="field field-full">
          <span className="field-label">Nombre de la cancha</span>
          <input
            className="input"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            maxLength={28}
            placeholder="Ej. Cancha Norte"
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

      <label className="check-row">
        <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} />
        <span>
          <b>Se puede reservar</b>
          <em>Si la apagas deja de ofrecerse y de contar para la ocupación. Sus reservas se quedan.</em>
        </span>
      </label>

      <p className="hint">
        El precio aplica a las reservas nuevas. Las ya hechas conservan el suyo.
      </p>

      {error && <p className="auth-error" role="alert">{error}</p>}
    </Modal>
  );
}
