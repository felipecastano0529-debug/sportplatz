/* ==========================================================================
   Pruebas del acento del negocio

   DESIGN.md §1 apoya el sistema entero sobre una condición: el acento da
   4.5:1 o más sobre blanco, así que EL MISMO COLOR sirve de relleno y de
   texto. Si el dueño elige un color que no llega, esa condición se rompe y
   media interfaz deja de leerse SIN dar un solo error en consola.

   Por eso esto se prueba: es la clase de fallo que nadie ve venir.
   ========================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PALETAS, derivar, paletaDe, hexRgb, seCorrigio } from '../src/lib/tema';
import { suggestedDeposit, money, moneyShort, iso, telE164, codigo, slugify } from '../src/lib/util';

/** Contraste WCAG 2.1 entre dos colores. */
function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const f = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const [r, g, bl] = hexRgb(hex);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const BLANCO = '#ffffff';
const PLACA = '#0a0e13';   // --panel-base

test('las ocho paletas de la casa pasan AA sobre blanco', () => {
  for (const p of PALETAS) {
    const c = contraste(p.accent, BLANCO);
    assert.ok(c >= 4.5, `${p.name} (${p.accent}) da ${c.toFixed(2)}:1, necesita 4.5`);
  }
});

test('sus versiones claras pasan AAA sobre la placa negra', () => {
  for (const p of PALETAS) {
    const c = contraste(p.hi, PLACA);
    assert.ok(c >= 7, `${p.name} claro (${p.hi}) da ${c.toFixed(2)}:1, necesita 7`);
  }
});

test('un color demasiado claro se OSCURECE hasta que se lee', () => {
  // Un amarillo pastel: 1.2:1 sobre blanco. Ilegible con texto blanco encima.
  const antes = contraste('#ffe680', BLANCO);
  assert.ok(antes < 4.5, 'el de partida no cumple');

  const d = derivar('#ffe680');
  const despues = contraste(d.accent, BLANCO);
  assert.ok(despues >= 4.5, `quedó en ${despues.toFixed(2)}:1`);
});

test('y se AVISA de que hubo que corregirlo', () => {
  assert.equal(seCorrigio('#ffe680'), true, 'no se le cambia el color en silencio');
  assert.equal(seCorrigio('#047857'), false, 'el que ya cumple se queda tal cual');
});

test('un color que ya cumple se respeta: el negocio ve SU color', () => {
  const d = derivar('#047857');
  assert.equal(d.accent.toLowerCase(), '#047857');
});

test('se conserva el tono: corregir no es cambiar de color', () => {
  const tono = (hex: string) => {
    const [r, g, b] = hexRgb(hex).map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    const h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
      : max === g ? (b - r) / d + 2
      : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };

  const original = '#ffe680';
  const corregido = derivar(original).accent;
  assert.ok(Math.abs(tono(original) - tono(corregido)) < 3,
    'sigue siendo el mismo amarillo, solo más oscuro');
});

test('un tema con color libre devuelve la paleta derivada', () => {
  const p = paletaDe({ accent: 'custom', custom: '#ff00aa' });
  assert.equal(p.id, 'custom');
  assert.ok(contraste(p.accent, BLANCO) >= 4.5);
});

test('un tema vacío cae al esmeralda de la casa', () => {
  assert.equal(paletaDe(null).id, 'esmeralda');
  assert.equal(paletaDe({}).accent, '#047857');
});

/* ── Dinero y fechas: lo que más se ve y menos se prueba ─────────────────── */

test('R10 · el adelanto es la mitad redondeada al millar más cercano', () => {
  assert.equal(suggestedDeposit(120000), 60000);
  assert.equal(suggestedDeposit(25000), 13000);   // el ejemplo del documento
  assert.equal(suggestedDeposit(90000), 45000);
  assert.equal(suggestedDeposit(0), 0);
});

test('R16 · el peso colombiano va sin decimales y con punto de miles', () => {
  assert.equal(money(120000), '$120.000');
  assert.equal(money(0), '$0');
  assert.equal(moneyShort(1200000), '$1.2M');
  assert.equal(moneyShort(340000), '$340k');
  assert.equal(moneyShort(2000000), '$2M');
});

test('la fecha NO se corre un día por el huso horario', () => {
  // El fallo clásico: new Date('2026-08-22').toISOString() en Bogotá da el 21.
  const d = new Date(2026, 7, 22);
  assert.equal(iso(d), '2026-08-22');
});

test('el teléfono se normaliza a E.164 colombiano', () => {
  assert.equal(telE164('300 123 4567'), '+573001234567');
  assert.equal(telE164('573001234567'), '+573001234567');
  assert.equal(telE164(''), null);
});

test('R48 · el código corto son los cuatro últimos del id, en mayúsculas', () => {
  assert.equal(codigo('a1b2c3d4-0000-0000-0000-000000003f9a'), 'SP-3F9A');
});

test('el slug del complejo aguanta tildes y espacios', () => {
  assert.equal(slugify('Complejo Deportivo La 70'), 'complejo-deportivo-la-70');
  assert.equal(slugify('Fútbol & Pádel'), 'futbol-padel');
  assert.equal(slugify('!!!'), 'complejo');
});
