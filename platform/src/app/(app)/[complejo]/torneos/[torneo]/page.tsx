import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirStaff } from '@/lib/tenant';
import { torneoPorId } from '@/lib/queries/comunidad';
import {
  roundsOf, standings, cleanSheets, podium, scorers, winnerOf,
  ROUND_LABEL, cupoById, type Partido, type Torneo
} from '@/lib/tournament';
import { SPORTS } from '@/lib/sports';
import { fmtDate, fmtDateLong, fmtHour } from '@/lib/util';
import { Icon } from '@/components/Icon';
import { Entra, Foco } from '@/components/ui/Motion';
import { LlaveInteractiva } from '@/components/app/torneos/Marcador';

export async function generateMetadata(
  { params }: { params: Promise<{ complejo: string; torneo: string }> }
): Promise<Metadata> {
  const { complejo, torneo } = await params;
  const s = await exigirStaff(complejo);
  const tn = await torneoPorId(s.complejo.id, torneo);
  return { title: tn?.nombre ?? 'Torneo' };
}

/* ==========================================================================
   VISTA · Un torneo

   Llaves donde los ganadores avanzan solos, calendario, tabla de
   posiciones, anotadores, valla menos vencida y podio.

   Las seis pestañas leen el MISMO torneo y lo derivan de formas distintas
   (R31): ni una de estas tablas está guardada en la base. Corregir un
   marcador a mitad del torneo las recalcula todas.
   ========================================================================== */

const PESTANAS = [
  { id: 'llaves',   label: 'Llaves' },
  { id: 'fixture',  label: 'Calendario' },
  { id: 'tabla',    label: 'Posiciones' },
  { id: 'goleador', label: 'Anotadores' },
  { id: 'valla',    label: 'Valla menos vencida' },
  { id: 'podio',    label: 'Podio' }
] as const;

type PestanaId = (typeof PESTANAS)[number]['id'];

export default async function TorneoPage({
  params,
  searchParams
}: {
  params: Promise<{ complejo: string; torneo: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const { complejo: slug, torneo: torneoId } = await params;
  const { ver } = await searchParams;
  const s = await exigirStaff(slug);

  const tn = await torneoPorId(s.complejo.id, torneoId);
  if (!tn) notFound();

  const pestana: PestanaId = PESTANAS.some(p => p.id === ver) ? (ver as PestanaId) : 'llaves';
  const sp = SPORTS[tn.deporte];
  const rondas = roundsOf(tn);
  const tercero = tn.partidos.find(m => m.ronda === 'tercero');

  const enlace = (p: PestanaId) => `/${slug}/torneos/${tn.id}?ver=${p}`;

  return (
    <Entra>
      <Foco />

      <LlaveInteractiva
        slug={slug}
        torneoId={tn.id}
        cupos={tn.cupos}
        partidos={tn.partidos}
        unidad={sp.unit}
        puedeSortear={s.dueno}
      >
        <header className="page-head">
          <div>
            <Link className="back" href={`/${slug}/torneos`}>
              <Icon name="left" className="ic ic-sm" />Torneos
            </Link>
            <p className="kicker">
              {sp.name} · {tn.tamano} equipos · desde {fmtDate(tn.fechaInicio)}
            </p>
            <h1 className="page-title">{tn.nombre}</h1>
          </div>
          {s.dueno && (
            <div className="page-tools">
              <button className="btn btn-secondary btn-sm" data-sortear="">
                <Icon name="swap" />Sortear cruces
              </button>
            </div>
          )}
        </header>

        <nav className="tabs" role="tablist">
          {PESTANAS.map(p => (
            <Link
              key={p.id}
              className={`tab${p.id === pestana ? ' is-on' : ''}`}
              href={enlace(p.id)}
              role="tab"
              aria-selected={p.id === pestana}
              scroll={false}
            >
              {p.label}
            </Link>
          ))}
        </nav>

        {pestana === 'llaves' && (
          <>
            <p className="pane-note">
              Toca cualquier partido para poner el marcador. Los ganadores avanzan solos.
            </p>
            <div className="bracket-wrap">
              <div className="bracket" style={{ '--rounds': rondas.length } as React.CSSProperties}>
                {rondas.map(r => (
                  <div className="br-col" key={r.key}>
                    <h3 className="br-title">{r.label}</h3>
                    <div className="br-slots">
                      {tn.partidos
                        .filter(m => m.ronda === r.key)
                        .sort((a, b) => a.idx - b.idx)
                        .map(m => <TarjetaPartido tn={tn} m={m} key={m.id} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* R23: siempre hay tercer puesto, alimentado por los perdedores
                de semifinal. No es una ronda de la llave; cuelga de ella. */}
            {tercero && (
              <div className="br-third">
                <h3 className="br-title">Tercer puesto</h3>
                <TarjetaPartido tn={tn} m={tercero} />
              </div>
            )}
          </>
        )}

        {pestana === 'fixture' && <Calendario tn={tn} />}

        {pestana === 'tabla' && (
          <>
            <p className="pane-note">
              Se ordena por puntos, luego diferencia, luego valla menos vencida.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="c">#</th>
                    <th>Equipo</th>
                    <th className="c">PJ</th><th className="c">G</th>
                    <th className="c">E</th><th className="c">P</th>
                    <th className="c">GF</th><th className="c">GC</th>
                    <th className="c">DIF</th><th className="c">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings(tn).map((r, i) => (
                    <tr className={i < 4 ? 'is-top' : ''} key={r.cupo.id}>
                      <td className="c num">{i + 1}</td>
                      <td>
                        <span className="tm">
                          <i className="br-chip" style={{ background: r.cupo.color }} />
                          {r.cupo.nombre}
                        </span>
                      </td>
                      <td className="c num">{r.pj}</td>
                      <td className="c num">{r.g}</td>
                      <td className="c num">{r.e}</td>
                      <td className="c num">{r.p}</td>
                      <td className="c num">{r.gf}</td>
                      <td className="c num">{r.gc}</td>
                      <td className={`c num ${r.dif > 0 ? 'ok' : r.dif < 0 ? 'neg' : ''}`}>
                        {r.dif > 0 ? '+' : ''}{r.dif}
                      </td>
                      <td className="c num strong">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {pestana === 'goleador' && <Anotadores tn={tn} unidad={sp.unit} />}

        {pestana === 'valla' && (
          <>
            <p className="pane-note">
              Menos {sp.unit} recibidos entre los que ya jugaron. Desempata más
              partidos jugados, luego más puntos.
            </p>
            <ol className="scorers">
              {cleanSheets(tn).map((r, i) => (
                <li className={`sc-row${i === 0 ? ' is-first' : ''}`} key={r.cupo.id}>
                  <span className="sc-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="sc-who">
                    <b>{r.cupo.nombre}</b>
                    <em>{r.pj} {r.pj === 1 ? 'partido' : 'partidos'}</em>
                  </span>
                  <span className="sc-track">
                    <i style={{
                      '--w': `${r.pj ? 100 - (r.gc / Math.max(1, r.gc + 3)) * 100 : 0}%`,
                      '--i': i
                    } as React.CSSProperties} />
                  </span>
                  <span className="sc-goals"><b>{r.gc}</b><em>recibidos</em></span>
                </li>
              ))}
              {!cleanSheets(tn).length && <li className="empty">Nadie ha jugado todavía</li>}
            </ol>
          </>
        )}

        {pestana === 'podio' && <Podio tn={tn} />}
      </LlaveInteractiva>
    </Entra>
  );
}

/* ── Piezas ──────────────────────────────────────────────────────────────── */

function TarjetaPartido({ tn, m }: { tn: Torneo; m: Partido }) {
  const A = cupoById(tn, m.cupoA);
  const B = cupoById(tn, m.cupoB);
  const gana = winnerOf(m);

  const Lado = ({ cupo, marcador, esGanador }: {
    cupo: typeof A; marcador: number | null; esGanador: boolean;
  }) => (
    <span className={`br-side${esGanador ? ' is-w' : ''}${cupo ? '' : ' is-tbd'}`}>
      <i className="br-chip" style={{ background: cupo?.color ?? 'var(--line-3)' }} />
      <b>{cupo?.nombre ?? 'Por definir'}</b>
      <em>{marcador ?? '–'}</em>
    </span>
  );

  return (
    <button className={`br-match${m.jugado ? ' is-played' : ''}`} data-match={m.id}>
      <Lado cupo={A} marcador={m.marcadorA} esGanador={!!gana && gana === m.cupoA} />
      <Lado cupo={B} marcador={m.marcadorB} esGanador={!!gana && gana === m.cupoB} />
      <span className="br-when">
        {m.fecha ? fmtDate(m.fecha) : 'Sin fecha'}
        {m.hora ? ` · ${fmtHour(m.hora)}` : ''}
      </span>
    </button>
  );
}

function Calendario({ tn }: { tn: Torneo }) {
  const porDia = new Map<string, Partido[]>();
  for (const m of tn.partidos) {
    const d = m.fecha ?? 'sin-fecha';
    porDia.set(d, [...(porDia.get(d) ?? []), m]);
  }

  const dias = [...porDia.keys()].sort();

  return (
    <>
      <p className="pane-note">
        Cada cuánto juegan y a qué hora. Toca para poner el marcador.
      </p>
      {dias.map(d => (
        <section className="fx-day" key={d}>
          <h3 className="fx-date">{d === 'sin-fecha' ? 'Sin fecha' : fmtDateLong(d)}</h3>
          <ul className="fx-list">
            {porDia.get(d)!
              .sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))
              .map(m => {
                const A = cupoById(tn, m.cupoA);
                const B = cupoById(tn, m.cupoB);
                const gana = winnerOf(m);
                return (
                  <li key={m.id}>
                    <button className={`fx-row${m.jugado ? ' is-played' : ''}`} data-match={m.id}>
                      <span className="fx-time">{m.hora ? fmtHour(m.hora) : '—'}</span>
                      <span className="fx-round">{ROUND_LABEL[m.ronda]}</span>
                      <span className="fx-teams">
                        <b className={gana === m.cupoA ? 'is-w' : ''}>
                          {A?.nombre ?? 'Por definir'}
                        </b>
                        <em>{m.jugado ? `${m.marcadorA} – ${m.marcadorB}` : 'vs'}</em>
                        <b className={gana === m.cupoB ? 'is-w' : ''}>
                          {B?.nombre ?? 'Por definir'}
                        </b>
                      </span>
                      <span className="fx-court">—</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </>
  );
}

function Anotadores({ tn, unidad }: { tn: Torneo; unidad: string }) {
  const filas = scorers(tn);
  const max = filas[0]?.goles || 1;

  return (
    <>
      <p className="pane-note">
        Quién ha hecho más {unidad}. Cada anotación es un hecho guardado en su
        partido, no un total: corregir un marcador no descuadra esta tabla.
      </p>
      <ol className="scorers">
        {filas.length ? filas.map((a, i) => {
          const cupo = tn.cupos.find(c => c.id === a.cupoId);
          return (
            <li className={`sc-row${i === 0 ? ' is-first' : ''}`} key={a.personaId ?? a.nombre}>
              <span className="sc-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="sc-who">
                <b>{a.nombre}</b>
                <em>
                  <i className="br-chip" style={{ background: cupo?.color ?? 'var(--line-3)' }} />
                  {cupo?.nombre ?? '—'}
                </em>
              </span>
              <span className="sc-track">
                <i style={{ '--w': `${(a.goles / max) * 100}%`, '--i': i } as React.CSSProperties} />
              </span>
              <span className="sc-goals"><b>{a.goles}</b><em>{unidad}</em></span>
            </li>
          );
        }) : <li className="empty">Todavía nadie anota</li>}
      </ol>
    </>
  );
}

function Podio({ tn }: { tn: Torneo }) {
  const p = podium(tn);
  const puestos = [
    { n: 2, cupo: p.plata, label: 'Subcampeón', clase: 'pod-2' },
    { n: 1, cupo: p.oro, label: 'Campeón', clase: 'pod-1' },
    { n: 3, cupo: p.bronce, label: 'Tercer puesto', clase: 'pod-3' }
  ];

  if (!p.oro) {
    return (
      <p className="empty-big">
        <span>El podio se llena cuando se juegue la final y el tercer puesto.</span>
      </p>
    );
  }

  return (
    <>
      <p className="pane-note">
        Oro para quien gana la final, plata para quien la pierde, bronce para
        quien gana el tercer puesto.
      </p>
      <div className="podium">
        {puestos.map(x => (
          <article className={`pod ${x.clase}`} key={x.n}>
            <span className="pod-n">{x.n}</span>
            <i className="br-chip" style={{ background: x.cupo?.color ?? 'var(--line-3)' }} />
            <h3 className="pod-name">{x.cupo?.nombre ?? 'Por definir'}</h3>
            <p className="pod-label">{x.label}</p>
          </article>
        ))}
      </div>
    </>
  );
}
