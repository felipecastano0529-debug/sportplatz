import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirStaff } from '@/lib/tenant';
import { equiposDe, plantillasDe, personasDe, torneosDe } from '@/lib/queries/comunidad';
import {
  recordDeEquipo, recordDeJugador, golesDePersona,
  goleadoresHistoricos, tablaDeEquipos
} from '@/lib/records';
import { SPORTS, esDeporte, type SportId } from '@/lib/sports';
import { PageHead } from '@/components/app/PageHead';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { Crest, TeamCard, PlayerCard, TeamSheet, Historial, Avatar, Racha } from '@/components/Fichas';
import { Ring } from '@/components/Chart';
import { AbridorDeFichas } from '@/components/app/equipos/Fichas';
import { Entra, Foco } from '@/components/ui/Motion';
import type { Persona } from '@/lib/types';

export const metadata: Metadata = { title: 'Equipos' };

/* ==========================================================================
   VISTA · Equipos (lado del dueño)

   El directorio del complejo: qué clubes juegan aquí, quiénes son sus
   jugadores y quién manda en el salón de la fama.

   Todo lo que se ve aquí —récord, racha, títulos, goleadores— se DERIVA de
   los partidos (R31). No hay ni una columna acumulada en la base, así que
   corregir un marcador a mitad de un torneo actualiza este directorio entero
   sin tocar nada más.
   ========================================================================== */

const PESTANAS = [
  { id: 'equipos',   label: 'Equipos' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'fama',      label: 'Salón de la fama' }
] as const;

type PestanaId = (typeof PESTANAS)[number]['id'];

export default async function EquiposPage({
  params,
  searchParams
}: {
  params: Promise<{ complejo: string }>;
  searchParams: Promise<{ ver?: string; deporte?: string }>;
}) {
  const { complejo: slug } = await params;
  const { ver, deporte } = await searchParams;
  const s = await exigirStaff(slug);
  const c = s.complejo;

  const pestana: PestanaId =
    PESTANAS.some(p => p.id === ver) ? (ver as PestanaId) : 'equipos';
  const filtro: SportId | 'all' = deporte && esDeporte(deporte) ? deporte : 'all';

  const [equipos, plantillas, personas, torneos] = await Promise.all([
    equiposDe(c.id),
    plantillasDe(c.id),
    personasDe(c.id),
    torneosDe(c.id)
  ]);

  const deportes = [...new Set(equipos.map(e => e.deporte))] as SportId[];
  const visibles = equipos.filter(e => filtro === 'all' || e.deporte === filtro);

  const porEquipo = new Map<string, { persona: Persona; posicion: string | null }[]>();
  const porPersona = new Map<string, string[]>();
  const dePersona = new Map(personas.map(p => [p.id, p]));

  for (const pl of plantillas) {
    const persona = pl.personas ? dePersona.get(pl.personas.id) : undefined;
    if (!persona) continue;
    const lista = porEquipo.get(pl.equipo_id) ?? [];
    lista.push({ persona, posicion: pl.posicion });
    porEquipo.set(pl.equipo_id, lista);

    const mios = porPersona.get(persona.id) ?? [];
    mios.push(pl.equipo_id);
    porPersona.set(persona.id, mios);
  }

  const golesDe = (personaId: string) => golesDePersona(personaId, torneos).total;

  // Las fichas se renderizan en el servidor y viajan ya listas: abrir una no
  // dispara una consulta, y el diálogo aparece en el mismo frame del clic.
  const fichas: Record<string, { titulo: string; contenido: React.ReactNode }> = {};

  for (const e of equipos) {
    fichas[e.id] = {
      titulo: e.nombre,
      contenido: (
        <TeamSheet
          equipo={e}
          record={recordDeEquipo(e.id, torneos)}
          plantilla={porEquipo.get(e.id) ?? []}
          capitanId={e.capitan_id}
          golesDe={golesDe}
        />
      )
    };
  }

  for (const p of personas) {
    const misEquipos = porPersona.get(p.id) ?? [];
    const r = recordDeJugador(p.id, misEquipos, torneos);
    const sp = SPORTS[equipos.find(e => e.id === misEquipos[0])?.deporte ?? 'futbol'];

    fichas[p.id] = {
      titulo: p.nombre,
      contenido: (
        <div className="sheet">
          <header className="sheet-head">
            <Avatar persona={p} className="avatar--xl" />
            <div className="sheet-id">
              <p className="kicker">Jugador · desde {p.creado_en.slice(0, 10)}</p>
              <h2 className="sheet-name">{p.nombre}</h2>
              <Racha racha={r.racha} />
            </div>
            <div className="sheet-ring">
              <Ring pct={r.pj ? r.g / r.pj : 0} size={66} stroke={6} />
              <span className="sheet-ring-v">
                <b>{r.pj ? Math.round((r.g / r.pj) * 100) : 0}%</b>
                <em>victorias</em>
              </span>
            </div>
          </header>

          <dl className="sheet-facts">
            <div><dt>Partidos</dt><dd>{r.pj}</dd></div>
            <div><dt>Ganados</dt><dd className="ok">{r.g}</dd></div>
            <div><dt>Perdidos</dt><dd className="neg">{r.p}</dd></div>
            <div>
              <dt>{sp.unit[0].toUpperCase() + sp.unit.slice(1)}</dt>
              <dd className="strong">{r.goles}</dd>
            </div>
            <div><dt>Por partido</dt><dd>{r.porPartido.toFixed(2)}</dd></div>
            <div><dt>Títulos</dt><dd>{r.titulos.length}</dd></div>
          </dl>

          <section className="sheet-block">
            <h3>Equipos <em>{misEquipos.length}</em></h3>
            <ul className="team-chips">
              {misEquipos.length ? misEquipos.map(id => {
                const e = equipos.find(x => x.id === id);
                if (!e) return null;
                return (
                  <li key={id}>
                    <span className="team-chip">
                      <Crest equipo={e} className="crest--sm" />
                      <b>{e.nombre}</b>
                      <em>{SPORTS[e.deporte].short}</em>
                    </span>
                  </li>
                );
              }) : <li className="empty">Todavía no pertenece a ningún equipo</li>}
            </ul>
          </section>

          <section className="sheet-block">
            <h3>Sus partidos <em>{r.filas.length}</em></h3>
            <Historial filas={r.filas} />
          </section>
        </div>
      )
    };
  }

  const enlace = (p: PestanaId, dep: string) =>
    `/${slug}/equipos?ver=${p}${dep === 'all' ? '' : `&deporte=${dep}`}`;

  const clubes = tablaDeEquipos(equipos.map(e => ({ id: e.id, nombre: e.nombre })), torneos, 8);
  const artilleros = goleadoresHistoricos(torneos, 8);
  const dePorId = new Map(equipos.map(e => [e.id, e]));

  return (
    <Entra>
      <Foco />

      <AbridorDeFichas fichas={fichas}>
        <PageHead
          kicker="Comunidad"
          title="Equipos y jugadores"
          sub={`${equipos.length} equipos · ${personas.length} jugadores registrados`}
        />

        <nav className="tabs" role="tablist">
          {PESTANAS.map(p => (
            <Link
              key={p.id}
              className={`tab${p.id === pestana ? ' is-on' : ''}`}
              href={enlace(p.id, filtro)}
              role="tab"
              aria-selected={p.id === pestana}
              scroll={false}
            >
              {p.label}
            </Link>
          ))}
        </nav>

        {pestana === 'equipos' && (
          <>
            {deportes.length > 1 && (
              <div className="filters">
                <Link className={`pill${filtro === 'all' ? ' is-on' : ''}`} href={enlace('equipos', 'all')} scroll={false}>
                  Todos
                </Link>
                {deportes.map(id => (
                  <Link
                    key={id}
                    className={`pill${filtro === id ? ' is-on' : ''}`}
                    href={enlace('equipos', id)}
                    scroll={false}
                  >
                    <Ball sport={id} className="pill-ball" />
                    {SPORTS[id].short}
                  </Link>
                ))}
              </div>
            )}

            <div className="team-grid">
              {visibles.length ? visibles.map((e, i) => (
                <TeamCard
                  key={e.id}
                  equipo={e}
                  record={recordDeEquipo(e.id, torneos)}
                  plantilla={(porEquipo.get(e.id) ?? []).length}
                  i={i}
                />
              )) : (
                <div className="empty-big">
                  <p>
                    {equipos.length
                      ? 'Ningún equipo de ese deporte todavía.'
                      : 'Todavía no hay equipos en tu complejo. Los crean los jugadores desde su lado, o tú al armar un torneo.'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {pestana === 'jugadores' && (
          <>
            <p className="pane-note">
              Cada jugador con cuenta lleva su propio histórico entre todos los torneos.
            </p>
            <div className="pl-grid">
              {personas.length ? personas.map((p, i) => {
                const misEquipos = porPersona.get(p.id) ?? [];
                const r = recordDeJugador(p.id, misEquipos, torneos);
                return (
                  <PlayerCard
                    key={p.id}
                    persona={p}
                    pj={r.pj}
                    ganados={r.g}
                    goles={r.goles}
                    equipo={dePorId.get(misEquipos[0])?.nombre}
                    i={i}
                  />
                );
              }) : <p className="empty">Nadie se ha registrado todavía</p>}
            </div>
          </>
        )}

        {pestana === 'fama' && (
          <>
            <p className="pane-note">
              Acumulado histórico de todos los torneos jugados en el complejo.
            </p>
            <div className="grid-2">
              <article className="card">
                <header className="card-head">
                  <h2>Clubes</h2>
                  <p className="card-sub">Por títulos, luego puntos</p>
                </header>
                <ul className="rank">
                  {clubes.length ? clubes.map((r, i) => {
                    const e = dePorId.get(r.equipo.id)!;
                    return (
                      <li className="rank-row" key={r.equipo.id} data-team={r.equipo.id} tabIndex={0} role="button">
                        <span className="rank-n">{String(i + 1).padStart(2, '0')}</span>
                        <Crest equipo={e} className="crest--sm" />
                        <span className="rank-name">{r.equipo.nombre}</span>
                        <span className="rank-track">
                          <span
                            className="rank-fill"
                            style={{
                              '--w': `${(r.pts / (clubes[0]?.pts || 1)) * 100}%`,
                              '--i': i
                            } as React.CSSProperties}
                          />
                        </span>
                        <span className="rank-val">
                          {r.titulos.length
                            ? <>{r.titulos.length} <Icon name="trophy" className="ic ic-sm" /></>
                            : `${r.pts} pts`}
                        </span>
                      </li>
                    );
                  }) : <li className="empty">Sin partidos jugados todavía</li>}
                </ul>
              </article>

              <article className="card">
                <header className="card-head">
                  <h2>Máximos anotadores</h2>
                  <p className="card-sub">Entre todos los torneos</p>
                </header>
                <ol className="scorers">
                  {artilleros.length ? artilleros.map((a, i) => (
                    <li
                      className={`sc-row${i === 0 ? ' is-first' : ''}`}
                      key={a.personaId ?? a.nombre}
                      data-player={a.personaId ?? undefined}
                      tabIndex={a.personaId ? 0 : undefined}
                      role={a.personaId ? 'button' : undefined}
                    >
                      <span className="sc-n">{String(i + 1).padStart(2, '0')}</span>
                      <span className="sc-who">
                        <b>{a.nombre}</b>
                        <em>{a.torneos} {a.torneos === 1 ? 'torneo' : 'torneos'}</em>
                      </span>
                      <span className="sc-track">
                        <i style={{
                          '--w': `${(a.goles / (artilleros[0]?.goles || 1)) * 100}%`,
                          '--i': i
                        } as React.CSSProperties} />
                      </span>
                      <span className="sc-goals"><b>{a.goles}</b><em>anotó</em></span>
                    </li>
                  )) : <li className="empty">Nadie ha anotado todavía</li>}
                </ol>
              </article>
            </div>
          </>
        )}
      </AbridorDeFichas>
    </Entra>
  );
}
