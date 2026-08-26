import { ROUND_LABEL, winnerOf, type Torneo, type Cupo, type Partido } from './tournament';

/* ==========================================================================
   El histórico

   R31 — LA REGLA QUE MÁS SE ROMPE: el histórico NO se guarda. Se deriva de
   los partidos. Récord de un equipo, goles de un jugador, títulos, racha,
   salón de la fama: todo sale de `partidos` y `anotaciones` en tiempo de
   lectura.

   R32 — Prohibido crear columnas acumuladas (`goles_totales`,
   `partidos_ganados`). Un marcador vive en un solo sitio. Guardar totales
   obliga a mantenerlos en sincronía cada vez que alguien corrige un
   resultado, y tarde o temprano se desincronizan.

   R33 — Si el cálculo pesa, se resuelve con vistas materializadas o caché
   con invalidación por torneo, NUNCA duplicando el dato en la tabla.

   Todo lo de este archivo es puro: recibe los torneos ya leídos y devuelve
   números. Por eso se puede probar sin base y sirve igual en el servidor que
   en el navegador.
   ========================================================================== */

export type Resultado = 'G' | 'E' | 'P';

export interface FilaHistorial {
  torneo: Torneo;
  partido: Partido;
  rondaLabel: string;
  rival: Cupo | null;
  gf: number;
  gc: number;
  resultado: Resultado;
}

/**
 * Todos los partidos jugados por un equipo REAL, en todos sus torneos.
 * Devuelve la fila ya resuelta: rival, marcador desde su punto de vista, y
 * si ganó, empató o perdió.
 */
export function partidosDeEquipo(equipoId: string, torneos: Torneo[]): FilaHistorial[] {
  const out: FilaHistorial[] = [];

  for (const tn of torneos) {
    const cupo = tn.cupos.find(c => c.equipoId === equipoId);
    if (!cupo) continue;

    for (const m of tn.partidos) {
      if (!m.jugado || m.marcadorA == null || m.marcadorB == null) continue;
      if (m.cupoA !== cupo.id && m.cupoB !== cupo.id) continue;

      const local = m.cupoA === cupo.id;
      const gf = local ? m.marcadorA : m.marcadorB;
      const gc = local ? m.marcadorB : m.marcadorA;
      const rivalId = local ? m.cupoB : m.cupoA;

      out.push({
        torneo: tn,
        partido: m,
        rondaLabel: ROUND_LABEL[m.ronda] ?? m.ronda,
        rival: tn.cupos.find(c => c.id === rivalId) ?? null,
        gf,
        gc,
        resultado: gf > gc ? 'G' : gf < gc ? 'P' : 'E'
      });
    }
  }

  return out.sort((a, b) =>
    ((b.partido.fecha ?? '') + (b.partido.hora ?? ''))
      .localeCompare((a.partido.fecha ?? '') + (a.partido.hora ?? '')));
}

export interface RecordEquipo {
  pj: number; g: number; e: number; p: number;
  gf: number; gc: number; dif: number; pts: number;
  efectividad: number;
  /** Los cinco más recientes, del más VIEJO al más nuevo. */
  racha: Resultado[];
  titulos: Torneo[];
  torneos: Torneo[];
  filas: FilaHistorial[];
}

export function recordDeEquipo(equipoId: string, torneos: Torneo[]): RecordEquipo {
  const filas = partidosDeEquipo(equipoId, torneos);

  const r = { pj: filas.length, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
  for (const f of filas) {
    r.gf += f.gf;
    r.gc += f.gc;
    if (f.resultado === 'G') r.g++;
    else if (f.resultado === 'E') r.e++;
    else r.p++;
  }

  const pts = r.g * 3 + r.e;

  const titulos = torneos.filter(tn => {
    const cupo = tn.cupos.find(c => c.equipoId === equipoId);
    if (!cupo) return false;
    return winnerOf(tn.partidos.find(m => m.ronda === 'final')) === cupo.id;
  });

  return {
    ...r,
    dif: r.gf - r.gc,
    pts,
    efectividad: r.pj ? pts / (r.pj * 3) : 0,
    /* R34. Del más viejo al más nuevo para leerla como línea de tiempo de
       izquierda a derecha: al revés, "GGPPP" se lee como una racha buena
       cuando en realidad viene de perder tres seguidos. */
    racha: filas.slice(0, 5).map(f => f.resultado).reverse(),
    titulos,
    torneos: torneos.filter(tn => tn.cupos.some(c => c.equipoId === equipoId)),
    filas
  };
}

/** Anotaciones de una persona, sumadas entre todos los torneos. */
export function golesDePersona(personaId: string, torneos: Torneo[]) {
  let total = 0;
  const porTorneo: { torneo: Torneo; goles: number }[] = [];

  for (const tn of torneos) {
    const mias = tn.anotaciones.filter(a => a.personaId === personaId);
    if (!mias.length) continue;
    const g = mias.reduce((s, a) => s + a.goles, 0);
    if (!g) continue;
    total += g;
    porTorneo.push({ torneo: tn, goles: g });
  }

  return { total, porTorneo };
}

export interface RecordJugador {
  equipos: string[];
  filas: FilaHistorial[];
  pj: number; g: number; e: number; p: number;
  goles: number;
  porPartido: number;
  titulos: Torneo[];
  racha: Resultado[];
}

/** Ficha completa de un jugador: equipos, partidos, anotaciones, títulos. */
export function recordDeJugador(
  personaId: string,
  equiposIds: string[],
  torneos: Torneo[]
): RecordJugador {
  const filas = equiposIds
    .flatMap(id => partidosDeEquipo(id, torneos))
    .sort((a, b) =>
      ((b.partido.fecha ?? '') + (b.partido.hora ?? ''))
        .localeCompare((a.partido.fecha ?? '') + (a.partido.hora ?? '')));

  const rec = { pj: filas.length, g: 0, e: 0, p: 0 };
  for (const f of filas) {
    if (f.resultado === 'G') rec.g++;
    else if (f.resultado === 'E') rec.e++;
    else rec.p++;
  }

  const goles = golesDePersona(personaId, torneos);
  const titulos = equiposIds.flatMap(id => recordDeEquipo(id, torneos).titulos);

  return {
    equipos: equiposIds,
    filas,
    ...rec,
    goles: goles.total,
    porPartido: rec.pj ? goles.total / rec.pj : 0,
    titulos,
    racha: filas.slice(0, 5).map(f => f.resultado).reverse()
  };
}

/** El próximo partido de un equipo, si tiene alguno pendiente. */
export function proximoPartido(equipoId: string, torneos: Torneo[], hoy: string) {
  const out: FilaHistorial[] = [];

  for (const tn of torneos) {
    const cupo = tn.cupos.find(c => c.equipoId === equipoId);
    if (!cupo) continue;

    for (const m of tn.partidos) {
      if (m.jugado || !m.fecha || m.fecha < hoy) continue;
      if (m.cupoA !== cupo.id && m.cupoB !== cupo.id) continue;
      const rivalId = m.cupoA === cupo.id ? m.cupoB : m.cupoA;
      out.push({
        torneo: tn,
        partido: m,
        rondaLabel: ROUND_LABEL[m.ronda] ?? m.ronda,
        rival: tn.cupos.find(c => c.id === rivalId) ?? null,
        gf: 0, gc: 0, resultado: 'E'
      });
    }
  }

  return out.sort((a, b) =>
    ((a.partido.fecha ?? '') + (a.partido.hora ?? ''))
      .localeCompare((b.partido.fecha ?? '') + (b.partido.hora ?? '')))[0] ?? null;
}

/** Tabla de goleadores histórica del complejo, entre todos los torneos. */
export function goleadoresHistoricos(torneos: Torneo[], limite = 10) {
  const mapa = new Map<string, {
    personaId: string | null; nombre: string; goles: number; torneos: Set<string>;
  }>();

  for (const tn of torneos) {
    for (const a of tn.anotaciones) {
      if (!a.goles) continue;
      const clave = a.personaId ?? 'n:' + a.nombre;
      const prev = mapa.get(clave) ?? {
        personaId: a.personaId, nombre: a.nombre, goles: 0, torneos: new Set<string>()
      };
      prev.goles += a.goles;
      prev.torneos.add(tn.id);
      mapa.set(clave, prev);
    }
  }

  return [...mapa.values()]
    .map(r => ({ ...r, torneos: r.torneos.size }))
    .sort((a, b) => b.goles - a.goles)
    .slice(0, limite);
}

/** Clasificación histórica de equipos del complejo. */
export function tablaDeEquipos(
  equipos: { id: string; nombre: string }[],
  torneos: Torneo[],
  limite = 10
) {
  return equipos
    .map(e => ({ equipo: e, ...recordDeEquipo(e.id, torneos) }))
    .filter(r => r.pj > 0)
    .sort((a, b) =>
      b.titulos.length - a.titulos.length || b.pts - a.pts || b.dif - a.dif)
    .slice(0, limite);
}
