/* ==========================================================================
   JUGADOR · Inicio
   Lo que un jugador quiere saber al abrir: cuándo juego, con quién, y qué
   hay libre ahora mismo. Nada de métricas de negocio: eso es del dueño.
   ========================================================================== */

import { $, $$, esc, money, iso, today, addDays, fmtDate, fmtDateLong, fmtHour, hhmm, firstName } from '../core/util.js';
import { S } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import { bookingsOfPlayer, freeHours, bookingsOn, courtById, hoursOfDay } from '../core/calc.js';
import { me, myTeams, nextMatchOf, teamRecord, crestSVG } from '../core/teams.js';
import { freeSlots } from '../core/tournament.js';
import { icon } from '../ui/icons.js';
import { stagger } from '../ui/motion.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { rachaHTML } from '../ui/fichas.js';
import { openBookingDetail } from '../views/reservas.js';

export function viewInicio(main) {
  const yo = me();
  const t = today();
  const nowH = new Date().getHours();
  const equipos = myTeams();
  const proximo = yo ? nextMatchOf(yo.id) : null;

  const misReservas = yo ? bookingsOfPlayer(yo.id) : [];
  const futuras = misReservas.filter(b => b.date >= iso(t))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const jugadas = misReservas.filter(b => b.date < iso(t)).length;

  const libresAhora = S.courts.filter(c =>
    !bookingsOn(iso(t), c.id).some(b => parseInt(b.start, 10) === nowH));

  const torneosAbiertos = (S.tournaments || []).filter(tn => tn.openSignup && freeSlots(tn) > 0);

  main.innerHTML = `
    ${pageHead(saludo(), yo ? `Hola, ${esc(firstName(yo.name))}` : 'Hola',
      `<button class="btn btn-primary btn-sm" id="goReservar">${icon('plus')}Reservar cancha</button>`,
      `${fmtDateLong(iso(t))} · ${libresAhora.length} de ${S.courts.length} canchas libres ahora`)}

    <section class="grid-2">
      ${proximo ? `
        <article class="card card-next" data-anim>
          <header class="card-head"><h2>Tu próximo partido</h2>
            <p class="card-sub">${esc(proximo.tn.name)}</p></header>
          <div class="next-match">
            <span class="next-side">${crestSVG(proximo.team, 'crest--lg')}<b>${esc(proximo.team.name)}</b></span>
            <span class="next-vs">VS</span>
            <span class="next-side">${crestSVG(proximo.rival, 'crest--lg')}<b>${esc(proximo.rival?.name || 'Por definir')}</b></span>
          </div>
          <p class="next-when">${icon('cal', 'ic ic-sm')}${fmtDateLong(proximo.match.date)}
            · ${fmtHour(proximo.match.time)}${proximo.match.court ? ' · ' + esc(proximo.match.court) : ''}</p>
        </article>`
        : `<article class="card card-next is-empty" data-anim>
          <header class="card-head"><h2>Sin partidos programados</h2>
            <p class="card-sub">Inscribe tu equipo en un torneo y aparecerá aquí</p></header>
          <button class="btn btn-primary btn-sm" id="goTorneos">${icon('trophy')}Ver torneos abiertos</button>
        </article>`}

      <article class="card" data-anim>
        <header class="card-head"><h2>Tus reservas</h2>
          <p class="card-sub">${jugadas} ${jugadas === 1 ? 'partido jugado' : 'partidos jugados'} aquí</p></header>
        <ul class="list">
          ${futuras.slice(0, 4).map(b => {
            const c = courtById(b.courtId);
            if (!c) return '';
            const saldo = b.total - b.deposit;
            return `<li class="list-row" data-booking="${b.id}" tabindex="0" role="button">
              <span class="list-ball">${ballSVG(c.sport)}</span>
              <span class="list-main"><b>${esc(c.name)}</b>
                <em>${fmtDate(b.date)} · ${fmtHour(b.start)}</em></span>
              <span class="list-side"><b>${money(b.total)}</b>
                ${saldo > 0 ? `<em class="tag tag-warn">debes ${money(saldo)}</em>`
                            : '<em class="tag tag-ok">pagada</em>'}</span>
            </li>`;
          }).join('') || '<li class="empty">No tienes reservas próximas</li>'}
        </ul>
      </article>
    </section>

    <section class="grid-2">
      <article class="card" data-anim>
        <header class="card-head"><h2>${equipos.length > 1 ? 'Tus equipos' : 'Tu equipo'}</h2>
          <p class="card-sub">Cómo van</p></header>
        ${equipos.length ? `<ul class="list">
          ${equipos.map(t => {
            const r = teamRecord(t.id);
            return `<li class="list-row" data-goteam="1">
              ${crestSVG(t, 'crest--sm')}
              <span class="list-main"><b>${esc(t.name)}</b>
                <em>${r.pj} jugados · ${r.g}G ${r.e}E ${r.p}P${r.titulos.length ? ` · ${r.titulos.length} título${r.titulos.length > 1 ? 's' : ''}` : ''}</em></span>
              <span class="list-side">${rachaHTML(r.racha)}</span>
            </li>`;
          }).join('')}
        </ul>` : `<div class="empty-inline">
          <p>Todavía no tienes equipo.</p>
          <button class="btn btn-primary btn-sm" id="goEquipo">${icon('shield')}Crear mi equipo</button>
        </div>`}
      </article>

      <article class="card" data-anim>
        <header class="card-head"><h2>Libre ahora mismo</h2>
          <p class="card-sub">A las ${fmtHour(hhmm(nowH))}</p></header>
        <ul class="free-now">
          ${libresAhora.slice(0, 6).map(c => `
            <li><button class="free-chip" data-quick="${c.id}">
              ${ballSVG(c.sport, 'pill-ball')}
              <span><b>${esc(c.name)}</b><em>${money(c.price)}/h</em></span>
              ${icon('right', 'ic ic-sm')}
            </button></li>`).join('') || '<li class="empty">Todo ocupado en este momento</li>'}
        </ul>
      </article>
    </section>

    ${torneosAbiertos.length ? `
      <section class="card card-cta" data-anim>
        <div>
          <p class="kicker">Inscripciones abiertas</p>
          <h2>${esc(torneosAbiertos[0].name)}</h2>
          <p class="cta-sub">${SPORTS[torneosAbiertos[0].sport].name} · arranca el ${fmtDate(torneosAbiertos[0].startDate)}
            · quedan <b>${freeSlots(torneosAbiertos[0])}</b> cupos</p>
        </div>
        <button class="btn btn-primary" id="goTorneos2">${icon('trophy')}Inscribir mi equipo</button>
      </section>` : ''}`;

  $('#goReservar').addEventListener('click', () => renderApp('reservar'));
  $('#goEquipo')?.addEventListener('click', () => renderApp('miequipo'));
  $$('[data-goteam]', main).forEach(el => el.addEventListener('click', () => renderApp('miequipo')));
  ['#goTorneos', '#goTorneos2'].forEach(s => $(s, main)?.addEventListener('click', () => renderApp('ptorneos')));
  $$('[data-quick]', main).forEach(b => b.addEventListener('click', () => {
    sessionStorage.setItem('sp.quickCourt', b.dataset.quick);
    renderApp('reservar');
  }));
  $$('[data-booking]', main).forEach(el => {
    const go = () => openBookingDetail(el.dataset.booking);
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  stagger($$('[data-anim]', main), { y: 16, step: 55 });
}

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}
