/* ==========================================================================
   JUGADOR · Mi equipo
   Crearlo, ponerle escudo y color, y armar la plantilla. Es la vista que
   convierte a un cliente en alguien que vuelve: un equipo con nombre y
   escudo es algo tuyo, una reserva no.
   ========================================================================== */

import { $, $$, esc, initials, fmtDate } from '../core/util.js';
import { S, save } from '../core/store.js';
import { SPORTS, ballSVG } from '../core/sports.js';
import {
  me, myTeams, teamOf, playerOf, makeTeam, makePlayer, rosterOf,
  crestSVG, teamRecord, matchesOfTeam, POSITIONS, PLAYER_COLORS
} from '../core/teams.js';
import { icon } from '../ui/icons.js';
import { stagger, enter } from '../ui/motion.js';
import { openModal, closeModal, toast } from '../ui/modal.js';
import { readPhoto } from '../ui/photo.js';
import { pageHead, renderApp } from '../ui/shell.js';
import { teamSheet, rachaHTML, avatarHTML } from '../ui/fichas.js';
import { ring } from '../ui/chart.js';

export function viewMiEquipo(main) {
  const yo = me();
  const equipos = myTeams();

  if (!equipos.length) {
    main.innerHTML = `
      ${pageHead('Tu club', 'Mi equipo')}
      <div class="empty-hero" data-anim>
        <span class="empty-ball">${ballSVG(S.business.sports[0] || 'futbol')}</span>
        <h2>Todavía no tienes equipo</h2>
        <p>Ármalo, ponle escudo y color, mete a tus amigos y ya puedes inscribirlo
           en los torneos del complejo. Su histórico empieza en el primer partido.</p>
        <button class="btn btn-primary" id="crear">${icon('plus')}Crear mi equipo</button>
      </div>`;
    $('#crear').addEventListener('click', () => openTeamForm(null, () => renderApp('miequipo')));
    enter($('.empty-hero'), { y: 20, dur: 520 });
    return;
  }

  main.innerHTML = `
    ${pageHead('Tu club', equipos.length > 1 ? 'Mis equipos' : 'Mi equipo',
      `<button class="btn btn-secondary btn-sm" id="nuevo">${icon('plus')}Otro equipo</button>`,
      `${yo ? esc(yo.name) : ''} · ${equipos.length} ${equipos.length === 1 ? 'equipo' : 'equipos'}`)}
    ${equipos.map((t, i) => miEquipoCard(t, i)).join('')}`;

  $('#nuevo').addEventListener('click', () => openTeamForm(null, () => renderApp('miequipo')));
  $$('[data-editteam]', main).forEach(b => b.addEventListener('click', () =>
    openTeamForm(teamOf(b.dataset.editteam), () => renderApp('miequipo'))));
  $$('[data-addplayer]', main).forEach(b => b.addEventListener('click', () =>
    openAddToRoster(teamOf(b.dataset.addplayer), () => renderApp('miequipo'))));
  $$('[data-kick]', main).forEach(b => b.addEventListener('click', () => {
    const [tid, pid] = b.dataset.kick.split('|');
    const t = teamOf(tid);
    t.roster = t.roster.filter(x => x !== pid);
    if (t.captainId === pid) t.captainId = t.roster[0] || null;
    save(); renderApp('miequipo'); toast('Jugador retirado del equipo', 'warn');
  }));
  stagger($$('[data-anim]', main), { y: 16, step: 50 });
}

function miEquipoCard(t, i) {
  const r = teamRecord(t.id);
  const plantilla = rosterOf(t);
  const sp = SPORTS[t.sport] || SPORTS.futbol;
  const partidos = matchesOfTeam(t.id).slice(0, 5);
  const yo = me();

  return `<section class="card card-team" data-anim style="--i:${i}">
    <header class="team-hero" style="--tc:${t.color}">
      ${crestSVG(t, 'crest--xl')}
      <div class="team-hero-id">
        <p class="kicker">${sp.name}${t.captainId === yo?.id ? ' · eres el capitán' : ''}</p>
        <h2>${esc(t.name)}</h2>
        ${rachaHTML(r.racha)}
      </div>
      <div class="sheet-ring">
        ${ring(r.efectividad, { size: 62, stroke: 6 })}
        <span class="sheet-ring-v"><b>${(r.efectividad * 100).toFixed(0)}%</b><em>efectividad</em></span>
      </div>
      <button class="btn btn-sm btn-secondary team-hero-edit" data-editteam="${t.id}">
        ${icon('pencil')}Editar</button>
    </header>

    <dl class="sheet-facts">
      <div><dt>Jugados</dt><dd>${r.pj}</dd></div>
      <div><dt>Ganados</dt><dd class="ok">${r.g}</dd></div>
      <div><dt>Perdidos</dt><dd class="neg">${r.p}</dd></div>
      <div><dt>Diferencia</dt><dd class="${r.dif > 0 ? 'ok' : r.dif < 0 ? 'neg' : ''}">${r.dif > 0 ? '+' : ''}${r.dif}</dd></div>
      <div><dt>Títulos</dt><dd class="strong">${r.titulos.length}</dd></div>
      <div><dt>Torneos</dt><dd>${r.torneos.length}</dd></div>
    </dl>

    <section class="sheet-block">
      <h3>Plantilla <em>${plantilla.length} de ${sp.squad} recomendados</em>
        <button class="mini" data-addplayer="${t.id}">${icon('plus', 'ic ic-sm')}Agregar</button></h3>
      <ul class="roster">
        ${plantilla.map(p => `
          <li class="roster-row">
            ${avatarHTML(p, 'avatar--sm')}
            <span class="roster-main"><b>${esc(p.name)}</b><em>${esc(p.position || sp.name)}</em></span>
            ${p.id === t.captainId ? '<span class="tag tag-cap">Capitán</span>' : ''}
            ${p.id === t.captainId ? '' : `<button class="mini mini--x" data-kick="${t.id}|${p.id}"
              aria-label="Sacar a ${esc(p.name)} del equipo">${icon('close', 'ic ic-sm')}</button>`}
          </li>`).join('')}
      </ul>
    </section>

    ${partidos.length ? `<section class="sheet-block">
      <h3>Últimos partidos</h3>
      <ul class="hist">
        ${partidos.map(x => `
          <li class="hist-row hist--${x.result}">
            <span class="hist-res">${x.result}</span>
            <span class="hist-main"><b>${esc(x.rival?.name || '—')}</b>
              <em>${esc(x.tn.name)} · ${x.roundLabel} · ${fmtDate(x.match.date)}</em></span>
            <span class="hist-score">${x.gf}<i>–</i>${x.gc}</span>
          </li>`).join('')}
      </ul>
    </section>` : `<p class="empty">Todavía no han jugado. Inscríbete en un torneo desde la sección Torneos.</p>`}
  </section>`;
}

/* ── Alta y edición de equipo ────────────────────────────────────────────── */

export function openTeamForm(team = null, done = () => {}) {
  const editing = !!team;
  const yo = me();
  const sports = S.business.sports;
  let crest = team?.crest ?? null;
  let color = team?.color ?? PLAYER_COLORS[(S.teams?.length || 0) % PLAYER_COLORS.length];

  openModal({
    title: editing ? 'Editar equipo' : 'Crear mi equipo',
    body: `
      <div class="crest-editor">
        <span class="crest-preview" id="crestPrev">${crestSVG({ name: team?.name || 'Equipo', color, crest }, 'crest--xl')}</span>
        <div class="crest-tools">
          <button type="button" class="btn btn-sm btn-secondary" id="crestUp">${icon('upload')}Subir escudo</button>
          ${crest ? '<button type="button" class="mini" id="crestDel">Quitar</button>' : ''}
          <span class="swatches" id="swatches" role="radiogroup" aria-label="Color del equipo">
            ${PLAYER_COLORS.map(c => `<button type="button" class="sw ${c === color ? 'is-on' : ''}"
              style="--sw:${c}" data-color="${c}" role="radio" aria-checked="${c === color}"
              aria-label="Color ${c}"></button>`).join('')}
          </span>
        </div>
      </div>
      <div class="form-grid">
        <label class="field field-full"><span class="field-label">Nombre del equipo</span>
          <input id="tmName" class="input input-lg" maxlength="26" placeholder="Los Vikingos"
                 value="${esc(team?.name || '')}"></label>
        <label class="field field-full"><span class="field-label">Deporte</span>
          <select id="tmSport" class="input">
            ${sports.map(id => `<option value="${id}" ${team?.sport === id ? 'selected' : ''}>${SPORTS[id].name}</option>`).join('')}
          </select></label>
      </div>
      <p class="hint">El escudo es opcional: sin foto se dibuja tu inicial sobre el color que elijas.</p>`,
    confirm: editing ? 'Guardar' : 'Crear equipo',
    danger: editing && team.captainId === yo?.id ? 'Eliminar equipo' : null,
    onDanger() {
      S.teams = S.teams.filter(t => t.id !== team.id);
      // El equipo sale de los torneos donde estaba inscrito, liberando el cupo.
      S.tournaments.forEach(tn => tn.teams.forEach(slot => {
        if (slot.teamId === team.id) { slot.teamId = null; slot.taken = false; slot.name = 'Cupo libre'; }
      }));
      save(); done(); toast('Equipo eliminado', 'warn');
    },
    onConfirm() {
      const name = $('#tmName').value.trim();
      if (!name) { toast('Ponle nombre a tu equipo', 'warn'); return false; }
      const sport = $('#tmSport').value;
      if (editing) {
        team.name = name; team.sport = sport; team.color = color; team.crest = crest;
      } else {
        const t = makeTeam({ name, sport, color, captainId: yo?.id, crest });
        (S.teams ??= []).push(t);
      }
      save(); done();
      toast(editing ? 'Equipo actualizado' : `"${name}" creado`);
    }
  });

  const repaint = () => {
    $('#crestPrev').innerHTML = crestSVG({ name: $('#tmName').value || 'Equipo', color, crest }, 'crest--xl');
  };
  $('#tmName').addEventListener('input', repaint);
  $$('#swatches .sw').forEach(b => b.addEventListener('click', () => {
    color = b.dataset.color;
    $$('#swatches .sw').forEach(x => { x.classList.remove('is-on'); x.setAttribute('aria-checked', 'false'); });
    b.classList.add('is-on'); b.setAttribute('aria-checked', 'true');
    repaint();
  }));
  $('#crestUp').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', async () => {
      if (!inp.files[0]) return;
      try { crest = await readPhoto(inp.files[0], { max: 320, q: 0.82 }); repaint(); }
      catch { toast('Esa imagen no se pudo leer', 'warn'); }
    });
    inp.click();
  });
  $('#crestDel')?.addEventListener('click', () => { crest = null; repaint(); });
}

/* ── Alta y edición de jugador ───────────────────────────────────────────── */

export function openPlayerForm(player = null, done = () => {}) {
  const editing = !!player;
  const sport = S.business.sports[0] || 'futbol';
  const pos = POSITIONS[sport] || POSITIONS.futbol;
  let avatar = player?.avatar ?? null;

  openModal({
    title: editing ? 'Editar jugador' : 'Crear mi jugador',
    body: `
      <div class="crest-editor">
        <span class="crest-preview" id="avPrev">${avatarHTML({ ...player, avatar, name: player?.name || '?' }, 'avatar--xl')}</span>
        <div class="crest-tools">
          <button type="button" class="btn btn-sm btn-secondary" id="avUp">${icon('upload')}Subir foto</button>
          ${avatar ? '<button type="button" class="mini" id="avDel">Quitar</button>' : ''}
        </div>
      </div>
      <div class="form-grid">
        <label class="field field-full"><span class="field-label">Tu nombre</span>
          <input id="plName" class="input input-lg" maxlength="34" placeholder="Nombre y apellido"
                 value="${esc(player?.name || '')}"></label>
        <label class="field"><span class="field-label">Celular</span>
          <input id="plPhone" class="input" placeholder="+57 300 000 0000" value="${esc(player?.phone || '')}"></label>
        <label class="field"><span class="field-label">Posición</span>
          <select id="plPos" class="input">
            ${pos.map(p => `<option ${player?.position === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select></label>
      </div>`,
    confirm: editing ? 'Guardar' : 'Entrar',
    onConfirm() {
      const name = $('#plName').value.trim();
      if (name.length < 2) { toast('Escribe tu nombre', 'warn'); return false; }
      if (editing) {
        player.name = name;
        player.phone = $('#plPhone').value.trim();
        player.position = $('#plPos').value;
        player.avatar = avatar;
        save(); done(player);
      } else {
        const p = makePlayer({ name, phone: $('#plPhone').value.trim(), position: $('#plPos').value, avatar });
        (S.players ??= []).push(p);
        save(); done(p);
      }
    }
  });

  const repaint = () => {
    $('#avPrev').innerHTML = avatarHTML(
      { ...(player || {}), avatar, name: $('#plName').value || '?', color: player?.color }, 'avatar--xl');
  };
  $('#plName').addEventListener('input', repaint);
  $('#avUp').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', async () => {
      if (!inp.files[0]) return;
      try { avatar = await readPhoto(inp.files[0], { max: 300, q: 0.8 }); repaint(); }
      catch { toast('Esa imagen no se pudo leer', 'warn'); }
    });
    inp.click();
  });
  $('#avDel')?.addEventListener('click', () => { avatar = null; repaint(); });
}

/* ── Sumar gente a la plantilla ──────────────────────────────────────────── */

export function openAddToRoster(team, done = () => {}) {
  if (!team) return;
  const libres = (S.players || []).filter(p => !team.roster.includes(p.id));

  openModal({
    title: 'Agregar a ' + team.name,
    body: `
      <p class="hint">Elige a alguien que ya juega en el complejo, o registra a un amigo nuevo.</p>
      <div class="who-list who-list--tall">
        ${libres.slice(0, 24).map(p => `
          <button type="button" class="who" data-add="${p.id}">
            ${avatarHTML(p, 'avatar--sm')}
            <b>${esc(p.name)}</b><em>${esc(p.position || 'Jugador')}</em>
          </button>`).join('') || '<p class="empty">Ya están todos en tu equipo</p>'}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" id="newMate">${icon('plus')}Registrar a alguien nuevo</button>`,
    confirm: null
  });

  $$('.modal [data-add]').forEach(b => b.addEventListener('click', () => {
    if (!team.roster.includes(b.dataset.add)) team.roster.push(b.dataset.add);
    save();
    closeModal();
    done();
    toast(`${playerOf(b.dataset.add)?.name} entra al equipo`);
  }));
  $('#newMate').addEventListener('click', () => {
    openPlayerForm(null, (p) => {
      team.roster.push(p.id);
      save(); done();
      toast(`${p.name} entra al equipo`);
    });
  });
}
