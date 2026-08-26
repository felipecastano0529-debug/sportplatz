import { cache } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { shortTime } from '@/lib/util';
import type { Torneo, Cupo, Partido, Anotacion } from '@/lib/tournament';
import type { Equipo, Persona } from '@/lib/types';
import type { SportId } from '@/lib/sports';

/* ==========================================================================
   Consultas · Equipos, jugadores y torneos

   Los torneos se leen ENTEROS —cupos, partidos y anotaciones— en una sola
   consulta anidada. No es despilfarro: todo lo derivado (tabla, valla,
   podio, récord de un equipo, salón de la fama) necesita los partidos
   completos, y traerlos por trozos serían cuatro viajes para calcular lo
   mismo.

   Cuando esto pese —muchos torneos con historia larga— la salida es una
   vista materializada por torneo, nunca una columna acumulada (R33).
   ========================================================================== */

export const equiposDe = cache(async (complejoId: string): Promise<Equipo[]> => {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('equipos').select('*')
    .eq('complejo_id', complejoId)
    .order('creado_en', { ascending: true });

  if (error) throw new Error(`No se pudieron leer los equipos: ${error.message}`);
  return (data ?? []) as Equipo[];
});

export interface Plantilla {
  equipo_id: string;
  persona_id: string;
  posicion: string | null;
  desde: string;
  personas: Pick<Persona, 'id' | 'nombre' | 'avatar_url' | 'color'> | null;
}

export const plantillasDe = cache(async (complejoId: string): Promise<Plantilla[]> => {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('plantillas')
    .select('equipo_id, persona_id, posicion, desde, personas(id, nombre, avatar_url, color), equipos!inner(complejo_id)')
    .eq('equipos.complejo_id', complejoId);

  if (error) throw new Error(`No se pudieron leer las plantillas: ${error.message}`);
  return (data ?? []) as unknown as Plantilla[];
});

/** Las personas del complejo, para el directorio y para armar plantillas. */
export const personasDe = cache(async (complejoId: string): Promise<Persona[]> => {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('membresias')
    .select('personas!inner(*)')
    .eq('complejo_id', complejoId);

  if (error) throw new Error(`No se pudieron leer los jugadores: ${error.message}`);

  const vistas = new Map<string, Persona>();
  for (const fila of (data ?? []) as unknown as { personas: Persona }[]) {
    if (fila.personas) vistas.set(fila.personas.id, fila.personas);
  }
  return [...vistas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
});

/* ── Torneos ─────────────────────────────────────────────────────────────── */

/** Lo que devuelve Postgres, antes de pasarlo a la forma que usa el motor. */
interface TorneoCrudo {
  id: string;
  nombre: string;
  deporte: SportId;
  tamano: 4 | 8 | 16;
  fecha_inicio: string;
  inscripcion_abierta: boolean;
  torneo_cupos: {
    id: string; posicion: number; equipo_id: string | null; nombre: string; color: string;
  }[];
  partidos: {
    id: string; ronda: string; idx: number;
    cupo_a: string | null; cupo_b: string | null;
    marcador_a: number | null; marcador_b: number | null;
    fecha: string | null; hora: string | null; cancha_id: string | null; jugado: boolean;
    anotaciones: {
      id: string; cupo_id: string; persona_id: string | null; nombre: string; goles: number;
    }[];
  }[];
}

const CONSULTA_TORNEO = `
  id, nombre, deporte, tamano, fecha_inicio, inscripcion_abierta,
  torneo_cupos(id, posicion, equipo_id, nombre, color),
  partidos(
    id, ronda, idx, cupo_a, cupo_b, marcador_a, marcador_b,
    fecha, hora, cancha_id, jugado,
    anotaciones(id, cupo_id, persona_id, nombre, goles)
  )
`;

/** De snake_case a la forma que espera `lib/tournament.ts`. */
function aTorneo(t: TorneoCrudo): Torneo {
  const cupos: Cupo[] = t.torneo_cupos
    .map(c => ({
      id: c.id,
      posicion: c.posicion,
      equipoId: c.equipo_id,
      nombre: c.nombre,
      color: c.color
    }))
    .sort((a, b) => a.posicion - b.posicion);

  const anotaciones: Anotacion[] = [];
  const partidos: Partido[] = t.partidos.map(m => {
    for (const a of m.anotaciones ?? []) {
      anotaciones.push({
        id: a.id,
        partidoId: m.id,
        cupoId: a.cupo_id,
        personaId: a.persona_id,
        nombre: a.nombre,
        goles: a.goles
      });
    }
    return {
      id: m.id,
      ronda: m.ronda as Partido['ronda'],
      idx: m.idx,
      cupoA: m.cupo_a,
      cupoB: m.cupo_b,
      marcadorA: m.marcador_a,
      marcadorB: m.marcador_b,
      fecha: m.fecha,
      hora: m.hora ? shortTime(m.hora) : null,
      canchaId: m.cancha_id,
      jugado: m.jugado
    };
  }).sort((a, b) => a.idx - b.idx);

  return {
    id: t.id,
    nombre: t.nombre,
    deporte: t.deporte,
    tamano: t.tamano,
    fechaInicio: t.fecha_inicio,
    inscripcionAbierta: t.inscripcion_abierta,
    cupos,
    partidos,
    anotaciones
  };
}

export const torneosDe = cache(async (complejoId: string): Promise<Torneo[]> => {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('torneos')
    .select(CONSULTA_TORNEO)
    .eq('complejo_id', complejoId)
    .order('fecha_inicio', { ascending: false });

  if (error) throw new Error(`No se pudieron leer los torneos: ${error.message}`);
  return ((data ?? []) as unknown as TorneoCrudo[]).map(aTorneo);
});

export const torneoPorId = cache(async (
  complejoId: string,
  torneoId: string
): Promise<Torneo | null> => {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from('torneos')
    .select(CONSULTA_TORNEO)
    .eq('complejo_id', complejoId)
    .eq('id', torneoId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el torneo: ${error.message}`);
  return data ? aTorneo(data as unknown as TorneoCrudo) : null;
});
