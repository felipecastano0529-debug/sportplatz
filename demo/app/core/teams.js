/* ==========================================================================
   NÚCLEO · Equipos y jugadores

   Antes los equipos vivían dentro de cada torneo y morían con él. Aquí pasan
   a ser entidades propias, y el torneo los referencia. Eso es lo único que
   hace posible el histórico: un equipo que juega tres torneos es el mismo
   equipo las tres veces.

   El histórico NO se guarda. Se deriva de los partidos que ya existen. Un
   marcador vive en un solo sitio —`tn.matches`— y todas las estadísticas
   salen de ahí. Guardar totales acumulados obligaría a mantenerlos en
   sincronía cada vez que alguien corrige un resultado, y tarde o temprano se
   desincronizan.
   ========================================================================== */

import { S } from './store.js';
import { uid, iso, today, initials } from './util.js';
import { SPORTS } from './sports.js';
import { roundsOf, winnerOf, teamById } from './tournament.js';

export const PLAYER_COLORS = [
  '#e5231f', '#1447e6', '#0f8a4d', '#ff7a00',
  '#7c3aed', '#0891b2', '#d946a0', '#facc15'
];

export const POSITIONS = {
  futbol:    ['Arquero', 'Defensa', 'Volante', 'Delantero'],
  padel:     ['Drive', 'Revés'],
  tenis:     ['Fondo', 'Red'],
  voleibol:  ['Armador', 'Punta', 'Central', 'Líbero'],
  paintball: ['Frontal', 'Medio', 'Back']
};

/* ── Acceso ──────────────────────────────────────────────────────────────── */

export const teamOf   = (id) => S?.teams?.find(t => t.id === id) || null;
export const playerOf = (id) => S?.players?.find(p => p.id === id) || null;

export const me = () => playerOf(S?.session?.playerId);
export const myTeams = () => {
  const p = me();
  if (!p) return [];
  return (S?.teams || []).filter(t => t.roster.includes(p.id));
};

export const teamsOfPlayer = (playerId) =>
  (S?.teams || []).filter(t => t.roster.includes(playerId));

export const rosterOf = (team) =>
  (team?.roster || []).map(playerOf).filter(Boolean);

/* ── Altas ───────────────────────────────────────────────────────────────── */

export function makePlayer({ name, phone = '', position = '', avatar = null }) {
  return {
    id: uid('p'), name: name.trim() || 'Jugador', phone, position, avatar,
    color: PLAYER_COLORS[(S?.players?.length || 0) % PLAYER_COLORS.length],
    since: iso(today())
  };
}

export function makeTeam({ name, sport, color, captainId, crest = null }) {
  return {
    id: uid('tm'),
    name: name.trim() || 'Equipo sin nombre',
    sport,
    color: color || PLAYER_COLORS[(S?.teams?.length || 0) % PLAYER_COLORS.length],
    crest,
    captainId,
    roster: captainId ? [captainId] : [],
    created: iso(today())
  };
}

/* ── Histórico derivado ──────────────────────────────────────────────────── */

/**
 * Todos los partidos jugados por un equipo real, en todos los torneos.
 * Devuelve la fila ya resuelta: rival, marcador desde el punto de vista del
 * equipo, y si ganó, empató o perdió.
 */
export function matchesOfTeam(teamId) {
  const out = [];
  (S?.tournaments || []).forEach(tn => {
    const slot = tn.teams.find(t => t.teamId === teamId);
    if (!slot) return;
    const labels = Object.fromEntries(
      [...(roundsOf(tn) || []), { key: 'tercero', label: 'Tercer puesto' }]
        .map(r => [r.key, r.label])
    );
    tn.matches.forEach(m => {
      if (!m.played || (m.teamA !== slot.id && m.teamB !== slot.id)) return;
      const home = m.teamA === slot.id;
      const gf = home ? m.scoreA : m.scoreB;
      const gc = home ? m.scoreB : m.scoreA;
      out.push({
        tn, match: m, roundLabel: labels[m.round] || m.round,
        rival: teamById(tn, home ? m.teamB : m.teamA),
        gf, gc,
        result: gf > gc ? 'G' : gf < gc ? 'P' : 'E'
      });
    });
  });
  return out.sort((a, b) => (b.match.date + b.match.time).localeCompare(a.match.date + a.match.time));
}

/** Resumen de un equipo: récord, racha de los últimos 5, títulos. */
export function teamRecord(teamId) {
  const rows = matchesOfTeam(teamId);
  const r = { pj: rows.length, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
  rows.forEach(x => {
    r.gf += x.gf; r.gc += x.gc;
    if (x.result === 'G') r.g++; else if (x.result === 'E') r.e++; else r.p++;
  });
  r.dif = r.gf - r.gc;
  r.pts = r.g * 3 + r.e;
  r.efectividad = r.pj ? r.pts / (r.pj * 3) : 0;
  // Racha: los cinco más recientes, del más viejo al más nuevo para leerla
  // de izquierda a derecha como una línea de tiempo.
  r.racha = rows.slice(0, 5).map(x => x.result).reverse();
  r.titulos = (S?.tournaments || []).filter(tn => {
    const slot = tn.teams.find(t => t.teamId === teamId);
    if (!slot) return false;
    const final = tn.matches.find(m => m.round === 'final');
    return winnerOf(final) === slot.id;
  });
  r.torneos = (S?.tournaments || []).filter(tn => tn.teams.some(t => t.teamId === teamId));
  return r;
}

/** Anotaciones de un jugador, sumadas entre todos los torneos. */
export function goalsOfPlayer(playerId) {
  let total = 0;
  const byTournament = [];
  (S?.tournaments || []).forEach(tn => {
    const mine = (tn.scorers || []).filter(s => s.playerId === playerId);
    if (!mine.length) return;
    const g = mine.reduce((a, s) => a + s.goals, 0);
    if (!g) return;
    total += g;
    byTournament.push({ tn, goals: g });
  });
  return { total, byTournament };
}

/** Ficha completa de un jugador: equipos, partidos, anotaciones, torneos. */
export function playerRecord(playerId) {
  const teams = teamsOfPlayer(playerId);
  const rows = teams.flatMap(t => matchesOfTeam(t.id).map(x => ({ ...x, team: t })));
  rows.sort((a, b) => (b.match.date + b.match.time).localeCompare(a.match.date + a.match.time));
  const rec = { pj: rows.length, g: 0, e: 0, p: 0 };
  rows.forEach(x => { if (x.result === 'G') rec.g++; else if (x.result === 'E') rec.e++; else rec.p++; });
  const goles = goalsOfPlayer(playerId);
  const titulos = teams.flatMap(t => teamRecord(t.id).titulos);
  return {
    teams, rows, ...rec,
    goles: goles.total,
    porPartido: rec.pj ? goles.total / rec.pj : 0,
    titulos,
    racha: rows.slice(0, 5).map(x => x.result).reverse()
  };
}

/** El próximo partido de un jugador, si su equipo tiene alguno pendiente. */
export function nextMatchOf(playerId) {
  const hoy = iso(today());
  const teams = teamsOfPlayer(playerId);
  const out = [];
  teams.forEach(t => {
    (S?.tournaments || []).forEach(tn => {
      const slot = tn.teams.find(x => x.teamId === t.id);
      if (!slot) return;
      tn.matches.forEach(m => {
        if (m.played || m.date < hoy) return;
        if (m.teamA !== slot.id && m.teamB !== slot.id) return;
        const rival = teamById(tn, m.teamA === slot.id ? m.teamB : m.teamA);
        out.push({ tn, match: m, team: t, rival });
      });
    });
  });
  return out.sort((a, b) => (a.match.date + a.match.time).localeCompare(b.match.date + b.match.time))[0] || null;
}

/** Tabla de goleadores histórica del complejo, entre todos los torneos. */
export function topScorersAllTime(limit = 10) {
  const map = new Map();
  (S?.tournaments || []).forEach(tn => {
    (tn.scorers || []).forEach(s => {
      if (!s.goals) return;
      const key = s.playerId || ('n:' + s.player);
      const prev = map.get(key) || { playerId: s.playerId || null, name: s.player, goals: 0, torneos: new Set() };
      prev.goals += s.goals;
      prev.torneos.add(tn.id);
      map.set(key, prev);
    });
  });
  return [...map.values()]
    .map(r => ({ ...r, torneos: r.torneos.size }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, limit);
}

/** Clasificación histórica de equipos del complejo. */
export function teamLeaderboard(limit = 10) {
  return (S?.teams || [])
    .map(t => ({ team: t, ...teamRecord(t.id) }))
    .filter(r => r.pj > 0)
    .sort((a, b) => b.titulos.length - a.titulos.length || b.pts - a.pts || b.dif - a.dif)
    .slice(0, limit);
}

/* ── Escudo dibujado ─────────────────────────────────────────────────────── */

/* Un equipo sin escudo no muestra un cuadro gris: muestra su inicial sobre su
   color, con el corte de escudo real. Se lee como identidad, no como hueco. */
export function crestSVG(team, cls = '') {
  if (!team) return '';
  if (team.crest) {
    return `<span class="crest ${cls}" style="--tc:${team.color}">
      <img src="${team.crest}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  }
  const ini = initials(team.name) || '?';
  return `<span class="crest crest--drawn ${cls}" style="--tc:${team.color}">
    <svg viewBox="0 0 40 44" aria-hidden="true">
      <path d="M20 1.5 37.5 7v17.5C37.5 33.6 30 40.5 20 42.5 10 40.5 2.5 33.6 2.5 24.5V7L20 1.5Z"/>
    </svg>
    <b>${ini}</b></span>`;
}

