/* ==========================================================================
   NÚCLEO · Utilidades

   Portado de `demo/app/core/util.js`, tipado y sin las tres funciones que
   ahí tocaban el DOM (`$`, `$$`, `esc`): en React el escape lo hace JSX y la
   selección no existe.

   Sin estado y sin dependencias. Todo lo que hay aquí es una función pura y
   se puede probar sin montar nada.
   ========================================================================== */

/** $120.000 — pesos colombianos, sin decimales (R16). */
export const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO');

/** $1.2M / $340k — para tarjetas de métrica donde el número largo estorba. */
export function moneyShort(n: number): string {
  const v = Math.round(n || 0);
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + 'M';
  if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'k';
  return '$' + v;
}

/** Miles con punto, para inputs de precio. */
export const thousands = (n: number | string) => (+n || 0).toLocaleString('es-CO');

/** Lee un input de precio escrito a mano: "120.000" → 120000. */
export const readNum = (v: string | number) => +String(v).replace(/\D/g, '') || 0;

/**
 * El adelanto sugerido (R10): la mitad del precio, redondeada al millar más
 * cercano. Cancha de $120.000 → $60.000; de $25.000 → $13.000.
 */
export const suggestedDeposit = (price: number) => Math.round((price * 0.5) / 1000) * 1000;

export const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAYS_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul',
  'ago', 'sep', 'oct', 'nov', 'dic'];

/* Fechas SIEMPRE como 'YYYY-MM-DD' en hora local del complejo, nunca como
   `Date` serializado: `new Date('2026-08-22').toISOString()` en Bogotá
   devuelve el día anterior, y la agenda de un negocio no puede correrse un
   día por un huso horario. */
export function iso(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date | string, n: number): Date {
  const z = typeof d === 'string' ? parseISO(d) : new Date(d);
  z.setDate(z.getDate() + n);
  return z;
}

export function today(): Date {
  const z = new Date();
  z.setHours(0, 0, 0, 0);
  return z;
}

export const sameDay = (a: Date | string, b: Date | string) => iso(a) === iso(b);

export const fmtDate = (s: string) => {
  const d = parseISO(s);
  return `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
};

export const fmtDateLong = (s: string) => {
  const d = parseISO(s);
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

/** '18:00' → '6:00 p.m.' */
export function fmtHour(h: string | number): string {
  const n = typeof h === 'number' ? h : parseInt(h, 10);
  const suf = n >= 12 ? 'p.m.' : 'a.m.';
  const h12 = n % 12 === 0 ? 12 : n % 12;
  return `${h12}:00 ${suf}`;
}

export const hourNum = (h: string) => parseInt(h, 10);
export const nextHour = (h: string) => String(hourNum(h) + 1).padStart(2, '0') + ':00';
export const hhmm = (h: number | string) => String(h).padStart(2, '0') + ':00';

/** Postgres devuelve `time` como '18:00:00'. La agenda razona en '18:00'. */
export const shortTime = (t: string) => String(t).slice(0, 5);

export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const shuffle = <T,>(a: T[]): T[] => a.slice().sort(() => Math.random() - 0.5);

/** Iniciales para avatares: "Juan Camilo Restrepo" → "JR". */
export const initials = (name?: string | null) => String(name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export const firstName = (name?: string | null) => String(name || '').split(' ')[0];

/* '3001234567' → '300 123 4567'. El número del negocio se enseña dentro del
   producto —es el que Neo usaría—, así que se lee como se lee un celular. */
export function waBonito(n?: string | null): string {
  const d = String(n || '').replace(/\D/g, '').replace(/^57/, '');
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(n || '');
}

export const esWhatsapp = (n?: string | null) => String(n || '').replace(/\D/g, '').length >= 10;

/** Normaliza a E.164 colombiano para guardar. '300 123 4567' → '+573001234567' */
export function telE164(n?: string | null): string | null {
  const d = String(n || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) return '+57' + d;
  if (d.length === 12 && d.startsWith('57')) return '+' + d;
  return '+' + d;
}

/** El código corto de una reserva (R48): 'SP-3F9A'. */
export const codigo = (id: string) => 'SP-' + id.slice(-4).toUpperCase();

/** Un slug de URL a partir del nombre del complejo. */
export function slugify(s: string): string {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'complejo';
}
