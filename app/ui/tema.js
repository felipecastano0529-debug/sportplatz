/* ==========================================================================
   UI · Tema
   El acento y el fondo del negocio, elegidos desde Ajustes.

   Toda la piel de la app cuelga de cuatro variables: `--accent` (el relleno
   que también sirve de texto sobre blanco), `--accent-hi` (la forma legible
   del mismo color sobre negro), `--accent-deep` y `--accent-rgb`, que
   alimenta glows, focos y sombras de color. Los rellenos, los bordes de
   foco, los tintes y el degradado de marca se derivan de ellas en el tema,
   así que aquí se escriben cuatro valores y se retiñe la aplicación entera
   —botones, pastillas, barras, anillos, el rail— sin una regla nueva.

   Las ocho paletas de la fila están escogidas a mano; el selector libre del
   final acepta CUALQUIER color y deriva de él las dos versiones. Un negocio
   quiere su color de marca exacto, no el más parecido de una lista — y el
   contraste no se defiende prohibiendo colores, se defiende calculándolos:
   se conserva el tono y la saturación que eligió y se busca la luminosidad
   que hace falta para pasar AA sobre blanco y AAA sobre la placa.

   Ojo con el rojo: en esta interfaz significa "sin abonar" y "cae". Se puede
   elegir, pero la marca y la alarma van a decir lo mismo con el mismo color.
   ========================================================================== */

export const PALETAS = [
  { id: 'esmeralda', name: 'Esmeralda', accent: '#047857', hi: '#34d399', deep: '#03543f', rgb: '16,150,105' },
  { id: 'oceano',    name: 'Océano',    accent: '#1d4ed8', hi: '#60a5fa', deep: '#1e3a8a', rgb: '37,99,235' },
  { id: 'indigo',    name: 'Índigo',    accent: '#6d28d9', hi: '#a78bfa', deep: '#4c1d95', rgb: '124,58,237' },
  { id: 'turquesa',  name: 'Turquesa',  accent: '#0e7490', hi: '#22d3ee', deep: '#164e63', rgb: '14,165,190' },
  { id: 'ambar',     name: 'Ámbar',     accent: '#b45309', hi: '#fbbf24', deep: '#78350f', rgb: '217,119,6' },
  { id: 'magenta',   name: 'Magenta',   accent: '#be185d', hi: '#f472b6', deep: '#831843', rgb: '219,39,119' },
  { id: 'lima',      name: 'Lima',      accent: '#4d7c0f', hi: '#a3e635', deep: '#365314', rgb: '101,163,13' },
  { id: 'grafito',   name: 'Grafito',   accent: '#334155', hi: '#94a3b8', deep: '#1e293b', rgb: '71,85,105' }
];

/* Los tres escenarios posibles detrás del contenido. El de la casa, ninguno,
   y el del propio negocio. */
export const FONDOS = [
  { id: 'estadio', name: 'Estadio',  hint: 'La noche de estadio, en movimiento' },
  { id: 'sobrio',  name: 'Sobrio',   hint: 'Sin foto: solo la placa y el dato' },
  { id: 'propio',  name: 'Tu foto',  hint: 'La foto de tu complejo, a sangre' }
];

/* ── Del color que eligió a los cuatro que usa el sistema ────────────────── */

/* Luminancia relativa de WCAG. Es lo único que decide si un texto se lee. */
const canal = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lumen = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);

/* La placa mate, medida: L = 0.0046. Es el fondo contra el que tiene que
   leerse `--accent-hi`, igual que el blanco lo es para `--accent`. */
const L_PLACA = 0.0046;

export const hexRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16));
};
const rgbHex = ([r, g, b]) => '#' + [r, g, b].map(v =>
  Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function rgbHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
          : max === g ? (b - r) / d + 2
          : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslRgb([h, s, l]) {
  if (!s) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => v * 255);
}

/**
 * Mueve la luminosidad del color —conservando tono y saturación— hasta que
 * su luminancia llega al objetivo. Bisección de 18 pasos: sobra para acertar
 * por debajo de lo que distingue un ojo, y es instantáneo.
 */
function aLuminancia(hex, objetivo, haciaArriba) {
  const [h, s] = rgbHsl(hexRgb(hex));
  let lo = haciaArriba ? rgbHsl(hexRgb(hex))[2] : 0;
  let hi = haciaArriba ? 1 : rgbHsl(hexRgb(hex))[2];
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (lumen(hslRgb([h, s, mid])) < objetivo) lo = mid; else hi = mid;
  }
  return rgbHex(hslRgb([h, s, haciaArriba ? hi : lo]));
}

/**
 * Las cuatro variables del sistema a partir de un color cualquiera.
 * `accent` baja hasta pasar 4.5:1 sobre blanco; `hi` sube hasta pasar 7:1
 * sobre la placa. Si el color ya cumple, se queda tal cual: el negocio ve
 * SU color, no una aproximación.
 */
export function derivar(hex) {
  const L = lumen(hexRgb(hex));
  /* Se apunta a 4.6 y 7.1 y no a 4.5 y 7: el hex redondea a enteros y
     apuntando al límite exacto se cae al 4.47 por culpa del redondeo. */
  const techoAccent = 1.05 / 4.6 - 0.05;                // 0.1783
  const sueloHi     = 7.1 * (L_PLACA + 0.05) - 0.05;    // 0.3377

  const accent = L > techoAccent ? aLuminancia(hex, techoAccent, false) : hex;
  const hi     = L < sueloHi     ? aLuminancia(hex, sueloHi, true)      : hex;
  const deep   = aLuminancia(accent, 0.045, false);
  return { accent, hi, deep, rgb: hexRgb(accent).join(',') };
}

export const paletaDe = (t) => {
  if (t?.accent === 'custom' && t.custom) return { id: 'custom', name: 'El tuyo', ...derivar(t.custom) };
  return PALETAS.find(p => p.id === t?.accent) || PALETAS[0];
};

/**
 * Escribe el tema en el elemento raíz. Va en `:root` y no en `body` a
 * propósito: `body[data-bleed="court"]` redefine el acento con el color del
 * deporte, y al vivir un nivel más abajo sigue ganando. El retinte por
 * deporte se conserva encima del color del negocio.
 */
export function aplicarTema(business, photos) {
  const t = { accent: 'esmeralda', fondo: 'estadio', ...(business?.theme || {}) };
  const p = paletaDe(t);
  const raiz = document.documentElement.style;

  raiz.setProperty('--accent', p.accent);
  raiz.setProperty('--accent-hi', p.hi);
  raiz.setProperty('--accent-deep', p.deep);
  raiz.setProperty('--accent-rgb', p.rgb);

  // La foto propia sustituye a las dos del proyecto —escritorio y móvil—
  // porque una sola imagen del negocio sirve para ambos encuadres.
  const propia = t.fondo === 'propio' && photos?.fondo;
  if (propia) {
    raiz.setProperty('--bg-estadio', `url("${photos.fondo}")`);
    raiz.setProperty('--bg-estadio-movil', `url("${photos.fondo}")`);
  } else {
    raiz.removeProperty('--bg-estadio');
    raiz.removeProperty('--bg-estadio-movil');
  }

  document.body.dataset.tema = t.accent;
  document.body.dataset.fondo = t.fondo;   // el CSS domará la foto ajena
  return t;
}

/** Qué escenario toca. Lo consulta el shell antes de pintar el fondo. */
export function modoFondo(business, photos) {
  const t = { fondo: 'estadio', ...(business?.theme || {}) };
  if (t.fondo === 'propio' && !photos?.fondo) return 'estadio';   // eligió foto y no subió ninguna
  return t.fondo;
}
