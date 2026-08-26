'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { Ball } from '@/components/Ball';
import { Crest } from '@/components/Fichas';
import { SubirFoto } from '@/components/app/SubirFoto';
import {
  crearMiEquipo, guardarMiEquipo, ponerEnPlantilla, sacarDePlantilla
} from '@/lib/actions/jugador';
import { SPORTS, POSITIONS, type SportId } from '@/lib/sports';
import { TEAM_COLORS } from '@/lib/tournament';
import type { Equipo, Persona } from '@/lib/types';

/* ==========================================================================
   JUGADOR · Mi equipo

   Crearlo, ponerle escudo y color, armar la plantilla. Un equipo sin escudo
   no muestra un cuadro gris: muestra su inicial sobre su color (R38), así
   que se puede crear sin subir nada y aun así se ve como un club.
   ========================================================================== */

export function CrearEquipo({
  slug,
  deportes
}: {
  slug: string;
  deportes: SportId[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [deporte, setDeporte] = useState<SportId>(deportes[0] ?? 'futbol');
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const guardar = () => {
    setError(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await crearMiEquipo(slug, { nombre, deporte, color });
        if (r.error) { setError(r.error); resolver(false); return; }
        toast(`${nombre.trim()} creado · ya eres su capitán`);
        setAbierto(false);
        router.refresh();
        resolver(true);
      });
    });
  };

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setAbierto(true)}>
        <Icon name="shield" />Crear equipo
      </button>

      {abierto && (
        <Modal
          title="Crear mi equipo"
          confirm="Crear equipo"
          confirmando={enVuelo}
          onConfirm={guardar}
          onClose={() => setAbierto(false)}
        >
          <div className="form-grid">
            <label className="field field-full">
              <span className="field-label">Nombre del equipo</span>
              <input
                className="input input-xl"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Los Cafeteros"
                maxLength={40}
              />
            </label>
          </div>

          {deportes.length > 1 && (
            <>
              <span className="field-label">Deporte</span>
              <div className="filters" style={{ marginBottom: 'var(--s5)' }}>
                {deportes.map(id => (
                  <button
                    type="button"
                    key={id}
                    className={`pill${id === deporte ? ' is-on' : ''}`}
                    onClick={() => setDeporte(id)}
                  >
                    <Ball sport={id} className="pill-ball" />
                    {SPORTS[id].short}
                  </button>
                ))}
              </div>
            </>
          )}

          <span className="field-label">Color</span>
          <div className="swatches" role="radiogroup" aria-label="Color del equipo">
            {TEAM_COLORS.map(hex => (
              <button
                type="button"
                key={hex}
                className={`swatch${hex === color ? ' is-on' : ''}`}
                onClick={() => setColor(hex)}
                role="radio"
                aria-checked={hex === color}
                aria-label={`Color ${hex}`}
                style={{ '--sw': hex, '--sw-hi': hex } as React.CSSProperties}
              >
                <i />
              </button>
            ))}
          </div>

          <div className="crest-editor" style={{ marginTop: 'var(--s5)' }}>
            <Crest
              equipo={{ nombre: nombre || 'Equipo', color, escudo_url: null }}
              className="crest--xl"
            />
            <p className="hint">
              Así se va a ver. Puedes subirle un escudo después; sin él lleva su
              inicial sobre su color, que ya se lee como identidad.
            </p>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
        </Modal>
      )}
    </>
  );
}

/* ── Editar el que ya existe ─────────────────────────────────────────────── */

export function EditarMiEquipo({
  slug,
  complejoId,
  equipo,
  soyCapitan
}: {
  slug: string;
  complejoId: string;
  equipo: Equipo;
  soyCapitan: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(equipo.nombre);
  const [color, setColor] = useState(equipo.color);
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  if (!soyCapitan) return null;

  const guardar = () => {
    setError(null);
    return new Promise<boolean>(resolver => {
      arrancar(async () => {
        const r = await guardarMiEquipo(slug, equipo.id, { nombre, color });
        if (r.error) { setError(r.error); resolver(false); return; }
        toast('Equipo actualizado');
        setAbierto(false);
        router.refresh();
        resolver(true);
      });
    });
  };

  return (
    <>
      <div className="crest-tools">
        <button className="btn btn-secondary btn-sm" onClick={() => setAbierto(true)}>
          <Icon name="pencil" />Editar equipo
        </button>
        <SubirFoto
          complejoId={complejoId}
          tipo="escudo"
          id={equipo.id}
          tieneFoto={!!equipo.escudo_url}
          etiqueta={equipo.nombre}
          variante="bar"
          onGuardar={(url: string) => guardarMiEquipo(slug, equipo.id, { escudoUrl: url })}
        />
      </div>

      {abierto && (
        <Modal
          title={`Editar ${equipo.nombre}`}
          confirm="Guardar"
          confirmando={enVuelo}
          onConfirm={guardar}
          onClose={() => setAbierto(false)}
        >
          <div className="form-grid">
            <label className="field field-full">
              <span className="field-label">Nombre</span>
              <input
                className="input"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                maxLength={40}
              />
            </label>
          </div>

          <span className="field-label">Color</span>
          <div className="swatches" role="radiogroup" aria-label="Color del equipo">
            {TEAM_COLORS.map(hex => (
              <button
                type="button"
                key={hex}
                className={`swatch${hex === color ? ' is-on' : ''}`}
                onClick={() => setColor(hex)}
                role="radio"
                aria-checked={hex === color}
                aria-label={`Color ${hex}`}
                style={{ '--sw': hex, '--sw-hi': hex } as React.CSSProperties}
              >
                <i />
              </button>
            ))}
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
        </Modal>
      )}
    </>
  );
}

/* ── La plantilla ────────────────────────────────────────────────────────── */

export function ArmarPlantilla({
  slug,
  equipo,
  dentro,
  disponibles,
  soyCapitan
}: {
  slug: string;
  equipo: Equipo;
  dentro: { persona: Persona; posicion: string | null }[];
  disponibles: Persona[];
  soyCapitan: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [, arrancar] = useTransition();

  const sugerido = SPORTS[equipo.deporte].squad;
  const posiciones = POSITIONS[equipo.deporte];

  const cambiarPosicion = (personaId: string, posicion: string) => {
    arrancar(async () => {
      const r = await ponerEnPlantilla(slug, equipo.id, personaId, posicion || undefined);
      if (r.error) { toast(r.error, 'warn'); return; }
      router.refresh();
    });
  };

  const sacar = (personaId: string, nombre: string) => {
    arrancar(async () => {
      const r = await sacarDePlantilla(slug, equipo.id, personaId);
      if (r.error) { toast(r.error, 'warn'); return; }
      toast(`${nombre} salió de la plantilla`, 'info');
      router.refresh();
    });
  };

  const meter = (personaId: string, nombre: string) => {
    arrancar(async () => {
      const r = await ponerEnPlantilla(slug, equipo.id, personaId);
      if (r.error) { toast(r.error, 'warn'); return; }
      toast(`${nombre} entró a la plantilla`);
      setAbierto(false);
      router.refresh();
    });
  };

  return (
    <>
      <ul className="roster">
        {dentro.map(({ persona, posicion }) => (
          <li className="roster-row" key={persona.id}>
            <span className="roster-main">
              <b>{persona.nombre}</b>
              {soyCapitan ? (
                <select
                  className="input input-mini"
                  value={posicion ?? ''}
                  onChange={e => cambiarPosicion(persona.id, e.target.value)}
                  aria-label={`Posición de ${persona.nombre}`}
                >
                  <option value="">Sin posición</option>
                  {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <em>{posicion || SPORTS[equipo.deporte].name}</em>
              )}
            </span>
            {persona.id === equipo.capitan_id
              ? <span className="tag tag-cap">Capitán</span>
              : soyCapitan && (
                <button className="mini" onClick={() => sacar(persona.id, persona.nombre)}>
                  Sacar
                </button>
              )}
          </li>
        ))}
        {!dentro.length && <li className="empty">Todavía no hay nadie en la plantilla</li>}
      </ul>

      <p className="hint">
        {/* R36: el tamaño sugerido depende del deporte. Es una sugerencia, no
            un tope: un equipo de fútbol con nueve inscritos es normal. */}
        {dentro.length} de {sugerido} sugeridos para {SPORTS[equipo.deporte].name.toLowerCase()}.
      </p>

      {soyCapitan && (
        <button className="btn btn-secondary btn-sm" onClick={() => setAbierto(true)}>
          <Icon name="plus" />Agregar jugador
        </button>
      )}

      {abierto && (
        <Modal title="Agregar a la plantilla" confirm={null} onClose={() => setAbierto(false)}>
          {disponibles.length ? (
            <div className="who-list">
              {disponibles.map(p => (
                <button
                  type="button"
                  className="who"
                  key={p.id}
                  onClick={() => meter(p.id, p.nombre)}
                >
                  <span className="avatar avatar--sm" style={{ '--tc': p.color } as React.CSSProperties}>
                    {p.nombre.slice(0, 2).toUpperCase()}
                  </span>
                  <b>{p.nombre}</b>
                  <em>{p.telefono ?? 'Jugador del complejo'}</em>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty">
              Ya está todo el mundo dentro. Los jugadores nuevos aparecen aquí en
              cuanto se registran en este complejo.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
