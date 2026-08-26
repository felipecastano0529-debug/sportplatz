import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirStaff } from '@/lib/tenant';
import { canchasDe } from '@/lib/queries/canchas';
import { reservasDelDia, reservasEntre, horasDelDia, facturado, cobrado } from '@/lib/queries/agenda';
import {
  money, moneyShort, iso, today, addDays, fmtDate, fmtHour,
  DAYS_S, MONTHS_S, shortTime
} from '@/lib/util';
import { estadoPago, ETIQUETA_PAGO, saldo, type Reserva } from '@/lib/types';
import { SPORTS, esDeporte, type SportId } from '@/lib/sports';
import { PageHead } from '@/components/app/PageHead';
import { Ball } from '@/components/Ball';
import { Icon } from '@/components/Icon';
import { AgendaShell, BotonNuevaReserva } from '@/components/app/reservas/AgendaShell';
import { AgendaEnVivo } from '@/components/app/Realtime';

export const metadata: Metadata = { title: 'Reservas' };

/* ==========================================================================
   VISTA · Reservas
   Agenda por hora × cancha, 14 días navegables.

   La cuadrícula se queda sobre superficie clara a propósito, aunque el fondo
   de la sección sea la noche de estadio: son diecisiete filas de datos
   seguidas y en vidrio oscuro se leen mal. El escenario es el marco; la mesa
   de trabajo es la mesa de trabajo.

   El día y el filtro viven en la URL y no en un estado de React. Así la
   agenda de un martes concreto se puede mandar por WhatsApp, el botón de
   atrás hace lo que promete, y el servidor pinta la cuadrícula ya resuelta.
   ========================================================================== */

/* De dónde salió cada reserva. `bot` es Neo por WhatsApp y `neo` es Neo
   dentro de la app: el mismo asistente por dos puertas, y al dueño le importa
   cuál — no es lo mismo un cliente que escribió al celular del negocio que
   uno que ya estaba adentro. */
const MARCA_ORIGEN: Record<string, { tag: string; title: string }> = {
  bot: { tag: 'WA', title: 'Reservó por WhatsApp con Neo AI' },
  neo: { tag: 'IA', title: 'Reservó hablando con Neo AI en la app' }
};

const CLASE_PAGO = {
  pagada: 'is-paid',
  adelanto: 'is-part',
  sin_abonar: 'is-due'
} as const;

export default async function ReservasPage({
  params,
  searchParams
}: {
  params: Promise<{ complejo: string }>;
  searchParams: Promise<{ dia?: string; deporte?: string }>;
}) {
  const { complejo: slug } = await params;
  const { dia, deporte } = await searchParams;
  const s = await exigirStaff(slug);
  const c = s.complejo;

  const hoy = today();
  const hoyISO = iso(hoy);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(dia ?? '') ? dia! : hoyISO;
  const filtro: SportId | 'all' = deporte && esDeporte(deporte) ? deporte : 'all';

  const [todasLasCanchas, delDia] = await Promise.all([
    canchasDe(c.id),
    reservasDelDia(c.id, fecha)
  ]);

  // La tira de días necesita saber cuánto se mueve cada uno: una sola
  // consulta del rango entero en vez de catorce.
  const desde = iso(addDays(hoy, -2));
  const hasta = iso(addDays(hoy, 11));
  const quincena = await reservasEntre(c.id, desde, hasta);
  const cargaPorDia = new Map<string, number>();
  for (const r of quincena) cargaPorDia.set(r.fecha, (cargaPorDia.get(r.fecha) ?? 0) + 1);

  const canchas = todasLasCanchas.filter(x => filtro === 'all' || x.deporte === filtro);
  const horas = horasDelDia(c);
  const deportes = [...new Set(todasLasCanchas.map(x => x.deporte))];

  const dias = Array.from({ length: 14 }, (_, i) => addDays(hoy, i - 2));
  const facturadoDia = facturado(delDia);
  const cobradoDia = cobrado(delDia);

  const enlace = (d: string, dep: string) =>
    `/${slug}/reservas?dia=${d}${dep === 'all' ? '' : `&deporte=${dep}`}`;

  // Índice por celda: buscar en un Map es O(1), y con 40 canchas × 17 horas
  // recorrer el array en cada celda son 11.560 comparaciones por repintado.
  const porCelda = new Map<string, Reserva>();
  for (const r of delDia) porCelda.set(`${r.cancha_id}|${shortTime(r.inicio)}`, r);

  const ligeras = canchas.map(x => ({ id: x.id, nombre: x.nombre, precio: x.precio }));

  return (
    <AgendaShell
      slug={slug}
      fecha={fecha}
      canchas={ligeras}
      horas={horas}
      reservas={delDia}
    >
      {/* §1.3: lo que el jugador hace, el dueño lo ve al instante. */}
      <AgendaEnVivo complejoId={c.id} avisar />

      <PageHead kicker="Agenda" title="Reservas" tools={<BotonNuevaReserva />} />

      <div className="daystrip" role="tablist" aria-label="Elegir día">
        {dias.map(d => {
          const v = iso(d);
          const n = cargaPorDia.get(v) ?? 0;
          const tope = Math.max(1, todasLasCanchas.length * 6);
          return (
            <Link
              key={v}
              className={`day${v === fecha ? ' is-on' : ''}${v === hoyISO ? ' is-today' : ''}`}
              href={enlace(v, filtro)}
              role="tab"
              aria-selected={v === fecha}
              scroll={false}
            >
              <em>{DAYS_S[d.getDay()]}</em>
              <b>{d.getDate()}</b>
              <span className="day-mes">{MONTHS_S[d.getMonth()]}</span>
              <span className="day-bar">
                <i style={{ '--w': `${Math.min(100, (n / tope) * 100)}%` } as React.CSSProperties} />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="agenda-bar">
        <div className="filters">
          <Link className={`pill${filtro === 'all' ? ' is-on' : ''}`} href={enlace(fecha, 'all')} scroll={false}>
            Todas
          </Link>
          {deportes.map(id => (
            <Link
              key={id}
              className={`pill${filtro === id ? ' is-on' : ''}`}
              href={enlace(fecha, id)}
              scroll={false}
            >
              <Ball sport={id} className="pill-ball" />
              {SPORTS[id].short}
            </Link>
          ))}
        </div>

        {/* El semáforo lleva SIEMPRE su etiqueta al lado: el color nunca es
            la única señal (R21). */}
        <p className="legend legend--inline">
          <span><i className="dot is-paid" /> pagada</span>
          <span><i className="dot is-part" /> adelanto</span>
          <span><i className="dot is-due" /> sin abonar</span>
        </p>

        {/* Facturado y cobrado, uno al lado del otro y con nombres distintos
            (R13). Nunca el mismo número con dos rótulos. */}
        <p className="agenda-sum">
          <b>{money(facturadoDia)}</b> facturado ·{' '}
          <span className="ok">{moneyShort(cobradoDia)}</span> recibido ·{' '}
          <span className="neg">{moneyShort(facturadoDia - cobradoDia)}</span> pendiente
        </p>
      </div>

      {!canchas.length ? (
        <p className="empty">
          {todasLasCanchas.length
            ? 'Ninguna cancha de ese deporte todavía.'
            : 'Todavía no hay canchas. Créalas en Ajustes y la agenda se llena sola.'}
        </p>
      ) : (
        <div className="agenda-wrap">
          {/* Escritorio: hora × cancha. Scrollea en horizontal con la columna
              de horas y la cabecera fijas — aguanta cuarenta canchas. */}
          <div className="agenda solo-ancho" style={{ '--cols': canchas.length } as React.CSSProperties}>
            <div className="agenda-head">
              <div className="ag-corner">{fmtDate(fecha)}</div>
              {canchas.map(x => (
                <div className="ag-col-head" key={x.id}>
                  <span><Ball sport={x.deporte} /></span>
                  <b>{x.nombre}</b>
                  <em>{money(x.precio)}</em>
                </div>
              ))}
            </div>

            <div className="agenda-body">
              {horas.map(h => (
                <div className="ag-row" key={h}>
                  <div className="ag-hour">{fmtHour(h)}</div>
                  {canchas.map(x => {
                    const r = porCelda.get(`${x.id}|${h}`);
                    if (!r) {
                      return (
                        <button
                          className="ag-cell is-free"
                          key={x.id}
                          data-new={`${x.id}|${h}`}
                          aria-label={`Reservar ${x.nombre} a las ${fmtHour(h)}`}
                        >
                          <span><Icon name="plus" className="ic ic-sm" />reservar</span>
                        </button>
                      );
                    }
                    return <Celda key={x.id} r={r} />;
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Celular: en un teléfono una cuadrícula de diez canchas por
              diecisiete horas no es una agenda, es un mapa que hay que
              recorrer con dos dedos. Lo que se mira en el celular es el DÍA,
              así que la tabla se convierte en la línea de tiempo del día y la
              cancha pasa de ser un eje a ser un dato de cada reserva. */}
          <ol className="agl solo-angosto">
            {horas.map(h => {
              const tomadas = canchas
                .map(x => ({ cancha: x, r: porCelda.get(`${x.id}|${h}`) }))
                .filter((x): x is { cancha: typeof canchas[0]; r: Reserva } => !!x.r);
              const libre = canchas.find(x => !porCelda.has(`${x.id}|${h}`));
              const nLibres = canchas.length - tomadas.length;

              return (
                <li className={`agl-row${tomadas.length ? '' : ' is-quiet'}`} key={h}>
                  <span className="agl-h">{fmtHour(h)}</span>
                  <div className="agl-slots">
                    {tomadas.map(({ cancha, r }) => {
                      const debe = saldo(r);
                      const estado = estadoPago(r);
                      const marca = MARCA_ORIGEN[r.origen];
                      return (
                        <button className={`agl-slot ${CLASE_PAGO[estado]}`} key={r.id} data-open={r.id}>
                          <b>{r.cliente}</b>
                          <em>
                            {cancha.nombre} ·{' '}
                            {debe > 0
                              ? `${moneyShort(r.total)} · debe ${moneyShort(debe)}`
                              : money(r.total)}
                          </em>
                          <span className="sr-only">{ETIQUETA_PAGO[estado]}</span>
                          {marca && <i className="src" title={marca.title}>{marca.tag}</i>}
                        </button>
                      );
                    })}
                    {nLibres > 0 && libre && (
                      <button className="agl-free" data-new={`${libre.id}|${h}`}>
                        <Icon name="plus" className="ic ic-sm" />
                        {nLibres} {nLibres === 1 ? 'cancha libre' : 'canchas libres'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </AgendaShell>
  );
}

function Celda({ r }: { r: Reserva }) {
  const debe = saldo(r);
  const estado = estadoPago(r);
  const marca = MARCA_ORIGEN[r.origen];

  return (
    <button className={`ag-cell ${CLASE_PAGO[estado]}`} data-open={r.id}>
      <b>{r.cliente.split(' ').slice(0, 2).join(' ')}</b>
      <em>{debe > 0 ? `${moneyShort(r.total)} · debe ${moneyShort(debe)}` : money(r.total)}</em>
      {/* El color no puede ser la única señal (R21): la etiqueta va aquí
          para quien usa lector de pantalla y para quien no distingue tonos. */}
      <span className="sr-only">{ETIQUETA_PAGO[estado]}</span>
      {marca && <i className="src" title={marca.title}>{marca.tag}</i>}
    </button>
  );
}
