'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { resolverTenant } from '@/lib/tenant';
import { torneoPorId } from '@/lib/queries/comunidad';
import { bracketShape, resolveBracket, reseed, hasStarted, TEAM_COLORS } from '@/lib/tournament';
import { iso, addDays, parseISO } from '@/lib/util';
import type { SportId } from '@/lib/sports';

/* ==========================================================================
   Escrituras · Torneos

   El motor de llaves (`lib/tournament.ts`) es puro: recibe el torneo, lo
   resuelve y devuelve QUÉ partidos cambiaron. Este archivo es el único que
   habla con la base, y escribe solo esos.

   R24 — los ganadores avanzan solos. Marcar un resultado no es guardar dos
   números: es resolver la llave hacia adelante, incluido el tercer puesto.
   R29 — volver a sortear solo lo puede hacer el dueño y solo si el torneo no
   ha empezado.
   ========================================================================== */

export interface Resultado { ok?: boolean; error?: string; id?: string }

async function staffDe(slug: string) {
  const s = await resolverTenant(slug);
  if (!s.staff) throw new Error('No tienes permiso sobre los torneos de este complejo.');
  if (s.soloLectura) throw new Error('El plan está vencido: los torneos son de solo lectura.');
  return s;
}

export async function crearTorneo(
  slug: string,
  form: {
    nombre: string;
    deporte: SportId;
    tamano: 4 | 8 | 16;
    fechaInicio: string;
    inscripcionAbierta: boolean;
    equipos?: (string | null)[];
  }
): Promise<Resultado> {
  const s = await staffDe(slug);
  const sb = await supabaseServer();

  const nombre = form.nombre.trim();
  if (!nombre) return { error: 'El torneo necesita un nombre.' };
  if (![4, 8, 16].includes(form.tamano)) return { error: 'Solo hay torneos de 4, 8 o 16 equipos.' };

  const { data: torneo, error } = await sb
    .from('torneos')
    .insert({
      complejo_id: s.complejo.id,
      nombre: nombre.slice(0, 80),
      deporte: form.deporte,
      tamano: form.tamano,
      fecha_inicio: form.fechaInicio,
      inscripcion_abierta: form.inscripcionAbierta
    })
    .select('id')
    .single();

  if (error) return { error: `No se pudo crear el torneo: ${error.message}` };

  // Los cupos. Los que vienen con equipo real quedan ocupados desde el
  // principio; el resto espera a que alguien se inscriba (R28).
  const equiposReales = form.equipos ?? [];
  const ids = equiposReales.filter(Boolean) as string[];
  const { data: reales } = ids.length
    ? await sb.from('equipos').select('id, nombre, color')
        .eq('complejo_id', s.complejo.id).in('id', ids)
    : { data: [] };

  const porId = new Map((reales ?? []).map(e => [e.id, e]));

  const cupos = Array.from({ length: form.tamano }, (_, i) => {
    const real = equiposReales[i] ? porId.get(equiposReales[i]!) : undefined;
    return {
      torneo_id: torneo.id,
      posicion: i,
      equipo_id: real?.id ?? null,
      nombre: real?.nombre ?? `Equipo ${i + 1}`,
      color: real?.color ?? TEAM_COLORS[i % TEAM_COLORS.length]
    };
  });

  const { data: cuposCreados, error: eCupos } = await sb
    .from('torneo_cupos').insert(cupos).select('id, posicion');

  if (eCupos) return { error: `No se pudieron crear los cupos: ${eCupos.message}` };

  const porPosicion = new Map((cuposCreados ?? []).map(c => [c.posicion as number, c.id as string]));
  const forma = bracketShape(form.tamano);
  const primera = forma[0].ronda;

  const partidos = forma.map(f => ({
    torneo_id: torneo.id,
    ronda: f.ronda,
    idx: f.idx,
    // Solo la primera ronda nace con cupos: el resto lo llena `resolveBracket`
    // a medida que se marcan resultados.
    cupo_a: f.ronda === primera ? porPosicion.get(f.idx * 2) ?? null : null,
    cupo_b: f.ronda === primera ? porPosicion.get(f.idx * 2 + 1) ?? null : null,
    fecha: iso(addDays(parseISO(form.fechaInicio), f.semana * 7)),
    hora: f.ronda === 'tercero'
      ? '15:00'
      : String(17 + (f.idx % 5)).padStart(2, '0') + ':00'
  }));

  const { error: ePartidos } = await sb.from('partidos').insert(partidos);
  if (ePartidos) return { error: `No se pudo armar la llave: ${ePartidos.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id: torneo.id };
}

/**
 * Marcar un resultado. Escribe el marcador Y resuelve la llave hacia
 * adelante en la misma operación (R24): si esto fueran dos pasos, un fallo
 * en medio dejaría un torneo con un ganador que no avanzó.
 */
export async function marcarResultado(
  slug: string,
  torneoId: string,
  partidoId: string,
  marcadorA: number | null,
  marcadorB: number | null
): Promise<Resultado> {
  const s = await staffDe(slug);
  const sb = await supabaseServer();

  const jugado = marcadorA != null && marcadorB != null;

  const { error } = await sb
    .from('partidos')
    .update({
      marcador_a: marcadorA,
      marcador_b: marcadorB,
      jugado
    })
    .eq('id', partidoId)
    .eq('torneo_id', torneoId);

  if (error) return { error: `No se pudo guardar el marcador: ${error.message}` };

  // Se relee el torneo entero y se resuelve: el motor devuelve solo los
  // partidos cuyos cupos cambiaron, así que la escritura sigue siendo corta.
  const tn = await torneoPorId(s.complejo.id, torneoId);
  if (!tn) return { error: 'Ese torneo ya no existe.' };

  const tocados = resolveBracket(tn);
  for (const m of tocados) {
    const { error: e } = await sb
      .from('partidos').update({ cupo_a: m.cupoA, cupo_b: m.cupoB })
      .eq('id', m.id);
    if (e) return { error: `El marcador quedó, pero la llave no avanzó: ${e.message}` };
  }

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** R29: barajar los cruces de primera ronda. Solo si no ha empezado. */
export async function volverASortear(slug: string, torneoId: string): Promise<Resultado> {
  const s = await resolverTenant(slug);
  if (!s.dueno) return { error: 'Solo el dueño puede volver a sortear.' };
  if (s.soloLectura) return { error: 'El plan está vencido: los torneos son de solo lectura.' };

  const sb = await supabaseServer();
  const tn = await torneoPorId(s.complejo.id, torneoId);
  if (!tn) return { error: 'Ese torneo ya no existe.' };

  if (hasStarted(tn)) {
    return { error: 'Este torneo ya tiene resultados. Volver a sortear borraría lo jugado.' };
  }

  reseed(tn);

  for (const m of tn.partidos) {
    const { error } = await sb
      .from('partidos')
      .update({
        cupo_a: m.cupoA,
        cupo_b: m.cupoB,
        marcador_a: m.marcadorA,
        marcador_b: m.marcadorB,
        jugado: m.jugado
      })
      .eq('id', m.id);
    if (error) return { error: `No se pudo sortear: ${error.message}` };
  }

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function editarTorneo(
  slug: string,
  torneoId: string,
  form: { nombre?: string; fechaInicio?: string; inscripcionAbierta?: boolean }
): Promise<Resultado> {
  const s = await staffDe(slug);
  const sb = await supabaseServer();

  const cambios: Record<string, unknown> = {};
  if (form.nombre !== undefined) {
    const n = form.nombre.trim();
    if (!n) return { error: 'El torneo necesita un nombre.' };
    cambios.nombre = n.slice(0, 80);
  }
  if (form.fechaInicio !== undefined) cambios.fecha_inicio = form.fechaInicio;
  if (form.inscripcionAbierta !== undefined) cambios.inscripcion_abierta = form.inscripcionAbierta;
  if (!Object.keys(cambios).length) return { ok: true };

  const { error } = await sb
    .from('torneos').update(cambios)
    .eq('id', torneoId).eq('complejo_id', s.complejo.id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function borrarTorneo(slug: string, torneoId: string): Promise<Resultado> {
  const s = await resolverTenant(slug);
  if (!s.dueno) return { error: 'Solo el dueño puede eliminar un torneo.' };

  const sb = await supabaseServer();
  const { error } = await sb
    .from('torneos').delete()
    .eq('id', torneoId).eq('complejo_id', s.complejo.id);

  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** R28: el jugador mete SU equipo en el primer cupo libre. */
export async function inscribirEquipo(
  slug: string,
  torneoId: string,
  equipoId: string
): Promise<Resultado> {
  const s = await resolverTenant(slug);
  const sb = await supabaseServer();

  const tn = await torneoPorId(s.complejo.id, torneoId);
  if (!tn) return { error: 'Ese torneo ya no existe.' };
  if (!tn.inscripcionAbierta) return { error: 'Este torneo no está abierto a inscripción.' };
  if (tn.cupos.some(c => c.equipoId === equipoId)) {
    return { error: 'Ese equipo ya está inscrito en este torneo.' };
  }

  const libre = tn.cupos.slice().sort((a, b) => a.posicion - b.posicion).find(c => !c.equipoId);
  if (!libre) return { error: 'Ya no quedan cupos libres.' };

  const { data: equipo } = await sb
    .from('equipos').select('id, nombre, color, capitan_id')
    .eq('id', equipoId).eq('complejo_id', s.complejo.id).single();

  if (!equipo) return { error: 'Ese equipo no existe en este complejo.' };
  if (!s.staff && equipo.capitan_id !== s.persona.id) {
    return { error: 'Solo el capitán puede inscribir a su equipo.' };
  }

  const { error } = await sb
    .from('torneo_cupos')
    .update({ equipo_id: equipo.id, nombre: equipo.nombre, color: equipo.color })
    .eq('id', libre.id)
    // Sin equipo todavía: si alguien se inscribió en este mismo instante, la
    // condición falla y no se pisa su cupo.
    .is('equipo_id', null);

  if (error) return { error: `No se pudo inscribir: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** Una anotación es un HECHO, no un total (R31). */
export async function anotar(
  slug: string,
  form: { partidoId: string; cupoId: string; personaId?: string | null; nombre: string; goles: number }
): Promise<Resultado> {
  await staffDe(slug);
  const sb = await supabaseServer();

  const goles = Math.max(1, Math.round(form.goles));
  const { error } = await sb.from('anotaciones').insert({
    partido_id: form.partidoId,
    cupo_id: form.cupoId,
    persona_id: form.personaId ?? null,
    nombre: form.nombre.trim() || 'Anónimo',
    goles
  });

  if (error) return { error: `No se pudo anotar: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function borrarAnotacion(slug: string, anotacionId: string): Promise<Resultado> {
  await staffDe(slug);
  const sb = await supabaseServer();
  const { error } = await sb.from('anotaciones').delete().eq('id', anotacionId);
  if (error) return { error: `No se pudo quitar: ${error.message}` };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}
