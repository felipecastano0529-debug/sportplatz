/* ==========================================================================
   VISTA · Torneos (lado del dueño)
   Llaves donde los ganadores avanzan solos, calendario, tabla, anotadores,
   valla menos vencida y podio.
   ========================================================================== */

import { $, $$, esc, iso, today, fmtDate, fmtDateLong, fmtHour, uid, shuffle } from '../core/util.js';
import { S, save } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import {
  ROUNDS, roundsOf, teamById, makeTournament, resolveBracket,
  winnerOf, standings, cleanSheets, podium, freeSlots, reseed
} from '../core/tournament.js';
import { teamOf, rosterOf, crestSVG } from '../core/teams.js';
import { EQUIPOS } from '../core/seed.js';
import { icon } from '../ui/icons.js';
import { enter, stagger } from '../ui/motion.js';
import { openModal, toast } from '../ui/modal.js';
import { pageHead, renderApp } from '../ui/shell.js';

let openTn = null;
let tnTab = 'llaves';

export const getOpenTn = () => openTn ? S.tournaments.find(t => t.id === openTn) || null : null;

export function viewTorneos(main) {
  if (openTn && S.tournaments.some(t => t.id === openTn)) return viewTorneoDetail(main);

  main.innerHTML = `
    ${pageHead('Competencias', 'Torneos',
      `<button class="btn btn-primary btn-sm" id="newTn">${icon('plus')}Crear torneo</button>`,
      `${S.tournaments.length} ${S.tournaments.length === 1 ? 'torneo' : 'torneos'} · los equipos se inscriben solos desde su cuenta`)}
    <div class="tn-grid">
      ${S.tournaments.map((tn, i) => {
        const p = podium(tn);
        const jugados = tn.matches.filter(m => m.played).length;
        const libres = freeSlots(tn);
        return `<article class="tn-card" data-anim style="--i:${i}" data-tn="${tn.id}" tabindex="0" role="button">
          <span class="tn-bg">${ballSVG(tn.sport)}</span>
          <p class="kicker">${SPORTS[tn.sport].name} · ${tn.size} equipos</p>
          <h2 class="tn-name">${esc(tn.name)}</h2>
          <p class="tn-meta">Arrancó el ${fmtDate(tn.startDate)} · ${jugados} de ${tn.matches.length} partidos jugados</p>
          <div class="tn-prog"><i style="--w:${(jugados / tn.matches.length) * 100}%"></i></div>
          <p class="tn-champ">${p.oro
            ? `${icon('trophy', 'ic ic-sm')} Campeón: <b>${esc(p.oro.name)}</b>`
            : tn.openSignup && libres
              ? `${icon('users', 'ic ic-sm')} Inscripciones abiertas · <b>${libres} ${libres === 1 ? 'cupo' : 'cupos'}</b>`
              : `${icon('clock', 'ic ic-sm')} En juego`}</p>
        </article>`;
      }).join('') || `<div class="empty-big">
        <p>Todavía no hay torneos.</p>
        <button class="btn btn-primary" id="newTn2">Crear el primero</button>
      </div>`}
    </div>`;

  $$('[data-tn]', main).forEach(el => {
    const go = () => { openTn = el.dataset.tn; tnTab = 'llaves'; renderApp('torneos'); };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  ['#newTn', '#newTn2'].forEach(s => $(s, main)?.addEventListener('click', () => openTnForm()));
  stagger($$('[data-anim]', main), { y: 16, step: 60 });
}

const TN_TABS = [
  { id: 'llaves',   label: 'Llaves' },
  { id: 'fixture',  label: 'Calendario' },
  { id: 'tabla',    label: 'Posiciones' },
  { id: 'goleador', label: 'Anotadores' },
  { id: 'valla',    label: 'Valla menos vencida' },
  { id: 'podio',    label: 'Podio' }
];

export function viewTorneoDetail(main) {
  const tn = S.tournaments.find(t => t.id === openTn);
  if (!tn) { openTn = null; return viewTorneos(main); }
  resolveBracket(tn); save();

  main.innerHTML = `
    <header class="page-head">
      <div>
        <button class="back" id="tnBack">${icon('left', 'ic ic-sm')}Torneos</button>
        <p class="kicker">${SPORTS[tn.sport].name} · ${tn.size} equipos · desde ${fmtDate(tn.startDate)}</p>
        <h1 class="page-title">${esc(tn.name)}</h1>
      </div>
      <div class="page-tools">
        <button class="btn btn-secondary btn-sm" id="tnShuffle">${icon('swap')}Sortear cruces</button>
        <button class="btn btn-secondary btn-sm" id="tnEdit">${icon('pencil')}Editar</button>
      </div>
    </header>
    <nav class="tabs" role="tablist">
      ${TN_TABS.map(t => `<button class="tab ${t.id === tnTab ? 'is-on' : ''}" data-tab="${t.id}"
          role="tab" aria-selected="${t.id === tnTab}">${t.label}</button>`).join('')}
    </nav>
    <div id="tnPane"></div>`;

  $('#tnBack').addEventListener('click', () => { openTn = null; renderApp('torneos'); });
  $('#tnEdit').addEventListener('click', () => openTnForm(tn));
  $('#tnShuffle').addEventListener('click', () => {
    if (tn.matches.some(m => m.played)) {
      openModal({
        title: 'Sortear de nuevo',
        body: '<p class="hint">Ya hay partidos jugados. Sortear los cruces borra todos los marcadores del torneo.</p>',
        confirm: 'Sortear igual',
        onConfirm() { reseed(tn); save(); viewTorneoDetail(main); toast('Cruces sorteados'); }
      });
      return;
    }
    reseed(tn); save(); viewTorneoDetail(main); toast('Cruces sorteados');
  });
  $$('[data-tab]', main).forEach(b => b.addEventListener('click', () => {
    tnTab = b.dataset.tab; viewTorneoDetail(main);
  }));

  const pane = $('#tnPane');
  ({ llaves: paneBracket, fixture: paneFixture, tabla: paneTable,
     goleador: paneScorers, valla: paneClean, podio: panePodium }[tnTab])(pane, tn);
  enter(pane, { y: 12, dur: 380 });
}

/* ── Llaves ──────────────────────────────────────────────────────────────── */

function paneBracket(pane, tn) {
  const rs = roundsOf(tn);
  pane.innerHTML = `
    <p class="pane-note">Toca cualquier partido para poner el marcador. Los ganadores avanzan solos.</p>
    <div class="bracket-wrap">
      <div class="bracket" style="--rounds:${rs.length}">
        ${rs.map(r => `
          <div class="br-col">
            <h3 class="br-title">${r.label}</h3>
            <div class="br-slots">
              ${tn.matches.filter(m => m.round === r.key).sort((a, b) => a.idx - b.idx).map(m => matchCard(tn, m)).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div class="br-third">
      <h3 class="br-title">Tercer puesto</h3>
      ${matchCard(tn, tn.matches.find(m => m.isThird))}
    </div>`;
  wireMatches(pane, tn);
  stagger($$('.br-match', pane), { y: 10, step: 30 });
}

function matchCard(tn, m) {
  if (!m) return '';
  const A = teamById(tn, m.teamA), B = teamById(tn, m.teamB);
  const w = winnerOf(m);
  const side = (T, score, isW) => `
    <span class="br-side ${isW ? 'is-w' : ''} ${T ? '' : 'is-tbd'}">
      <i class="br-chip" style="background:${T ? T.color : 'var(--line-3)'}"></i>
      <b>${T ? esc(T.name) : 'Por definir'}</b>
      <em>${score ?? '–'}</em>
    </span>`;
  return `<button class="br-match ${m.played ? 'is-played' : ''}" data-match="${m.id}">
    ${side(A, m.scoreA, w && w === m.teamA)}
    ${side(B, m.scoreB, w && w === m.teamB)}
    <span class="br-when">${fmtDate(m.date)} · ${fmtHour(m.time)}${m.court ? ' · ' + esc(m.court) : ''}</span>
  </button>`;
}

function wireMatches(pane, tn) {
  $$('[data-match]', pane).forEach(b => b.addEventListener('click', () => openMatch(tn, b.dataset.match)));
}

export function openMatch(tn, mid) {
  const m = tn.matches.find(x => x.id === mid);
  const A = teamById(tn, m.teamA), B = teamById(tn, m.teamB);
  if (!A || !B) { toast('Ese partido todavía espera a que se definan los equipos', 'warn'); return; }
  const unit = SPORTS[tn.sport].unit;
  const courtOpts = ['<option value="">— sin asignar —</option>',
    ...S.courts.map(c => `<option ${m.court === c.name ? 'selected' : ''}>${esc(c.name)}</option>`)].join('');

  openModal({
    title: `${A.name} vs ${B.name}`,
    body: `
      <div class="score-set">
        <div class="score-side">
          <i class="br-chip" style="background:${A.color}"></i>
          <b>${esc(A.name)}</b>
          <input id="sA" class="score-in" type="number" min="0" max="99" value="${m.scoreA ?? ''}" placeholder="0">
        </div>
        <span class="score-x">–</span>
        <div class="score-side">
          <i class="br-chip" style="background:${B.color}"></i>
          <b>${esc(B.name)}</b>
          <input id="sB" class="score-in" type="number" min="0" max="99" value="${m.scoreB ?? ''}" placeholder="0">
        </div>
      </div>
      <p class="hint">${unit[0].toUpperCase() + unit.slice(1)} de cada equipo. En eliminación directa no puede quedar empate.</p>
      <div class="form-grid">
        <label class="field"><span class="field-label">Fecha</span>
          <input id="mDate" class="input" type="date" value="${m.date}"></label>
        <label class="field"><span class="field-label">Hora</span>
          <input id="mTime" class="input" type="time" value="${m.time}"></label>
        <label class="field field-full"><span class="field-label">Cancha</span>
          <select id="mCourt" class="input">${courtOpts}</select></label>
      </div>`,
    confirm: 'Guardar resultado',
    extra: m.played ? { label: 'Borrar marcador', run() {
      m.scoreA = m.scoreB = null; m.played = false;
      resolveBracket(tn); save(); viewTorneoDetail($('.main-inner'));
    } } : null,
    onConfirm() {
      const a = $('#sA').value === '' ? null : Math.max(0, +$('#sA').value);
      const b = $('#sB').value === '' ? null : Math.max(0, +$('#sB').value);
      m.date = $('#mDate').value; m.time = $('#mTime').value; m.court = $('#mCourt').value;
      if (a == null || b == null) { m.played = false; m.scoreA = m.scoreB = null; }
      else if (a === b) { toast('No puede quedar empate: es eliminación directa', 'warn'); return false; }
      else { m.scoreA = a; m.scoreB = b; m.played = true; }
      resolveBracket(tn); save(); viewTorneoDetail($('.main-inner'));
      if (m.played) toast(`${a > b ? A.name : B.name} avanza`);
    }
  });
}

/* ── Calendario ──────────────────────────────────────────────────────────── */

function paneFixture(pane, tn) {
  const rs = [...roundsOf(tn), { key: 'tercero', label: 'Tercer puesto' }];
  const all = rs.flatMap(r => tn.matches.filter(m => m.round === r.key)
    .sort((a, b) => a.idx - b.idx).map(m => ({ m, r })));
  const byDate = {};
  all.forEach(({ m, r }) => (byDate[m.date] ??= []).push({ m, r }));

  pane.innerHTML = `
    <p class="pane-note">Cada cuánto juegan, a qué hora y en cuál cancha. Toca para editar.</p>
    ${Object.keys(byDate).sort().map(d => `
      <section class="fx-day">
        <h3 class="fx-date">${fmtDateLong(d)}</h3>
        <ul class="fx-list">
          ${byDate[d].sort((a, b) => a.m.time.localeCompare(b.m.time)).map(({ m, r }) => {
            const A = teamById(tn, m.teamA), B = teamById(tn, m.teamB);
            return `<li><button class="fx-row ${m.played ? 'is-played' : ''}" data-match="${m.id}">
              <span class="fx-time">${fmtHour(m.time)}</span>
              <span class="fx-round">${r.label}</span>
              <span class="fx-teams">
                <b class="${winnerOf(m) === m.teamA ? 'is-w' : ''}">${A ? esc(A.name) : 'Por definir'}</b>
                <em>${m.played ? `${m.scoreA} – ${m.scoreB}` : 'vs'}</em>
                <b class="${winnerOf(m) === m.teamB ? 'is-w' : ''}">${B ? esc(B.name) : 'Por definir'}</b>
              </span>
              <span class="fx-court">${m.court ? esc(m.court) : '—'}</span>
            </button></li>`;
          }).join('')}
        </ul>
      </section>`).join('')}`;
  wireMatches(pane, tn);
}

/* ── Tabla ───────────────────────────────────────────────────────────────── */

function paneTable(pane, tn) {
  const rows = standings(tn);
  pane.innerHTML = `
    <p class="pane-note">Se ordena por puntos, luego diferencia, luego valla menos vencida.</p>
    <div class="table-wrap"><table class="table">
      <thead><tr>
        <th class="c">#</th><th>Equipo</th><th class="c">PJ</th><th class="c">G</th><th class="c">E</th><th class="c">P</th>
        <th class="c">GF</th><th class="c">GC</th><th class="c">DIF</th><th class="c">PTS</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => `<tr class="${i < 4 ? 'is-top' : ''}">
          <td class="c num">${i + 1}</td>
          <td><span class="tm"><i class="br-chip" style="background:${r.team.color}"></i>${esc(r.team.name)}</span></td>
          <td class="c num">${r.pj}</td><td class="c num">${r.g}</td><td class="c num">${r.e}</td><td class="c num">${r.p}</td>
          <td class="c num">${r.gf}</td><td class="c num">${r.gc}</td>
          <td class="c num ${r.dif > 0 ? 'ok' : r.dif < 0 ? 'neg' : ''}">${r.dif > 0 ? '+' : ''}${r.dif}</td>
          <td class="c num strong">${r.pts}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  stagger($$('tbody tr', pane), { y: 6, step: 22 });
}

/* ── Anotadores ──────────────────────────────────────────────────────────── */

function paneScorers(pane, tn) {
  const unit = SPORTS[tn.sport].unit;
  const rows = (tn.scorers || []).filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals);
  const max = rows[0]?.goals || 1;

  pane.innerHTML = `
    <p class="pane-note">Quién ha hecho más ${unit}. Toca a un jugador para ajustarle el número.</p>
    <ol class="scorers">
      ${rows.map((s, i) => {
        const t = teamById(tn, s.team);
        return `<li class="sc-row ${i === 0 ? 'is-first' : ''}" data-scorer="${s.id}" tabindex="0" role="button">
          <span class="sc-n">${String(i + 1).padStart(2, '0')}</span>
          <span class="sc-who"><b>${esc(s.player)}</b>
            <em><i class="br-chip" style="background:${t?.color || 'var(--line-3)'}"></i>${esc(t?.name || '—')}</em></span>
          <span class="sc-track"><i style="--w:${(s.goals / max) * 100}%; --i:${i}"></i></span>
          <span class="sc-goals"><b>${s.goals}</b><em>${unit}</em></span>
        </li>`;
      }).join('') || '<li class="empty">Todavía nadie anota</li>'}
    </ol>
    <button class="btn btn-secondary btn-sm" id="addScorer">${icon('plus')}Agregar jugador</button>`;

  $$('[data-scorer]', pane).forEach(el => el.addEventListener('click', () => {
    const s = tn.scorers.find(x => x.id === el.dataset.scorer);
    openModal({
      title: s.player,
      body: `<div class="form-grid">
        <label class="field field-full"><span class="field-label">Jugador</span>
          <input id="pName" class="input" value="${esc(s.player)}"></label>
        <label class="field field-full"><span class="field-label">${unit[0].toUpperCase() + unit.slice(1)}</span>
          <input id="pGoals" class="input" type="number" min="0" value="${s.goals}"></label>
      </div>`,
      confirm: 'Guardar',
      onConfirm() {
        s.player = $('#pName').value.trim() || s.player;
        s.goals = Math.max(0, +$('#pGoals').value || 0);
        save(); viewTorneoDetail($('.main-inner'));
      }
    });
  }));

  $('#addScorer').addEventListener('click', () => {
    const opts = tn.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    openModal({
      title: 'Agregar jugador',
      body: `<div class="form-grid">
        <label class="field field-full"><span class="field-label">Nombre</span>
          <input id="nName" class="input" placeholder="Nombre del jugador"></label>
        <label class="field"><span class="field-label">Equipo</span>
          <select id="nTeam" class="input">${opts}</select></label>
        <label class="field"><span class="field-label">${unit[0].toUpperCase() + unit.slice(1)}</span>
          <input id="nGoals" class="input" type="number" min="0" value="1"></label>
      </div>`,
      confirm: 'Agregar',
      onConfirm() {
        const slotId = $('#nTeam').value;
        const slot = tn.teams.find(t => t.id === slotId);
        const real = slot?.teamId ? teamOf(slot.teamId) : null;
        const nombre = $('#nName').value.trim() || 'Jugador';
        // Si el nombre coincide con alguien de la plantilla real, se enlaza:
        // así el gol también cuenta en el histórico de ese jugador.
        const match = real ? rosterOf(real).find(p => p.name.toLowerCase() === nombre.toLowerCase()) : null;
        tn.scorers.push({
          id: uid('s'), team: slotId, playerId: match?.id ?? null,
          player: nombre, goals: Math.max(0, +$('#nGoals').value || 0)
        });
        save(); viewTorneoDetail($('.main-inner'));
      }
    });
  });
  stagger($$('.sc-row', pane), { y: 8, step: 30 });
}

/* ── Valla ───────────────────────────────────────────────────────────────── */

function paneClean(pane, tn) {
  const rows = cleanSheets(tn);
  const best = rows[0];
  pane.innerHTML = `
    <p class="pane-note">Valla menos vencida: el equipo que menos ${SPORTS[tn.sport].unit} ha recibido.</p>
    ${best ? `<div class="hero-stat">
      <span class="hero-ball">${ballSVG(tn.sport)}</span>
      <div><p class="kicker">Menos vencida</p>
      <h2>${esc(best.team.name)}</h2>
      <p>${best.gc} recibido${best.gc === 1 ? '' : 's'} en ${best.pj} partido${best.pj === 1 ? '' : 's'} · ${(best.gc / best.pj).toFixed(1)} por partido</p></div>
    </div>` : ''}
    <div class="table-wrap"><table class="table">
      <thead><tr><th class="c">#</th><th>Equipo</th><th class="c">PJ</th><th class="c">Recibidos</th><th class="c">Promedio</th><th class="c">Vallas en cero</th></tr></thead>
      <tbody>
        ${rows.map((r, i) => {
          const zeros = tn.matches.filter(m => m.played &&
            ((m.teamA === r.team.id && m.scoreB === 0) || (m.teamB === r.team.id && m.scoreA === 0))).length;
          return `<tr class="${i === 0 ? 'is-top' : ''}">
            <td class="c num">${i + 1}</td>
            <td><span class="tm"><i class="br-chip" style="background:${r.team.color}"></i>${esc(r.team.name)}</span></td>
            <td class="c num">${r.pj}</td><td class="c num strong">${r.gc}</td>
            <td class="c num">${(r.gc / r.pj).toFixed(1)}</td><td class="c num">${zeros}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="6" class="empty">Aún no hay partidos jugados</td></tr>'}
      </tbody>
    </table></div>`;
  stagger($$('tbody tr', pane), { y: 6, step: 24 });
}

/* ── Podio ───────────────────────────────────────────────────────────────── */

function panePodium(pane, tn) {
  const p = podium(tn);
  const box = (T, place, label) => `
    <div class="pod pod-${place} ${T ? '' : 'is-tbd'}">
      <span class="pod-place">${place}</span>
      <span class="pod-ball">${ballSVG(tn.sport)}</span>
      <b class="pod-name">${T ? esc(T.name) : 'Por definir'}</b>
      <em class="pod-label">${label}</em>
    </div>`;
  pane.innerHTML = `
    <p class="pane-note">El podio se llena solo cuando se juegan la final y el tercer puesto.</p>
    <div class="podium">
      ${box(p.plata, 2, 'Subcampeón')}
      ${box(p.oro, 1, 'Campeón')}
      ${box(p.bronce, 3, 'Tercer lugar')}
    </div>
    ${p.oro ? `<p class="pod-final">${esc(p.oro.name)} se quedó con la ${esc(tn.name)}.</p>` : ''}`;
  const nodes = $$('.pod', pane);
  [nodes[1], nodes[0], nodes[2]].filter(Boolean).forEach((n, i) =>
    enter(n, { y: 26, delay: i * 110, dur: 620, bounce: true }));
}

/* ── Alta y edición ──────────────────────────────────────────────────────── */

export function openTnForm(tn = null) {
  const editing = !!tn;
  const size = tn?.size ?? 8;
  const names = tn ? tn.teams.map(t => t.name) : EQUIPOS.slice(0, size);
  const sportOpts = S.business.sports.map(id =>
    `<option value="${id}" ${tn?.sport === id ? 'selected' : ''}>${SPORTS[id].name}</option>`).join('');

  openModal({
    title: editing ? 'Editar torneo' : 'Crear torneo',
    wide: true,
    body: `
      <div class="form-grid">
        <label class="field field-full"><span class="field-label">Nombre del torneo</span>
          <input id="tName" class="input" placeholder="Copa Apertura" value="${esc(tn?.name || '')}"></label>
        <label class="field"><span class="field-label">Deporte</span>
          <select id="tSport" class="input">${sportOpts}</select></label>
        <label class="field"><span class="field-label">Arranca</span>
          <input id="tDate" class="input" type="date" value="${tn?.startDate || iso(today())}"></label>
        <div class="field field-full"><span class="field-label">Cuántos equipos</span>
          <div class="seg" id="tSize">
            ${[4, 8, 16].map(n => `<button type="button" class="seg-b ${n === size ? 'is-on' : ''}" data-size="${n}">${n} equipos</button>`).join('')}
          </div>
          <p class="hint" id="tRounds"></p></div>
        <label class="field field-full check-row">
          <input type="checkbox" id="tOpen" ${tn?.openSignup ?? !editing ? 'checked' : ''}>
          <span><b>Abierto a inscripción</b>
            <em>Los jugadores pueden meter su equipo en un cupo libre desde su cuenta.</em></span>
        </label>
      </div>
      <div class="teams-head"><span class="field-label">Equipos</span>
        <button type="button" class="mini" id="tShuffle">Barajar orden</button></div>
      <div class="teams" id="tTeams"></div>
      ${editing ? '<p class="hint">Cambiar el número de equipos reinicia las llaves y los marcadores.</p>' : ''}`,
    confirm: editing ? 'Guardar cambios' : 'Crear torneo',
    danger: editing ? 'Eliminar torneo' : null,
    onDanger() {
      S.tournaments = S.tournaments.filter(x => x.id !== tn.id);
      openTn = null; save(); renderApp('torneos'); toast('Torneo eliminado', 'warn');
    },
    onConfirm() {
      const n = $('#tName').value.trim() || 'Torneo sin nombre';
      const sz = +$('.seg-b.is-on', $('#tSize')).dataset.size;
      const teamNames = $$('#tTeams input[type=text]').map(i => i.value);
      const abierto = $('#tOpen').checked;
      const payload = { name: n, sport: $('#tSport').value, size: sz, startDate: $('#tDate').value, teamNames, openSignup: abierto };

      if (editing && sz === tn.size) {
        tn.name = n; tn.sport = payload.sport; tn.startDate = payload.startDate;
        tn.openSignup = abierto;
        tn.teams.forEach((t, i) => { t.name = teamNames[i] || t.name; });
      } else {
        const fresh = makeTournament(payload);
        if (editing) { fresh.id = tn.id; S.tournaments[S.tournaments.indexOf(tn)] = fresh; }
        else { S.tournaments.push(fresh); openTn = fresh.id; }
      }
      tnTab = 'llaves'; save(); renderApp('torneos');
      toast(editing ? 'Torneo actualizado' : `"${n}" creado con ${sz} equipos`);
    }
  });

  const paintTeams = (n, vals) => {
    $('#tTeams').innerHTML = Array.from({ length: n }, (_, i) => `
      <label class="team-in"><i>${String(i + 1).padStart(2, '0')}</i>
        <input type="text" value="${esc(vals[i] || EQUIPOS[i % EQUIPOS.length])}" placeholder="Equipo ${i + 1}"></label>`).join('');
    $('#tRounds').textContent = ROUNDS[n].map(r => r.label).join(' → ') + ' → Tercer puesto';
  };
  paintTeams(size, names);

  $$('#tSize .seg-b').forEach(b => b.addEventListener('click', () => {
    $$('#tSize .seg-b').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    paintTeams(+b.dataset.size, $$('#tTeams input[type=text]').map(i => i.value));
  }));
  $('#tShuffle').addEventListener('click', () => {
    const vals = shuffle($$('#tTeams input[type=text]').map(i => i.value));
    $$('#tTeams input[type=text]').forEach((i, k) => {
      i.value = vals[k];
      i.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 260, delay: k * 25 });
    });
  });
}
