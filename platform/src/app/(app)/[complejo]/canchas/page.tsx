import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirStaff } from '@/lib/tenant';
import { canchasDe } from '@/lib/queries/canchas';
import { reservasDelDia, horasDelDia } from '@/lib/queries/agenda';
import { reservasEntre } from '@/lib/queries/agenda';
import {
  money, moneyShort, iso, today, addDays, hourNum, hhmm, fmtHour, firstName, shortTime
} from '@/lib/util';
import { estadoPago, saldo, type Reserva } from '@/lib/types';
import { SPORTS, esDeporte, type SportId } from '@/lib/sports';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { MediaBlock } from '@/components/MediaBlock';
import { SubirFoto } from '@/components/app/SubirFoto';
import { EditarCancha } from '@/components/app/canchas/CanchaAcciones';
import { Entra, Foco } from '@/components/ui/Motion';
import { guardarFotoCancha, guardarFotoDeporte } from '@/lib/actions/negocio';

export const metadata: Metadata = { title: 'Canchas' };

/* ==========================================================================
   VISTA · Canchas

   La cancha ES el fondo: el `.view-bg` del layout pone la foto del deporte a
   sangre, y las tarjetas flotan encima en vidrio oscuro. Blancas macizas
   taparían la foto; en vidrio se leen como fichas apoyadas sobre el campo.

   El retinte va POR TOKENS, no por componente: la sección redefine
   `--accent` y `--accent-rgb` con el color real de la superficie y botones,
   pills, anillos de foco y focos del cursor se retintan solos. Añadir un
   deporte no obliga a añadir una regla.
   ========================================================================== */

const CLASE_PAGO = { pagada: 'paid', adelanto: 'part', sin_abonar: 'due' } as const;

export default async function CanchasPage({
  params,
  searchParams
}: {
  params: Promise<{ complejo: string }>;
  searchParams: Promise<{ deporte?: string }>;
}) {
  const { complejo: slug } = await params;
  const { deporte } = await searchParams;
  const s = await exigirStaff(slug);
  const c = s.complejo;

  const todas = await canchasDe(c.id);
  const deportes = [...new Set(todas.map(x => x.deporte))] as SportId[];

  if (!deportes.length) {
    return (
      <div className="ob-panel">
        <p className="kicker">Inventario</p>
        <h1 className="page-title">Todavía no hay canchas</h1>
        <p className="ob-sub">
          Créalas en Ajustes: dinos qué deportes tienes, cuántas canchas de cada
          uno y a cuánto la hora. La agenda se llena sola.
        </p>
        <p className="ob-actions auth-actions">
          <Link className="btn btn-primary" href={`/${slug}/ajustes`}>Ir a Ajustes</Link>
        </p>
      </div>
    );
  }

  const activo: SportId =
    deporte && esDeporte(deporte) && deportes.includes(deporte) ? deporte : deportes[0];
  if (deporte && !esDeporte(deporte)) notFound();

  const sp = SPORTS[activo];
  const canchas = todas.filter(x => x.deporte === activo);

  const hoy = today();
  const hoyISO = iso(hoy);
  const horaAhora = new Date().getHours();

  const [delDia, delMes] = await Promise.all([
    reservasDelDia(c.id, hoyISO),
    reservasEntre(c.id, iso(addDays(hoy, -29)), hoyISO)
  ]);

  const porCancha = new Map<string, Reserva[]>();
  for (const r of delDia) {
    const l = porCancha.get(r.cancha_id) ?? [];
    l.push(r);
    porCancha.set(r.cancha_id, l);
  }

  const mesPorCancha = new Map<string, number>();
  for (const r of delMes) {
    mesPorCancha.set(r.cancha_id, (mesPorCancha.get(r.cancha_id) ?? 0) + r.total);
  }

  const horas = horasDelDia(c);
  const ocupadasAhora = canchas.filter(x =>
    (porCancha.get(x.id) ?? []).some(r => hourNum(shortTime(r.inicio)) === horaAhora)).length;
  const precioProm = canchas.length
    ? canchas.reduce((a, x) => a + x.precio, 0) / canchas.length : 0;
  const reservasHoy = canchas.reduce((a, x) => a + (porCancha.get(x.id)?.length ?? 0), 0);

  const fondoDeporte = canchas.find(x => x.foto_url)?.foto_url ?? null;

  /* El retinte de la sección NO se escribe aquí: lo hace `base.css` con
     `body[data-sport]` y `body[data-bleed="court"]`, que además redefine
     `--on-accent` al verde-negro para el texto sobre los rellenos claros.
     Ponerlo otra vez desde la vista solo servía para pisarlo peor. */

  return (
    <Entra>
      <Foco />

      <header className="page-head">
        <div>
          <p className="kicker">Inventario</p>
          <h1 className="page-title">{sp.name}</h1>
          <p className="page-sub">
            {canchas.length} {canchas.length === 1 ? 'cancha' : 'canchas'} · {sp.blurb}
          </p>
        </div>
        <div className="page-tools">
          <span className="stamp">
            <Icon name="canchas" />
            {todas.length} canchas · {deportes.length}{' '}
            {deportes.length === 1 ? 'deporte' : 'deportes'}
          </span>
        </div>
      </header>

      <div className="court-bar" data-anim>
        {deportes.length > 1 && (
          <nav className="hero-switch" aria-label="Elegir deporte">
            {deportes.map(id => (
              <Link
                key={id}
                className={`hswitch${id === activo ? ' is-on' : ''}`}
                href={`/${slug}/canchas?deporte=${id}`}
                aria-current={id === activo ? 'true' : undefined}
                scroll={false}
              >
                <Ball sport={id} className="pill-ball" />
                <span>{SPORTS[id].short}</span>
              </Link>
            ))}
          </nav>
        )}

        <dl className="hero-facts">
          <div>
            <dt>Libres ahora</dt>
            <dd>{canchas.length - ocupadasAhora}<em>de {canchas.length}</em></dd>
          </div>
          <div><dt>Precio hora</dt><dd>{moneyShort(precioProm)}</dd></div>
          <div><dt>Reservas hoy</dt><dd>{reservasHoy}</dd></div>
        </dl>

        {s.dueno && (
          <SubirFoto
            complejoId={c.id}
            tipo="cancha"
            id={activo}
            tieneFoto={!!fondoDeporte}
            etiqueta={sp.name}
            variante="bar"
            onGuardar={async (url: string) => {
              'use server';
              return guardarFotoDeporte(slug, activo, url);
            }}
          />
        )}
      </div>

      <div className="court-grid">
        {canchas.map((x, i) => {
          const deHoy = porCancha.get(x.id) ?? [];
          const ahora = deHoy.find(r => hourNum(shortTime(r.inicio)) === horaAhora);
          const siguiente = deHoy
            .filter(r => hourNum(shortTime(r.inicio)) > horaAhora)
            .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];

          return (
            <article className="court" data-anim key={x.id} style={{ '--i': i } as React.CSSProperties}>
              <div className="court-media">
                <MediaBlock sport={x.deporte} src={x.foto_url}>
                  {s.dueno && (
                    <SubirFoto
                      complejoId={c.id}
                      tipo="cancha"
                      id={x.id}
                      tieneFoto={!!x.foto_url}
                      etiqueta={x.nombre}
                      onGuardar={async (url: string) => {
                        'use server';
                        return guardarFotoCancha(slug, x.id, url);
                      }}
                    />
                  )}
                </MediaBlock>
                <span className={`court-badge ${ahora ? 'is-busy' : 'is-free'}`}>
                  <i />{ahora ? 'Ocupada ahora' : 'Libre ahora'}
                </span>
              </div>

              <div className="court-body">
                <header className="court-top">
                  <span className="court-ball"><Ball sport={x.deporte} /></span>
                  <div>
                    <h2 className="court-name">{x.nombre}</h2>
                    <p className="court-sport">
                      {SPORTS[x.deporte].name}
                      {!x.activa && ' · desactivada'}
                    </p>
                  </div>
                  <p className="court-price"><b>{money(x.precio)}</b><em>/ hora</em></p>
                </header>

                <dl className="court-stats">
                  <div>
                    <dt>Hoy</dt>
                    <dd>{deHoy.length} reserva{deHoy.length === 1 ? '' : 's'}</dd>
                  </div>
                  <div>
                    <dt>30 días</dt>
                    <dd>{moneyShort(mesPorCancha.get(x.id) ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>{ahora ? 'Jugando' : 'Siguiente'}</dt>
                    <dd>
                      {ahora
                        ? firstName(ahora.cliente)
                        : siguiente
                          ? fmtHour(shortTime(siguiente.inicio))
                          : 'libre el resto'}
                    </dd>
                  </div>
                </dl>

                <div className="court-day" role="img" aria-label="Ocupación de hoy, hora por hora">
                  {horas.map(h => {
                    const r = deHoy.find(y => shortTime(y.inicio) === h);
                    const cls = r ? CLASE_PAGO[estadoPago(r)] : 'free';
                    const titulo = r
                      ? `${fmtHour(h)} · ${r.cliente} · ${
                          saldo(r) ? 'debe ' + money(saldo(r)) : 'pagada'}`
                      : `${fmtHour(h)} · libre`;
                    return <span className={`slot is-${cls}`} title={titulo} key={h} />;
                  })}
                </div>

                <div className="court-actions">
                  <Link
                    className="btn btn-sm btn-primary"
                    href={`/${slug}/reservas?dia=${hoyISO}&deporte=${x.deporte}`}
                  >
                    <Icon name="plus" />Reservar
                  </Link>
                  {s.dueno && (
                    <EditarCancha
                      slug={slug}
                      cancha={{ id: x.id, nombre: x.nombre, precio: x.precio, activa: x.activa }}
                    />
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="legend">
        <span><i className="dot is-free" /> libre</span>
        <span><i className="dot is-paid" /> pagada completa</span>
        <span><i className="dot is-part" /> con adelanto</span>
        <span><i className="dot is-due" /> sin abonar</span>
        <span className="legend-note">
          Cada barra es una hora, de {fmtHour(hhmm(c.hora_abre))} a{' '}
          {fmtHour(hhmm(c.hora_cierra))} de hoy
        </span>
      </p>
    </Entra>
  );
}
