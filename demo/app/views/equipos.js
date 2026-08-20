/* ==========================================================================
   VISTA · Equipos (lado del dueño)
   El directorio del complejo: qué clubes juegan aquí, quiénes son sus
   jugadores y quién manda en el salón de la fama.
   ========================================================================== */

import { $, $$, esc } from '../core/util.js';
import { S, save } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import { teamOf, playerOf, teamLeaderboard, topScorersAllTime, crestSVG } from '../core/teams.js';
import { icon } from '../ui/icons.js';
import { enter, stagger } from '../ui/motion.js';
import { openModal } from '../ui/modal.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { teamCard, playerCard, teamSheet, playerSheet, avatarHTML } from '../ui/fichas.js';
import { openTeamForm, openPlayerForm } from '../player/equipo.js';

let tab = 'equipos';
let sportFilter = 'all';

const TABS = [
  { id: 'equipos',   label: 'Equipos' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'fama',      label: 'Salón de la fama' }
];

export function viewEquipos(main) {
  const teams = (S.teams || []).filter(t => sportFilter === 'all' || t.sport === sportFilter);
  const players = S.players || [];

  main.innerHTML = `
    ${pageHead('Comunidad', 'Equipos y jugadores',
      `<button class="btn btn-primary btn-sm" id="newTeam">${icon('plus')}Crear equipo</button>`,
      `${(S.teams || []).length} equipos · ${players.length} jugadores registrados`)}

    <nav class="tabs" role="tablist">
      ${TABS.map(t => `<button class="tab ${t.id === tab ? 'is-on' : ''}" data-tab="${t.id}"
        role="tab" aria-selected="${t.id === tab}">${t.label}</button>`).join('')}
    </nav>
    <div id="eqPane"></div>`;

  $$('[data-tab]', main).forEach(b => b.addEventListener('click', () => {
    tab = b.dataset.tab; viewEquipos(main);
  }));
  $('#newTeam').addEventListener('click', () => openTeamForm(null, () => renderApp('equipos')));

  const pane = $('#eqPane');
  ({ equipos: paneTeams, jugadores: panePlayers, fama: paneFame }[tab])(pane, teams, players);
  enter(pane, { y: 12, dur: 380 });
}

function sportFilterHTML() {
  return `<div class="filters" id="eqFilter">
    <button class="pill ${sportFilter === 'all' ? 'is-on' : ''}" data-sf="all">Todos</button>
    ${S.business.sports.map(id => `
      <button class="pill ${sportFilter === id ? 'is-on' : ''}" data-sf="${id}">
        ${ballSVG(id, 'pill-ball')}${SPORTS[id].short}</button>`).join('')}
  </div>`;
}

function wireFilter(pane) {
  $$('[data-sf]', pane).forEach(b => b.addEventListener('click', () => {
    sportFilter = b.dataset.sf;
    viewEquipos($('.main-inner'));
  }));
}

function paneTeams(pane, teams) {
  pane.innerHTML = `
    ${sportFilterHTML()}
    <div class="team-grid">
      ${teams.map((t, i) => teamCard(t, i)).join('') || `<div class="empty-big">
        <p>Todavía no hay equipos en tu complejo.</p>
        <button class="btn btn-primary" id="firstTeam">Crear el primero</button>
      </div>`}
    </div>`;
  wireFilter(pane);
  $('#firstTeam', pane)?.addEventListener('click', () => openTeamForm(null, () => renderApp('equipos')));
  wireCards(pane);
  stagger($$('[data-anim]', pane), { y: 16, step: 40 });
}

function panePlayers(pane, _teams, players) {
  pane.innerHTML = `
    <p class="pane-note">Cada jugador con cuenta lleva su propio histórico entre todos los torneos.</p>
    <div class="pl-grid">
      ${players.map((p, i) => playerCard(p, i)).join('') || '<p class="empty">Nadie se ha registrado todavía</p>'}
    </div>`;
  wireCards(pane);
  stagger($$('[data-anim]', pane), { y: 14, step: 26 });
}

function paneFame(pane) {
  const clubes = teamLeaderboard(8);
  const artilleros = topScorersAllTime(8);

  pane.innerHTML = `
    <p class="pane-note">Acumulado histórico de todos los torneos jugados en el complejo.</p>
    <div class="grid-2">
      <article class="card">
        <header class="card-head"><h2>Clubes</h2>
          <p class="card-sub">Por títulos, luego puntos</p></header>
        <ul class="rank">
          ${clubes.map((r, i) => `
            <li class="rank-row" data-team="${r.team.id}" tabindex="0" role="button">
              <span class="rank-n">${String(i + 1).padStart(2, '0')}</span>
              ${crestSVG(r.team, 'crest--sm')}
              <span class="rank-name">${esc(r.team.name)}</span>
              <span class="rank-track"><span class="rank-fill"
                style="--w:${(r.pts / (clubes[0]?.pts || 1)) * 100}%; --i:${i}"></span></span>
              <span class="rank-val">${r.titulos.length ? `${r.titulos.length} ${icon('trophy', 'ic ic-sm')}` : r.pts + ' pts'}</span>
            </li>`).join('') || '<li class="empty">Sin partidos jugados todavía</li>'}
        </ul>
      </article>

      <article class="card">
        <header class="card-head"><h2>Máximos anotadores</h2>
          <p class="card-sub">Entre todos los torneos</p></header>
        <ol class="scorers">
          ${artilleros.map((s, i) => `
            <li class="sc-row ${i === 0 ? 'is-first' : ''}" ${s.playerId ? `data-player="${s.playerId}" tabindex="0" role="button"` : ''}>
              <span class="sc-n">${String(i + 1).padStart(2, '0')}</span>
              <span class="sc-who"><b>${esc(s.name)}</b>
                <em>${s.torneos} ${s.torneos === 1 ? 'torneo' : 'torneos'}</em></span>
              <span class="sc-track"><i style="--w:${(s.goals / (artilleros[0]?.goals || 1)) * 100}%; --i:${i}"></i></span>
              <span class="sc-goals"><b>${s.goals}</b><em>anotó</em></span>
            </li>`).join('') || '<li class="empty">Nadie ha anotado todavía</li>'}
        </ol>
      </article>
    </div>`;
  wireCards(pane);
  stagger($$('.rank-row, .sc-row', pane), { y: 8, step: 24 });
}

/* ── Fichas ──────────────────────────────────────────────────────────────── */

function wireCards(root) {
  $$('[data-team]', root).forEach(el => {
    const go = () => openTeamSheet(el.dataset.team);
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  $$('[data-player]', root).forEach(el => {
    const go = () => openPlayerSheet(el.dataset.player);
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

export function openTeamSheet(teamId) {
  const team = teamOf(teamId);
  if (!team) return;
  openModal({
    title: team.name,
    wide: true,
    body: teamSheet(team),
    confirm: null,
    extra: { label: 'Editar equipo', run: () => openTeamForm(team, () => renderApp('equipos')) }
  });
  $$('[data-player]', document).forEach(el => {
    if (!el.closest('.modal')) return;
    el.addEventListener('click', () => openPlayerSheet(el.dataset.player));
  });
}

export function openPlayerSheet(playerId) {
  const p = playerOf(playerId);
  if (!p) return;
  openModal({
    title: p.name,
    wide: true,
    body: playerSheet(playerId),
    confirm: null,
    extra: { label: 'Editar jugador', run: () => openPlayerForm(p, () => renderApp('equipos')) }
  });
  $$('.modal [data-team]').forEach(el =>
    el.addEventListener('click', () => openTeamSheet(el.dataset.team)));
}
