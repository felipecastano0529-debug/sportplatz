'use client';

import { useState, useTransition } from 'react';
import { crearComplejo, unirmeAComplejo } from '@/lib/actions/onboarding';
import { SPORTS, SPORT_LIST, type SportId } from '@/lib/sports';
import { MediaBlock } from '@/components/MediaBlock';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { thousands, readNum, esWhatsapp } from '@/lib/util';

/* ==========================================================================
   Onboarding

   Cuatro preguntas y la plataforma existe. No da la bienvenida:
   PERSONALIZA. Con estas cuatro respuestas se genera el negocio entero.

   El WhatsApp se pide en el primer paso y no al final, y no es un peaje: es
   el número al que Neo le mandaría las reservas. Pedirlo con su para qué a
   la vista es lo que separa un dato que se entrega de uno que se saca.
   ========================================================================== */

const PASOS = ['Tu negocio', 'Tus canchas', 'Cuántas', 'Precios'];

export function Onboarding({ nombrePersona }: { nombrePersona: string }) {
  const [camino, setCamino] = useState<'elegir' | 'dueno' | 'jugador'>('elegir');

  if (camino === 'elegir') return <Bifurcacion nombre={nombrePersona} onElegir={setCamino} />;
  if (camino === 'jugador') return <EntrarAComplejo onVolver={() => setCamino('elegir')} />;
  return <CuatroPreguntas onVolver={() => setCamino('elegir')} />;
}

/* ── ¿Qué eres aquí? ─────────────────────────────────────────────────────── */

function Bifurcacion({
  nombre,
  onElegir
}: {
  nombre: string;
  onElegir: (c: 'dueno' | 'jugador') => void;
}) {
  return (
    <div className="ob-panel">
      <header className="ob-head">
        <p className="kicker">Hola, {nombre.split(' ')[0]}</p>
        <h1 className="ob-title">¿Qué vienes a <em>hacer</em>?</h1>
        <p className="ob-sub">
          Es la última pregunta antes de entrar. La cuenta es la misma; lo que
          cambia es la plataforma que ves.
        </p>
      </header>

      <div className="role-pick">
        <button type="button" className="role-card" onClick={() => onElegir('dueno')}>
          <Icon name="panel" className="ic" />
          <b>Administro un complejo</b>
          <em>Panel, agenda, canchas, torneos y Neo AI</em>
        </button>

        <button type="button" className="role-card" onClick={() => onElegir('jugador')}>
          <Icon name="user" className="ic" />
          <b>Vengo a jugar</b>
          <em>Reservar, armar equipo, inscribirte y ver tu histórico</em>
        </button>
      </div>
    </div>
  );
}

/* ── El jugador entra al complejo que lo invitó ──────────────────────────── */

function EntrarAComplejo({ onVolver }: { onVolver: () => void }) {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const entrar = () => {
    setError(null);
    arrancar(async () => {
      const r = await unirmeAComplejo(slug);
      if (r?.error) setError(r.error);
    });
  };

  return (
    <div className="ob-panel">
      <header className="ob-head">
        <p className="kicker">Jugador</p>
        <h1 className="ob-title">¿A qué <em>complejo</em> vas?</h1>
        <p className="ob-sub">
          Pega el link que te mandó el complejo, o escribe su dirección. Si ya
          te tienen apuntado con tu número, tus reservas aparecen solas.
        </p>
      </header>

      <div className="ob-field">
        <input
          className="input input-xl"
          value={slug}
          onChange={e => setSlug(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && slug.trim()) entrar(); }}
          placeholder="complejo-la-70"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        <p className="hint">
          Es la última parte del link: sportplatz.app/<b>complejo-la-70</b>
        </p>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="ob-actions">
        <button className="btn btn-secondary" onClick={onVolver}>
          <Icon name="left" className="ic ic-sm" />Atrás
        </button>
        <button className="btn btn-primary" onClick={entrar} disabled={enVuelo || !slug.trim()}>
          {enVuelo ? <><span className="spin" />Entrando…</> : 'Entrar'}
        </button>
      </div>
    </div>
  );
}

/* ── Las cuatro preguntas ────────────────────────────────────────────────── */

function CuatroPreguntas({ onVolver }: { onVolver: () => void }) {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [deportes, setDeportes] = useState<SportId[]>([]);
  const [cuantas, setCuantas] = useState<Partial<Record<SportId, number>>>({});
  const [precios, setPrecios] = useState<Partial<Record<SportId, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, arrancar] = useTransition();

  const alternar = (id: SportId) => {
    setDeportes(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      setCuantas(c => ({ ...c, [id]: c[id] ?? 1 }));
      setPrecios(p => ({ ...p, [id]: p[id] ?? SPORTS[id].price }));
      return [...prev, id];
    });
  };

  const contar = (id: SportId, d: number) =>
    setCuantas(c => ({ ...c, [id]: Math.max(1, Math.min(12, (c[id] ?? 1) + d)) }));

  const crear = () => {
    setError(null);
    arrancar(async () => {
      const r = await crearComplejo({ nombre, whatsapp, deportes, cuantas, precios });
      if (r?.error) setError(r.error);
    });
  };

  const okNombre = nombre.trim().length >= 2;
  const okWa = esWhatsapp(whatsapp);

  return (
    <div className={`ob-panel${paso === 1 ? ' ob-panel-wide' : ''}`}>
      {/* Los pasos también en el escenario: el rail de la izquierda es una
          escena compartida y no sabe en cuál va. */}
      <ol className="ob-steps ob-steps--inline" aria-label="Progreso">
        {PASOS.map((s, i) => (
          <li className={`ob-step${i === paso ? ' is-now' : i < paso ? ' is-done' : ''}`} key={s}>
            <span className="ob-step-n"><span>{i + 1}</span></span>
            <span className="ob-step-t">{s}</span>
          </li>
        ))}
      </ol>

      {paso === 0 && (
        <>
          <header className="ob-head">
            <p className="kicker">Paso 01</p>
            <h1 className="ob-title">¿Cómo se llama tu <em>negocio</em>?</h1>
            <p className="ob-sub">
              Va a aparecer en el panel, en las reservas, en la cuenta de cada
              jugador y en cada respuesta de Neo AI por WhatsApp.
            </p>
          </header>

          <div className="ob-field">
            <input
              className="input input-xl"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Complejo Deportivo La 70"
              maxLength={42}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <p className="hint">
              {okNombre ? '¡Listo!' : 'Escribe el nombre para continuar'}
            </p>
          </div>

          <div className="ob-field">
            <label className="field-label" htmlFor="obWa">
              ¿A qué WhatsApp te llegarían las reservas?
            </label>
            <input
              id="obWa"
              className="input input-xl"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="300 123 4567"
              inputMode="tel"
              maxLength={20}
            />
            <p className="hint">
              {okWa
                ? 'Perfecto. Ahí es donde te va a escribir Neo AI.'
                : 'Neo AI le manda ahí las reservas que atiende por ti.'}
            </p>
          </div>

          <div className="ob-actions">
            <button className="btn btn-secondary" onClick={onVolver}>
              <Icon name="left" className="ic ic-sm" />Atrás
            </button>
            <button className="btn btn-primary" onClick={() => setPaso(1)} disabled={!okNombre || !okWa}>
              Continuar
            </button>
          </div>
        </>
      )}

      {paso === 1 && (
        <>
          <header className="ob-head">
            <p className="kicker">Paso 02</p>
            <h1 className="ob-title">¿Qué <em>canchas</em> tienes?</h1>
            <p className="ob-sub">
              Elige todas las que apliquen. Después les puedes subir la foto de
              cada una y así te ves tú, no una plantilla.
            </p>
          </header>

          <div className="sport-grid">
            {SPORT_LIST.map(sp => {
              const on = deportes.includes(sp.id);
              return (
                <div
                  key={sp.id}
                  className={`sport-card${on ? ' is-on' : ''}`}
                  role="checkbox"
                  aria-checked={on}
                  tabIndex={0}
                  onClick={() => alternar(sp.id)}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternar(sp.id); }
                  }}
                >
                  <MediaBlock sport={sp.id} src={sp.photo} />
                  <span className="sport-check" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                  <span className="sport-body">
                    <span className="sport-name">{sp.name}</span>
                    <span className="sport-blurb">{sp.blurb}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="ob-actions">
            <button className="btn btn-secondary" onClick={() => setPaso(0)}>
              <Icon name="left" className="ic ic-sm" />Atrás
            </button>
            <button className="btn btn-primary" onClick={() => setPaso(2)} disabled={!deportes.length}>
              Continuar {!!deportes.length && <span className="btn-count">{deportes.length}</span>}
            </button>
          </div>
        </>
      )}

      {paso === 2 && (
        <>
          <header className="ob-head">
            <p className="kicker">Paso 03</p>
            <h1 className="ob-title">¿<em>Cuántas</em> tienes de cada una?</h1>
            <p className="ob-sub">
              Después les puedes cambiar el nombre, el precio y la foto una por una.
            </p>
          </header>

          <div className="count-list">
            {deportes.map(id => (
              <div className="count-row" key={id}>
                <span className="count-icon"><Ball sport={id} /></span>
                <span className="count-label">
                  <b>{SPORTS[id].name}</b>
                  <em>{SPORTS[id].blurb}</em>
                </span>
                <span className="stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => contar(id, -1)}
                    aria-label={`Quitar una cancha de ${SPORTS[id].name}`}
                  >
                    −
                  </button>
                  <output className="stepper-val">{cuantas[id] ?? 1}</output>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => contar(id, 1)}
                    aria-label={`Agregar una cancha de ${SPORTS[id].name}`}
                  >
                    +
                  </button>
                </span>
              </div>
            ))}
          </div>

          <div className="ob-actions">
            <button className="btn btn-secondary" onClick={() => setPaso(1)}>
              <Icon name="left" className="ic ic-sm" />Atrás
            </button>
            <button className="btn btn-primary" onClick={() => setPaso(3)}>Continuar</button>
          </div>
        </>
      )}

      {paso === 3 && (
        <>
          <header className="ob-head">
            <p className="kicker">Paso 04</p>
            <h1 className="ob-title">¿A cuánto cobras la <em>hora</em>?</h1>
            <p className="ob-sub">
              Precio por hora de cada tipo de cancha. Lo puedes ajustar cancha
              por cancha más adelante.
            </p>
          </header>

          <div className="price-list">
            {deportes.map(id => {
              const n = cuantas[id] ?? 1;
              return (
                <label className="price-row" key={id}>
                  <span className="count-icon"><Ball sport={id} /></span>
                  <span className="count-label">
                    <b>{SPORTS[id].name}</b>
                    <em>{n} cancha{n > 1 ? 's' : ''}</em>
                  </span>
                  <span className="price-input">
                    <i>$</i>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={thousands(precios[id] ?? SPORTS[id].price)}
                      onChange={e => setPrecios(p => ({ ...p, [id]: readNum(e.target.value) }))}
                    />
                    <em>/ hora</em>
                  </span>
                </label>
              );
            })}
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <div className="ob-actions">
            <button className="btn btn-secondary" onClick={() => setPaso(2)}>
              <Icon name="left" className="ic ic-sm" />Atrás
            </button>
            <button className="btn btn-primary" onClick={crear} disabled={enVuelo}>
              {enVuelo ? <><span className="spin" />Creando…</> : 'Crear mi plataforma'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
