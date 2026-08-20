/* ==========================================================================
   NÚCLEO · Torneos
   Llaves de 4, 8 o 16 con los ganadores avanzando solos, tercer puesto,
   tabla, goleadores y valla menos vencida.

   Cambio respecto a la versión anterior: los equipos del torneo ya no son
   objetos desechables `{id, name, color}` que morían con el torneo. Ahora
   cada uno apunta a un equipo real de `S.teams` por `teamId`, que es lo que
   permite que un equipo tenga histórico entre torneos. Los torneos guardados
   antes siguen funcionando: si no hay `teamId`, se comporta como antes.
   ========================================================================== */

import { uid, iso, parseISO, addDays, shuffle } from './util.js';

export const ROUNDS = {
  16: [
    { key: 'octavos', label: 'Octavos de final', slots: 8 },
    { key: 'cuartos', label: 'Cuartos de final', slots: 4 },
    { key: 'semis',   label: 'Semifinal',        slots: 2 },
    { key: 'final',   label: 'Final',            slots: 1 }
  ],
  8: [
    { key: 'cuartos', label: 'Cuartos de final', slots: 4 },
    { key: 'semis',   label: 'Semifinal',        slots: 2 },
    { key: 'final',   label: 'Final',            slots: 1 }
  ],
  4: [
    { key: 'semis', label: 'Semifinal', slots: 2 },
    { key: 'final', label: 'Final',     slots: 1 }
  ]
};

/* Ocho colores distintos: con cuatro, dos finalistas terminaban con el mismo
   punto de color y la tabla dejaba de leerse. */
export const TEAM_COLORS = [
  '#e5231f', '#1447e6', '#ffd400', '#12151a',
  '#0f8a4d', '#ff7a00', '#7c3aed', '#0891b2'
];

export const roundsOf = (tn) => ROUNDS[tn.size];
export const teamById = (tn, id) => tn.teams.find(t => t.id === id) || null;

/**
 * `entries` es opcional: [{ teamId, name, color }]. Si viene, el torneo queda
 * enlazado a equipos reales; si no, se generan equipos sueltos como antes.
 */
export function makeTournament({ name, sport, size, startDate, teamNames, entries = null, openSignup = false }) {
  const teams = Array.from({ length: size }, (_, i) => {
    const e = entries?.[i];
    return {
      id: uid('t'),
      teamId: e?.teamId ?? null,
      name: (e?.name ?? teamNames?.[i] ?? '').trim() || `Equipo ${i + 1}`,
      color: e?.color ?? TEAM_COLORS[i % TEAM_COLORS.length]
    };
  });

  const rounds = ROUNDS[size];
  const matches = [];
  rounds.forEach((r, ri) => {
    for (let i = 0; i < r.slots; i++) {
      matches.push({
        id: uid('m'),
        round: r.key,
        idx: i,
        teamA: ri === 0 ? teams[i * 2].id : null,
        teamB: ri === 0 ? teams[i * 2 + 1].id : null,
        scoreA: null, scoreB: null,
        date: iso(addDays(parseISO(startDate), ri * 7)),
        time: String(17 + (i % 5)).padStart(2, '0') + ':00',
        court: '',
        played: false
      });
    }
  });

  matches.push({
    id: uid('m'), round: 'tercero', idx: 0, teamA: null, teamB: null,
    scoreA: null, scoreB: null,
    date: iso(addDays(parseISO(startDate), (rounds.length - 1) * 7)),
    time: '15:00', court: '', played: false, isThird: true
  });

  return {
    id: uid('tn'), name, sport, size, startDate, teams, matches,
    openSignup,                  // ¿los jugadores pueden inscribir su equipo?
    scorers: []                  // se llenan desde la plantilla real del equipo
  };
}

/** Propaga ganadores hacia la siguiente ronda y arma el partido de 3.er puesto. */
export function resolveBracket(tn) {
  const rs = roundsOf(tn);
  if (!rs) return;
  for (let ri = 0; ri < rs.length - 1; ri++) {
    const cur = tn.matches.filter(m => m.round === rs[ri].key).sort((a, b) => a.idx - b.idx);
    const nxt = tn.matches.filter(m => m.round === rs[ri + 1].key).sort((a, b) => a.idx - b.idx);
    nxt.forEach((m, i) => {
      m.teamA = winnerOf(cur[i * 2]);
      m.teamB = winnerOf(cur[i * 2 + 1]);
    });
  }
  const semis = tn.matches.filter(m => m.round === 'semis').sort((a, b) => a.idx - b.idx);
  const third = tn.matches.find(m => m.isThird);
  if (third && semis.length === 2) {
    third.teamA = loserOf(semis[0]);
    third.teamB = loserOf(semis[1]);
  }
}

export function winnerOf(m) {
  if (!m || !m.played || m.scoreA == null || m.scoreB == null) return null;
  return m.scoreA === m.scoreB ? null : (m.scoreA > m.scoreB ? m.teamA : m.teamB);
}
export function loserOf(m) {
  if (!m || !m.played || m.scoreA == null || m.scoreB == null) return null;
  return m.scoreA === m.scoreB ? null : (m.scoreA > m.scoreB ? m.teamB : m.teamA);
}

/** Tabla: PJ, G, E, P, GF, GC, DIF, PTS — por puntos, diferencia, valla. */
export function standings(tn) {
  const rows = tn.teams.map(t => ({ team: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 }));
  const by = Object.fromEntries(rows.map(r => [r.team.id, r]));
  tn.matches.forEach(m => {
    if (!m.played || m.scoreA == null || m.scoreB == null) return;
    const A = by[m.teamA], B = by[m.teamB];
    if (!A || !B) return;
    A.pj++; B.pj++;
    A.gf += m.scoreA; A.gc += m.scoreB;
    B.gf += m.scoreB; B.gc += m.scoreA;
    if (m.scoreA > m.scoreB) { A.g++; B.p++; }
    else if (m.scoreA < m.scoreB) { B.g++; A.p++; }
    else { A.e++; B.e++; }
  });
  rows.forEach(r => { r.pts = r.g * 3 + r.e; r.dif = r.gf - r.gc; });
  return rows.sort((a, b) => b.pts - a.pts || b.dif - a.dif || a.gc - b.gc || b.gf - a.gf);
}

/** Valla menos vencida: menos recibidos entre los que ya jugaron. */
export function cleanSheets(tn) {
  return standings(tn).filter(r => r.pj > 0)
    .sort((a, b) => a.gc - b.gc || b.pj - a.pj || b.pts - a.pts);
}

export function podium(tn) {
  const final = tn.matches.find(m => m.round === 'final');
  const third = tn.matches.find(m => m.isThird);
  return {
    oro:    teamById(tn, winnerOf(final)),
    plata:  teamById(tn, loserOf(final)),
    bronce: teamById(tn, winnerOf(third))
  };
}


/** Cuántos cupos quedan libres en un torneo abierto a inscripción. */
export const freeSlots = (tn) => tn.teams.filter(t => !t.teamId && !t.taken).length;

/** Mete un equipo real en el primer cupo libre. */
export function signUp(tn, team) {
  const slot = tn.teams.find(t => !t.teamId && !t.taken);
  if (!slot) return false;
  slot.teamId = team.id;
  slot.name = team.name;
  slot.color = team.color;
  slot.taken = true;
  return true;
}

/** Baraja los cruces de primera ronda sin perder los equipos inscritos. */
export function reseed(tn) {
  const order = shuffle(tn.teams);
  const first = roundsOf(tn)[0];
  const ms = tn.matches.filter(m => m.round === first.key).sort((a, b) => a.idx - b.idx);
  ms.forEach((m, i) => {
    m.teamA = order[i * 2]?.id ?? null;
    m.teamB = order[i * 2 + 1]?.id ?? null;
    m.scoreA = m.scoreB = null; m.played = false;
  });
  resolveBracket(tn);
}
