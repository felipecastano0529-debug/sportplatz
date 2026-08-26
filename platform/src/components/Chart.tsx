import { useId } from 'react';

/* ==========================================================================
   UI · Gráficos vectoriales

   Portado de `demo/app/ui/chart.js`. El área de ingresos es SVG con
   `preserveAspectRatio="none"` para llenar la tarjeta, y la línea lleva
   `vector-effect: non-scaling-stroke` (en la hoja) para que el estirado
   horizontal no la engorde.
   ========================================================================== */

interface Punto { x: number; y: number }

/**
 * Curva suave tipo Catmull-Rom convertida a béziers. Una polilínea recta
 * parece un electrocardiograma; la curva parece una tendencia.
 */
export function smoothPath(pts: Punto[], tension = 0.34): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d +=
      ` C${(p1.x + ((p2.x - p0.x) * tension) / 3).toFixed(1)},` +
      `${(p1.y + ((p2.y - p0.y) * tension) / 3).toFixed(1)}` +
      ` ${(p2.x - ((p3.x - p1.x) * tension) / 3).toFixed(1)},` +
      `${(p2.y - ((p3.y - p1.y) * tension) / 3).toFixed(1)}` +
      ` ${p2.x},${p2.y}`;
  }
  return d;
}

/* La geometría del SVG expresada en porcentaje, para que la capa HTML de
   encima coloque los puntos exactamente sobre la curva. */
export const CH_GEO = { foot: (30 / 210) * 100, inner: (158 / 210) * 100 };

/**
 * Área con degradado, línea con brillo y retícula detrás.
 *
 * Los puntos NO van dentro del SVG: con `preserveAspectRatio="none"` el
 * estirado horizontal los convertiría en elipses. Se dibujan en la capa HTML
 * de encima, que sí mantiene el círculo redondo (trampa 3 del documento
 * maestro).
 */
export function AreaChart({
  values,
  w = 720,
  h = 210,
  pad = 22,
  foot = 30
}: {
  values: number[];
  w?: number;
  h?: number;
  pad?: number;
  foot?: number;
}) {
  // `useId` en vez de un aleatorio: dos gráficos en la misma página no pueden
  // compartir el id del degradado, y con un aleatorio el HTML del servidor y
  // el del cliente no coinciden y React rehidrata mal.
  const id = useId().replace(/:/g, '');
  const max = Math.max(...values, 1);
  const inner = h - pad - foot;
  const step = values.length > 1 ? w / (values.length - 1) : w;

  const pts = values.map((v, i) => ({
    x: +(i * step).toFixed(1),
    y: +(pad + inner - (v / max) * inner).toFixed(1)
  }));

  const line = smoothPath(pts);
  const area = `${line} L${w},${pad + inner} L0,${pad + inner} Z`;

  return (
    <svg className="ch-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-hi)" stopOpacity=".55" />
          <stop offset=".55" stopColor="var(--accent-hi)" stopOpacity=".16" />
          <stop offset="1" stopColor="var(--accent-hi)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`stroke-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--accent-hi)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map(k => {
        const y = +(pad + inner - k * inner).toFixed(1);
        return <line key={k} className="ch-grid" x1="0" x2={w} y1={y} y2={y} />;
      })}

      <path className="ch-area" d={area} fill={`url(#fill-${id})`} />
      <path className="ch-line" d={line} stroke={`url(#stroke-${id})`} />
    </svg>
  );
}

/** Sparkline de la tarjeta de métrica: solo el gesto de la tendencia. */
export function Sparkline({
  values,
  tone = 'brand'
}: {
  values: number[];
  tone?: 'brand' | 'ok' | 'warn';
}) {
  if (values.length < 2) return null;

  const w = 96, h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => ({
    x: +(i * (w / (values.length - 1))).toFixed(1),
    y: +(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)
  }));

  return (
    <svg
      className={`spark spark--${tone}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={smoothPath(pts)} />
    </svg>
  );
}

/** Anillo de progreso. Un solo trazo con dash-offset: sin librería y sin canvas. */
export function Ring({ pct, size = 44, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));

  return (
    <svg className="ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className="ring-v"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={c.toFixed(1)}
        strokeDashoffset={off.toFixed(1)}
      />
    </svg>
  );
}
