/* ==========================================================================
   JUGADOR · Torneos
   Ver los que hay, meter tu equipo en un cupo libre y seguir la llave.
   El jugador consulta y se inscribe; los marcadores los pone el dueño.
   ========================================================================== */

import { $, $$, esc, fmtDate, fmtDateLong, fmtHour } from '../core/util.js';
import { S, save } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import {
  roundsOf, teamById, winnerOf, standings, podium, freeSlots, signUp, resolveBracket
} from '../core/tournament.js';
import { me, myTeams, teamOf, crestSVG } from '../core/teams.js';
import { icon } from '../ui/icons.js';
import { enter, stagger } from '../ui/motion.js';
import { openModal, toast } from '../ui/modal.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { openTeamForm } from './equipo.js';

let openId = null;

export function viewPlayerTorneos(main) {
  if (openId && S.tournaments.some(t => t.id === openId)) return detalle(main);

  const equipos = myTeams();
  const mios = new Set(equipos.map(t => t.id));
  const lista = S.tournaments || [];

  main.innerHTML = `
    ${pageHead('Competencias', 'Torneos', '',
      equipos.length
        ? `Inscribe ${equipos.length === 1 ? esc(equipos[0].name) : 'tu equipo'} en un cupo libre`
        : 'Crea tu equipo para poder inscribirte')}

    <div class="tn-grid">
      ${lista.map((tn, i) => {
        const libres = freeSlots(tn);
        const inscrito = tn.teams.some(t => mios.has(t.teamId));
        const p = podium(tn);
        const jugados = tn.matches.filter(m => m.played).length;
        return `<article class="tn-card ${inscrito ? 'is-mine' : ''}" data-anim style="--i:${i}"
                         data-tn="${tn.id}" tabindex="0" role="button">
          <span class="tn-bg">${ballSVG(tn.sport)}</span>
          <p class="kicker">${SPORTS[tn.sport].name} · ${tn.size} equipos</p>
          <h2 class="tn-name">${esc(tn.name)}</h2>
          <p class="tn-meta">Arranca el ${fmtDate(tn.startDate)} · ${jugados} de ${tn.matches.length} jugados</p>
          <div class="tn-prog"><i style="--w:${(jugados / tn.matches.length) * 100}%"></i></div>
          <p class="tn-champ">${
            p.oro ? `${icon('trophy', 'ic ic-sm')} Campeón: <b>${esc(p.oro.name)}</b>`
            : inscrito ? `${icon('check', 'ic ic-sm')} <b>Tu equipo está dentro</b>`
            : tn.openSignup && libres ? `${icon('users', 'ic ic-sm')} <b>${libres}</b> ${libres === 1 ? 'cupo libre' : 'cupos libres'}`
            : `${icon('clock', 'ic ic-sm')} Cupos llenos`}</p>
        </article>`;
      }).join('') || '<p class="empty">Todavía no hay torneos programados</p>'}
    </div>`;

  $$('[data-tn]', main).forEach(el => {
    const go = () => { openId = el.dataset.tn; renderApp('ptorneos'); };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  stagger($$('[data-anim]', main), { y: 16, step: 60 });
}

function detalle(main) {
  const tn = S.tournaments.find(t => t.id === openId);
  const equipos = myTeams().filter(t => t.sport === tn.sport);
  const mios = new Set(myTeams().map(t => t.id));
  const inscrito = tn.teams.find(t => mios.has(t.teamId));
  const libres = freeSlots(tn);
  const rs = roundsOf(tn);
  const rows = standings(tn);

  main.innerHTML = `
    <header class="page-head">
      <div>
        <button class="back" id="back">${icon('left', 'ic ic-sm')}Torneos</button>
        <p class="kicker">${SPORTS[tn.sport].name} · ${tn.size} equipos · desde ${fmtDate(tn.startDate)}</p>
        <h1 class="page-title">${esc(tn.name)}</h1>
      </div>
      <div class="page-tools">
        ${inscrito
          ? `<span class="stamp stamp--ok">${icon('check')}${esc(inscrito.name)} inscrito</span>`
          : tn.openSignup && libres
            ? `<button class="btn btn-primary btn-sm" id="signup">${icon('plus')}Inscribir mi equipo</button>`
            : `<span class="stamp">${icon('clock')}Inscripciones cerradas</span>`}
      </div>
    </header>

    <section class="card" data-anim>
      <header class="card-head"><h2>Equipos</h2>
        <p class="card-sub">${tn.size - libres} de ${tn.size} cupos ocupados</p></header>
      <ul class="signup-list">
        ${tn.teams.map(slot => {
          const real = slot.teamId ? teamOf(slot.teamId) : null;
          const esMio = slot.teamId && mios.has(slot.teamId);
          return `<li class="signup-row ${real ? '' : 'is-free'} ${esMio ? 'is-mine' : ''}">
            ${real ? crestSVG(real, 'crest--sm')
                   : `<span class="crest crest--empty" aria-hidden="true">${icon('plus', 'ic ic-sm')}</span>`}
            <b>${real ? esc(real.name) : 'Cupo libre'}</b>
            ${esMio ? '<span class="tag tag-ok">Tu equipo</span>' : ''}
            ${real ? `<em>${real.roster.length} ${real.roster.length === 1 ? 'jugador' : 'jugadores'}</em>` : ''}
          </li>`;
        }).join('')}
      </ul>
    </section>

    <section class="card" data-anim>
      <header class="card-head"><h2>Cómo va la llave</h2>
        <p class="card-sub">Los marcadores los carga el complejo</p></header>
      <div class="bracket-wrap">
        <div class="bracket bracket--read" style="--rounds:${rs.length}">
          ${rs.map(r => `
            <div class="br-col">
              <h3 class="br-title">${r.label}</h3>
              <div class="br-slots">
                ${tn.matches.filter(m => m.round === r.key).sort((a, b) => a.idx - b.idx).map(m => {
                  const A = teamById(tn, m.teamA), B = teamById(tn, m.teamB);
                  const w = winnerOf(m);
                  const side = (T, sc, isW) => `
                    <span class="br-side ${isW ? 'is-w' : ''} ${T ? '' : 'is-tbd'} ${T && mios.has(T.teamId) ? 'is-mine' : ''}">
                      <i class="br-chip" style="background:${T ? T.color : 'var(--line-3)'}"></i>
                      <b>${T ? esc(T.name) : 'Por definir'}</b><em>${sc ?? '–'}</em></span>`;
                  return `<div class="br-match ${m.played ? 'is-played' : ''}">
                    ${side(A, m.scoreA, w && w === m.teamA)}
                    ${side(B, m.scoreB, w && w === m.teamB)}
                    <span class="br-when">${fmtDate(m.date)} · ${fmtHour(m.time)}${m.court ? ' · ' + esc(m.court) : ''}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </section>

    ${rows.some(r => r.pj) ? `
      <section class="card" data-anim>
        <header class="card-head"><h2>Posiciones</h2></header>
        <div class="table-wrap"><table class="table">
          <thead><tr><th class="c">#</th><th>Equipo</th><th class="c">PJ</th><th class="c">G</th>
            <th class="c">E</th><th class="c">P</th><th class="c">DIF</th><th class="c">PTS</th></tr></thead>
          <tbody>
            ${rows.map((r, i) => `<tr class="${mios.has(r.team.teamId) ? 'is-mine' : ''} ${i < 4 ? 'is-top' : ''}">
              <td class="c num">${i + 1}</td>
              <td><span class="tm"><i class="br-chip" style="background:${r.team.color}"></i>${esc(r.team.name)}</span></td>
              <td class="c num">${r.pj}</td><td class="c num">${r.g}</td><td class="c num">${r.e}</td>
              <td class="c num">${r.p}</td>
              <td class="c num ${r.dif > 0 ? 'ok' : r.dif < 0 ? 'neg' : ''}">${r.dif > 0 ? '+' : ''}${r.dif}</td>
              <td class="c num strong">${r.pts}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </section>` : ''}`;

  $('#back').addEventListener('click', () => { openId = null; renderApp('ptorneos'); });
  $('#signup')?.addEventListener('click', () => inscribir(tn, equipos, main));
  stagger($$('[data-anim]', main), { y: 14, step: 50 });
}

function inscribir(tn, equipos, main) {
  if (!equipos.length) {
    openModal({
      title: 'Necesitas un equipo',
      body: `<p class="hint">Este torneo es de <b>${SPORTS[tn.sport].name}</b> y todavía no tienes
        un equipo de ese deporte. Créalo y vuelve: te toma menos de un minuto.</p>`,
      confirm: 'Crear mi equipo',
      onConfirm() { openTeamForm(null, () => renderApp('ptorneos')); }
    });
    return;
  }

  openModal({
    title: 'Inscribir en ' + tn.name,
    body: `
      <p class="hint">Quedan <b>${freeSlots(tn)}</b> cupos. Al inscribirte entras al sorteo de cruces.</p>
      <div class="who-list">
        ${equipos.map((t, i) => `
          <button type="button" class="who ${i === 0 ? 'is-on' : ''}" data-pickteam="${t.id}">
            ${crestSVG(t, 'crest--sm')}<b>${esc(t.name)}</b>
            <em>${t.roster.length} ${t.roster.length === 1 ? 'jugador' : 'jugadores'}</em>
          </button>`).join('')}
      </div>`,
    confirm: 'Inscribir',
    onConfirm() {
      const id = $('.who.is-on')?.dataset.pickteam;
      const team = teamOf(id);
      if (!team) { toast('Elige un equipo', 'warn'); return false; }
      if (tn.teams.some(t => t.teamId === team.id)) { toast('Ese equipo ya está inscrito', 'warn'); return false; }
      if (!signUp(tn, team)) { toast('Ya no quedan cupos', 'warn'); return false; }
      resolveBracket(tn);
      save();
      renderApp('ptorneos');
      toast(`${team.name} quedó inscrito en ${tn.name}`);
    }
  });

  $$('[data-pickteam]').forEach(b => b.addEventListener('click', () => {
    $$('[data-pickteam]').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
  }));
}
