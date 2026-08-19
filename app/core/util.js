/* ==========================================================================
   NÚCLEO · Utilidades
   Selección, escape, dinero y fechas. Sin estado y sin dependencias.
   ========================================================================== */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** $120.000 — pesos colombianos, sin decimales. */
export const money = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');

/** 1.2M / 340k — para tarjetas de métrica donde el número largo estorba. */
export const moneyShort = (n) => {
  n = Math.round(n || 0);
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'k';
  return '$' + n;
};

/** Miles con punto, para inputs de precio. */
export const thousands = (n) => (+n || 0).toLocaleString('es-CO');
/** Lee un input de precio escrito a mano: "120.000" -> 120000 */
export const readNum = (v) => +String(v).replace(/\D/g, '') || 0;

export const DAYS     = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAYS_S   = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MONTHS   = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export const MONTHS_S = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export const iso = (d) => {
  const z = new Date(d);
  return z.getFullYear() + '-' + String(z.getMonth() + 1).padStart(2, '0') + '-' + String(z.getDate()).padStart(2, '0');
};
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const z = new Date(d); z.setDate(z.getDate() + n); return z; };
export const today = () => { const z = new Date(); z.setHours(0, 0, 0, 0); return z; };
export const sameDay = (a, b) => iso(a) === iso(b);

export const fmtDate     = (s) => { const d = parseISO(s); return `${DAYS_S[d.getDay()]} ${d.getDate()} ${MONTHS_S[d.getMonth()]}`; };
export const fmtDateLong = (s) => { const d = parseISO(s); return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };

/** '18:00' -> '6:00 p.m.' */
export const fmtHour = (h) => {
  const n = parseInt(h, 10);
  const suf = n >= 12 ? 'p.m.' : 'a.m.';
  const h12 = n % 12 === 0 ? 12 : n % 12;
  return `${h12}:00 ${suf}`;
};
export const hourNum  = (h) => parseInt(h, 10);
export const nextHour = (h) => String(hourNum(h) + 1).padStart(2, '0') + ':00';
export const hhmm     = (h) => String(h).padStart(2, '0') + ':00';

export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);

/** Iniciales para avatares: "Juan Camilo Restrepo" -> "JR" */
export const initials = (name) => String(name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export const firstName = (name) => String(name || '').split(' ')[0];

/* '3001234567' -> '300 123 4567'. El número del negocio se enseña dentro de la
   demo —es el que Neo usaría—, así que se lee como se lee un celular aquí. */
export const waBonito = (n) => {
  const d = String(n || '').replace(/\D/g, '').replace(/^57/, '');
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(n || '');
};
export const esWhatsapp = (n) => String(n || '').replace(/\D/g, '').length >= 10;
