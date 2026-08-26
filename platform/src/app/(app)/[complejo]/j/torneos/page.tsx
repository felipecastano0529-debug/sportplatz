import type { Metadata } from 'next';
import { resolverTenant } from '@/lib/tenant';
import { torneosDe, equiposDe, plantillasDe } from '@/lib/queries/comunidad';
import { podium, freeSlots, standings, cupoById } from '@/lib/tournament';
import { SPORTS } from '@/lib/sports';
import { fmtDate, fmtHour } from '@/lib/util';
import { PageHead } from '@/components/app/PageHead';
import { Icon } from '@/components/Icon';
import { Entra, Foco } from '@/components/ui/Motion';
import { InscribirEquipo } from '@/components/app/jugador/Inscribir';
import type { Torneo } from '@/lib/tournament';

export const metadata: Metadata = { title: 'Torneos' };

/* ==========================================================================
   JUGADOR · Torneos

   Ver los que hay, meter su equipo en un cupo libre, seguir la llave.

   La diferencia con la vista del dueño no es de permisos: el dueño organiza
   y el jugador participa. Por eso aquí lo primero es «¿puedo entrar?» y
   «¿cuándo juego?», no «¿cuántos partidos van?».
   ========================================================================== */

export default async function TorneosJugadorPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await resolverTenant(slug);
  const c = s.complejo;

  const [torneos, equipos, plantillas] = await Promise.all([
    torneosDe(c.id),
    equiposDe(c.id),
    plantillasDe(c.id)
  ]);

  const mios = new Set(
    equipos
      .filter(e => plantillas.some(p => p.equipo_id === e.id && p.persona_id === s.persona.id))
      .map(e => e.id)
  );
  const capitaneo = equipos.filter(e => e.capitan_id === s.persona.id);

  const abiertos = torneos.filter(tn => tn.inscripcionAbierta && freeSlots(tn) > 0);
  const resto = torneos.filter(tn => !abiertos.includes(tn));

  return (
    <Entra>
      <Foco />

      <PageHead
        kicker="Competencias"
        title="Torneos"
        sub={
          abiertos.length
            ? `${abiertos.length} con inscripción abierta`
            : `${torneos.length} ${torneos.length === 1 ? 'torneo' : 'torneos'} en ${c.nombre}`
        }
      />

      {!torneos.length && (
        <div className="empty-big">
          <p>Todavía no hay torneos en {c.nombre}. Cuando abran uno, aparece aquí.</p>
        </div>
      )}

      {!!abiertos.length && (
        <>
          <p className="pane-note">
            Estos aceptan equipos. Tu equipo entra en el primer cupo libre.
          </p>
          {abiertos.map(tn => {
            const libres = freeSlots(tn);
            const yaEstoy = tn.cupos.some(x => x.equipoId && mios.has(x.equipoId));
            const candidatos = capitaneo.filter(
              e => e.deporte === tn.deporte && !tn.cupos.some(x => x.equipoId === e.id)
            );

            return (
              <section className="card card-cta" data-anim key={tn.id}>
                <div>
                  <p className="kicker">
                    {SPORTS[tn.deporte].name} · {tn.tamano} equipos
                  </p>
                  <h2>{tn.nombre}</h2>
                  <p className="cta-sub">
                    Arranca el {fmtDate(tn.fechaInicio)} · quedan <b>{libres}</b>{' '}
                    {libres === 1 ? 'cupo' : 'cupos'}
                  </p>
                </div>

                {yaEstoy ? (
                  <p className="tag tag-ok">Tu equipo ya está dentro</p>
                ) : (
                  <InscribirEquipo
                    slug={slug}
                    torneoId={tn.id}
                    torneoNombre={tn.nombre}
                    cupos={libres}
                    candidatos={candidatos}
                  />
                )}
              </section>
            );
          })}
        </>
      )}

      {resto.map(tn => <TorneoResumen tn={tn} mios={mios} key={tn.id} />)}
    </Entra>
  );
}

/**
 * Un torneo en el que ya no se puede entrar. Lo que le importa a quien lo
 * mira: si su equipo está dentro, cómo va la tabla y cuándo es el próximo
 * partido suyo.
 */
function TorneoResumen({ tn, mios }: { tn: Torneo; mios: Set<string> }) {
  const p = podium(tn);
  const tabla = standings(tn);
  const jugados = tn.partidos.filter(m => m.jugado).length;

  const misCupos = new Set(
    tn.cupos.filter(c => c.equipoId && mios.has(c.equipoId)).map(c => c.id)
  );

  const miProximo = misCupos.size
    ? tn.partidos
        .filter(m => !m.jugado && (misCupos.has(m.cupoA ?? '') || misCupos.has(m.cupoB ?? '')))
        .sort((a, b) => ((a.fecha ?? '') + (a.hora ?? '')).localeCompare((b.fecha ?? '') + (b.hora ?? '')))[0]
    : null;

  const rival = miProximo
    ? cupoById(tn, misCupos.has(miProximo.cupoA ?? '') ? miProximo.cupoB : miProximo.cupoA)
    : null;

  return (
    <article className="card" data-anim>
      <header className="card-head">
        <h2>{tn.nombre}</h2>
        <p className="card-sub">
          {SPORTS[tn.deporte].name} · {jugados} de {tn.partidos.length} partidos jugados
        </p>
      </header>

      <div className="tn-prog">
        <i style={{
          '--w': `${tn.partidos.length ? (jugados / tn.partidos.length) * 100 : 0}%`
        } as React.CSSProperties} />
      </div>

      {p.oro ? (
        <p className="tn-champ">
          <Icon name="trophy" className="ic ic-sm" /> Campeón: <b>{p.oro.nombre}</b>
        </p>
      ) : miProximo ? (
        <p className="next-when">
          <Icon name="cal" className="ic ic-sm" />
          Tu próximo: contra <b>{rival?.nombre ?? 'por definir'}</b>
          {miProximo.fecha ? ` el ${fmtDate(miProximo.fecha)}` : ''}
          {miProximo.hora ? ` a las ${fmtHour(miProximo.hora)}` : ''}
        </p>
      ) : (
        <p className="tn-champ">
          <Icon name="clock" className="ic ic-sm" /> En juego
        </p>
      )}

      <ul className="rank">
        {tabla.slice(0, 4).map((r, i) => (
          <li className={`rank-row${misCupos.has(r.cupo.id) ? ' is-mine' : ''}`} key={r.cupo.id}>
            <span className="rank-n">{String(i + 1).padStart(2, '0')}</span>
            <i className="br-chip" style={{ background: r.cupo.color }} />
            <span className="rank-name">{r.cupo.nombre}</span>
            <span className="rank-val">{r.pts} pts</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
