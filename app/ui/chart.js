/* ==========================================================================
   UI · Gráficos vectoriales
   El área de ingresos es SVG con preserveAspectRatio="none" para llenar la
   tarjeta, y vector-effect: non-scaling-stroke para que el estirado
   horizontal no engorde la línea.
   ========================================================================== */

import { uid } from '../core/util.js';

/* Curva suave tipo Catmull-Rom convertida a béziers. Una polilínea recta
   parece un electrocardiograma; la curva parece una tendencia. */
export function smoothPath(pts, tension = 0.34) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1.x + (p2.x - p0.x) * tension / 3).toFixed(1)},${(p1.y + (p2.y - p0.y) * tension / 3).toFixed(1)}` +
         ` ${(p2.x - (p3.x - p1.x) * tension / 3).toFixed(1)},${(p2.y - (p3.y - p1.y) * tension / 3).toFixed(1)}` +
         ` ${p2.x},${p2.y}`;
  }
  return d;
}

/* Área con degradado, línea con brillo y retícula detrás. El id del degradado
   se genera por instancia para que dos gráficos no se pisen. */
export function areaChart(values, { w = 720, h = 210, pad = 22, foot = 30 } = {}) {
  const id = uid('g');
  const max = Math.max(...values, 1);
  const inner = h - pad - foot;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => ({
    x: +(i * step).toFixed(1),
    y: +(pad + inner - (v / max) * inner).toFixed(1)
  }));
  const line = smoothPath(pts);
  const area = `${line} L${w},${pad + inner} L0,${pad + inner} Z`;
  const grid = [0, .25, .5, .75, 1].map(k =>
    `<line class="ch-grid" x1="0" x2="${w}" y1="${(pad + inner - k * inner).toFixed(1)}" y2="${(pad + inner - k * inner).toFixed(1)}"/>`
  ).join('');

  return `<svg class="ch-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="fill-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"   stop-color="var(--accent-hi)" stop-opacity=".55"/>
        <stop offset=".55" stop-color="var(--accent-hi)" stop-opacity=".16"/>
        <stop offset="1"   stop-color="var(--accent-hi)" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="stroke-${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--accent-hi)"/>
        <stop offset="1" stop-color="var(--accent)"/>
      </linearGradient>
    </defs>
    ${grid}
    <path class="ch-area" d="${area}" fill="url(#fill-${id})"/>
    <path class="ch-line" d="${line}" stroke="url(#stroke-${id})"/>
  </svg>`;
  /* Los puntos NO van dentro del SVG: con preserveAspectRatio="none" el
     estirado horizontal los convertiría en elipses. Se dibujan en la capa
     HTML de encima, que sí mantiene el círculo redondo, con la misma
     geometría expresada en porcentaje (CH_GEO). Esa capa también posiciona
     cada columna en i/(n-1)*100%, igual que el SVG: con columnas flex de
     ancho igual, cada punto quedaría medio paso corrido respecto a la curva. */
}

export const CH_GEO = { foot: (30 / 210 * 100), inner: (158 / 210 * 100) };

/* Sparkline de la tarjeta de métrica: solo el gesto de la tendencia. */
export function sparkline(values, tone = 'brand') {
  if (values.length < 2) return '';
  const w = 96, h = 28, max = Math.max(...values, 1), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: +(i * (w / (values.length - 1))).toFixed(1),
    y: +(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)
  }));
  return `<svg class="spark spark--${tone}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${smoothPath(pts)}"/></svg>`;
}

/* Anillo de progreso para las fichas de equipo y jugador. Un solo trazo con
   dash-offset: no hace falta ni una librería ni un canvas. */
export function ring(pct, { size = 44, stroke = 4 } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-v" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
  </svg>`;
}
