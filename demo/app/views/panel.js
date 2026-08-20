/* ==========================================================================
   VISTA · Panel del dueño
   Cuánto entra, de dónde, y a quién hay que cobrarle.

   Corrección respecto a la versión anterior: las métricas separan FACTURADO
   de COBRADO. Antes las cuatro tarjetas sumaban `total` de todas las reservas
   del rango —incluidas las futuras y las que nadie ha pagado— y lo rotulaban
   como ingresos. Un dueño que mira ese número toma decisiones con plata que
   todavía no tiene.
   ========================================================================== */

import { $$, esc, money, moneyShort, iso, today, addDays, fmtDate, fmtDateLong, DAYS_S, parseISO, firstName } from '../core/util.js';
import { S } from '../core/store.js';
import { ballSVG } from '../core/sports.js';
import {
  revenueBetween, collectedBetween, occupancy, pendingTotal, revenueByCourt,
  dailySeries, weeklySeries, pendingSeries, courtById
} from '../core/calc.js';
import { icon } from '../ui/icons.js';
import { areaChart, sparkline, CH_GEO } from '../ui/chart.js';
import { stagger, countUp } from '../ui/motion.js';
import { pageHead } from '../ui/shell.js';

export function viewPanel(main) {
  const t = today();

  const hoy       = revenueBetween(t, t);
  const ayer      = revenueBetween(addDays(t, -1), addDays(t, -1));
  const semana    = revenueBetween(addDays(t, -6), t);
  const semanaAnt = revenueBetween(addDays(t, -13), addDays(t, -7));
  const mes       = revenueBetween(addDays(t, -29), t);
  const mesAnt    = revenueBetween(addDays(t, -59), addDays(t, -30));
  const cobradoMes = collectedBetween(addDays(t, -29), t);
  const ocup      = occupancy(addDays(t, -6), t);
  const porCobrar = pendingTotal();

  const delta = (a, b) => b === 0 ? null : (a - b) / b;
  const chip = (d) => d == null
    ? '<span class="chip chip-flat">nuevo</span>'
    : `<span class="chip ${d >= 0 ? 'chip-up' : 'chip-down'}">${icon(d >= 0 ? 'up' : 'down', 'ic')}${Math.abs(d * 100).toFixed(0)}%</span>`;

  const rank = revenueByCourt(addDays(t, -29), t);
  const top = rank[0];
  const series = dailySeries(14);
  const maxV = Math.max(...series.map(s => s.value), 1);

  const proximas = S.bookings
    .filter(b => b.date >= iso(t))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, 6);

  const deudores = S.bookings
    .filter(b => b.date >= iso(t) && b.deposit < b.total)
    .sort((a, b) => (b.total - b.deposit) - (a.total - a.deposit))
    .slice(0, 5);

  const stats = [
    { label: 'Facturado hoy',   ic: 'clock',  val: hoy,       d: delta(hoy, ayer),       foot: 'vs. ayer',
      spark: dailySeries(8).map(s => s.value), tone: 'brand' },
    { label: 'Últimos 7 días',  ic: 'cal',    val: semana,    d: delta(semana, semanaAnt), foot: 'vs. semana anterior',
      spark: dailySeries(14).slice(-7).map(s => s.value), tone: 'brand' },
    { label: 'Cobrado en 30 días', ic: 'wallet', val: cobradoMes, d: delta(mes, mesAnt), foot: `de ${moneyShort(mes)} facturados`,
      spark: weeklySeries(6), tone: 'ok' },
    { label: 'Por cobrar',      ic: 'flame',  val: porCobrar, d: null,                   foot: 'saldos con adelanto pendiente',
      spark: pendingSeries(7), tone: 'warn' }
  ];

  main.innerHTML = `
    ${pageHead('Panel del dueño', 'Cómo va el negocio',
      `<span class="stamp">${icon('cal')}${fmtDateLong(iso(t))}</span>`,
      `${S.courts.length} canchas · ocupación de la semana <b>${(ocup * 100).toFixed(0)}%</b>`)}

    <section class="stat-row">
      ${stats.map(s => `
        <article class="stat" data-anim>
          <p class="stat-head">${icon(s.ic)}<span class="stat-label">${s.label}</span></p>
          <p class="stat-val" data-count="${s.val}">$0</p>
          <p class="stat-foot">${s.d === null ? '' : chip(s.d)} <span>${s.foot}</span></p>
          <span class="stat-spark">${sparkline(s.spark, s.tone)}</span>
        </article>`).join('')}
    </section>

    <section class="grid-2">
      <article class="card card-chart" data-anim>
        <header class="card-head">
          <h2>Ingresos por día</h2>
          <p class="card-sub">Últimas dos semanas</p>
        </header>
        <div class="chart" style="--n:${series.length}; --last:${series.length - 1};
             --foot:${CH_GEO.foot}%; --inner:${CH_GEO.inner}%">
          ${areaChart(series.map(s => s.value))}
          <div class="ch-cols">
            ${series.map((s, i) => `
              <div class="ch-col ${s.date === iso(t) ? 'is-today' : ''}"
                   style="--i:${i}; --v:${(s.value / maxV).toFixed(4)}">
                <i class="ch-dot"></i>
                <span class="bar-tip">${money(s.value)}<em>${fmtDate(s.date)}</em></span>
                <span class="ch-x">${DAYS_S[parseISO(s.date).getDay()].slice(0, 2)}</span>
              </div>`).join('')}
          </div>
        </div>
        <dl class="ch-legend">
          <div><dt>Total</dt><dd>${money(series.reduce((a, s) => a + s.value, 0))}</dd></div>
          <div><dt>Promedio día</dt><dd>${money(series.reduce((a, s) => a + s.value, 0) / series.length)}</dd></div>
          <div><dt>Mejor día</dt><dd>${moneyShort(maxV)}</dd></div>
        </dl>
      </article>

      <article class="card" data-anim>
        <header class="card-head">
          <h2>Qué cancha deja más</h2>
          <p class="card-sub">Últimos 30 días</p>
        </header>
        ${top ? `<p class="hero-line"><b>${esc(top.court.name)}</b> lidera con <b>${money(top.value)}</b></p>` : ''}
        <ul class="rank">
          ${rank.slice(0, 6).map((r, i) => `
            <li class="rank-row">
              <span class="rank-n">${String(i + 1).padStart(2, '0')}</span>
              <span class="rank-ball">${ballSVG(r.court.sport)}</span>
              <span class="rank-name">${esc(r.court.name)}</span>
              <span class="rank-track"><span class="rank-fill" style="--w:${(r.value / (top.value || 1)) * 100}%; --i:${i}"></span></span>
              <span class="rank-val">${moneyShort(r.value)}</span>
            </li>`).join('') || '<li class="empty">Sin movimiento este mes</li>'}
        </ul>
      </article>
    </section>

    <section class="grid-2">
      <article class="card" data-anim>
        <header class="card-head">
          <h2>Próximas reservas</h2>
          <p class="card-sub">Lo que viene, en orden</p>
        </header>
        <ul class="list">
          ${proximas.map(b => {
            const c = courtById(b.courtId);
            if (!c) return '';
            const saldo = b.total - b.deposit;
            return `<li class="list-row">
              <span class="list-ball">${ballSVG(c.sport)}</span>
              <span class="list-main">
                <b>${esc(b.customer)}</b>
                <em>${esc(c.name)} · ${fmtDate(b.date)} · ${b.start.replace(':00', '')}h</em>
              </span>
              <span class="list-side">
                <b>${money(b.total)}</b>
                ${saldo > 0
                  ? `<em class="tag tag-warn">debe ${money(saldo)}</em>`
                  : `<em class="tag tag-ok">pagada</em>`}
              </span>
            </li>`;
          }).join('') || '<li class="empty">Sin reservas próximas</li>'}
        </ul>
      </article>

      <article class="card" data-anim>
        <header class="card-head">
          <h2>Saldos pendientes</h2>
          <p class="card-sub">Dieron adelanto · falta el resto</p>
        </header>
        <ul class="list">
          ${deudores.map(b => {
            const c = courtById(b.courtId);
            if (!c) return '';
            const saldo = b.total - b.deposit;
            const pct = b.total ? (b.deposit / b.total) * 100 : 0;
            return `<li class="list-row">
              <span class="list-main">
                <b>${esc(b.customer)}</b>
                <em>${esc(c.name)} · ${fmtDate(b.date)}</em>
                <span class="pay-bar" role="img" aria-label="abonado ${pct.toFixed(0)}%"><i style="--w:${pct}%"></i></span>
              </span>
              <span class="list-side">
                <b class="neg">${money(saldo)}</b>
                <em>abonó ${money(b.deposit)}</em>
              </span>
            </li>`;
          }).join('') || '<li class="empty">Todo el mundo al día</li>'}
        </ul>
      </article>
    </section>`;

  $$('[data-count]', main).forEach(n => countUp(n, +n.dataset.count));
  stagger($$('[data-anim]', main), { y: 16, step: 55 });
}
