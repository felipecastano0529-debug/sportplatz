'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { resolverTenant } from '@/lib/tenant';
import { horasDelDia } from '@/lib/queries/agenda';
import { nextHour, shortTime, telE164, fmtHour, iso, today } from '@/lib/util';
import type { Cancha, MedioPago, Origen } from '@/lib/types';

/* ==========================================================================
   Escrituras · Agenda

   Las cuatro reglas que no se negocian aquí:

     · R4. La no-doble-reserva la impone la BASE con un índice único. Este
       archivo NO comprueba antes y escribe después: intenta escribir y
       traduce el 23505. Comprobar primero es una carrera perdida en cuanto
       hay dos personas.
     · R5. Cuando la franja se la lleva otro, no se devuelve "error": se
       devuelven las horas que SÍ quedan libres. Es lo que ya hace Neo.
     · R8. `total` se congela con el precio del momento. Cambiar la tarifa
       mañana no reescribe el pasado.
     · R9/R15. `abonado` NUNCA se escribe a mano. Todo movimiento de plata es
       una fila en `pagos` y un trigger recalcula. Así una devolución es un
       monto negativo y no una resta que nadie puede auditar.
   ========================================================================== */

export interface ResultadoReserva {
  ok?: boolean;
  error?: string;
  /** R5: si la franja se la llevó otro, con qué horas se puede seguir. */
  libres?: string[];
  mensaje?: string;
}

const CHOQUE = '23505';

async function staffDe(slug: string) {
  const s = await resolverTenant(slug);
  if (!s.staff) throw new Error('No tienes permiso sobre esta agenda.');
  if (s.soloLectura) throw new Error('El plan está vencido: la agenda es de solo lectura.');
  return s;
}

/** Las horas que quedan libres en una cancha ese día, para ofrecerlas (R5, R6). */
async function libresDe(
  cancha: Cancha,
  fecha: string,
  horas: string[]
): Promise<string[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from('reservas')
    .select('inicio')
    .eq('cancha_id', cancha.id)
    .eq('fecha', fecha)
    .in('estado', ['confirmada', 'jugada']);

  const tomadas = new Set((data ?? []).map(r => shortTime(r.inicio as string)));
  const esHoy = fecha === iso(today());
  const ahora = new Date().getHours();

  return horas
    .filter(h => !tomadas.has(h))
    .filter(h => !esHoy || parseInt(h, 10) > ahora);
}

export async function crearReserva(
  slug: string,
  form: {
    canchaId: string;
    fecha: string;
    inicio: string;
    cliente: string;
    telefono?: string;
    adelanto?: number;
    medio?: MedioPago;
    nota?: string;
    origen?: Origen;
  }
): Promise<ResultadoReserva> {
  const s = await staffDe(slug);
  const sb = await supabaseServer();

  const cliente = form.cliente.trim();
  if (!cliente) return { error: 'Escribe a nombre de quién va la reserva.' };

  const { data: cancha } = await sb
    .from('canchas').select('*')
    .eq('id', form.canchaId).eq('complejo_id', s.complejo.id).single();

  if (!cancha) return { error: 'Esa cancha no existe en este complejo.' };
  const c = cancha as Cancha;
  if (!c.activa) return { error: `${c.nombre} está desactivada y no se puede reservar.` };

  const inicio = shortTime(form.inicio);
  const total = c.precio;                        // R8: se congela aquí
  const adelanto = Math.max(0, Math.min(total, Math.round(form.adelanto ?? 0)));

  const { data: creada, error } = await sb
    .from('reservas')
    .insert({
      complejo_id: s.complejo.id,
      cancha_id: c.id,
      fecha: form.fecha,
      inicio,
      fin: nextHour(inicio),                     // R1: una hora exacta
      cliente,
      telefono: telE164(form.telefono),
      total,
      origen: form.origen ?? 'mostrador',
      nota: form.nota?.trim() ?? ''
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === CHOQUE) {
      const libres = await libresDe(c, form.fecha, horasDelDia(s.complejo));
      return {
        error: `Alguien acaba de tomar las ${fmtHour(inicio)} en ${c.nombre}.`,
        libres,
        mensaje: libres.length
          ? 'Estas horas siguen libres ese día:'
          : 'No queda ninguna hora libre en esa cancha ese día.'
      };
    }
    return { error: `No se pudo guardar la reserva: ${error.message}` };
  }

  // R9/R15: el adelanto es un PAGO, no un número escrito en la reserva.
  if (adelanto > 0) {
    const { error: ePago } = await sb.from('pagos').insert({
      complejo_id: s.complejo.id,
      reserva_id: creada.id,
      monto: adelanto,
      medio: form.medio ?? 'efectivo',
      registrado_por: s.persona.id
    });
    if (ePago) return { error: `La reserva quedó, pero el adelanto no: ${ePago.message}` };
  }

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** Un abono suma a `abonado` y nunca lo pasa de `total` (R15). */
export async function registrarAbono(
  slug: string,
  reservaId: string,
  monto: number,
  medio: MedioPago = 'efectivo'
): Promise<ResultadoReserva> {
  const s = await staffDe(slug);
  const sb = await supabaseServer();

  const { data: r } = await sb
    .from('reservas').select('total, abonado')
    .eq('id', reservaId).eq('complejo_id', s.complejo.id).single();

  if (!r) return { error: 'Esa reserva no existe.' };

  const falta = r.total - r.abonado;
  if (falta <= 0) return { error: 'Esa reserva ya está pagada.' };

  const cobra = Math.max(1, Math.min(falta, Math.round(monto)));
  const { error } = await sb.from('pagos').insert({
    complejo_id: s.complejo.id,
    reserva_id: reservaId,
    monto: cobra,
    medio,
    registrado_por: s.persona.id
  });

  if (error) return { error: `No se pudo registrar el abono: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/**
 * R19. En producción cancelar NO borra: la reserva pasa a `cancelada`,
 * conserva quién y cuándo, y libera la franja (el índice único es parcial).
 * Un negocio necesita saber qué se cayó.
 */
export async function cancelarReserva(
  slug: string,
  reservaId: string
): Promise<ResultadoReserva> {
  const s = await staffDe(slug);
  const sb = await supabaseServer();

  const { error } = await sb
    .from('reservas')
    .update({
      estado: 'cancelada',
      cancelada_en: new Date().toISOString(),
      cancelada_por: s.persona.id
    })
    .eq('id', reservaId)
    .eq('complejo_id', s.complejo.id);

  if (error) return { error: `No se pudo cancelar: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}

/** Devolución: fila con monto negativo. Nunca se edita un pago existente (P5). */
export async function devolver(
  slug: string,
  reservaId: string,
  monto: number
): Promise<ResultadoReserva> {
  const s = await staffDe(slug);
  const sb = await supabaseServer();

  const { data: r } = await sb
    .from('reservas').select('abonado')
    .eq('id', reservaId).eq('complejo_id', s.complejo.id).single();

  if (!r) return { error: 'Esa reserva no existe.' };

  const devuelve = Math.max(1, Math.min(r.abonado, Math.round(monto)));
  const { error } = await sb.from('pagos').insert({
    complejo_id: s.complejo.id,
    reserva_id: reservaId,
    monto: -devuelve,
    medio: 'efectivo',
    registrado_por: s.persona.id
  });

  if (error) return { error: `No se pudo registrar la devolución: ${error.message}` };

  revalidatePath(`/${slug}`, 'layout');
  return { ok: true };
}
