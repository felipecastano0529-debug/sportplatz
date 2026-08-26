'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { marcarResultado, volverASortear } from '@/lib/actions/torneos';
import type { Cupo, Partido } from '@/lib/tournament';

/* ==========================================================================
   Poner el marcador

   La cuadrícula de la llave y el calendario los pinta el servidor; este
   contenedor escucha el clic delegado y abre el diálogo del partido.

   Regla del diálogo: en eliminación directa NO puede quedar empate (R24). Se
   dice antes de guardar, no después.
   ========================================================================== */

export function LlaveInteractiva({
  slug,
  torneoId,
  cupos,
  partidos,
  unidad,
  puedeSortear,
  children
}: {
  slug: string;
  torneoId: string;
  cupos: Cupo[];
  partidos: Partido[];
  unidad: string;
  puedeSortear: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<Partido | null>(null);
  const [confirmarSorteo, setConfirmarSorteo] = useState(false);
  const [, arrancar] = useTransition();

  const alClic = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-match], [data-sortear]');
    if (!el) return;

    if (el.dataset.sortear !== undefined) {
      const yaEmpezo = partidos.some(m => m.jugado);
      if (yaEmpezo) { setConfirmarSorteo(true); return; }
      sortear();
      return;
    }

    const m = partidos.find(x => x.id === el.dataset.match);
    if (!m) return;
    if (!m.cupoA || !m.cupoB) {
      toast('Ese partido todavía espera a que se definan los equipos', 'warn');
      return;
    }
    setAbierto(m);
  };

  const sortear = () => {
    setConfirmarSorteo(false);
    arrancar(async () => {
      const r = await volverASortear(slug, torneoId);
      if (r.error) { toast(r.error, 'warn'); return; }
      toast('Cruces sorteados');
      router.refresh();
    });
  };

  return (
    <>
      <div onClick={alClic}>{children}</div>

      {abierto && (
        <DialogoPartido
          slug={slug}
          torneoId={torneoId}
          partido={abierto}
          cupoA={cupos.find(c => c.id === abierto.cupoA)!}
          cupoB={cupos.find(c => c.id === abierto.cupoB)!}
          unidad={unidad}
          onCerrar={() => setAbierto(null)}
          onHecho={() => { setAbierto(null); router.refresh(); }}
        />
      )}

      {confirmarSorteo && puedeSortear && (
        <Modal
          title="Sortear de nuevo"
          confirm="Sortear igual"
          onConfirm={sortear}
          onClose={() => setConfirmarSorteo(false)}
        >
          <p className="nota nota--neg">
            <Icon name="spark" className="ic ic-sm" />
            Ya hay partidos jugados. Sortear los cruces borra todos los
            marcadores de la primera ronda y vuelve a resolver la llave.
          </p>
        </Modal>
      )}
    </>
  );
}

function DialogoPartido({
  slug, torneoId, partido, cupoA, cupoB, unidad, onCerrar, onHecho
}: {
  slug: string;
  torneoId: string;
  partido: Partido;
  cupoA: Cupo;
  cupoB: Cupo;
  unidad: string;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [a, setA] = useState(partido.marcadorA?.toString() ?? '');
  const [b, setB] = useState(partido.marcadorB?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const guardar = () => {
    setError(null);
    const na = a === '' ? null : Math.max(0, parseInt(a, 10) || 0);
    const nb = b === '' ? null : Math.max(0, parseInt(b, 10) || 0);

    if (na != null && nb != null && na === nb) {
      setError('No puede quedar empate: es eliminación directa.');
      return false;
    }

    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await marcarResultado(slug, torneoId, partido.id, na, nb);
        if (r.error) { setError(r.error); resolver(false); return; }
        if (na != null && nb != null) {
          toast(`${na > nb ? cupoA.nombre : cupoB.nombre} avanza`);
        } else {
          toast('Marcador borrado', 'info');
        }
        onHecho();
        resolver(true);
      });
    });
  };

  const borrar = () => {
    arrancar(async () => {
      const r = await marcarResultado(slug, torneoId, partido.id, null, null);
      if (r.error) { toast(r.error, 'warn'); return; }
      toast('Marcador borrado · la llave vuelve atrás', 'info');
      onHecho();
    });
  };

  return (
    <Modal
      title={`${cupoA.nombre} vs ${cupoB.nombre}`}
      confirm="Guardar resultado"
      confirmando={enVuelo}
      onConfirm={guardar}
      danger={partido.jugado ? 'Borrar marcador' : undefined}
      onDanger={partido.jugado ? borrar : undefined}
      onClose={onCerrar}
    >
      <div className="score-set">
        <div className="score-side">
          <i className="br-chip" style={{ background: cupoA.color }} />
          <b>{cupoA.nombre}</b>
          <input
            className="score-in"
            type="number"
            min={0}
            max={99}
            value={a}
            onChange={e => setA(e.target.value)}
            placeholder="0"
          />
        </div>

        <span className="score-x">–</span>

        <div className="score-side">
          <i className="br-chip" style={{ background: cupoB.color }} />
          <b>{cupoB.nombre}</b>
          <input
            className="score-in"
            type="number"
            min={0}
            max={99}
            value={b}
            onChange={e => setB(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <p className="hint">
        {unidad[0].toUpperCase() + unidad.slice(1)} de cada equipo. En eliminación
        directa no puede quedar empate, y el ganador avanza solo a la ronda
        siguiente.
      </p>

      {error && <p className="auth-error" role="alert">{error}</p>}
    </Modal>
  );
}
