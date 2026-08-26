'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { resolverTenant } from '@/lib/tenant';
import { canchasActivas } from '@/lib/queries/canchas';
import { franjasOcupadas, misReservas } from '@/lib/queries/agenda';
import { responder, saludoInicial, type Sesion, type Mundo, type Respuesta, type Mensaje } from '@/lib/neo/motor';
import { leerFecha } from '@/lib/neo/lectura';
import { norm } from '@/lib/neo/lectura';
import { reservarComoJugador, cancelarMiReserva } from '@/lib/actions/jugador';
import { iso, today, shortTime, fmtDate, fmtHour, money, firstName, suggestedDeposit } from '@/lib/util';

/* ==========================================================================
   NEO · La costura con la base

   El motor es puro: recibe un mundo y devuelve mensajes y, si toca, una
   ACCIÓN. Este archivo es el único que lee la agenda y el único que escribe.

   R43 — la reserva que crea Neo es el MISMO registro que crea el mostrador.
   Por eso no inserta a mano: llama a `reservarComoJugador`, la misma función
   que usa el formulario. Solo cambia `origen`.

   R5 — entre el resumen y el «dale» del jugador pueden pasar treinta
   segundos. La escritura revalida contra la base, y si la franja se la
   llevaron, Neo lo dice y ofrece las que quedan.
   ========================================================================== */

/** El día del que hay que cargar disponibilidad para poder contestar. */
function diaEnJuego(ctx: Sesion, entrada: string): string {
  const { date } = leerFecha(norm(entrada));
  return date ?? ctx.date ?? iso(today());
}

async function cargarMundo(slug: string, dia: string): Promise<{ mundo: Mundo; complejoId: string }> {
  const s = await resolverTenant(slug);
  const [canchas, ocupadas, mias] = await Promise.all([
    canchasActivas(s.complejo.id),
    franjasOcupadas(s.complejo.id, dia),
    misReservas(s.complejo.id, s.persona.id, { desde: iso(today()) })
  ]);

  return {
    complejoId: s.complejo.id,
    mundo: {
      negocio: s.complejo.nombre,
      abre: s.complejo.hora_abre,
      cierra: s.complejo.hora_cierra,
      canchas: canchas.map(c => ({
        id: c.id, nombre: c.nombre, deporte: c.deporte, precio: c.precio
      })),
      ocupadas,
      diaCargado: dia,
      yo: { nombre: s.persona.nombre },
      misReservas: mias.map(r => ({
        id: r.id,
        codigo: r.codigo,
        canchaId: r.cancha_id,
        fecha: r.fecha,
        inicio: shortTime(r.inicio),
        total: r.total,
        abonado: r.abonado
      }))
    }
  };
}

export async function abrirConversacion(slug: string): Promise<Respuesta> {
  const { mundo } = await cargarMundo(slug, iso(today()));
  return saludoInicial(mundo);
}

export async function hablarConNeo(
  slug: string,
  ctx: Sesion,
  entrada: string
): Promise<{ ctx: Sesion; respuesta: Respuesta }> {
  const dia = diaEnJuego(ctx, entrada);
  const { mundo } = await cargarMundo(slug, dia);

  // El motor MUTA la sesión: se clona para que el estado que vuelve al
  // cliente sea un objeto nuevo y React lo vea cambiar.
  const sesion: Sesion = { ...ctx };
  const r = responder(sesion, entrada, mundo);

  if (!r.accion) return { ctx: sesion, respuesta: r };

  if (r.accion.tipo === 'reservar') {
    const { canchaId, fecha, inicio, pago } = r.accion;
    // Origen 'neo' y no 'bot': 'bot' es WhatsApp, esta entró hablando DENTRO
    // de la app. Las dos son Neo; la agenda las distingue (R18).
    const res = await reservarComoJugador(slug, { canchaId, fecha, inicio, pago });

    if (res.error) {
      const msgs: Mensaje[] = [{ t: 'text', text: res.error }];
      if (res.libres?.length) {
        msgs.push({ t: 'hours', canchaId, fecha, horas: res.libres });
      }
      sesion.start = null;
      sesion.espera = null;
      return { ctx: sesion, respuesta: { msgs, quick: ['Otra hora', 'Otro día'] } };
    }

    const cancha = mundo.canchas.find(c => c.id === canchaId)!;
    const abonado = 0;   // el complejo cobra al llegar mientras no haya pasarela
    const codigo = res.codigo ?? '';
    sesion.ultima = codigo;
    sesion.start = null;

    revalidatePath(`/${slug}`, 'layout');

    return {
      ctx: sesion,
      respuesta: {
        msgs: [
          {
            t: 'ok',
            b: {
              codigo,
              cancha: cancha.nombre,
              fecha,
              inicio,
              total: cancha.precio,
              abonado,
              saldo: cancha.precio - abonado
            }
          },
          {
            t: 'text',
            text: `Quedó a tu nombre${mundo.yo ? `, ${firstName(mundo.yo.nombre)}` : ''}. ` +
              'Ya te aparece en tu inicio y en tus reservas. ' +
              `${pagoEnPalabras(pago, cancha.precio)} ` +
              `Si te toca cancelar, escríbeme «cancelar ${codigo}» y la suelto.`
          }
        ],
        quick: ['Reservar otra', 'Mis reservas']
      }
    };
  }

  if (r.accion.tipo === 'cancelar') {
    const res = await cancelarMiReserva(slug, r.accion.reservaId);
    if (res.error) {
      return {
        ctx: sesion,
        respuesta: { msgs: [{ t: 'text', text: res.error }], quick: ['Mis reservas'] }
      };
    }
    revalidatePath(`/${slug}`, 'layout');
  }

  return { ctx: sesion, respuesta: r };
}

function pagoEnPalabras(pago: 'adelanto' | 'completo' | 'cancha', precio: number): string {
  if (pago === 'completo') return `Pagas ${money(precio)} al llegar.`;
  if (pago === 'cancha') return `Pagas los ${money(precio)} en cancha.`;
  return `Llevas ${money(suggestedDeposit(precio))} de adelanto y el resto en cancha.`;
}

/* ── Lo que ve el dueño ──────────────────────────────────────────────────── */

/**
 * El resumen de automatización de la vista de Neo AI del dueño: cuánto
 * atiende el asistente sin que nadie conteste. Suma `neo` y `bot`, que son
 * las dos puertas del mismo asistente (R18).
 */
export async function resumenDeNeo(slug: string, desde: string, hasta: string) {
  const s = await resolverTenant(slug);
  const sb = await supabaseServer();

  const { data } = await sb
    .from('reservas')
    .select('origen, total, abonado')
    .eq('complejo_id', s.complejo.id)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .in('estado', ['confirmada', 'jugada']);

  const filas = (data ?? []) as { origen: string; total: number; abonado: number }[];
  const porNeo = filas.filter(r => r.origen === 'neo' || r.origen === 'bot');

  return {
    total: filas.length,
    atendidas: porNeo.length,
    porcentaje: filas.length ? porNeo.length / filas.length : 0,
    facturadoPorNeo: porNeo.reduce((a, r) => a + r.total, 0)
  };
}

/** Un texto corto para el dueño, con la fecha ya formateada. */
export async function ejemploDeReserva(slug: string) {
  const s = await resolverTenant(slug);
  const sb = await supabaseServer();

  const { data } = await sb
    .from('reservas')
    .select('cliente, fecha, inicio, codigo, canchas(nombre)')
    .eq('complejo_id', s.complejo.id)
    .in('origen', ['neo', 'bot'])
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const r = data as unknown as {
    cliente: string; fecha: string; inicio: string; codigo: string;
    canchas: { nombre: string } | null;
  };

  return {
    texto: `${r.cliente} apartó ${r.canchas?.nombre ?? 'una cancha'} el ` +
      `${fmtDate(r.fecha)} a las ${fmtHour(shortTime(r.inicio))}`,
    codigo: r.codigo
  };
}
