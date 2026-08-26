'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { resolverTenant } from '@/lib/tenant';
import { horasDelDia } from '@/lib/queries/agenda';
import { nextHour, shortTime, fmtHour, iso, today } from '@/lib/util';
import type { Cancha } from '@/lib/types';

/* ==========================================================================
   Escrituras · El jugador

   El jugador reserva A SU NOMBRE, en un complejo donde está inscrito, y no
   puede darse por pagado: la política de RLS exige `abonado = 0` en el
   insert, así que aunque este archivo mintiera, la base lo rechaza.

   R47 — tres formas de pago: adelanto (la mitad, R10), completo, o pagar en
   cancha. Las tres crean la MISMA reserva; lo único que cambia es cuánta
   plata entra hoy.

   Hasta que haya pasarela (§8.2), lo que el jugador elige aquí se registra
   como intención y el complejo lo cobra en mostrador. La reserva se crea
   siempre con `abonado = 0`: prometer un cobro que no ocurrió es peor que no
   cobrarlo.
   ========================================================================== */

export type FormaPago = 'adelanto' | 'completo' | 'cancha';

export interface ResultadoReserva {
  ok?: boolean;
  error?: string;
  libres?: string[];
  mensaje?: string;
  codigo?: string;
}

export async function reservarComoJugador(
  slug: string,
  form: { canchaId: string; fecha: string; inicio: string; pago: FormaPago; nota?: string }
): Promise<ResultadoReserva> {
  const s = await resolverTenant(slug);
  if (s.soloLectura) return { error: 'Este complejo está en solo lectura ahora mismo.' };

  const sb = await supabaseServer();

  const { data: cancha } = await sb
    .from('canchas').select('*')
    .eq('id', form.canchaId).eq('complejo_id', s.complejo.id).single();

  if (!cancha) return { error: 'Esa cancha no existe en este complejo.' };
  const c = cancha as Cancha;
  if (!c.activa) return { error: `${c.nombre} no está disponible.` };

  const inicio = shortTime(form.inicio);

  // R6: las horas ya pasadas de hoy no se reservan. Prometer una franja que
  // empezó hace veinte minutos es lo que hace que una agenda deje de creerse.
  if (form.fecha === iso(today()) && parseInt(inicio, 10) <= new Date().getHours()) {
    return { error: 'Esa hora ya pasó. Elige una más tarde.' };
  }

  const nota =
    form.pago === 'completo' ? 'El jugador paga completo al llegar'
    : form.pago === 'adelanto' ? 'El jugador aparta con adelanto'
    : 'El jugador paga todo en cancha';

  const { data: creada, error } = await sb
    .from('reservas')
    .insert({
      complejo_id: s.complejo.id,
      cancha_id: c.id,
      fecha: form.fecha,
      inicio,
      fin: nextHour(inicio),
      persona_id: s.persona.id,
      cliente: s.persona.nombre,
      telefono: s.persona.telefono,
      total: c.precio,        // R8: congelado
      abonado: 0,             // lo exige la política; solo un `pago` lo mueve
      origen: 'app',
      estado: 'confirmada',
      nota: form.nota?.trim() || nota
    })
    .select('codigo')
    .single();

  if (error) {
    // R5: si alguien tomó la hora mientras decidía, no se dice "error". Se
    // dice qué pasó y con qué horas puede seguir.
    if (error.code === '23505') {
      const { data } = await sb
        .from('reservas').select('inicio')
        .eq('cancha_id', c.id).eq('fecha', form.fecha)
        .in('estado', ['confirmada', 'jugada']);

      const tomadas = new Set((data ?? []).map(r => shortTime(r.inicio as string)));
      const esHoy = form.fecha === iso(today());
      const ahora = new Date().getHours();
      const libres = horasDelDia(s.complejo)
        .filter(h => !tomadas.has(h))
        .filter(h => !esHoy || parseInt(h, 10) > ahora);

      return {
        error: `Alguien acaba de tomar las ${fmtHour(inicio)} en ${c.nombre}.`,
        libres,
        mensaje: libres.length
          ? 'Estas horas siguen libres:'
          : 'No queda ninguna hora libre en esa cancha ese día.'
      };
    }
    return { error: `No se pudo reservar: ${error.message}` };
  }

  revalidatePath(`/${slug}`, 'layout');
  // R48: el código con el que después se cancela por WhatsApp.
  return { ok: true, codigo: creada.codigo as string };
}

/**
 * El jugador cancela lo suyo. R19: no se borra, pasa a `cancelada` y libera
 * la franja. R20: la política de devolución es del negocio; por ahora se
 * deja constancia y el complejo decide.
 */
export async function cancelarMiReserva(
  slug: string,
  reservaId: string
): Promise<ResultadoReserva> {
  const s = await resolverTenant(slug);
  const sb = await supabaseServer();

  const { error } = await sb
    .from('reservas')
    .update({
      estado: 'cancelada',
      cancelada_en: new Date().toISOString(),
      cancelada_por: s.persona.id
    })
    .eq('id', reservaId)
    .eq('persona_id', s.persona.id)
    .eq('estado', 'confirmada');

  if (error) return { error: `No se pudo cancelar: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/* ── Equipos ─────────────────────────────────────────────────────────────── */

export async function crearMiEquipo(
  slug: string,
  form: { nombre: string; deporte: string; color: string }
): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const s = await resolverTenant(slug);
  const sb = await supabaseServer();

  const nombre = form.nombre.trim();
  if (nombre.length < 2) return { error: 'El equipo necesita un nombre.' };

  const { data, error } = await sb
    .from('equipos')
    .insert({
      complejo_id: s.complejo.id,
      nombre: nombre.slice(0, 40),
      deporte: form.deporte,
      color: form.color,
      capitan_id: s.persona.id
    })
    .select('id')
    .single();

  if (error) return { error: `No se pudo crear el equipo: ${error.message}` };

  // R35: el capitán está SIEMPRE dentro de la plantilla. Si no, un equipo
  // recién creado no tiene a nadie y el histórico nace roto.
  const { error: ePlantilla } = await sb.from('plantillas').insert({
    equipo_id: data.id,
    persona_id: s.persona.id
  });

  if (ePlantilla) return { error: `El equipo quedó, pero no te agregó: ${ePlantilla.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, id: data.id };
}

export async function guardarMiEquipo(
  slug: string,
  equipoId: string,
  form: { nombre?: string; color?: string; escudoUrl?: string }
): Promise<{ ok?: boolean; error?: string }> {
  const s = await resolverTenant(slug);
  const sb = await supabaseServer();

  const cambios: Record<string, unknown> = {};
  if (form.nombre !== undefined) {
    const n = form.nombre.trim();
    if (n.length < 2) return { error: 'El equipo necesita un nombre.' };
    cambios.nombre = n.slice(0, 40);
  }
  if (form.color !== undefined) cambios.color = form.color;
  if (form.escudoUrl !== undefined) cambios.escudo_url = form.escudoUrl;
  if (!Object.keys(cambios).length) return { ok: true };

  const { error } = await sb
    .from('equipos').update(cambios)
    .eq('id', equipoId)
    .eq('complejo_id', s.complejo.id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** R36/R37: la plantilla del equipo, con su posición por deporte. */
export async function ponerEnPlantilla(
  slug: string,
  equipoId: string,
  personaId: string,
  posicion?: string
): Promise<{ ok?: boolean; error?: string }> {
  // Resuelve el tenant aunque no se use el resultado: es lo que comprueba que
  // quien llama pertenece a este complejo antes de tocar nada.
  await resolverTenant(slug);
  const sb = await supabaseServer();

  const { error } = await sb
    .from('plantillas')
    .upsert({ equipo_id: equipoId, persona_id: personaId, posicion: posicion ?? null });

  if (error) return { error: `No se pudo agregar: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

export async function sacarDePlantilla(
  slug: string,
  equipoId: string,
  personaId: string
): Promise<{ ok?: boolean; error?: string }> {
  // Comprueba pertenencia al complejo antes de tocar nada.
  await resolverTenant(slug);
  const sb = await supabaseServer();

  const { data: equipo } = await sb
    .from('equipos').select('capitan_id').eq('id', equipoId).single();

  if (equipo?.capitan_id === personaId) {
    return { error: 'El capitán no se puede sacar de su propia plantilla (R35).' };
  }

  const { error } = await sb
    .from('plantillas').delete()
    .eq('equipo_id', equipoId).eq('persona_id', personaId);

  if (error) return { error: `No se pudo sacar: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}
