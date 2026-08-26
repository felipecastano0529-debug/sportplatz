import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirStaff } from '@/lib/tenant';
import { torneosDe, equiposDe } from '@/lib/queries/comunidad';
import { podium, freeSlots } from '@/lib/tournament';
import { SPORTS } from '@/lib/sports';
import { fmtDate } from '@/lib/util';
import { PageHead } from '@/components/app/PageHead';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { Entra, Foco } from '@/components/ui/Motion';
import { CrearTorneo } from '@/components/app/torneos/CrearTorneo';

export const metadata: Metadata = { title: 'Torneos' };

/* ==========================================================================
   VISTA · Torneos (lado del dueño)

   La lista. Cada torneo abre en su propia URL: así se puede mandar el link
   de la llave por WhatsApp, que es exactamente lo que hace un organizador el
   día del torneo.
   ========================================================================== */

export default async function TorneosPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await exigirStaff(slug);

  const [torneos, equipos] = await Promise.all([
    torneosDe(s.complejo.id),
    equiposDe(s.complejo.id)
  ]);

  const deportes = [...new Set(equipos.map(e => e.deporte))];

  return (
    <Entra>
      <Foco />

      <PageHead
        kicker="Competencias"
        title="Torneos"
        sub={`${torneos.length} ${torneos.length === 1 ? 'torneo' : 'torneos'} · los equipos se inscriben solos desde su cuenta`}
        tools={
          <CrearTorneo
            slug={slug}
            equipos={equipos.map(e => ({ id: e.id, nombre: e.nombre, deporte: e.deporte }))}
            deportes={deportes.length ? deportes : ['futbol']}
          />
        }
      />

      <div className="tn-grid">
        {torneos.length ? torneos.map((tn, i) => {
          const p = podium(tn);
          const jugados = tn.partidos.filter(m => m.jugado).length;
          const libres = freeSlots(tn);

          return (
            <Link
              className="tn-card"
              data-anim
              key={tn.id}
              href={`/${slug}/torneos/${tn.id}`}
              style={{ '--i': i } as React.CSSProperties}
            >
              <span className="tn-bg"><Ball sport={tn.deporte} /></span>
              <p className="kicker">{SPORTS[tn.deporte].name} · {tn.tamano} equipos</p>
              <h2 className="tn-name">{tn.nombre}</h2>
              <p className="tn-meta">
                Arrancó el {fmtDate(tn.fechaInicio)} · {jugados} de {tn.partidos.length} partidos jugados
              </p>
              <div className="tn-prog">
                <i style={{
                  '--w': `${tn.partidos.length ? (jugados / tn.partidos.length) * 100 : 0}%`
                } as React.CSSProperties} />
              </div>
              <p className="tn-champ">
                {p.oro ? (
                  <><Icon name="trophy" className="ic ic-sm" /> Campeón: <b>{p.oro.nombre}</b></>
                ) : tn.inscripcionAbierta && libres ? (
                  <>
                    <Icon name="users" className="ic ic-sm" /> Inscripciones abiertas ·{' '}
                    <b>{libres} {libres === 1 ? 'cupo' : 'cupos'}</b>
                  </>
                ) : (
                  <><Icon name="clock" className="ic ic-sm" /> En juego</>
                )}
              </p>
            </Link>
          );
        }) : (
          <div className="empty-big">
            <p>
              Todavía no hay torneos. Crea uno de 4, 8 o 16 equipos: la llave se
              arma sola y los ganadores avanzan solos al marcar cada resultado.
            </p>
          </div>
        )}
      </div>
    </Entra>
  );
}
