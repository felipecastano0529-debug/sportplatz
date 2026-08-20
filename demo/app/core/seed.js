/* ==========================================================================
   NÚCLEO · Datos de arranque
   Genera un negocio que ya lleva tres meses funcionando, para que nada nazca
   vacío: reservas con su historia, jugadores, equipos con plantilla y un
   torneo jugado hasta semifinales.
   ========================================================================== */

import { uid, iso, today, addDays, pick, shuffle, hhmm, nextHour } from './util.js';
import { SPORTS } from './sports.js';
import { makeTournament, resolveBracket, TEAM_COLORS } from './tournament.js';
import { makePlayer, makeTeam, POSITIONS } from './teams.js';

export const NOMBRES = [
  'Juan Camilo Restrepo','Andrés Salazar','Valeria Ochoa','Santiago Mejía','Laura Gutiérrez',
  'Sebastián Arango','Mariana Vélez','Daniel Cardona','Camila Ríos','Julián Betancur',
  'Natalia Zapata','Esteban Correa','Sara Montoya','Felipe Ospina','Manuela Henao',
  'Ricardo Jaramillo','Paula Andrea Gómez','Kevin Marín','Diana Toro','Óscar Palacio'
];

export const EQUIPOS = [
  'Los Vikingos','Real Manrique','Deportivo La 70','Atlético Poblado','FC Sabaneta',
  'Los Tigres','Envigado FC','Barrio Antioquia','Club Robledo','Nueva Villa',
  'Los Halcones','Belén United','San Javier FC','Laureles CF','Aranjuez SC','Castilla FC'
];

export const JUGADORES = [
  'Mateo Zapata','Brayan Úsuga','Cristian Loaiza','Jhon Alexander Muñoz','Steven Cano',
  'Yeison Agudelo','Michael Herrera','Duván Castrillón','Jefferson Puerta','Alejandro Bedoya',
  'Wílmar Roldán','Édison Quiñones','Samuel Arroyave','Johan Villada','Nicolás Escobar',
  'Kevin Castaño','Emerson Tabares','Luis Fernando Díaz','Jhonatan Ceballos','Andrés Balanta',
  'Sergio Quintero','Miguel Borja','Elkin Palacios','Tomás Ángel','Fabián Sierra',
  'Óscar Cortés','Deiver Machado','Yerson Mosquera','Iván Angulo','Julián Quiñones',
  'Jáder Valencia','Camilo Vargas','Marlos Moreno','Jarlan Barrera','Sherman Cárdenas',
  'Vladimir Hernández','Aldair Quintana','Kevin Mier','Juan Fernando Quintero','Daniel Muñoz'
];

export const phone = () => '+57 3' + String(Math.floor(10 + Math.random() * 89)) + ' ' +
  String(Math.floor(100 + Math.random() * 899)) + ' ' + String(Math.floor(1000 + Math.random() * 8999));

export function makeCourts(config) {
  const courts = [];
  config.forEach(({ sport, count, price }) => {
    for (let i = 1; i <= count; i++) {
      courts.push({
        id: uid('c'),
        sport, n: i,
        name: `${SPORTS[sport].short} ${i}`,
        price,
        image: `assets/canchas/${sport}-${i}.jpg`,
        active: true
      });
    }
  });
  return courts;
}

/**
 * 75 días de historia + 14 hacia adelante.
 *
 * El triple bucle visita cada terna (cancha, día, hora) exactamente una vez,
 * así que un duplicado es imposible por construcción. La versión anterior
 * comprobaba igualmente con `out.some(...)` sobre un array creciente, lo que
 * volvía la generación cuadrática: medido, 12 canchas tardaban 974 ms y 40
 * canchas 10,5 s con el hilo congelado y sin ningún indicador. Sin esa
 * comprobación es lineal — 40 canchas bajan a decenas de milisegundos.
 */
export function seedBookings(courts, players, { open = 6, close = 23 } = {}) {
  const out = [];
  const t = today();
  const clientes = players.slice();

  for (let d = -75; d <= 14; d++) {
    const day = addDays(t, d);
    const dateISO = iso(day);
    const dow = day.getDay();
    const load = dow === 0 ? 0.55 : dow === 6 ? 0.75 : dow === 5 ? 0.7 : 0.38;

    for (const court of courts) {
      for (let h = open; h < close; h++) {
        const peak = h >= 17 && h <= 22 ? 1 : h >= 10 && h <= 15 ? 0.35 : 0.12;
        if (Math.random() > load * peak) continue;

        const start = hhmm(h);
        const total = court.price;
        const r = Math.random();
        const deposit = d < 0 ? total
          : r < 0.42 ? total
          : r < 0.85 ? Math.round(total * 0.5 / 1000) * 1000
          : 0;

        // Seis de cada diez reservas las hace un jugador con cuenta: así el
        // histórico del jugador nace con contenido.
        const conCuenta = clientes.length && Math.random() < 0.6;
        const p = conCuenta ? pick(clientes) : null;

        out.push({
          id: uid('b'),
          courtId: court.id,
          date: dateISO,
          start,
          end: nextHour(start),
          playerId: p?.id ?? null,
          customer: p?.name ?? pick(NOMBRES),
          phone: p?.phone ?? phone(),
          total,
          deposit,
          source: Math.random() < 0.62 ? 'bot' : 'mostrador',
          status: d < 0 ? 'jugada' : 'confirmada',
          note: ''
        });
      }
    }
  }
  return out;
}

/** Un plantel de jugadores con cuenta, listos para armar equipos. */
export function seedPlayers(sports, n = 26) {
  const pool = shuffle(JUGADORES).slice(0, n);
  const sport = sports[0] || 'futbol';
  const pos = POSITIONS[sport] || POSITIONS.futbol;
  return pool.map((name, i) => ({
    ...makePlayer({ name, phone: phone(), position: pos[i % pos.length] }),
    color: TEAM_COLORS[i % TEAM_COLORS.length]
  }));
}

/** Equipos ya formados, repartiendo la plantilla sin repetir jugadores. */
export function seedTeams(players, sport, count = 8) {
  const sq = Math.min(SPORTS[sport]?.squad ?? 5, Math.max(2, Math.floor(players.length / count)));
  const pool = shuffle(players);
  let k = 0;
  return EQUIPOS.slice(0, count).map((name, i) => {
    const roster = pool.slice(k, k + sq).map(p => p.id);
    k += sq;
    const team = makeTeam({ name, sport, color: TEAM_COLORS[i % TEAM_COLORS.length], captainId: roster[0] });
    team.roster = roster.length ? roster : [pool[i % pool.length].id];
    team.captainId = team.roster[0];
    return team;
  });
}

/**
 * Torneo de ejemplo: cuartos y semis jugados, final pendiente para que se
 * pueda editar en vivo y se vea cómo avanza la llave sola.
 */
export function demoTournament({ business, courts, teams, players }) {
  const sport = business.sports.includes('futbol') ? 'futbol' : business.sports[0];
  const size = 8;
  const elegibles = teams.filter(t => t.sport === sport).slice(0, size);

  const tn = makeTournament({
    name: 'Copa ' + (business.name.split(' ').slice(-1)[0] || 'Apertura'),
    sport, size,
    startDate: iso(addDays(today(), -21)),
    entries: elegibles.map(t => ({ teamId: t.id, name: t.name, color: t.color }))
  });

  // Los goleadores salen de la plantilla real: dos por equipo.
  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  tn.scorers = tn.teams.flatMap(slot => {
    const real = teams.find(t => t.id === slot.teamId);
    const roster = (real?.roster || []).slice(0, 2);
    return roster.map(pid => ({
      id: uid('s'), team: slot.id, playerId: pid,
      player: byId[pid]?.name || 'Jugador', goals: 0
    }));
  });

  const goals = () => Math.floor(Math.random() * 6);
  ['cuartos', 'semis'].forEach(r => {
    resolveBracket(tn);
    tn.matches.filter(m => m.round === r).forEach(m => {
      if (!m.teamA || !m.teamB) return;
      let a = goals(), b = goals();
      if (a === b) b = a + 1;                      // eliminación directa: sin empates
      m.scoreA = a; m.scoreB = b; m.played = true;
      const canchas = courts.filter(c => c.sport === sport);
      if (canchas.length) m.court = pick(canchas).name;
    });
    resolveBracket(tn);
  });
  resolveBracket(tn);

  // Repartir los goles marcados entre los goleadores de equipos que jugaron.
  const total = tn.matches.filter(m => m.played).reduce((s, m) => s + m.scoreA + m.scoreB, 0);
  const vivos = tn.scorers.filter(s =>
    tn.matches.some(m => m.played && (m.teamA === s.team || m.teamB === s.team)));
  let left = total;
  while (left > 0 && vivos.length) {
    const s = pick(vivos);
    const g = Math.min(left, 1 + Math.floor(Math.random() * 2));
    s.goals += g; left -= g;
  }
  return tn;
}

/** Un torneo abierto a inscripción, para que el jugador tenga qué hacer. */
export function openTournament(business, teams) {
  const sport = business.sports.includes('futbol') ? 'futbol' : business.sports[0];
  const size = 8;
  const yaInscritos = teams.filter(t => t.sport === sport).slice(0, 5);
  const tn = makeTournament({
    name: 'Torneo Relámpago',
    sport, size,
    startDate: iso(addDays(today(), 12)),
    openSignup: true,
    entries: Array.from({ length: size }, (_, i) => {
      const t = yaInscritos[i];
      return t ? { teamId: t.id, name: t.name, color: t.color } : { teamId: null, name: 'Cupo libre', color: '#94a3b8' };
    })
  });
  tn.teams.forEach(t => { if (t.teamId) t.taken = true; });
  tn.scorers = [];
  return tn;
}
