import type { Metadata } from 'next';
import { resolverTenant } from '@/lib/tenant';
import { equiposDe, plantillasDe, torneosDe } from '@/lib/queries/comunidad';
import { canchasDe } from '@/lib/queries/canchas';
import { misReservas } from '@/lib/queries/agenda';
import { recordDeJugador } from '@/lib/records';
import { money, iso, today, fmtDate, fmtHour, shortTime } from '@/lib/util';
import { SPORTS } from '@/lib/sports';
import { PageHead } from '@/components/app/PageHead';
import { Avatar, Racha, Crest, Historial } from '@/components/Fichas';
import { Ring } from '@/components/Chart';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { Entra, Foco } from '@/components/ui/Motion';

export const metadata: Metadata = { title: 'Mi histórico' };

/* ==========================================================================
   JUGADOR · Mi histórico

   Partidos, anotaciones, títulos, equipos y en qué canchas juega más.

   NADA de esto se guarda (R31). Todo sale de los partidos y de las reservas
   en tiempo de lectura: si el complejo corrige un marcador de hace tres
   meses, esta pantalla lo refleja sin que nadie recalcule un total.
   ========================================================================== */

export default async function HistorialPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await resolverTenant(slug);
  const c = s.complejo;

  const hoyISO = iso(today());

  const [equipos, plantillas, torneos, canchas, reservas] = await Promise.all([
    equiposDe(c.id),
    plantillasDe(c.id),
    torneosDe(c.id),
    canchasDe(c.id),
    misReservas(c.id, s.persona.id)
  ]);

  const misEquipos = equipos.filter(e =>
    plantillas.some(p => p.equipo_id === e.id && p.persona_id === s.persona.id));

  const r = recordDeJugador(s.persona.id, misEquipos.map(e => e.id), torneos);

  const jugadas = reservas.filter(x => x.fecha < hoyISO);
  const gastado = jugadas.reduce((a, x) => a + x.abonado, 0);

  // En qué canchas juega más. Se deriva de sus reservas: es lo que hace que
  // el complejo pueda decirle "tu cancha" sin que nadie lo haya marcado.
  const porCancha = new Map<string, number>();
  for (const x of jugadas) porCancha.set(x.cancha_id, (porCancha.get(x.cancha_id) ?? 0) + 1);

  const dePorId = new Map(canchas.map(x => [x.id, x]));
  const ranking = [...porCancha.entries()]
    .map(([id, n]) => ({ cancha: dePorId.get(id), n }))
    .filter(x => x.cancha)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  const sp = SPORTS[misEquipos[0]?.deporte ?? canchas[0]?.deporte ?? 'futbol'];
  const tope = ranking[0]?.n || 1;

  return (
    <Entra>
      <Foco />

      <PageHead
        kicker="Tus números"
        title="Mi histórico"
        sub={`Todo lo que llevas jugado en ${c.nombre}`}
      />

      <article className="card card-wide" data-anim>
        <div className="sheet">
          <header className="sheet-head">
            <Avatar persona={s.persona} className="avatar--xl" />
            <div className="sheet-id">
              <p className="kicker">
                {misEquipos.length
                  ? misEquipos.map(e => e.nombre).join(' · ')
                  : 'Todavía sin equipo'}
              </p>
              <h2 className="sheet-name">{s.persona.nombre}</h2>
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
            <div><dt>Empatados</dt><dd>{r.e}</dd></div>
            <div><dt>Perdidos</dt><dd className="neg">{r.p}</dd></div>
            <div>
              <dt>{sp.unit[0].toUpperCase() + sp.unit.slice(1)}</dt>
              <dd className="strong">{r.goles}</dd>
            </div>
            <div><dt>Por partido</dt><dd>{r.porPartido.toFixed(2)}</dd></div>
            <div><dt>Títulos</dt><dd className="strong">{r.titulos.length}</dd></div>
            <div><dt>Reservas</dt><dd>{jugadas.length}</dd></div>
          </dl>

          {!!r.titulos.length && (
            <p className="sheet-titles">
              <Icon name="trophy" className="ic ic-sm" />
              {r.titulos.map((t, i) => (
                <span key={t.id}>{i > 0 && ' · '}<b>{t.nombre}</b></span>
              ))}
            </p>
          )}
        </div>
      </article>

      <section className="grid-2">
        <article className="card" data-anim>
          <header className="card-head">
            <h2>Tus partidos</h2>
            <p className="card-sub">De torneo, del más reciente al más viejo</p>
          </header>
          <Historial filas={r.filas} />
        </article>

        <article className="card" data-anim>
          <header className="card-head">
            <h2>Dónde juegas más</h2>
            <p className="card-sub">
              {jugadas.length
                ? `${jugadas.length} ${jugadas.length === 1 ? 'reserva jugada' : 'reservas jugadas'} · ${money(gastado)} pagados`
                : 'Todavía sin reservas jugadas'}
            </p>
          </header>

          <ul className="rank">
            {ranking.length ? ranking.map((x, i) => (
              <li className="rank-row" key={x.cancha!.id}>
                <span className="rank-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="rank-ball"><Ball sport={x.cancha!.deporte} /></span>
                <span className="rank-name">{x.cancha!.nombre}</span>
                <span className="rank-track">
                  <span
                    className="rank-fill"
                    style={{ '--w': `${(x.n / tope) * 100}%`, '--i': i } as React.CSSProperties}
                  />
                </span>
                <span className="rank-val">{x.n} {x.n === 1 ? 'vez' : 'veces'}</span>
              </li>
            )) : <li className="empty">Reserva tu primera cancha y aparece aquí</li>}
          </ul>
        </article>
      </section>

      <section className="grid-2">
        <article className="card" data-anim>
          <header className="card-head">
            <h2>Tus equipos</h2>
            <p className="card-sub">{misEquipos.length || 'Ninguno'} </p>
          </header>
          <ul className="team-chips">
            {misEquipos.length ? misEquipos.map(e => (
              <li key={e.id}>
                <span className="team-chip">
                  <Crest equipo={e} className="crest--sm" />
                  <b>{e.nombre}</b>
                  <em>{SPORTS[e.deporte].short}</em>
                </span>
              </li>
            )) : <li className="empty">Todavía no perteneces a ningún equipo</li>}
          </ul>
        </article>

        <article className="card" data-anim>
          <header className="card-head">
            <h2>Reservas anteriores</h2>
            <p className="card-sub">Las últimas que jugaste</p>
          </header>
          <ul className="list">
            {jugadas.length ? jugadas.slice(0, 8).map(x => {
              const cancha = dePorId.get(x.cancha_id);
              return (
                <li className="list-row" key={x.id}>
                  {cancha && <span className="list-ball"><Ball sport={cancha.deporte} /></span>}
                  <span className="list-main">
                    <b>{cancha?.nombre ?? 'Cancha'}</b>
                    <em>{fmtDate(x.fecha)} · {fmtHour(shortTime(x.inicio))}</em>
                  </span>
                  <span className="list-side">
                    <b>{money(x.total)}</b>
                    <em className="mono">{x.codigo}</em>
                  </span>
                </li>
              );
            }) : <li className="empty">Todavía no has jugado aquí</li>}
          </ul>
        </article>
      </section>
    </Entra>
  );
}
