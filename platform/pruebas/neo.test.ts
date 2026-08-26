/* ==========================================================================
   Pruebas del motor de Neo

   El motor es puro: recibe un mundo y devuelve qué contestar. Por eso se
   puede probar sin base de datos, sin navegador y sin red — que es
   exactamente la razón por la que se partió por esa costura.

   Lo que se comprueba son las reglas del documento maestro, no la
   implementación: R45 (nunca promete una hora ocupada), R46 (la ambigüedad
   a. m./p. m. se resuelve hacia la tarde y se avisa), R44 (los cuatro
   huecos) y R48 (el código corto).

   Correr:  npx tsx pruebas/neo.test.ts
   ========================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { responder, nuevaSesion, type Mundo, type Mensaje } from '../src/lib/neo/motor';
import { leerFecha, leerHora } from '../src/lib/neo/lectura';
import { iso, today, addDays } from '../src/lib/util';

const HOY = iso(today());

function mundo(ocupadas: Record<string, string[]> = {}): Mundo {
  const mapa = new Map<string, Set<string>>();
  for (const [id, horas] of Object.entries(ocupadas)) mapa.set(id, new Set(horas));

  return {
    negocio: 'Complejo La 70',
    abre: 6,
    cierra: 23,
    canchas: [
      { id: 'c1', nombre: 'Sintética 1', deporte: 'futbol', precio: 120000 },
      { id: 'c2', nombre: 'Sintética 2', deporte: 'futbol', precio: 120000 },
      { id: 'p1', nombre: 'Pádel 1', deporte: 'padel', precio: 90000 }
    ],
    ocupadas: mapa,
    diaCargado: HOY,
    yo: { nombre: 'Juan Restrepo' },
    misReservas: []
  };
}

const textos = (msgs: Mensaje[]) =>
  msgs.filter(m => m.t === 'text').map(m => (m as { text: string }).text).join(' ');

const tipo = (msgs: Mensaje[], t: string) => msgs.find(m => m.t === t);

/* ── Lectura ─────────────────────────────────────────────────────────────── */

test('R46 · "a las 7" se entiende de noche y se marca ambigua', () => {
  const { hour, ambigua } = leerHora('a las 7', 6, 23);
  assert.equal(hour, 19);
  assert.equal(ambigua, true, 'tiene que avisar de que interpretó p. m.');
});

test('R46 · "7 de la mañana" NO es ambigua', () => {
  const { hour, ambigua } = leerHora('a las 7 de la manana', 6, 23);
  assert.equal(hour, 7);
  assert.equal(ambigua, false);
});

test('R46 · "6:00 p.m." viene entera y no se marca ambigua', () => {
  const { hour, ambigua } = leerHora('6:00 p.m.', 6, 23);
  assert.equal(hour, 18);
  assert.equal(ambigua, false);
});

test('la fecha se come su trozo, así "el 20 de agosto" no son las 8 p. m.', () => {
  const { date, resto } = leerFecha('reservar el 20 de agosto');
  assert.ok(date, 'tiene que leer la fecha');
  const { hour } = leerHora(resto, 6, 23);
  assert.equal(hour, null, 'el 20 ya no está en el texto que ve la hora');
});

test('"mañana" es mañana, no hoy', () => {
  const { date } = leerFecha('manana a las 8');
  assert.equal(date, iso(addDays(today(), 1)));
});

/* ── Conversación ────────────────────────────────────────────────────────── */

test('R44 · pide los huecos en orden: deporte, día, hora', () => {
  const ctx = nuevaSesion();
  const m = mundo();

  const r1 = responder(ctx, 'quiero reservar', m);
  assert.match(textos(r1.msgs), /qué quieres jugar/i);

  const r2 = responder(ctx, 'sintetica', m);
  assert.match(textos(r2.msgs), /qué día/i);
  assert.equal(ctx.sport, 'futbol', '"sintética" es fútbol');

  const r3 = responder(ctx, 'hoy', m);
  assert.ok(tipo(r3.msgs, 'hours'), 'con día y deporte, enseña las horas libres');
});

test('R45 · no ofrece una hora que ya está tomada', () => {
  const ctx = nuevaSesion();
  // Todas las canchas de fútbol llenas a las 19:00.
  const m = mundo({ c1: ['19:00'], c2: ['19:00'] });

  responder(ctx, 'sintetica hoy', m);
  const r = responder(ctx, 'a las 7', m);

  const horas = tipo(r.msgs, 'hours') as { horas: string[] } | undefined;
  assert.ok(horas, 'ofrece alternativas en vez de un error');
  assert.ok(!horas!.horas.includes('19:00'), 'las 19:00 no pueden estar en la lista');
  assert.match(textos(r.msgs), /tomadas/i);
});

test('R45 · si una cancha está tomada, ofrece la otra a la misma hora', () => {
  const ctx = nuevaSesion();
  const m = mundo({ c1: ['19:00'] });

  responder(ctx, 'sintetica 1 hoy', m);
  const r = responder(ctx, 'a las 7', m);

  assert.match(textos(r.msgs), /Sintética 2/);
  assert.equal(ctx.courtId, 'c2');
});

test('R46 · el resumen avisa de la hora interpretada', () => {
  const ctx = nuevaSesion();
  const r = responder(ctx, 'sintetica hoy a las 8', mundo());

  const q = tipo(r.msgs, 'quote') as { q: { nota: string; inicio: string } } | undefined;
  assert.ok(q, 'con los cuatro huecos llenos llega el resumen');
  assert.equal(q!.q.inicio, '20:00');
  assert.match(q!.q.nota, /8 a\.m\./, 'ofrece la corrección en una palabra');
});

test('un "dale" sobre el resumen pide la reserva, no la escribe', () => {
  const ctx = nuevaSesion();
  responder(ctx, 'padel manana a las 8 pm', { ...mundo(), diaCargado: iso(addDays(today(), 1)) });
  assert.equal(ctx.espera, 'confirm');

  const r = responder(ctx, 'dale', { ...mundo(), diaCargado: iso(addDays(today(), 1)) });
  assert.ok(r.accion, 'el motor pide la escritura; no la hace');
  assert.equal(r.accion!.tipo, 'reservar');
});

test('R10 · el adelanto sugerido es la mitad redondeada al millar', () => {
  const ctx = nuevaSesion();
  const r = responder(ctx, 'sintetica hoy a las 8 pm', mundo());
  const q = tipo(r.msgs, 'quote') as { q: { adelanto: number; total: number } };
  assert.equal(q.q.total, 120000);
  assert.equal(q.q.adelanto, 60000);
});

test('fuera del horario lo dice y no aparta nada', () => {
  const ctx = nuevaSesion();
  const r = responder(ctx, 'sintetica hoy a las 3 am', mundo());
  assert.match(textos(r.msgs), /cerrados/i);
  assert.equal(ctx.start, null, 'la hora se descarta, no se guarda');
});

test('R49 · tras dos mensajes sin entender, cambia de estrategia', () => {
  const ctx = nuevaSesion();
  const m = mundo();
  responder(ctx, 'oye una pregunta rara', m);
  const r = responder(ctx, 'otra cosa que no entiende', m);
  assert.match(textos(r.msgs), /sintética mañana a las 7/i, 'enseña la forma que sí lee');
  assert.ok(r.quick.length, 'y ofrece atajos');
});

test('preguntar el precio no borra lo que ya se dijo', () => {
  const ctx = nuevaSesion();
  const m = mundo();
  responder(ctx, 'sintetica hoy', m);
  responder(ctx, 'cuanto vale', m);
  assert.equal(ctx.sport, 'futbol');
  assert.equal(ctx.date, HOY);
});

test('"otra hora" vacía la hora, no devuelve el mismo resumen', () => {
  const ctx = nuevaSesion();
  const m = mundo();
  responder(ctx, 'sintetica hoy a las 8 pm', m);
  assert.equal(ctx.start, '20:00');

  responder(ctx, 'otra hora', m);
  assert.equal(ctx.start, null);
  assert.equal(ctx.espera, null);
});

test('no inventa la dirección', () => {
  const ctx = nuevaSesion();
  const r = responder(ctx, 'donde quedan', mundo());
  assert.match(textos(r.msgs), /no la tengo/i);
});
