/* ==========================================================================
   JUGADOR · Mi histórico
   Todo lo que ha hecho aquí: partidos, anotaciones, títulos y las canchas
   que más pisa. Nada de esto está guardado — se deriva de los partidos y de
   las reservas que ya existen.
   ========================================================================== */

import { $, $$, esc, money, iso, today, fmtDate, fmtDateLong, fmtHour } from '../core/util.js';
import { S } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import { bookingsOfPlayer, courtById } from '../core/calc.js';
import { me, playerRecord, goalsOfPlayer, crestSVG } from '../core/teams.js';
import { icon } from '../ui/icons.js';
import { stagger, countUp } from '../ui/motion.js';
import { ring } from '../ui/chart.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { rachaHTML, avatarHTML } from '../ui/fichas.js';

export function viewHistorial(main) {
  const yo = me();
  if (!yo) {
    main.innerHTML = `${pageHead('Tu trayectoria', 'Mi histórico')}
      <p class="empty">Entra como jugador para ver tu histórico.</p>`;
    return;
  }

  const r = playerRecord(yo.id);
  const sp = SPORTS[r.teams[0]?.sport] || SPORTS[S.business.sports[0]] || SPORTS.futbol;
  const reservas = bookingsOfPlayer(yo.id);
  const jugadas = reservas.filter(b => b.date < iso(today()));
  const gastado = jugadas.reduce((a, b) => a + b.deposit, 0);

  // Qué cancha pisa más: se cuenta sobre sus propias reservas.
  const porCancha = new Map();
  jugadas.forEach(b => porCancha.set(b.courtId, (porCancha.get(b.courtId) || 0) + 1));
  const favoritas = [...porCancha.entries()]
    .map(([id, n]) => ({ court: courtById(id), n }))
    .filter(x => x.court)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const maxFav = favoritas[0]?.n || 1;

  main.innerHTML = `
    ${pageHead('Tu trayectoria', 'Mi histórico', '',
      `Desde ${fmtDate(yo.since)} · ${r.teams.length} ${r.teams.length === 1 ? 'equipo' : 'equipos'}`)}

    <section class="card card-profile" data-anim>
      ${avatarHTML(yo, 'avatar--xl')}
      <div class="profile-id">
        <p class="kicker">${esc(yo.position || 'Jugador')}</p>
        <h2>${esc(yo.name)}</h2>
        ${rachaHTML(r.racha)}
      </div>
      <div class="sheet-ring">
        ${ring(r.pj ? r.g / r.pj : 0, { size: 72, stroke: 7 })}
        <span class="sheet-ring-v"><b>${r.pj ? Math.round(r.g / r.pj * 100) : 0}%</b><em>victorias</em></span>
      </div>
    </section>

    <section class="stat-row">
      ${[
        ['Partidos', 'trophy', r.pj, 'de torneo'],
        [sp.unit[0].toUpperCase() + sp.unit.slice(1), 'spark', r.goles, `${r.porPartido.toFixed(2)} por partido`],
        ['Reservas', 'cal', reservas.length, `${jugadas.length} ya jugadas`],
        ['Invertido', 'wallet', gastado, 'en canchas', true]
      ].map(([label, ic, val, foot, isMoney]) => `
        <article class="stat" data-anim>
          <p class="stat-head">${icon(ic)}<span class="stat-label">${label}</span></p>
          <p class="stat-val" data-count="${val}" data-money="${isMoney ? 1 : 0}">0</p>
          <p class="stat-foot"><span>${foot}</span></p>
        </article>`).join('')}
    </section>

    <section class="grid-2">
      <article class="card" data-anim>
        <header class="card-head"><h2>Tus equipos</h2>
          <p class="card-sub">${r.titulos.length} ${r.titulos.length === 1 ? 'título' : 'títulos'} entre todos</p></header>
        <ul class="list">
          ${r.teams.map(t => `<li class="list-row" data-goteam="1">
            ${crestSVG(t, 'crest--sm')}
            <span class="list-main"><b>${esc(t.name)}</b>
              <em>${SPORTS[t.sport]?.name || ''} · ${t.roster.length} jugadores</em></span>
            ${t.captainId === yo.id ? '<span class="tag tag-cap">Capitán</span>' : ''}
          </li>`).join('') || '<li class="empty">Todavía no perteneces a ningún equipo</li>'}
        </ul>
      </article>

      <article class="card" data-anim>
        <header class="card-head"><h2>Dónde juegas más</h2>
          <p class="card-sub">Tus canchas de siempre</p></header>
        <ul class="rank">
          ${favoritas.map((f, i) => `
            <li class="rank-row">
              <span class="rank-n">${String(i + 1).padStart(2, '0')}</span>
              <span class="rank-ball">${ballSVG(f.court.sport)}</span>
              <span class="rank-name">${esc(f.court.name)}</span>
              <span class="rank-track"><span class="rank-fill" style="--w:${(f.n / maxFav) * 100}%; --i:${i}"></span></span>
              <span class="rank-val">${f.n}×</span>
            </li>`).join('') || '<li class="empty">Todavía no has jugado aquí</li>'}
        </ul>
      </article>
    </section>

    <section class="card" data-anim>
      <header class="card-head"><h2>Tus partidos</h2>
        <p class="card-sub">${r.rows.length} en total</p></header>
      <ul class="hist">
        ${r.rows.map(x => `
          <li class="hist-row hist--${x.result}">
            <span class="hist-res">${x.result}</span>
            <span class="hist-main"><b>${esc(x.team.name)} vs ${esc(x.rival?.name || '—')}</b>
              <em>${esc(x.tn.name)} · ${x.roundLabel} · ${fmtDate(x.match.date)}</em></span>
            <span class="hist-score">${x.gf}<i>–</i>${x.gc}</span>
          </li>`).join('') || '<li class="empty">Todavía no has jugado un torneo. Inscribe tu equipo y empieza.</li>'}
      </ul>
    </section>

    <section class="card" data-anim>
      <header class="card-head"><h2>Tus reservas</h2>
        <p class="card-sub">Todo lo que has apartado aquí</p></header>
      <ul class="list">
        ${reservas.slice(0, 20).map(b => {
          const c = courtById(b.courtId);
          if (!c) return '';
          const saldo = b.total - b.deposit;
          const pasada = b.date < iso(today());
          return `<li class="list-row ${pasada ? 'is-past' : ''}">
            <span class="list-ball">${ballSVG(c.sport)}</span>
            <span class="list-main"><b>${esc(c.name)}</b>
              <em>${fmtDate(b.date)} · ${fmtHour(b.start)}${b.source === 'bot' ? ' · por WhatsApp' : ''}</em></span>
            <span class="list-side"><b>${money(b.total)}</b>
              ${saldo > 0 ? `<em class="tag tag-warn">debes ${money(saldo)}</em>`
                          : '<em class="tag tag-ok">pagada</em>'}</span>
          </li>`;
        }).join('') || '<li class="empty">Todavía no has reservado</li>'}
      </ul>
    </section>`;

  $$('[data-count]', main).forEach(n => {
    const isMoney = n.dataset.money === '1';
    countUp(n, +n.dataset.count, isMoney ? money : (v) => String(Math.round(v)));
  });
  $$('[data-goteam]', main).forEach(el => el.addEventListener('click', () => renderApp('miequipo')));
  stagger($$('[data-anim]', main), { y: 16, step: 50 });
}
