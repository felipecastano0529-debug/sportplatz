'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { Crest } from '@/components/Fichas';
import { inscribirEquipo } from '@/lib/actions/torneos';
import type { Equipo } from '@/lib/types';

/* ==========================================================================
   JUGADOR · Inscribir mi equipo

   R28 — el equipo entra en el PRIMER cupo libre, y el cupo queda tomado. Si
   dos capitanes pulsan a la vez, la condición `is('equipo_id', null)` de la
   escritura hace que solo uno se lo lleve: el otro recibe un mensaje, no un
   cupo pisado.

   Solo se ofrecen los equipos del mismo deporte y de los que la persona es
   capitana: inscribir el equipo de otro no es una función, es un accidente.
   ========================================================================== */

export function InscribirEquipo({
  slug,
  torneoId,
  torneoNombre,
  cupos,
  candidatos
}: {
  slug: string;
  torneoId: string;
  torneoNombre: string;
  cupos: number;
  candidatos: Equipo[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState(candidatos[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  if (!candidatos.length) {
    return (
      <p className="hint">
        Para inscribirte necesitas ser capitán de un equipo de este deporte.
      </p>
    );
  }

  const inscribir = () => {
    setError(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await inscribirEquipo(slug, torneoId, elegido);
        if (r.error) { setError(r.error); resolver(false); return; }
        const nombre = candidatos.find(e => e.id === elegido)?.nombre ?? 'Tu equipo';
        toast(`${nombre} quedó inscrito en ${torneoNombre}`);
        setAbierto(false);
        router.refresh();
        resolver(true);
      });
    });
  };

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setAbierto(true)}>
        <Icon name="trophy" />Inscribir mi equipo
      </button>

      {abierto && (
        <Modal
          title={`Inscribirse en ${torneoNombre}`}
          confirm="Inscribir"
          confirmando={enVuelo}
          onConfirm={inscribir}
          onClose={() => setAbierto(false)}
        >
          <p className="hint">
            Quedan {cupos} {cupos === 1 ? 'cupo' : 'cupos'}. Tu equipo entra en el
            primero libre y el cupo queda tomado.
          </p>

          <div className="who-list">
            {candidatos.map(e => (
              <button
                type="button"
                key={e.id}
                className={`who${e.id === elegido ? ' is-on' : ''}`}
                onClick={() => setElegido(e.id)}
              >
                <Crest equipo={e} className="crest--sm" />
                <b>{e.nombre}</b>
                <em>Eres el capitán</em>
              </button>
            ))}
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
        </Modal>
      )}
    </>
  );
}
