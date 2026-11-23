import { cache } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { iso, hhmm, shortTime, today, addDays } from '@/lib/util';
import type { Complejo, Reserva } from '@/lib/types';

/* ==========================================================================
   Consultas · Agenda

   Portado de `demo/app/core/calc.js`, con las mismas firmas y contra SQL en
   vez de contra un array en memoria.

   Lo que cambia de fondo: en la demo todo era síncrono porque el estado
   entero cabía en una variable. Aquí cada función es una consulta, así que
   la vista pide UNA vez lo que necesita y calcula sobre eso — nunca una
   consulta por celda de la agenda.
   ========================================================================== */

/* ── Horario ─────────────────────────────────────────────────────────────── */

/** Las franjas del día, de `hora_abre` a `hora_cierra - 1` (R2). */
export function horasDelDia(c: Pick<Complejo, 'hora_abre' | 'hora_cierra'>): string[] {
  const n = Math.max(1, c.hora_cierra - c.hora_abre);
  return Array.from({ length: n }, (_, i) => hhmm(c.hora_abre + i));
}

/* ── Lecturas ────────────────────────────────────────────────────────────── */

/**
 * Trae TODAS las filas de una consulta, en bloques.
 *
 * PostgREST devuelve como mucho mil filas y no avisa: no hay error, no hay
 * bandera, la respuesta simplemente se corta. Con una agenda de verdad eso
 * no es un detalle de paginación, es una mentira en pantalla. Pasó: el panel
 * pedía sus ciento veinte días ordenados por fecha ascendente, recibía las
 * mil reservas MÁS VIEJAS del rango y enseñaba «Facturado hoy $0» con tres
 * meses de dinero en la base, sin un solo error en consola.
 *
 * Diez complejos de un tamaño normal llegan a mil filas en una semana, así
 * que subir el tope del servidor solo aplaza el mismo susto.
 *
 * CASI TODA consulta de esta app cabe en una sola página — un día, catorce
 * días, treinta días. Solo el panel y ajustes (120 y 425 días) pasan de
 * mil filas. Por eso se pide la PRIMERA página sola, sin contar nada antes:
 * si viene incompleta, ya es todo y esto costó el mismo viaje de siempre.
 * Únicamente cuando la primera página viene llena —puede haber más detrás—
 * se pregunta cuántas hacen falta y se piden TODAS a la vez.
 *
 * La versión anterior contaba SIEMPRE antes de pedir nada, para poder
 * paralelizar de entrada. Sonaba bien y midió peor: le sumó un viaje de red
 * de más a cada consulta pequeña —que es el 90% de ellas— a cambio de
 * ahorrarle unos pocos a las dos que sí pesan.
 */
const BLOQUE = 1000;
/** Cinturón de seguridad: si algún día una consulta se deja el filtro de
    complejo, es mejor cortar que pasearse por la base entera. */
const TOPE_FILAS = 50_000;

async function todasLasFilas<T>(
  contar: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  queSeEstabaLeyendo: string
): Promise<T[]> {
  const { data, error } = await pagina(0, BLOQUE - 1);
  if (error) throw new Error(`${queSeEstabaLeyendo}: ${error.message}`);

  const filas = data ?? [];
  // Incompleta: no hay más detrás. El caso común, y el único viaje que hizo falta.
  if (filas.length < BLOQUE) return filas;

  const { count, error: eContar } = await contar();
  if (eContar) throw new Error(`${queSeEstabaLeyendo}: ${eContar.message}`);

  const total = Math.min(count ?? filas.length, TOPE_FILAS);
  const faltan = Math.ceil(total / BLOQUE) - 1;
  if (faltan <= 0) return filas;

  const resto = await Promise.all(
    Array.from({ length: faltan }, (_, i) => pagina((i + 1) * BLOQUE, (i + 1) * BLOQUE + BLOQUE - 1))
  );
  for (const bloque of resto) {
    if (bloque.error) throw new Error(`${queSeEstabaLeyendo}: ${bloque.error.message}`);
    filas.push(...(bloque.data ?? []));
  }
  return filas;
}

/**
 * Las reservas de un rango. Es la consulta base de la agenda y del panel:
 * se pide una vez el rango completo y todo lo demás se deriva en memoria.
 *
 * Las canceladas se excluyen por defecto porque no cuentan para plata ni
 * para ocupación — pero NO se borran (R19): la vista de cancelaciones las
 * pide aparte.
 */
export const reservasEntre = cache(async (
  complejoId: string,
  desde: string,
  hasta: string,
  incluirCanceladas = false
): Promise<Reserva[]> => {
  const sb = await supabaseServer();

  // El mismo filtro escrito dos veces: una para contar (con `head: true` no
  // viaja ni una fila, solo el número en la cabecera de la respuesta) y otra
  // para cada página. Son dos peticiones porque `range()` y
  // `count: 'exact', head: true` no se combinan en la misma — pero la de
  // contar es liviana y las páginas se piden TODAS a la vez, así que el
  // costo real es un viaje, no cuatro seguidos.
  const contar = () => {
    let q = sb.from('reservas').select('*', { count: 'exact', head: true })
      .eq('complejo_id', complejoId).gte('fecha', desde).lte('fecha', hasta);
    if (!incluirCanceladas) q = q.in('estado', ['confirmada', 'jugada']);
    return q;
  };

  const pagina = (a: number, b: number) => {
    let q = sb.from('reservas').select('*')
      .eq('complejo_id', complejoId).gte('fecha', desde).lte('fecha', hasta);
    if (!incluirCanceladas) q = q.in('estado', ['confirmada', 'jugada']);
    return q.order('fecha').order('inicio').range(a, b);
  };

  return todasLasFilas<Reserva>(contar, pagina, 'No se pudo leer la agenda');
});

export const reservasDelDia = (complejoId: string, fecha: string) =>
  reservasEntre(complejoId, fecha, fecha);

/** Lo que necesita cada cálculo de dinero de este archivo, y nada más. */
export type ResumenReserva = Pick<Reserva, 'fecha' | 'cancha_id' | 'total' | 'abonado'>;

/**
 * Como `reservasEntre`, pero solo trae las cuatro columnas que usan los
 * cálculos de abajo — no las dieciséis de `Reserva`.
 *
 * El Panel pide 120 días y Ajustes hasta 425: en un complejo con historia
 * real esas ventanas superan las mil filas y ya cuestan varias páginas. El
 * Panel solo suma plata y cuenta franjas; Ajustes solo suma plata. Ninguno
 * de los dos necesita el nombre del cliente, su teléfono, la nota o el
 * código — pedirlos de todas formas es transferir cuatro o cinco veces más
 * bytes por fila para tirarlos sin mirarlos.
 */
export const resumenEntre = cache(async (
  complejoId: string,
  desde: string,
  hasta: string
): Promise<ResumenReserva[]> => {
  const sb = await supabaseServer();
  const columnas = 'fecha, cancha_id, total, abonado';

  const contar = () =>
    sb.from('reservas').select('*', { count: 'exact', head: true })
      .eq('complejo_id', complejoId).gte('fecha', desde).lte('fecha', hasta)
      .in('estado', ['confirmada', 'jugada']);

  const pagina = (a: number, b: number) =>
    sb.from('reservas').select(columnas)
      .eq('complejo_id', complejoId).gte('fecha', desde).lte('fecha', hasta)
      .in('estado', ['confirmada', 'jugada'])
      .range(a, b);

  return todasLasFilas<ResumenReserva>(contar, pagina, 'No se pudo leer el resumen de la agenda');
});

/** Lo que le queda por delante a una persona, de lo más cercano a lo más lejos. */
export const misReservas = cache(async (
  complejoId: string,
  personaId: string,
  { desde, hasta }: { desde?: string; hasta?: string } = {}
): Promise<Reserva[]> => {
  const sb = await supabaseServer();

  const contar = () => {
    let q = sb.from('reservas').select('*', { count: 'exact', head: true })
      .eq('complejo_id', complejoId).eq('persona_id', personaId)
      .in('estado', ['confirmada', 'jugada']);
    if (desde) q = q.gte('fecha', desde);
    if (hasta) q = q.lte('fecha', hasta);
    return q;
  };

  const pagina = (a: number, b: number) => {
    let q = sb.from('reservas').select('*')
      .eq('complejo_id', complejoId).eq('persona_id', personaId)
      .in('estado', ['confirmada', 'jugada']);
    if (desde) q = q.gte('fecha', desde);
    if (hasta) q = q.lte('fecha', hasta);
    return q
      .order('fecha', { ascending: false })
      .order('inicio', { ascending: false })
      .range(a, b);
  };

  return todasLasFilas<Reserva>(contar, pagina, 'No se pudieron leer tus reservas');
});

/**
 * Las franjas ya tomadas de un día, sin decir de quién son.
 *
 * Es la costura exacta entre "puedo reservar" y "puedo cotillear": el
 * jugador necesita saber qué horas están libres, no quién ocupa las otras ni
 * cuánto pagó. La función vive en la base con `security definer` y devuelve
 * dos columnas.
 */
export const franjasOcupadas = cache(async (
  complejoId: string,
  fecha: string
): Promise<Map<string, Set<string>>> => {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('franjas_ocupadas', { c: complejoId, d: fecha });
  if (error) throw new Error(`No se pudo leer la disponibilidad: ${error.message}`);

  const mapa = new Map<string, Set<string>>();
  for (const f of (data ?? []) as { cancha_id: string; inicio: string }[]) {
    const set = mapa.get(f.cancha_id) ?? new Set<string>();
    set.add(shortTime(f.inicio));
    mapa.set(f.cancha_id, set);
  }
  return mapa;
});

/* ── Derivados ───────────────────────────────────────────────────────────── */

/**
 * Las horas libres de una cancha en un día (R6). Las horas ya pasadas de hoy
 * no se ofrecen: prometer una franja que empezó hace veinte minutos es
 * exactamente lo que hace que una agenda deje de creerse.
 */
export function horasLibres(
  complejo: Pick<Complejo, 'hora_abre' | 'hora_cierra'>,
  ocupadas: Set<string> | undefined,
  fecha: string
): string[] {
  const esHoy = fecha === iso(today());
  const ahora = new Date().getHours();

  return horasDelDia(complejo)
    .filter(h => !ocupadas?.has(h))
    .filter(h => !esHoy || parseInt(h, 10) > ahora);
}

/** R12: lo facturado es lo que VALEN las reservas del rango. */
export const facturado = (rs: ResumenReserva[]) => rs.reduce((s, r) => s + r.total, 0);

/** R13: lo cobrado es lo que ENTRÓ. Nunca se presentan como el mismo número. */
export const cobrado = (rs: ResumenReserva[]) => rs.reduce((s, r) => s + r.abonado, 0);

/** R14: por cobrar = los saldos de hoy en adelante. */
export function porCobrar(rs: ResumenReserva[], desde = iso(today())): number {
  return rs
    .filter(r => r.fecha >= desde && r.abonado < r.total)
    .reduce((s, r) => s + (r.total - r.abonado), 0);
}

/** Franjas usadas sobre franjas posibles. */
export function ocupacion(
  rs: ResumenReserva[],
  complejo: Pick<Complejo, 'hora_abre' | 'hora_cierra'>,
  nCanchas: number,
  dias: number
): number {
  const posibles = dias * (complejo.hora_cierra - complejo.hora_abre) * nCanchas;
  return posibles ? rs.length / posibles : 0;
}

/** R12 agrupado por cancha, de la que más deja a la que menos. */
export function facturadoPorCancha(rs: ResumenReserva[], canchaIds: string[]) {
  const mapa = new Map<string, number>(canchaIds.map(id => [id, 0]));
  for (const r of rs) mapa.set(r.cancha_id, (mapa.get(r.cancha_id) ?? 0) + r.total);
  return [...mapa.entries()]
    .map(([canchaId, valor]) => ({ canchaId, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/** R12 por día, para la serie del panel. */
export function serieDiaria(rs: ResumenReserva[], dias = 14) {
  const hoy = today();
  const porDia = new Map<string, number>();
  for (const r of rs) porDia.set(r.fecha, (porDia.get(r.fecha) ?? 0) + r.total);

  return Array.from({ length: dias }, (_, i) => {
    const fecha = iso(addDays(hoy, -(dias - 1 - i)));
    return { fecha, valor: porDia.get(fecha) ?? 0 };
  });
}

/** Series cortas para los sparklines de las tarjetas de métrica. */
export function serieSemanal(rs: ResumenReserva[], semanas = 6) {
  const hoy = today();
  return Array.from({ length: semanas }, (_, i) => {
    const fin = iso(addDays(hoy, -(semanas - 1 - i) * 7));
    const ini = iso(addDays(fin, -6));
    return rs.filter(r => r.fecha >= ini && r.fecha <= fin).reduce((s, r) => s + r.total, 0);
  });
}

export function seriePendiente(rs: ResumenReserva[], dias = 7) {
  const hoy = today();
  return Array.from({ length: dias }, (_, i) => {
    const f = iso(addDays(hoy, i));
    return rs
      .filter(r => r.fecha === f && r.abonado < r.total)
      .reduce((s, r) => s + (r.total - r.abonado), 0);
  });
}
