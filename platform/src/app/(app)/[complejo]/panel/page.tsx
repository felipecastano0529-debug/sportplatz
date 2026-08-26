import type { Metadata } from 'next';
import { exigirDueno } from '@/lib/tenant';
import { canchasDe } from '@/lib/queries/canchas';
import {
  reservasEntre, facturado, cobrado, porCobrar, ocupacion,
  facturadoPorCancha, serieDiaria, serieSemanal, seriePendiente
} from '@/lib/queries/agenda';
import {
  money, moneyShort, iso, today, addDays, fmtDate, fmtDateLong,
  DAYS_S, parseISO, shortTime
} from '@/lib/util';
import { saldo } from '@/lib/types';
import { PageHead } from '@/components/app/PageHead';
import { AreaChart, Sparkline, CH_GEO } from '@/components/Chart';
import { Ball } from '@/components/Ball';
import { Icon, type IconName } from '@/components/Icon';
import { Entra, Contador, Foco } from '@/components/ui/Motion';

export const metadata: Metadata = { title: 'Panel' };

/* ==========================================================================
   VISTA · Panel del dueño
   Cuánto entra, de dónde, y a quién hay que cobrarle.

   La regla que sostiene esta pantalla: FACTURADO y COBRADO nunca se
   presentan como el mismo número (R13). Un dueño que mira lo facturado
   creyendo que es lo cobrado toma decisiones con plata que todavía no tiene.
   Esa distinción es media venta.
   ========================================================================== */

export default async function PanelPage({
  params
}: {
  params: Promise<{ complejo: string }>;
}) {
  const { complejo: slug } = await params;
  const s = await exigirDueno(slug);
  const c = s.complejo;

  const hoy = today();
  const hoyISO = iso(hoy);

  // UNA consulta de 60 días y todo lo demás se deriva en memoria. Sesenta
  // porque el comparativo del mes necesita el mes anterior entero.
  const [canchas, rango] = await Promise.all([
    canchasDe(c.id),
    reservasEntre(c.id, iso(addDays(hoy, -59)), iso(addDays(hoy, 60)))
  ]);

  const entre = (d: number, h: number) => {
    const a = iso(addDays(hoy, d));
    const b = iso(addDays(hoy, h));
    return rango.filter(r => r.fecha >= a && r.fecha <= b);
  };

  const deHoy        = entre(0, 0);
  const deAyer       = entre(-1, -1);
  const deSemana     = entre(-6, 0);
  const semanaAnt    = entre(-13, -7);
  const deMes        = entre(-29, 0);
  const mesAnt       = entre(-59, -30);
  const pasado       = rango.filter(r => r.fecha <= hoyISO);
  const futuro       = rango.filter(r => r.fecha >= hoyISO);

  const ocup = ocupacion(deSemana, c, canchas.filter(x => x.activa).length, 7);

  const delta = (a: number, b: number) => (b === 0 ? null : (a - b) / b);

  const metricas: {
    label: string; ic: IconName; val: number; d: number | null;
    foot: string; spark: number[]; tone: 'brand' | 'ok' | 'warn';
  }[] = [
    {
      label: 'Facturado hoy', ic: 'clock', val: facturado(deHoy),
      d: delta(facturado(deHoy), facturado(deAyer)), foot: 'vs. ayer',
      spark: serieDiaria(pasado, 8).map(x => x.valor), tone: 'brand'
    },
    {
      label: 'Últimos 7 días', ic: 'cal', val: facturado(deSemana),
      d: delta(facturado(deSemana), facturado(semanaAnt)), foot: 'vs. semana anterior',
      spark: serieDiaria(pasado, 14).slice(-7).map(x => x.valor), tone: 'brand'
    },
    {
      label: 'Cobrado en 30 días', ic: 'wallet', val: cobrado(deMes),
      d: delta(facturado(deMes), facturado(mesAnt)),
      foot: `de ${moneyShort(facturado(deMes))} facturados`,
      spark: serieSemanal(pasado, 6), tone: 'ok'
    },
    {
      label: 'Por cobrar', ic: 'flame', val: porCobrar(futuro, hoyISO), d: null,
      foot: 'saldos con adelanto pendiente',
      spark: seriePendiente(futuro, 7), tone: 'warn'
    }
  ];

  const porCancha = facturadoPorCancha(deMes, canchas.map(x => x.id));
  const nombreDe = new Map(canchas.map(x => [x.id, x]));
  const rank = porCancha.map(r => ({ ...r, cancha: nombreDe.get(r.canchaId)! })).filter(r => r.cancha);
  const top = rank[0];

  const serie = serieDiaria(pasado, 14);
  const maxV = Math.max(...serie.map(x => x.valor), 1);
  const totalSerie = serie.reduce((a, x) => a + x.valor, 0);

  const proximas = futuro
    .slice()
    .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio))
    .slice(0, 6);

  const deudores = futuro
    .filter(r => r.abonado < r.total)
    .sort((a, b) => saldo(b) - saldo(a))
    .slice(0, 5);

  return (
    <Entra>
      <Foco />

      <PageHead
        kicker="Panel del dueño"
        title="Cómo va el negocio"
        sub={
          <>
            {canchas.length} canchas · ocupación de la semana{' '}
            <b>{(ocup * 100).toFixed(0)}%</b>
          </>
        }
        tools={
          <span className="stamp">
            <Icon name="cal" />
            {fmtDateLong(hoyISO)}
          </span>
        }
      />

      <section className="stat-row">
        {metricas.map(m => (
          <article className="stat" data-anim key={m.label}>
            <p className="stat-head">
              <Icon name={m.ic} />
              <span className="stat-label">{m.label}</span>
            </p>
            <p className="stat-val"><Contador a={m.val} /></p>
            <p className="stat-foot">
              {m.d !== null && <Chip d={m.d} />}
              <span>{m.foot}</span>
            </p>
            <span className="stat-spark"><Sparkline values={m.spark} tone={m.tone} /></span>
          </article>
        ))}
      </section>

      <section className="grid-2">
        <article className="card card-chart" data-anim>
          <header className="card-head">
            <h2>Ingresos por día</h2>
            <p className="card-sub">Últimas dos semanas</p>
          </header>

          <div
            className="chart"
            style={{
              '--n': serie.length,
              '--last': serie.length - 1,
              '--foot': `${CH_GEO.foot}%`,
              '--inner': `${CH_GEO.inner}%`
            } as React.CSSProperties}
          >
            <AreaChart values={serie.map(x => x.valor)} />
            {/* Los puntos van FUERA del SVG: dentro heredarían el escalado no
                uniforme y se deformarían en elipses. */}
            <div className="ch-cols">
              {serie.map((x, i) => (
                <div
                  key={x.fecha}
                  className={`ch-col${x.fecha === hoyISO ? ' is-today' : ''}`}
                  style={{ '--i': i, '--v': (x.valor / maxV).toFixed(4) } as React.CSSProperties}
                >
                  <i className="ch-dot" />
                  <span className="bar-tip">
                    {money(x.valor)}
                    <em>{fmtDate(x.fecha)}</em>
                  </span>
                  <span className="ch-x">
                    {DAYS_S[parseISO(x.fecha).getDay()].slice(0, 2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <dl className="ch-legend">
            <div><dt>Total</dt><dd>{money(totalSerie)}</dd></div>
            <div><dt>Promedio día</dt><dd>{money(totalSerie / serie.length)}</dd></div>
            <div><dt>Mejor día</dt><dd>{moneyShort(maxV)}</dd></div>
          </dl>
        </article>

        <article className="card" data-anim>
          <header className="card-head">
            <h2>Qué cancha deja más</h2>
            <p className="card-sub">Últimos 30 días</p>
          </header>

          {top && top.valor > 0 && (
            <p className="hero-line">
              <b>{top.cancha.nombre}</b> lidera con <b>{money(top.valor)}</b>
            </p>
          )}

          <ul className="rank">
            {rank.length ? rank.slice(0, 6).map((r, i) => (
              <li className="rank-row" key={r.canchaId}>
                <span className="rank-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="rank-ball"><Ball sport={r.cancha.deporte} /></span>
                <span className="rank-name">{r.cancha.nombre}</span>
                <span className="rank-track">
                  <span
                    className="rank-fill"
                    style={{
                      '--w': `${(r.valor / (top.valor || 1)) * 100}%`,
                      '--i': i
                    } as React.CSSProperties}
                  />
                </span>
                <span className="rank-val">{moneyShort(r.valor)}</span>
              </li>
            )) : <li className="empty">Sin movimiento este mes</li>}
          </ul>
        </article>
      </section>

      <section className="grid-2">
        <article className="card" data-anim>
          <header className="card-head">
            <h2>Próximas reservas</h2>
            <p className="card-sub">Lo que viene, en orden</p>
          </header>

          <ul className="list">
            {proximas.length ? proximas.map(r => {
              const cancha = nombreDe.get(r.cancha_id);
              if (!cancha) return null;
              const debe = saldo(r);
              return (
                <li className="list-row" key={r.id}>
                  <span className="list-ball"><Ball sport={cancha.deporte} /></span>
                  <span className="list-main">
                    <b>{r.cliente}</b>
                    <em>
                      {cancha.nombre} · {fmtDate(r.fecha)} · {shortTime(r.inicio).replace(':00', '')}h
                    </em>
                  </span>
                  <span className="list-side">
                    <b>{money(r.total)}</b>
                    {debe > 0
                      ? <em className="tag tag-warn">debe {money(debe)}</em>
                      : <em className="tag tag-ok">pagada</em>}
                  </span>
                </li>
              );
            }) : <li className="empty">Sin reservas próximas</li>}
          </ul>
        </article>

        <article className="card" data-anim>
          <header className="card-head">
            <h2>Saldos pendientes</h2>
            <p className="card-sub">Dieron adelanto · falta el resto</p>
          </header>

          <ul className="list">
            {deudores.length ? deudores.map(r => {
              const cancha = nombreDe.get(r.cancha_id);
              if (!cancha) return null;
              const pct = r.total ? (r.abonado / r.total) * 100 : 0;
              return (
                <li className="list-row" key={r.id}>
                  <span className="list-main">
                    <b>{r.cliente}</b>
                    <em>{cancha.nombre} · {fmtDate(r.fecha)}</em>
                    <span
                      className="pay-bar"
                      role="img"
                      aria-label={`abonado ${pct.toFixed(0)}%`}
                    >
                      <i style={{ '--w': `${pct}%` } as React.CSSProperties} />
                    </span>
                  </span>
                  <span className="list-side">
                    <b className="neg">{money(saldo(r))}</b>
                    <em>abonó {money(r.abonado)}</em>
                  </span>
                </li>
              );
            }) : <li className="empty">Todo el mundo al día</li>}
          </ul>
        </article>
      </section>
    </Entra>
  );
}

/* El delta nunca va solo en color: lleva flecha y número, así que se lee
   también en escala de grises y para quien no distingue rojo de verde. */
function Chip({ d }: { d: number }) {
  return (
    <span className={`chip ${d >= 0 ? 'chip-up' : 'chip-down'}`}>
      <Icon name={d >= 0 ? 'up' : 'down'} />
      {Math.abs(d * 100).toFixed(0)}%
    </span>
  );
}
