import { initials, fmtDate } from '@/lib/util';
import { SPORTS } from '@/lib/sports';
import { Ball } from './Ball';
import { Ring } from './Chart';
import { Icon } from './Icon';
import type { Resultado, RecordEquipo, FilaHistorial } from '@/lib/records';
import type { Equipo, Persona } from '@/lib/types';

/* ==========================================================================
   UI · Fichas de equipo y de jugador

   Las miran los dos roles: el dueño desde su directorio y el jugador desde
   su histórico. Por eso viven aquí y no dentro de una vista.

   Todo lo que muestran se deriva de los partidos; no hay ni un total
   guardado (R31). Corregir un marcador actualiza la ficha sin tocar nada
   más — eso es lo que compra la regla.
   ========================================================================== */

const NOMBRE_RESULTADO: Record<Resultado, string> = {
  G: 'Ganó', E: 'Empató', P: 'Perdió'
};

/**
 * La racha se lee de izquierda a derecha como una línea de tiempo: el más
 * viejo primero (R34). Cada resultado es una letra sobre su color, no un
 * emoji — así se distingue también en escala de grises.
 */
export function Racha({ racha }: { racha: Resultado[] }) {
  if (!racha.length) return <span className="racha racha--empty">sin partidos</span>;
  return (
    <span className="racha">
      {racha.map((r, i) => (
        <i className={`ra ra--${r}`} title={NOMBRE_RESULTADO[r]} key={i}>{r}</i>
      ))}
    </span>
  );
}

/**
 * Un equipo sin escudo NO muestra un cuadro gris: muestra su inicial sobre
 * su color, con el corte de escudo real (R38). Se lee como identidad, no
 * como hueco esperando contenido.
 */
export function Crest({
  equipo,
  className = ''
}: {
  equipo: Pick<Equipo, 'nombre' | 'color' | 'escudo_url'>;
  className?: string;
}) {
  if (equipo.escudo_url) {
    return (
      <span className={`crest ${className}`.trim()} style={{ '--tc': equipo.color } as React.CSSProperties}>
        <img src={equipo.escudo_url} alt="" loading="lazy" />
      </span>
    );
  }

  return (
    <span
      className={`crest crest--drawn ${className}`.trim()}
      style={{ '--tc': equipo.color } as React.CSSProperties}
    >
      <svg viewBox="0 0 40 44" aria-hidden="true">
        <path d="M20 1.5 37.5 7v17.5C37.5 33.6 30 40.5 20 42.5 10 40.5 2.5 33.6 2.5 24.5V7L20 1.5Z" />
      </svg>
      <b>{initials(equipo.nombre) || '?'}</b>
    </span>
  );
}

export function Avatar({
  persona,
  className = ''
}: {
  persona?: Pick<Persona, 'nombre' | 'color' | 'avatar_url'> | null;
  className?: string;
}) {
  const color = persona?.color ?? 'var(--accent)';

  if (persona?.avatar_url) {
    return (
      <span
        className={`avatar ${className} avatar--img`.trim()}
        style={{ '--tc': color } as React.CSSProperties}
      >
        <img src={persona.avatar_url} alt="" loading="lazy" />
      </span>
    );
  }

  return (
    <span className={`avatar ${className}`.trim()} style={{ '--tc': color } as React.CSSProperties}>
      {initials(persona?.nombre ?? '?')}
    </span>
  );
}

/* ── Tarjeta compacta de equipo ──────────────────────────────────────────── */

export function TeamCard({
  equipo,
  record,
  plantilla,
  i = 0,
  onAbrir
}: {
  equipo: Equipo;
  record: RecordEquipo;
  plantilla: number;
  i?: number;
  onAbrir?: string;
}) {
  const sp = SPORTS[equipo.deporte];

  return (
    <article
      className="team-card"
      data-anim
      data-team={onAbrir ?? equipo.id}
      style={{ '--i': i } as React.CSSProperties}
      tabIndex={0}
      role="button"
    >
      <span className="team-bg"><Ball sport={equipo.deporte} /></span>
      <Crest equipo={equipo} className="crest--lg" />
      <h2 className="team-name">{equipo.nombre}</h2>
      <p className="team-meta">
        {sp.short} · {plantilla} {plantilla === 1 ? 'jugador' : 'jugadores'}
      </p>
      <Racha racha={record.racha} />
      <dl className="team-facts">
        <div><dt>PJ</dt><dd>{record.pj}</dd></div>
        <div><dt>G</dt><dd className="ok">{record.g}</dd></div>
        <div>
          <dt>DIF</dt>
          <dd className={record.dif > 0 ? 'ok' : record.dif < 0 ? 'neg' : ''}>
            {record.dif > 0 ? '+' : ''}{record.dif}
          </dd>
        </div>
        <div><dt>Títulos</dt><dd className="strong">{record.titulos.length}</dd></div>
      </dl>
    </article>
  );
}

/* ── Tarjeta compacta de jugador ─────────────────────────────────────────── */

export function PlayerCard({
  persona,
  pj,
  ganados,
  goles,
  equipo,
  i = 0
}: {
  persona: Persona;
  pj: number;
  ganados: number;
  goles: number;
  equipo?: string;
  i?: number;
}) {
  return (
    <article
      className="pl-card"
      data-anim
      data-player={persona.id}
      style={{ '--i': i } as React.CSSProperties}
      tabIndex={0}
      role="button"
    >
      <Avatar persona={persona} className="avatar--lg" />
      <h2 className="pl-name">{persona.nombre}</h2>
      <p className="pl-meta">Jugador{equipo ? ` · ${equipo}` : ''}</p>
      <dl className="pl-facts">
        <div><dt>PJ</dt><dd>{pj}</dd></div>
        <div><dt>Anotó</dt><dd className="strong">{goles}</dd></div>
        <div><dt>Ganó</dt><dd className="ok">{ganados}</dd></div>
      </dl>
    </article>
  );
}

/* ── Ficha completa de equipo ────────────────────────────────────────────── */

export function TeamSheet({
  equipo,
  record,
  plantilla,
  capitanId,
  golesDe
}: {
  equipo: Equipo;
  record: RecordEquipo;
  plantilla: { persona: Persona; posicion: string | null }[];
  capitanId: string | null;
  golesDe: (personaId: string) => number;
}) {
  const sp = SPORTS[equipo.deporte];

  return (
    <div className="sheet" data-sport={equipo.deporte}>
      <header className="sheet-head">
        <Crest equipo={equipo} className="crest--xl" />
        <div className="sheet-id">
          <p className="kicker">{sp.name} · desde {fmtDate(equipo.creado_en.slice(0, 10))}</p>
          <h2 className="sheet-name">{equipo.nombre}</h2>
          <Racha racha={record.racha} />
        </div>
        <div className="sheet-ring">
          <Ring pct={record.efectividad} size={66} stroke={6} />
          <span className="sheet-ring-v">
            <b>{(record.efectividad * 100).toFixed(0)}%</b>
            <em>efectividad</em>
          </span>
        </div>
      </header>

      <dl className="sheet-facts">
        <div><dt>Jugados</dt><dd>{record.pj}</dd></div>
        <div><dt>Ganados</dt><dd className="ok">{record.g}</dd></div>
        <div><dt>Empatados</dt><dd>{record.e}</dd></div>
        <div><dt>Perdidos</dt><dd className="neg">{record.p}</dd></div>
        <div><dt>A favor</dt><dd>{record.gf}</dd></div>
        <div><dt>En contra</dt><dd>{record.gc}</dd></div>
        <div>
          <dt>Diferencia</dt>
          <dd className={record.dif > 0 ? 'ok' : record.dif < 0 ? 'neg' : ''}>
            {record.dif > 0 ? '+' : ''}{record.dif}
          </dd>
        </div>
        <div><dt>Títulos</dt><dd className="strong">{record.titulos.length}</dd></div>
      </dl>

      {!!record.titulos.length && (
        <p className="sheet-titles">
          <Icon name="trophy" className="ic ic-sm" />
          {record.titulos.map((t, i) => (
            <span key={t.id}>{i > 0 && ' · '}<b>{t.nombre}</b></span>
          ))}
        </p>
      )}

      <section className="sheet-block">
        <h3>
          Plantilla <em>{plantilla.length} {plantilla.length === 1 ? 'jugador' : 'jugadores'}</em>
        </h3>
        <ul className="roster">
          {plantilla.length ? plantilla.map(({ persona, posicion }) => (
            <li className="roster-row" key={persona.id} data-player={persona.id} tabIndex={0} role="button">
              <Avatar persona={persona} className="avatar--sm" />
              <span className="roster-main">
                <b>{persona.nombre}</b>
                <em>{posicion || sp.name}</em>
              </span>
              {persona.id === capitanId && <span className="tag tag-cap">Capitán</span>}
              <span className="roster-g">
                <b>{golesDe(persona.id)}</b>
                <em>{sp.unit}</em>
              </span>
            </li>
          )) : <li className="empty">Todavía no hay nadie en la plantilla</li>}
        </ul>
      </section>

      <section className="sheet-block">
        <h3>Histórico de partidos <em>{record.filas.length}</em></h3>
        <Historial filas={record.filas} />
      </section>
    </div>
  );
}

export function Historial({ filas, limite = 24 }: { filas: FilaHistorial[]; limite?: number }) {
  if (!filas.length) return <ul className="hist"><li className="empty">Todavía no ha jugado</li></ul>;

  return (
    <ul className="hist">
      {filas.slice(0, limite).map(x => (
        <li className={`hist-row hist--${x.resultado}`} key={x.partido.id}>
          <span className="hist-res">{x.resultado}</span>
          <span className="hist-main">
            <b>{x.rival?.nombre ?? 'Por definir'}</b>
            <em>
              {x.torneo.nombre} · {x.rondaLabel}
              {x.partido.fecha ? ` · ${fmtDate(x.partido.fecha)}` : ''}
            </em>
          </span>
          <span className="hist-score">{x.gf}<i>–</i>{x.gc}</span>
        </li>
      ))}
    </ul>
  );
}
