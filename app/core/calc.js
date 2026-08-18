/* ==========================================================================
   NÚCLEO · Cálculos
   Todo lo que el panel, la agenda y las fichas necesitan saber sobre plata y
   ocupación. Funciones puras sobre `S`: nada aquí toca el DOM.
   ========================================================================== */

import { S } from './store.js';
import { iso, parseISO, today, addDays } from './util.js';

/* El horario dejó de estar clavado en el código: cada negocio pone el suyo
   en Ajustes. Los valores por defecto siguen siendo 6:00 a 23:00. */
export const openHour  = () => S?.business?.openHour  ?? 6;
export const closeHour = () => S?.business?.closeHour ?? 23;
export const hoursOfDay = () => {
  const a = openHour(), b = closeHour();
  return Array.from({ length: Math.max(1, b - a) }, (_, i) => a + i);
};

export const courtById  = (id) => S.courts.find(c => c.id === id) || null;
export const bookingById = (id) => S.bookings.find(b => b.id === id) || null;

/** Lo facturado: la suma de lo que valen las reservas del rango. */
export function revenueBetween(from, to) {
  const a = iso(from), b = iso(to);
  return S.bookings.filter(x => x.date >= a && x.date <= b)
    .reduce((s, x) => s + x.total, 0);
}

/** Lo cobrado de verdad: solo los adelantos y abonos ya recibidos. */
export function collectedBetween(from, to) {
  const a = iso(from), b = iso(to);
  return S.bookings.filter(x => x.date >= a && x.date <= b)
    .reduce((s, x) => s + x.deposit, 0);
}

export function pendingTotal() {
  const t = iso(today());
  return S.bookings.filter(x => x.date >= t && x.deposit < x.total)
    .reduce((s, x) => s + (x.total - x.deposit), 0);
}

export function occupancy(from, to) {
  const days = Math.round((parseISO(iso(to)) - parseISO(iso(from))) / 864e5) + 1;
  const slots = days * (closeHour() - openHour()) * S.courts.length;
  const used = S.bookings.filter(x => x.date >= iso(from) && x.date <= iso(to)).length;
  return slots ? used / slots : 0;
}

export function revenueByCourt(from, to) {
  const map = new Map(S.courts.map(c => [c.id, 0]));
  S.bookings.filter(x => x.date >= iso(from) && x.date <= iso(to))
    .forEach(x => map.set(x.courtId, (map.get(x.courtId) || 0) + x.total));
  return [...map.entries()]
    .map(([id, v]) => ({ court: courtById(id), value: v }))
    .filter(r => r.court)
    .sort((a, b) => b.value - a.value);
}

export function dailySeries(days = 14) {
  const t = today();
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(t, -(days - 1 - i));
    return { date: iso(d), value: revenueBetween(d, d) };
  });
}

/* Series cortas solo para los sparklines de las tarjetas de métrica. */
export function weeklySeries(weeks = 6) {
  const t = today();
  return Array.from({ length: weeks }, (_, i) => {
    const end = addDays(t, -(weeks - 1 - i) * 7);
    return revenueBetween(addDays(end, -6), end);
  });
}

export function pendingSeries(days = 7) {
  const t = today();
  return Array.from({ length: days }, (_, i) => {
    const d = iso(addDays(t, i));
    return S.bookings.filter(b => b.date === d && b.deposit < b.total)
      .reduce((s, b) => s + (b.total - b.deposit), 0);
  });
}

export function bookingsOn(dateISO, courtId = null) {
  return S.bookings.filter(b => b.date === dateISO && (!courtId || b.courtId === courtId));
}

/** ¿Está esta cancha ocupada a esta hora de este día? */
export const slotTaken = (courtId, dateISO, start) =>
  S.bookings.some(b => b.courtId === courtId && b.date === dateISO && b.start === start);

/** Las horas libres de una cancha en un día, ya en formato '18:00'. */
export function freeHours(courtId, dateISO) {
  const taken = new Set(bookingsOn(dateISO, courtId).map(b => b.start));
  return hoursOfDay()
    .map(h => String(h).padStart(2, '0') + ':00')
    .filter(h => !taken.has(h));
}

/** Reservas de un cliente concreto, de la más reciente a la más vieja. */
export function bookingsOfPlayer(playerId) {
  return S.bookings.filter(b => b.playerId === playerId)
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
}
