/* ==========================================================================
   UI · Fichas de equipo y de jugador
   Las miran los dos roles: el dueño desde su directorio y el jugador desde su
   histórico. Por eso viven aquí y no dentro de una vista.

   Todo lo que muestran se deriva de los partidos; no hay ni un total
   guardado. Corregir un marcador actualiza la ficha sin tocar nada más.
   ========================================================================== */

import { esc, initials, fmtDate, firstName } from '../core/util.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import {
  teamRecord, matchesOfTeam, rosterOf, crestSVG,
  playerRecord, goalsOfPlayer, teamsOfPlayer, playerOf
} from '../core/teams.js';
import { icon } from './icons.js';
import { ring } from './chart.js';

/* La racha se lee de izquierda a derecha como una línea de tiempo: el más
   viejo primero. Cada resultado es una letra sobre su color, no un emoji. */
export const rachaHTML = (racha) => racha.length
  ? `<span class="racha">${racha.map(r =>
      `<i class="ra ra--${r}" title="${r === 'G' ? 'Ganó' : r === 'E' ? 'Empató' : 'Perdió'}">${r}</i>`).join('')}</span>`
  : '<span class="racha racha--empty">sin partidos</span>';

export const avatarHTML = (p, cls = '') => p?.avatar
  ? `<span class="avatar ${cls} avatar--img" style="--tc:${p.color}"><img src="${esc(p.avatar)}" alt=""></span>`
  : `<span class="avatar ${cls}" style="--tc:${p?.color || 'var(--accent)'}">${esc(initials(p?.name || '?'))}</span>`;

/* ── Ficha de equipo ─────────────────────────────────────────────────────── */

export function teamSheet(team) {
  const r = teamRecord(team.id);
  const rows = matchesOfTeam(team.id);
  const plantilla = rosterOf(team);
  const sp = SPORTS[team.sport] || SPORTS.futbol;

  return `
    <div class="sheet" data-sport="${team.sport}">
      <header class="sheet-head">
        ${crestSVG(team, 'crest--xl')}
        <div class="sheet-id">
          <p class="kicker">${sp.name} · desde ${fmtDate(team.created)}</p>
          <h2 class="sheet-name">${esc(team.name)}</h2>
          ${rachaHTML(r.racha)}
        </div>
        <div class="sheet-ring">
          ${ring(r.efectividad, { size: 66, stroke: 6 })}
          <span class="sheet-ring-v"><b>${(r.efectividad * 100).toFixed(0)}%</b><em>efectividad</em></span>
        </div>
      </header>

      <dl class="sheet-facts">
        <div><dt>Jugados</dt><dd>${r.pj}</dd></div>
        <div><dt>Ganados</dt><dd class="ok">${r.g}</dd></div>
        <div><dt>Empatados</dt><dd>${r.e}</dd></div>
        <div><dt>Perdidos</dt><dd class="neg">${r.p}</dd></div>
        <div><dt>A favor</dt><dd>${r.gf}</dd></div>
        <div><dt>En contra</dt><dd>${r.gc}</dd></div>
        <div><dt>Diferencia</dt><dd class="${r.dif > 0 ? 'ok' : r.dif < 0 ? 'neg' : ''}">${r.dif > 0 ? '+' : ''}${r.dif}</dd></div>
        <div><dt>Títulos</dt><dd class="strong">${r.titulos.length}</dd></div>
      </dl>

      ${r.titulos.length ? `<p class="sheet-titles">${icon('trophy', 'ic ic-sm')}
        ${r.titulos.map(t => `<b>${esc(t.name)}</b>`).join(' · ')}</p>` : ''}

      <section class="sheet-block">
        <h3>Plantilla <em>${plantilla.length} ${plantilla.length === 1 ? 'jugador' : 'jugadores'}</em></h3>
        <ul class="roster">
          ${plantilla.map(p => {
            const g = goalsOfPlayer(p.id).total;
            return `<li class="roster-row" data-player="${p.id}" tabindex="0" role="button">
              ${avatarHTML(p, 'avatar--sm')}
              <span class="roster-main"><b>${esc(p.name)}</b><em>${esc(p.position || sp.name)}</em></span>
              ${p.id === team.captainId ? '<span class="tag tag-cap">Capitán</span>' : ''}
              <span class="roster-g"><b>${g}</b><em>${sp.unit}</em></span>
            </li>`;
          }).join('') || '<li class="empty">Todavía no hay nadie en la plantilla</li>'}
        </ul>
      </section>

      <section class="sheet-block">
        <h3>Histórico de partidos <em>${rows.length}</em></h3>
        <ul class="hist">
          ${rows.map(x => `
            <li class="hist-row hist--${x.result}">
              <span class="hist-res">${x.result}</span>
              <span class="hist-main">
                <b>${esc(x.rival?.name || 'Por definir')}</b>
                <em>${esc(x.tn.name)} · ${x.roundLabel} · ${fmtDate(x.match.date)}</em>
              </span>
              <span class="hist-score">${x.gf}<i>–</i>${x.gc}</span>
            </li>`).join('') || '<li class="empty">Este equipo todavía no ha jugado</li>'}
        </ul>
      </section>
    </div>`;
}

/* ── Ficha de jugador ────────────────────────────────────────────────────── */

export function playerSheet(playerId) {
  const p = playerOf(playerId);
  if (!p) return '<p class="empty">Ese jugador ya no existe</p>';
  const r = playerRecord(playerId);
  const sp = SPORTS[r.teams[0]?.sport] || SPORTS.futbol;

  return `
    <div class="sheet">
      <header class="sheet-head">
        ${avatarHTML(p, 'avatar--xl')}
        <div class="sheet-id">
          <p class="kicker">${esc(p.position || 'Jugador')} · desde ${fmtDate(p.since)}</p>
          <h2 class="sheet-name">${esc(p.name)}</h2>
          ${rachaHTML(r.racha)}
        </div>
        <div class="sheet-ring">
          ${ring(r.pj ? r.g / r.pj : 0, { size: 66, stroke: 6 })}
          <span class="sheet-ring-v"><b>${r.pj ? Math.round(r.g / r.pj * 100) : 0}%</b><em>victorias</em></span>
        </div>
      </header>

      <dl class="sheet-facts">
        <div><dt>Partidos</dt><dd>${r.pj}</dd></div>
        <div><dt>Ganados</dt><dd class="ok">${r.g}</dd></div>
        <div><dt>Perdidos</dt><dd class="neg">${r.p}</dd></div>
        <div><dt>${sp.unit[0].toUpperCase() + sp.unit.slice(1)}</dt><dd class="strong">${r.goles}</dd></div>
        <div><dt>Por partido</dt><dd>${r.porPartido.toFixed(2)}</dd></div>
        <div><dt>Títulos</dt><dd>${r.titulos.length}</dd></div>
      </dl>

      <section class="sheet-block">
        <h3>Equipos <em>${r.teams.length}</em></h3>
        <ul class="team-chips">
          ${r.teams.map(t => `<li><button class="team-chip" data-team="${t.id}">
            ${crestSVG(t, 'crest--sm')}<b>${esc(t.name)}</b>
            <em>${SPORTS[t.sport]?.short || ''}</em></button></li>`).join('')
            || '<li class="empty">Todavía no pertenece a ningún equipo</li>'}
        </ul>
      </section>

      <section class="sheet-block">
        <h3>Sus partidos <em>${r.rows.length}</em></h3>
        <ul class="hist">
          ${r.rows.slice(0, 24).map(x => `
            <li class="hist-row hist--${x.result}">
              <span class="hist-res">${x.result}</span>
              <span class="hist-main">
                <b>${esc(x.team.name)} vs ${esc(x.rival?.name || '—')}</b>
                <em>${esc(x.tn.name)} · ${x.roundLabel} · ${fmtDate(x.match.date)}</em>
              </span>
              <span class="hist-score">${x.gf}<i>–</i>${x.gc}</span>
            </li>`).join('') || '<li class="empty">Todavía no ha jugado</li>'}
        </ul>
      </section>
    </div>`;
}

/* ── Tarjeta compacta de equipo, para las rejillas ───────────────────────── */

export function teamCard(team, i = 0) {
  const r = teamRecord(team.id);
  const sp = SPORTS[team.sport] || SPORTS.futbol;
  return `<article class="team-card" data-team="${team.id}" data-anim style="--i:${i}" tabindex="0" role="button">
    <span class="team-bg">${ballSVG(team.sport)}</span>
    ${crestSVG(team, 'crest--lg')}
    <h2 class="team-name">${esc(team.name)}</h2>
    <p class="team-meta">${sp.short} · ${team.roster.length} ${team.roster.length === 1 ? 'jugador' : 'jugadores'}</p>
    ${rachaHTML(r.racha)}
    <dl class="team-facts">
      <div><dt>PJ</dt><dd>${r.pj}</dd></div>
      <div><dt>G</dt><dd class="ok">${r.g}</dd></div>
      <div><dt>DIF</dt><dd class="${r.dif > 0 ? 'ok' : r.dif < 0 ? 'neg' : ''}">${r.dif > 0 ? '+' : ''}${r.dif}</dd></div>
      <div><dt>Títulos</dt><dd class="strong">${r.titulos.length}</dd></div>
    </dl>
  </article>`;
}

/* ── Tarjeta compacta de jugador ─────────────────────────────────────────── */

export function playerCard(p, i = 0) {
  const r = playerRecord(p.id);
  return `<article class="pl-card" data-player="${p.id}" data-anim style="--i:${i}" tabindex="0" role="button">
    ${avatarHTML(p, 'avatar--lg')}
    <h2 class="pl-name">${esc(p.name)}</h2>
    <p class="pl-meta">${esc(p.position || 'Jugador')}${r.teams[0] ? ' · ' + esc(r.teams[0].name) : ''}</p>
    <dl class="pl-facts">
      <div><dt>PJ</dt><dd>${r.pj}</dd></div>
      <div><dt>Anotó</dt><dd class="strong">${r.goles}</dd></div>
      <div><dt>Ganó</dt><dd class="ok">${r.g}</dd></div>
    </dl>
  </article>`;
}
