import type { Metadata } from 'next';
import Link from 'next/link';
import { resolverTenant } from '@/lib/tenant';
import { canchasActivas } from '@/lib/queries/canchas';
import { misReservas, franjasOcupadas } from '@/lib/queries/agenda';
import { equiposDe, plantillasDe, torneosDe } from '@/lib/queries/comunidad';
import { recordDeEquipo, proximoPartido } from '@/lib/records';
import { freeSlots } from '@/lib/tournament';
import {
  money, iso, today, fmtDate, fmtDateLong, fmtHour, hhmm, firstName, shortTime
} from '@/lib/util';
import { saldo } from '@/lib/types';
import { SPORTS } from '@/lib/sports';
import { PageHead } from '@/components/app/PageHead';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { Crest, Racha } from '@/components/Fichas';
import { Entra, Foco } from '@/components/ui/Motion';
import { AgendaEnVivo } from '@/components/app/Realtime';

export const metadata: Metadata = { title: 'Inicio' };

/* ==========================================================================
   JUGADOR · Inicio

   Lo que un jugador quiere saber al abrir: cuándo juego, con quién, y qué
   hay libre ahora mismo. Nada de métricas de negocio — eso es del dueño, y
   no es que se le oculte: es que no le sirve.

   Esta pantalla se mira casi siempre desde un celular, así que el orden es
   el de la mano: primero el próximo partido, luego lo que ya reservó, y al
   final lo que podría reservar.
   ========================================================================== */

export default async function InicioJugadorPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await resolverTenant(slug);
  const c = s.complejo;

  const hoy = today();
  const hoyISO = iso(hoy);
  const horaAhora = new Date().getHours();

  const [canchas, mias, equipos, plantillas, torneos, ocupadas] = await Promise.all([
    canchasActivas(c.id),
    misReservas(c.id, s.persona.id),
    equiposDe(c.id),
    plantillasDe(c.id),
    torneosDe(c.id),
    franjasOcupadas(c.id, hoyISO)
  ]);

  const misEquipos = equipos.filter(e =>
    plantillas.some(p => p.equipo_id === e.id && p.persona_id === s.persona.id));

  const proximo = misEquipos
    .map(e => ({ equipo: e, partido: proximoPartido(e.id, torneos, hoyISO) }))
    .filter(x => x.partido)[0];

  const futuras = mias
    .filter(r => r.fecha >= hoyISO)
    .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));
  const jugadas = mias.filter(r => r.fecha < hoyISO).length;

  const ahoraHHMM = hhmm(horaAhora);
  const libresAhora = canchas.filter(x => !ocupadas.get(x.id)?.has(ahoraHHMM));

  const abiertos = torneos.filter(tn => tn.inscripcionAbierta && freeSlots(tn) > 0);
  const dePorId = new Map(canchas.map(x => [x.id, x]));

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <Entra>
      <Foco />
      {/* El jugador también escucha: si el mostrador le cambia algo de su
          reserva mientras tiene la pantalla abierta, lo ve. */}
      <AgendaEnVivo complejoId={c.id} />

      <PageHead
        kicker={saludo}
        title={`Hola, ${firstName(s.persona.nombre)}`}
        sub={`${fmtDateLong(hoyISO)} · ${libresAhora.length} de ${canchas.length} canchas libres ahora`}
        tools={
          <Link className="btn btn-primary btn-sm" href={`/${slug}/j/reservar`}>
            <Icon name="plus" />Reservar cancha
          </Link>
        }
      />

      <section className="grid-2">
        {proximo?.partido ? (
          <article className="card card-next" data-anim>
            <header className="card-head">
              <h2>Tu próximo partido</h2>
              <p className="card-sub">{proximo.partido.torneo.nombre}</p>
            </header>
            <div className="next-match">
              <span className="next-side">
                <Crest equipo={proximo.equipo} className="crest--lg" />
                <b>{proximo.equipo.nombre}</b>
              </span>
              <span className="next-vs">VS</span>
              <span className="next-side">
                {proximo.partido.rival ? (
                  <Crest
                    equipo={{
                      nombre: proximo.partido.rival.nombre,
                      color: proximo.partido.rival.color,
                      escudo_url: null
                    }}
                    className="crest--lg"
                  />
                ) : null}
                <b>{proximo.partido.rival?.nombre ?? 'Por definir'}</b>
              </span>
            </div>
            <p className="next-when">
              <Icon name="cal" className="ic ic-sm" />
              {proximo.partido.partido.fecha
                ? fmtDateLong(proximo.partido.partido.fecha)
                : 'Sin fecha'}
              {proximo.partido.partido.hora ? ` · ${fmtHour(proximo.partido.partido.hora)}` : ''}
            </p>
          </article>
        ) : (
          <article className="card card-next is-empty" data-anim>
            <header className="card-head">
              <h2>Sin partidos programados</h2>
              <p className="card-sub">Inscribe tu equipo en un torneo y aparecerá aquí</p>
            </header>
            <Link className="btn btn-primary btn-sm" href={`/${slug}/j/torneos`}>
              <Icon name="trophy" />Ver torneos abiertos
            </Link>
          </article>
        )}

        <article className="card" data-anim>
          <header className="card-head">
            <h2>Tus reservas</h2>
            <p className="card-sub">
              {jugadas} {jugadas === 1 ? 'partido jugado' : 'partidos jugados'} aquí
            </p>
          </header>
          <ul className="list">
            {futuras.length ? futuras.slice(0, 4).map(r => {
              const cancha = dePorId.get(r.cancha_id);
              const debe = saldo(r);
              return (
                <li className="list-row" key={r.id}>
                  {cancha && <span className="list-ball"><Ball sport={cancha.deporte} /></span>}
                  <span className="list-main">
                    <b>{cancha?.nombre ?? 'Cancha'}</b>
                    <em>{fmtDate(r.fecha)} · {fmtHour(shortTime(r.inicio))}</em>
                  </span>
                  <span className="list-side">
                    <b>{money(r.total)}</b>
                    {debe > 0
                      ? <em className="tag tag-warn">debes {money(debe)}</em>
                      : <em className="tag tag-ok">pagada</em>}
                  </span>
                </li>
              );
            }) : <li className="empty">No tienes reservas próximas</li>}
          </ul>
        </article>
      </section>

      <section className="grid-2">
        <article className="card" data-anim>
          <header className="card-head">
            <h2>{misEquipos.length > 1 ? 'Tus equipos' : 'Tu equipo'}</h2>
            <p className="card-sub">Cómo van</p>
          </header>

          {misEquipos.length ? (
            <ul className="list">
              {misEquipos.map(e => {
                const r = recordDeEquipo(e.id, torneos);
                return (
                  <li className="list-row" key={e.id}>
                    <Crest equipo={e} className="crest--sm" />
                    <span className="list-main">
                      <b>{e.nombre}</b>
                      <em>
                        {r.pj} jugados · {r.g}G {r.e}E {r.p}P
                        {r.titulos.length
                          ? ` · ${r.titulos.length} título${r.titulos.length > 1 ? 's' : ''}`
                          : ''}
                      </em>
                    </span>
                    <span className="list-side"><Racha racha={r.racha} /></span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-inline">
              <p>Todavía no tienes equipo.</p>
              <Link className="btn btn-primary btn-sm" href={`/${slug}/j/equipo`}>
                <Icon name="shield" />Crear mi equipo
              </Link>
            </div>
          )}
        </article>

        <article className="card" data-anim>
          <header className="card-head">
            <h2>Libre ahora mismo</h2>
            <p className="card-sub">A las {fmtHour(ahoraHHMM)}</p>
          </header>
          <ul className="free-now">
            {libresAhora.length ? libresAhora.slice(0, 6).map(x => (
              <li key={x.id}>
                <Link
                  className="free-chip"
                  href={`/${slug}/j/reservar?deporte=${x.deporte}&dia=${hoyISO}&cancha=${x.id}`}
                >
                  <Ball sport={x.deporte} className="pill-ball" />
                  <span><b>{x.nombre}</b><em>{money(x.precio)}/h</em></span>
                  <Icon name="right" className="ic ic-sm" />
                </Link>
              </li>
            )) : <li className="empty">Todo ocupado en este momento</li>}
          </ul>
        </article>
      </section>

      {!!abiertos.length && (
        <section className="card card-cta" data-anim>
          <div>
            <p className="kicker">Inscripciones abiertas</p>
            <h2>{abiertos[0].nombre}</h2>
            <p className="cta-sub">
              {SPORTS[abiertos[0].deporte].name} · arranca el {fmtDate(abiertos[0].fechaInicio)} ·
              quedan <b>{freeSlots(abiertos[0])}</b> cupos
            </p>
          </div>
          <Link className="btn btn-primary" href={`/${slug}/j/torneos`}>
            <Icon name="trophy" />Inscribir mi equipo
          </Link>
        </section>
      )}
    </Entra>
  );
}
