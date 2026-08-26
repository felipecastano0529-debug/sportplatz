'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { Ball } from '@/components/Ball';
import { crearTorneo } from '@/lib/actions/torneos';
import { SPORTS, type SportId } from '@/lib/sports';
import { iso, today, addDays } from '@/lib/util';

/* ==========================================================================
   Crear un torneo

   Cuatro decisiones: nombre, deporte, tamaño y cuándo arranca. Los equipos
   se pueden meter aquí o dejar los cupos libres para que se inscriban solos
   (R28) — que es lo que hace un complejo que quiere llenar el torneo sin
   perseguir a nadie.
   ========================================================================== */

const TAMANOS = [4, 8, 16] as const;

export function CrearTorneo({
  slug,
  equipos,
  deportes
}: {
  slug: string;
  equipos: { id: string; nombre: string; deporte: SportId }[];
  deportes: SportId[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setAbierto(true)}>
        <Icon name="plus" />Crear torneo
      </button>

      {abierto && (
        <Dialogo
          slug={slug}
          equipos={equipos}
          deportes={deportes}
          onCerrar={() => setAbierto(false)}
          onHecho={id => {
            setAbierto(false);
            router.push(`/${slug}/torneos/${id}`);
          }}
        />
      )}
    </>
  );
}

function Dialogo({
  slug, equipos, deportes, onCerrar, onHecho
}: {
  slug: string;
  equipos: { id: string; nombre: string; deporte: SportId }[];
  deportes: SportId[];
  onCerrar: () => void;
  onHecho: (id: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [deporte, setDeporte] = useState<SportId>(deportes[0]);
  const [tamano, setTamano] = useState<4 | 8 | 16>(8);
  // Una semana vista: nadie organiza un torneo para mañana.
  const [fecha, setFecha] = useState(iso(addDays(today(), 7)));
  const [abierta, setAbierta] = useState(true);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const delDeporte = equipos.filter(e => e.deporte === deporte);

  const alternar = (id: string) => {
    setElegidos(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < tamano ? [...prev, id] : prev);
  };

  const guardar = () => {
    setError(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await crearTorneo(slug, {
          nombre,
          deporte,
          tamano,
          fechaInicio: fecha,
          inscripcionAbierta: abierta,
          equipos: Array.from({ length: tamano }, (_, i) => elegidos[i] ?? null)
        });
        if (r.error || !r.id) { setError(r.error ?? 'No se pudo crear.'); resolver(false); return; }
        toast(`${nombre.trim()} creado · llave de ${tamano}`);
        onHecho(r.id);
        resolver(true);
      });
    });
  };

  const libres = tamano - elegidos.length;

  return (
    <Modal
      title="Crear torneo"
      confirm="Crear torneo"
      confirmando={enVuelo}
      onConfirm={guardar}
      onClose={onCerrar}
      wide
    >
      <div className="form-grid">
        <label className="field field-full">
          <span className="field-label">Nombre</span>
          <input
            className="input"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej. Copa La 70 · Apertura"
            maxLength={80}
          />
        </label>

        <label className="field">
          <span className="field-label">Arranca</span>
          <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </label>
      </div>

      <span className="field-label">Deporte</span>
      <div className="filters" style={{ marginBottom: 'var(--s5)' }}>
        {deportes.map(id => (
          <button
            type="button"
            key={id}
            className={`pill${id === deporte ? ' is-on' : ''}`}
            onClick={() => { setDeporte(id); setElegidos([]); }}
          >
            <Ball sport={id} className="pill-ball" />
            {SPORTS[id].short}
          </button>
        ))}
      </div>

      {/* R22: solo 4, 8 o 16. Eliminación directa, y siempre con tercer
          puesto alimentado por los perdedores de semifinal. */}
      <span className="field-label">Tamaño</span>
      <div className="filters" style={{ marginBottom: 'var(--s5)' }}>
        {TAMANOS.map(n => (
          <button
            type="button"
            key={n}
            className={`pill${n === tamano ? ' is-on' : ''}`}
            onClick={() => { setTamano(n); setElegidos(prev => prev.slice(0, n)); }}
          >
            {n} equipos
          </button>
        ))}
      </div>

      {delDeporte.length > 0 && (
        <>
          <span className="field-label">
            Equipos <em>{elegidos.length} de {tamano}</em>
          </span>
          <div className="filters" style={{ marginBottom: '.5rem' }}>
            {delDeporte.map(e => (
              <button
                type="button"
                key={e.id}
                className={`pill${elegidos.includes(e.id) ? ' is-on' : ''}`}
                onClick={() => alternar(e.id)}
              >
                {e.nombre}
              </button>
            ))}
          </div>
        </>
      )}

      <label className="check-row">
        <input type="checkbox" checked={abierta} onChange={e => setAbierta(e.target.checked)} />
        <span>
          <b>Abierto a inscripción</b>
          <em>
            {libres > 0
              ? `Quedan ${libres} ${libres === 1 ? 'cupo' : 'cupos'} para que los capitanes metan su equipo desde su cuenta.`
              : 'Ya no quedan cupos libres: el torneo arranca con estos equipos.'}
          </em>
        </span>
      </label>

      {error && <p className="auth-error" role="alert">{error}</p>}
    </Modal>
  );
}
