import type { Metadata } from 'next';
import { resolverTenant } from '@/lib/tenant';
import { equiposDe, plantillasDe, personasDe, torneosDe } from '@/lib/queries/comunidad';
import { canchasDe } from '@/lib/queries/canchas';
import { recordDeEquipo, golesDePersona } from '@/lib/records';
import { SPORTS, type SportId } from '@/lib/sports';
import { PageHead } from '@/components/app/PageHead';
import { Crest, Racha, Historial } from '@/components/Fichas';
import { Ring } from '@/components/Chart';
import { Icon } from '@/components/Icon';
import { Entra, Foco } from '@/components/ui/Motion';
import { CrearEquipo, EditarMiEquipo, ArmarPlantilla } from '@/components/app/jugador/MiEquipo';
import type { Persona } from '@/lib/types';

export const metadata: Metadata = { title: 'Mi equipo' };

/* ==========================================================================
   JUGADOR · Mi equipo

   Crearlo, ponerle escudo y color, armar la plantilla.

   Un jugador puede estar en varios equipos (R35), así que esta pantalla los
   muestra todos. El que capitanea es el único que puede editar — el resto
   los mira.
   ========================================================================== */

export default async function MiEquipoPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await resolverTenant(slug);
  const c = s.complejo;

  const [equipos, plantillas, personas, torneos, canchas] = await Promise.all([
    equiposDe(c.id),
    plantillasDe(c.id),
    personasDe(c.id),
    torneosDe(c.id),
    canchasDe(c.id)
  ]);

  const mios = equipos.filter(e =>
    plantillas.some(p => p.equipo_id === e.id && p.persona_id === s.persona.id));

  const dePersona = new Map(personas.map(p => [p.id, p]));
  const deportes = [...new Set(canchas.map(x => x.deporte))] as SportId[];

  const plantillaDe = (equipoId: string) =>
    plantillas
      .filter(p => p.equipo_id === equipoId)
      .map(p => ({
        persona: p.personas ? dePersona.get(p.personas.id) : undefined,
        posicion: p.posicion
      }))
      .filter((x): x is { persona: Persona; posicion: string | null } => !!x.persona);

  return (
    <Entra>
      <Foco />

      <PageHead
        kicker="Tu club"
        title={mios.length > 1 ? 'Tus equipos' : 'Mi equipo'}
        sub={
          mios.length
            ? `${mios.length} ${mios.length === 1 ? 'equipo' : 'equipos'} en ${c.nombre}`
            : 'Crea el tuyo y arma la plantilla'
        }
        tools={<CrearEquipo slug={slug} deportes={deportes.length ? deportes : ['futbol']} />}
      />

      {!mios.length && (
        <div className="empty-big">
          <p>
            Todavía no estás en ningún equipo. Crea el tuyo: le pones nombre,
            color y escudo, y ya puedes inscribirlo en los torneos abiertos.
          </p>
        </div>
      )}

      {mios.map(e => {
        const r = recordDeEquipo(e.id, torneos);
        const dentro = plantillaDe(e.id);
        const soyCapitan = e.capitan_id === s.persona.id;
        const dentroIds = new Set(dentro.map(x => x.persona.id));
        const disponibles = personas.filter(p => !dentroIds.has(p.id));
        const sp = SPORTS[e.deporte];

        return (
          <article className="card card-wide" data-anim key={e.id}>
            <div className="sheet" data-sport={e.deporte}>
              <header className="sheet-head">
                <Crest equipo={e} className="crest--xl" />
                <div className="sheet-id">
                  <p className="kicker">
                    {sp.name}
                    {soyCapitan ? ' · eres el capitán' : ''}
                  </p>
                  <h2 className="sheet-name">{e.nombre}</h2>
                  <Racha racha={r.racha} />
                </div>
                <div className="sheet-ring">
                  <Ring pct={r.efectividad} size={66} stroke={6} />
                  <span className="sheet-ring-v">
                    <b>{(r.efectividad * 100).toFixed(0)}%</b>
                    <em>efectividad</em>
                  </span>
                </div>
              </header>

              <EditarMiEquipo
                slug={slug}
                complejoId={c.id}
                equipo={e}
                soyCapitan={soyCapitan}
              />

              <dl className="sheet-facts">
                <div><dt>Jugados</dt><dd>{r.pj}</dd></div>
                <div><dt>Ganados</dt><dd className="ok">{r.g}</dd></div>
                <div><dt>Empatados</dt><dd>{r.e}</dd></div>
                <div><dt>Perdidos</dt><dd className="neg">{r.p}</dd></div>
                <div>
                  <dt>Diferencia</dt>
                  <dd className={r.dif > 0 ? 'ok' : r.dif < 0 ? 'neg' : ''}>
                    {r.dif > 0 ? '+' : ''}{r.dif}
                  </dd>
                </div>
                <div><dt>Títulos</dt><dd className="strong">{r.titulos.length}</dd></div>
              </dl>

              {!!r.titulos.length && (
                <p className="sheet-titles">
                  <Icon name="trophy" className="ic ic-sm" />
                  {r.titulos.map((t, i) => (
                    <span key={t.id}>{i > 0 && ' · '}<b>{t.nombre}</b></span>
                  ))}
                </p>
              )}

              <section className="sheet-block">
                <h3>
                  Plantilla <em>{dentro.length} {dentro.length === 1 ? 'jugador' : 'jugadores'}</em>
                </h3>
                <ArmarPlantilla
                  slug={slug}
                  equipo={e}
                  dentro={dentro}
                  disponibles={disponibles}
                  soyCapitan={soyCapitan}
                />
              </section>

              <section className="sheet-block">
                <h3>Histórico de partidos <em>{r.filas.length}</em></h3>
                <Historial filas={r.filas} />
              </section>

              {!!dentro.length && (
                <section className="sheet-block">
                  <h3>Quién anota</h3>
                  <ul className="roster">
                    {dentro
                      .map(x => ({ ...x, goles: golesDePersona(x.persona.id, torneos).total }))
                      .sort((a, b) => b.goles - a.goles)
                      .map(({ persona, goles }) => (
                        <li className="roster-row" key={persona.id}>
                          <span className="roster-main">
                            <b>{persona.nombre}</b>
                          </span>
                          <span className="roster-g">
                            <b>{goles}</b>
                            <em>{sp.unit}</em>
                          </span>
                        </li>
                      ))}
                  </ul>
                </section>
              )}
            </div>
          </article>
        );
      })}
    </Entra>
  );
}
