/* ==========================================================================
   Pruebas del motor de torneos y del histórico derivado

   Puro: recibe un torneo y devuelve llaves, tabla, valla y podio. Se prueban
   las reglas del documento maestro, no la implementación.

   Correr:  npm test
   ========================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bracketShape, resolveBracket, standings, cleanSheets, podium,
  winnerOf, freeSlots, hasStarted, ROUNDS,
  type Torneo, type Partido, type Cupo
} from '../src/lib/tournament';
import { recordDeEquipo, goleadoresHistoricos } from '../src/lib/records';

function torneo(tamano: 4 | 8 | 16 = 4): Torneo {
  const cupos: Cupo[] = Array.from({ length: tamano }, (_, i) => ({
    id: `c${i}`,
    posicion: i,
    equipoId: `e${i}`,
    nombre: `Equipo ${i + 1}`,
    color: '#000'
  }));

  const forma = bracketShape(tamano);
  const primera = forma[0].ronda;

  const partidos: Partido[] = forma.map((f, i) => ({
    id: `m${i}`,
    ronda: f.ronda,
    idx: f.idx,
    cupoA: f.ronda === primera ? cupos[f.idx * 2]?.id ?? null : null,
    cupoB: f.ronda === primera ? cupos[f.idx * 2 + 1]?.id ?? null : null,
    marcadorA: null,
    marcadorB: null,
    fecha: '2026-09-01',
    hora: '18:00',
    canchaId: null,
    jugado: false
  }));

  return {
    id: 'tn', nombre: 'Copa', deporte: 'futbol', tamano,
    fechaInicio: '2026-09-01', inscripcionAbierta: false,
    cupos, partidos, anotaciones: []
  };
}

const marcar = (tn: Torneo, id: string, a: number, b: number) => {
  const m = tn.partidos.find(x => x.id === id)!;
  m.marcadorA = a; m.marcadorB = b; m.jugado = true;
  resolveBracket(tn);
};

/* ── Forma de la llave ───────────────────────────────────────────────────── */

test('R23 · las rondas por tamaño son las del documento', () => {
  assert.deepEqual(ROUNDS[16].map(r => r.key), ['octavos', 'cuartos', 'semis', 'final']);
  assert.deepEqual(ROUNDS[8].map(r => r.key), ['cuartos', 'semis', 'final']);
  assert.deepEqual(ROUNDS[4].map(r => r.key), ['semis', 'final']);
});

test('R23 · SIEMPRE hay partido de tercer puesto', () => {
  for (const n of [4, 8, 16] as const) {
    const forma = bracketShape(n);
    assert.equal(forma.filter(f => f.ronda === 'tercero').length, 1, `tamaño ${n}`);
  }
});

test('un torneo de 8 tiene 7 partidos de llave más el tercero', () => {
  assert.equal(bracketShape(8).length, 8);   // 4 + 2 + 1 + tercero
});

/* ── Los ganadores avanzan solos ─────────────────────────────────────────── */

test('R24 · marcar una semifinal manda al ganador a la final', () => {
  const tn = torneo(4);
  marcar(tn, 'm0', 3, 1);   // c0 gana

  const final = tn.partidos.find(m => m.ronda === 'final')!;
  assert.equal(final.cupoA, 'c0', 'el ganador ocupa su sitio en la final');
  assert.equal(final.cupoB, null, 'la otra semi todavía no se ha jugado');
});

test('R24 · un empate NO produce ganador: es eliminación directa', () => {
  const tn = torneo(4);
  marcar(tn, 'm0', 2, 2);

  assert.equal(winnerOf(tn.partidos[0]), null);
  const final = tn.partidos.find(m => m.ronda === 'final')!;
  assert.equal(final.cupoA, null, 'nadie avanza con un empate');
});

test('R23 · los perdedores de semifinal alimentan el tercer puesto', () => {
  const tn = torneo(4);
  marcar(tn, 'm0', 3, 1);   // pierde c1
  marcar(tn, 'm1', 0, 2);   // pierde c2

  const tercero = tn.partidos.find(m => m.ronda === 'tercero')!;
  assert.equal(tercero.cupoA, 'c1');
  assert.equal(tercero.cupoB, 'c2');
});

test('R24 · corregir un marcador rehace la llave hacia adelante', () => {
  const tn = torneo(4);
  marcar(tn, 'm0', 3, 1);
  assert.equal(tn.partidos.find(m => m.ronda === 'final')!.cupoA, 'c0');

  // El árbitro se equivocó: gana el otro.
  marcar(tn, 'm0', 1, 3);
  assert.equal(tn.partidos.find(m => m.ronda === 'final')!.cupoA, 'c1',
    'la final se corrige sola, sin tocar nada más');
});

test('resolveBracket devuelve SOLO los partidos que cambiaron', () => {
  const tn = torneo(8);
  marcar(tn, 'm0', 2, 0);
  const otraVez = resolveBracket(tn);
  assert.equal(otraVez.length, 0, 'llamarlo dos veces no escribe de más');
});

/* ── Tabla, valla y podio ────────────────────────────────────────────────── */

test('R25 · PTS = G*3 + E, y ordena por puntos, diferencia, valla', () => {
  const tn = torneo(4);
  marcar(tn, 'm0', 5, 0);   // c0 gana por 5
  marcar(tn, 'm1', 1, 0);   // c2 gana por 1

  const t = standings(tn);
  assert.equal(t[0].cupo.id, 'c0', 'gana quien tiene mejor diferencia a igualdad de puntos');
  assert.equal(t[0].pts, 3);
  assert.equal(t[0].dif, 5);
  assert.equal(t[1].cupo.id, 'c2');
});

test('R26 · la valla menos vencida solo mira a los que ya jugaron', () => {
  const tn = torneo(4);
  marcar(tn, 'm0', 3, 1);

  const v = cleanSheets(tn);
  assert.equal(v.length, 2, 'los que no han jugado no aparecen');
  assert.equal(v[0].cupo.id, 'c0', 'menos recibidos primero');
  assert.equal(v[0].gc, 1);
});

test('R27 · oro gana la final, plata la pierde, bronce gana el tercero', () => {
  const tn = torneo(4);
  marcar(tn, 'm0', 3, 1);   // c0 a la final, c1 al tercero
  marcar(tn, 'm1', 2, 0);   // c2 a la final, c3 al tercero

  const final = tn.partidos.find(m => m.ronda === 'final')!;
  marcar(tn, final.id, 1, 2);   // gana c2

  const tercero = tn.partidos.find(m => m.ronda === 'tercero')!;
  marcar(tn, tercero.id, 4, 0); // gana c1

  const p = podium(tn);
  assert.equal(p.oro?.id, 'c2');
  assert.equal(p.plata?.id, 'c0');
  assert.equal(p.bronce?.id, 'c1');
});

/* ── Inscripción ─────────────────────────────────────────────────────────── */

test('R28 · los cupos libres son los que no tienen equipo real', () => {
  const tn = torneo(8);
  tn.cupos[3].equipoId = null;
  tn.cupos[5].equipoId = null;
  assert.equal(freeSlots(tn), 2);
});

test('R29 · un torneo con un solo marcador ya ha empezado', () => {
  const tn = torneo(4);
  assert.equal(hasStarted(tn), false);
  marcar(tn, 'm0', 1, 0);
  assert.equal(hasStarted(tn), true);
});

/* ── El histórico derivado ───────────────────────────────────────────────── */

test('R31 · el récord de un equipo se deriva de los partidos', () => {
  const tn = torneo(4);
  marcar(tn, 'm0', 3, 1);   // e0 gana
  const final = tn.partidos.find(m => m.ronda === 'final')!;
  marcar(tn, 'm1', 0, 2);   // e3 gana
  marcar(tn, final.id, 2, 1);   // e0 campeón

  const r = recordDeEquipo('e0', [tn]);
  assert.equal(r.pj, 2);
  assert.equal(r.g, 2);
  assert.equal(r.gf, 5);
  assert.equal(r.gc, 2);
  assert.equal(r.pts, 6);
  assert.equal(r.titulos.length, 1, 'ganar la final es un título, y sale del partido');
});

test('R34 · la racha va del más VIEJO al más nuevo', () => {
  const tn = torneo(4);
  tn.partidos[0].fecha = '2026-09-01';
  marcar(tn, 'm0', 3, 1);       // e0 gana, el más viejo
  const final = tn.partidos.find(m => m.ronda === 'final')!;
  marcar(tn, 'm1', 0, 2);
  final.fecha = '2026-09-08';
  marcar(tn, final.id, 0, 1);   // e0 pierde, el más nuevo

  const r = recordDeEquipo('e0', [tn]);
  assert.deepEqual(r.racha, ['G', 'P'], 'se lee de izquierda a derecha como una línea de tiempo');
});

test('R31 · los goleadores se suman de las anotaciones, no de un total', () => {
  const tn = torneo(4);
  tn.anotaciones = [
    { id: 'a1', partidoId: 'm0', cupoId: 'c0', personaId: 'p1', nombre: 'Juan', goles: 2 },
    { id: 'a2', partidoId: 'm0', cupoId: 'c0', personaId: 'p1', nombre: 'Juan', goles: 1 },
    { id: 'a3', partidoId: 'm0', cupoId: 'c1', personaId: 'p2', nombre: 'Ana', goles: 2 }
  ];

  const tabla = goleadoresHistoricos([tn]);
  assert.equal(tabla[0].nombre, 'Juan');
  assert.equal(tabla[0].goles, 3, 'dos anotaciones del mismo jugador se suman');
  assert.equal(tabla[1].goles, 2);
});
