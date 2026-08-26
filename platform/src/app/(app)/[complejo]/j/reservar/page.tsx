import type { Metadata } from 'next';
import Link from 'next/link';
import { resolverTenant } from '@/lib/tenant';
import { canchasActivas } from '@/lib/queries/canchas';
import { franjasOcupadas, horasDelDia, horasLibres } from '@/lib/queries/agenda';
import {
  money, iso, today, addDays, fmtDateLong, fmtHour, DAYS_S, MONTHS_S
} from '@/lib/util';
import { SPORTS, esDeporte, type SportId } from '@/lib/sports';
import { PageHead } from '@/components/app/PageHead';
import { Ball } from '@/components/Ball';
import { Entra } from '@/components/ui/Motion';
import { ParrillaHoras } from '@/components/app/jugador/Reservar';

export const metadata: Metadata = { title: 'Reservar' };

/* ==========================================================================
   JUGADOR · Reservar

   Cuatro pasos en una sola pantalla: deporte → día → cancha → hora. Sin
   formulario: el jugador ve la parrilla de horas libres y toca la que
   quiere.

   Todo el estado vive en la URL, y eso importa especialmente aquí: en el
   celular esta pantalla se abre desde un link de WhatsApp, y ese link tiene
   que llevar directo al día y a la cancha de los que se estaba hablando.
   ========================================================================== */

export default async function ReservarPage({
  params,
  searchParams
}: {
  params: Promise<{ complejo: string }>;
  searchParams: Promise<{ deporte?: string; dia?: string; cancha?: string }>;
}) {
  const { complejo: slug } = await params;
  const { deporte, dia, cancha: canchaPedida } = await searchParams;
  const s = await resolverTenant(slug);
  const c = s.complejo;

  const todas = await canchasActivas(c.id);
  const deportes = [...new Set(todas.map(x => x.deporte))] as SportId[];

  if (!deportes.length) {
    return (
      <div className="ob-panel">
        <p className="kicker">Reservar</p>
        <h1 className="page-title">Este complejo todavía no tiene canchas</h1>
        <p className="ob-sub">En cuanto las den de alta aparecerán aquí.</p>
      </div>
    );
  }

  const hoy = today();
  const hoyISO = iso(hoy);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(dia ?? '') ? dia! : hoyISO;

  const activo: SportId =
    deporte && esDeporte(deporte) && deportes.includes(deporte) ? deporte : deportes[0];

  const delDeporte = todas.filter(x => x.deporte === activo);
  const cancha = delDeporte.find(x => x.id === canchaPedida) ?? delDeporte[0];

  const ocupadasPorCancha = await franjasOcupadas(c.id, fecha);
  const ocupadas = ocupadasPorCancha.get(cancha.id) ?? new Set<string>();

  const horas = horasDelDia(c);
  const libres = horasLibres(c, ocupadas, fecha);
  const setLibres = new Set(libres);

  const dias = Array.from({ length: 14 }, (_, i) => addDays(hoy, i));
  const sp = SPORTS[activo];

  const enlace = (o: { deporte?: string; dia?: string; cancha?: string }) => {
    const p = new URLSearchParams();
    p.set('deporte', o.deporte ?? activo);
    p.set('dia', o.dia ?? fecha);
    if (o.cancha ?? (o.deporte ? undefined : cancha.id)) {
      p.set('cancha', o.cancha ?? cancha.id);
    }
    return `/${slug}/j/reservar?${p}`;
  };

  return (
    <Entra>
      <ParrillaHoras
        slug={slug}
        cancha={{ id: cancha.id, nombre: cancha.nombre, precio: cancha.precio }}
        fecha={fecha}
      >
        <PageHead
          kicker="Reserva tu cancha"
          title="Reservar"
          sub={`${sp.name} · ${money(cancha.precio)} la hora`}
        />

        {deportes.length > 1 && (
          <nav className="hero-switch" aria-label="Elegir deporte" data-anim>
            {deportes.map(id => (
              <Link
                key={id}
                className={`hswitch${id === activo ? ' is-on' : ''}`}
                href={enlace({ deporte: id })}
                aria-current={id === activo ? 'true' : undefined}
                scroll={false}
              >
                <Ball sport={id} className="pill-ball" />
                <span>{SPORTS[id].short}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="daystrip" data-anim role="tablist" aria-label="Elegir día">
          {dias.map(d => {
            const v = iso(d);
            return (
              <Link
                key={v}
                className={`day${v === fecha ? ' is-on' : ''}${v === hoyISO ? ' is-today' : ''}`}
                href={enlace({ dia: v })}
                role="tab"
                aria-selected={v === fecha}
                scroll={false}
              >
                <em>{DAYS_S[d.getDay()]}</em>
                <b>{d.getDate()}</b>
                <span className="day-mes">{MONTHS_S[d.getMonth()]}</span>
              </Link>
            );
          })}
        </div>

        {delDeporte.length > 1 && (
          <div className="filters filters--wide" data-anim>
            {delDeporte.map(x => (
              <Link
                key={x.id}
                className={`pill${x.id === cancha.id ? ' is-on' : ''}`}
                href={enlace({ cancha: x.id })}
                scroll={false}
              >
                {x.nombre} <em>{money(x.precio)}</em>
              </Link>
            ))}
          </div>
        )}

        <section className="slots-card" data-anim>
          <header className="slots-head">
            <div>
              <h2>{cancha.nombre}</h2>
              <p>{fmtDateLong(fecha)}</p>
            </div>
            <span className="slots-legend">
              <i className="dot is-free" />libre <i className="dot is-due" />ocupada
            </span>
          </header>

          <div className="slot-grid">
            {horas.map(h => {
              const tomada = ocupadas.has(h);
              const disponible = setLibres.has(h);
              // "Pasó" y "ocupada" no son lo mismo, y decirlo cuesta una
              // palabra: si el jugador cree que está ocupada, vuelve mañana
              // a la misma hora y se encuentra lo mismo.
              const paso = !tomada && !disponible;

              return (
                <button
                  key={h}
                  className={`hslot${disponible ? '' : ' is-off'}`}
                  disabled={!disponible}
                  data-hora={h}
                  aria-label={`${fmtHour(h)}${disponible ? ', reservar' : ', no disponible'}`}
                >
                  <b>{fmtHour(h).replace(':00', '')}</b>
                  <em>{tomada ? 'ocupada' : paso ? 'pasó' : money(cancha.precio)}</em>
                </button>
              );
            })}
          </div>

          {!libres.length && (
            <p className="empty">
              No queda ninguna hora libre en {cancha.nombre} ese día. Prueba otra
              cancha o el día siguiente.
            </p>
          )}
        </section>
      </ParrillaHoras>
    </Entra>
  );
}
