/* ==========================================================================
   NÚCLEO · Torneos

   Portado de `demo/app/core/tournament.js`. Es puro: recibe un torneo ya
   leído de la base y devuelve llaves resueltas, tabla, valla y podio. No
   consulta nada y no escribe nada — por eso se puede probar solo y por eso
   sirve igual en el servidor que en el navegador.

   El cambio respecto a la demo es de vocabulario, no de reglas: lo que allí
   era `tn.teams` (equipos sueltos que morían con el torneo) aquí son CUPOS
   (`torneo_cupos`), y cada cupo apunta a un equipo real por `equipoId`. Eso
   es lo único que hace posible el histórico (R30): un equipo que juega tres
   torneos es el mismo equipo las tres veces.
   ========================================================================== */

import type { SportId } from './sports';

export type RondaKey = 'octavos' | 'cuartos' | 'semis' | 'final' | 'tercero';

export interface Ronda { key: RondaKey; label: string; slots: number }

/** Un cupo del torneo: la plaza, con el equipo real que la ocupa. */
export interface Cupo {
  id: string;
  posicion: number;
  equipoId: string | null;
  nombre: string;
  color: string;
}

export interface Partido {
  id: string;
  ronda: RondaKey;
  idx: number;
  cupoA: string | null;
  cupoB: string | null;
  marcadorA: number | null;
  marcadorB: number | null;
  fecha: string | null;
  hora: string | null;
  canchaId: string | null;
  jugado: boolean;
}

export interface Torneo {
  id: string;
  nombre: string;
  deporte: SportId;
  /** 4, 8 o 16 (R22). */
  tamano: 4 | 8 | 16;
  fechaInicio: string;
  inscripcionAbierta: boolean;
  cupos: Cupo[];
  partidos: Partido[];
  anotaciones: Anotacion[];
}

export interface Anotacion {
  id: string;
  partidoId: string;
  cupoId: string;
  personaId: string | null;
  nombre: string;
  goles: number;
}

/* Rondas por tamaño (R23). Siempre hay tercer puesto, alimentado por los
   perdedores de semifinal, y por eso no aparece en esta lista: no es una
   ronda de la llave, es un partido colgado de ella. */
export const ROUNDS: Record<number, Ronda[]> = {
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

export const ROUND_LABEL: Record<RondaKey, string> = {
  octavos: 'Octavos de final',
  cuartos: 'Cuartos de final',
  semis:   'Semifinal',
  final:   'Final',
  tercero: 'Tercer puesto'
};

/* Ocho colores distintos: con cuatro, dos finalistas terminaban con el mismo
   punto de color y la tabla dejaba de leerse. */
export const TEAM_COLORS = [
  '#e5231f', '#1447e6', '#ffd400', '#12151a',
  '#0f8a4d', '#ff7a00', '#7c3aed', '#0891b2'
];

export const roundsOf = (tn: Pick<Torneo, 'tamano'>) => ROUNDS[tn.tamano] ?? [];
export const cupoById = (tn: Torneo, id: string | null) =>
  id ? tn.cupos.find(c => c.id === id) ?? null : null;

/* ── Resolución de la llave ─────────────────────────────────────────────── */

export function winnerOf(m?: Partido | null): string | null {
  if (!m || !m.jugado || m.marcadorA == null || m.marcadorB == null) return null;
  // Un empate no produce ganador: esto es eliminación directa (R24).
  if (m.marcadorA === m.marcadorB) return null;
  return m.marcadorA > m.marcadorB ? m.cupoA : m.cupoB;
}

export function loserOf(m?: Partido | null): string | null {
  if (!m || !m.jugado || m.marcadorA == null || m.marcadorB == null) return null;
  if (m.marcadorA === m.marcadorB) return null;
  return m.marcadorA > m.marcadorB ? m.cupoB : m.cupoA;
}

/**
 * Propaga los ganadores hacia la ronda siguiente y arma el tercer puesto
 * (R24). Devuelve SOLO los partidos cuyos cupos cambiaron, para poder
 * escribir en la base lo justo en vez de reescribir la llave entera.
 */
export function resolveBracket(tn: Torneo): Partido[] {
  const rs = roundsOf(tn);
  const tocados: Partido[] = [];
  const marcar = (m: Partido, a: string | null, b: string | null) => {
    if (m.cupoA === a && m.cupoB === b) return;
    m.cupoA = a; m.cupoB = b;
    tocados.push(m);
  };

  const deRonda = (k: RondaKey) =>
    tn.partidos.filter(m => m.ronda === k).sort((a, b) => a.idx - b.idx);

  for (let ri = 0; ri < rs.length - 1; ri++) {
    const cur = deRonda(rs[ri].key);
    const nxt = deRonda(rs[ri + 1].key);
    nxt.forEach((m, i) => marcar(m, winnerOf(cur[i * 2]), winnerOf(cur[i * 2 + 1])));
  }

  const semis = deRonda('semis');
  const third = tn.partidos.find(m => m.ronda === 'tercero');
  if (third && semis.length === 2) marcar(third, loserOf(semis[0]), loserOf(semis[1]));

  return tocados;
}

/* ── Tabla, valla y podio ───────────────────────────────────────────────── */

export interface Fila {
  cupo: Cupo;
  pj: number; g: number; e: number; p: number;
  gf: number; gc: number; dif: number; pts: number;
}

/** Tabla: PTS = G*3 + E. Orden: puntos, diferencia, menos recibidos, más anotados (R25). */
export function standings(tn: Torneo): Fila[] {
  const rows: Fila[] = tn.cupos.map(cupo => ({
    cupo, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dif: 0, pts: 0
  }));
  const by = new Map(rows.map(r => [r.cupo.id, r]));

  for (const m of tn.partidos) {
    if (!m.jugado || m.marcadorA == null || m.marcadorB == null) continue;
    const A = m.cupoA ? by.get(m.cupoA) : null;
    const B = m.cupoB ? by.get(m.cupoB) : null;
    if (!A || !B) continue;
    A.pj++; B.pj++;
    A.gf += m.marcadorA; A.gc += m.marcadorB;
    B.gf += m.marcadorB; B.gc += m.marcadorA;
    if (m.marcadorA > m.marcadorB) { A.g++; B.p++; }
    else if (m.marcadorA < m.marcadorB) { B.g++; A.p++; }
    else { A.e++; B.e++; }
  }

  for (const r of rows) { r.pts = r.g * 3 + r.e; r.dif = r.gf - r.gc; }
  return rows.sort((a, b) =>
    b.pts - a.pts || b.dif - a.dif || a.gc - b.gc || b.gf - a.gf);
}

/** Valla menos vencida: menos recibidos entre los que ya jugaron (R26). */
export const cleanSheets = (tn: Torneo): Fila[] =>
  standings(tn).filter(r => r.pj > 0)
    .sort((a, b) => a.gc - b.gc || b.pj - a.pj || b.pts - a.pts);

/** Oro = gana la final, plata = la pierde, bronce = gana el tercer puesto (R27). */
export function podium(tn: Torneo) {
  const final = tn.partidos.find(m => m.ronda === 'final');
  const third = tn.partidos.find(m => m.ronda === 'tercero');
  return {
    oro:    cupoById(tn, winnerOf(final)),
    plata:  cupoById(tn, loserOf(final)),
    bronce: cupoById(tn, winnerOf(third))
  };
}

/** Anotadores del torneo, sumados desde el hecho y nunca desde un total (R31). */
export function scorers(tn: Torneo) {
  const map = new Map<string, { personaId: string | null; nombre: string; cupoId: string; goles: number }>();
  for (const a of tn.anotaciones) {
    const key = a.personaId ?? 'n:' + a.nombre;
    const prev = map.get(key);
    if (prev) prev.goles += a.goles;
    else map.set(key, { personaId: a.personaId, nombre: a.nombre, cupoId: a.cupoId, goles: a.goles });
  }
  return [...map.values()].sort((a, b) => b.goles - a.goles);
}

/* ── Inscripción y sorteo ───────────────────────────────────────────────── */

/** Cuántos cupos quedan libres en un torneo abierto a inscripción (R28). */
export const freeSlots = (tn: Torneo) => tn.cupos.filter(c => !c.equipoId).length;

/** El primer cupo libre, que es el que se le asigna a quien se inscribe. */
export const firstFreeSlot = (tn: Torneo) =>
  tn.cupos.slice().sort((a, b) => a.posicion - b.posicion).find(c => !c.equipoId) ?? null;

/** ¿Ya empezó? Si hay un solo marcador, no se puede volver a sortear (R29). */
export const hasStarted = (tn: Torneo) => tn.partidos.some(m => m.jugado);

/**
 * Baraja los cruces de primera ronda sin perder los equipos inscritos y
 * borra los marcadores de esa ronda (R29). Muta `tn` y devuelve la llave ya
 * resuelta, para que quien llame escriba de una vez.
 */
export function reseed(tn: Torneo): Torneo {
  const orden = tn.cupos.slice().sort(() => Math.random() - 0.5);
  const first = roundsOf(tn)[0];
  if (!first) return tn;

  tn.partidos
    .filter(m => m.ronda === first.key)
    .sort((a, b) => a.idx - b.idx)
    .forEach((m, i) => {
      m.cupoA = orden[i * 2]?.id ?? null;
      m.cupoB = orden[i * 2 + 1]?.id ?? null;
      m.marcadorA = null;
      m.marcadorB = null;
      m.jugado = false;
    });

  resolveBracket(tn);
  return tn;
}

/**
 * La forma de la llave para un tamaño dado: qué partidos hay que crear al
 * dar de alta un torneo. La primera ronda se llena con los cupos en orden;
 * el resto nace vacío y lo llena `resolveBracket`.
 */
export function bracketShape(tamano: 4 | 8 | 16) {
  const rs = ROUNDS[tamano];
  const out: { ronda: RondaKey; idx: number; semana: number }[] = [];
  rs.forEach((r, ri) => {
    for (let i = 0; i < r.slots; i++) out.push({ ronda: r.key, idx: i, semana: ri });
  });
  out.push({ ronda: 'tercero', idx: 0, semana: rs.length - 1 });
  return out;
}
