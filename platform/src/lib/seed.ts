import { iso, today, addDays, hhmm, nextHour, pick, shuffle } from './util';
import { SPORTS, POSITIONS, type SportId } from './sports';
import { TEAM_COLORS, bracketShape } from './tournament';

/* ==========================================================================
   Datos de arranque

   Genera un negocio que ya lleva tres meses funcionando, para que nada nazca
   vacío: reservas con su historia, jugadores, equipos con plantilla y un
   torneo jugado hasta semifinales.

   Es SOLO para demostraciones y datos de prueba (§4.9). Un complejo real
   nace con sus canchas y su agenda en blanco, y se llena solo.

   R39. Todo es RELATIVO A HOY. Nunca fechas fijas en el código: unos datos
        de prueba con fechas de hace seis meses se ven caducados.
   R40. Carga por día: sábado 0,75 · viernes 0,70 · domingo 0,55 · entre
        semana 0,38. Por hora: 17–22 pleno, 10–15 al 35%, resto al 12%.
   R41. El pasado va todo pagado. El futuro: 42% pagado, 43% con adelanto,
        15% sin abonar. 62% entró por bot.
   R42. El triple bucle visita cada terna (cancha, día, hora) EXACTAMENTE UNA
        VEZ, así que un duplicado es imposible por construcción. La versión
        que comprobaba con `some()` sobre un array creciente era cuadrática:
        10,5 s con 40 canchas, con el hilo congelado y sin indicador.
   ========================================================================== */

export const NOMBRES = [
  'Juan Camilo Restrepo', 'Andrés Salazar', 'Valeria Ochoa', 'Santiago Mejía', 'Laura Gutiérrez',
  'Sebastián Arango', 'Mariana Vélez', 'Daniel Cardona', 'Camila Ríos', 'Julián Betancur',
  'Natalia Zapata', 'Esteban Correa', 'Sara Montoya', 'Felipe Ospina', 'Manuela Henao',
  'Ricardo Jaramillo', 'Paula Andrea Gómez', 'Kevin Marín', 'Diana Toro', 'Óscar Palacio'
];

export const EQUIPOS = [
  'Los Vikingos', 'Real Manrique', 'Deportivo La 70', 'Atlético Poblado', 'FC Sabaneta',
  'Los Tigres', 'Envigado FC', 'Barrio Antioquia', 'Club Robledo', 'Nueva Villa',
  'Los Halcones', 'Belén United', 'San Javier FC', 'Laureles CF', 'Aranjuez SC', 'Castilla FC'
];

export const JUGADORES = [
  'Mateo Zapata', 'Brayan Úsuga', 'Cristian Loaiza', 'Jhon Alexander Muñoz', 'Steven Cano',
  'Yeison Agudelo', 'Michael Herrera', 'Duván Castrillón', 'Jefferson Puerta', 'Alejandro Bedoya',
  'Wílmar Roldán', 'Édison Quiñones', 'Samuel Arroyave', 'Johan Villada', 'Nicolás Escobar',
  'Kevin Castaño', 'Emerson Tabares', 'Luis Fernando Díaz', 'Jhonatan Ceballos', 'Andrés Balanta',
  'Sergio Quintero', 'Miguel Borja', 'Elkin Palacios', 'Tomás Ángel', 'Fabián Sierra',
  'Óscar Cortés', 'Deiver Machado', 'Yerson Mosquera', 'Iván Angulo', 'Julián Quiñones'
];

export const telefono = () =>
  '+573' + String(Math.floor(10 + Math.random() * 89)) +
  String(Math.floor(1000000 + Math.random() * 8999999));

/* ── Canchas ─────────────────────────────────────────────────────────────── */

export interface PlanDeCanchas { deporte: SportId; cuantas: number; precio: number }

export function canchasDeSemilla(complejoId: string, plan: PlanDeCanchas[]) {
  const filas: Record<string, unknown>[] = [];
  let orden = 0;

  for (const { deporte, cuantas, precio } of plan) {
    for (let n = 1; n <= cuantas; n++) {
      filas.push({
        complejo_id: complejoId,
        deporte,
        numero: n,
        nombre: `${SPORTS[deporte].short} ${n}`,
        precio,
        orden: orden++
      });
    }
  }
  return filas;
}

/* ── Reservas ────────────────────────────────────────────────────────────── */

export interface CanchaSembrada { id: string; precio: number }
export interface PersonaSembrada { id: string; nombre: string; telefono: string | null }

/**
 * 75 días de historia y 14 hacia adelante, siempre relativos a hoy (R39).
 *
 * Con 40 canchas y 17 franjas son ~60.000 ternas y unas 12.000 reservas: se
 * inserta por lotes porque un solo INSERT de ese tamaño desborda el límite
 * de la petición.
 */
export function reservasDeSemilla(
  complejoId: string,
  canchas: CanchaSembrada[],
  clientes: PersonaSembrada[],
  { abre = 6, cierra = 23, atras = 75, adelante = 14 } = {}
) {
  const out: Record<string, unknown>[] = [];
  const hoy = today();
  const hoyISO = iso(hoy);

  for (let d = -atras; d <= adelante; d++) {
    const dia = addDays(hoy, d);
    const fecha = iso(dia);
    const dow = dia.getDay();

    // R40: el sábado por la tarde es cuando se llena; el martes a las 10 no.
    const carga = dow === 0 ? 0.55 : dow === 6 ? 0.75 : dow === 5 ? 0.70 : 0.38;

    for (const cancha of canchas) {
      for (let h = abre; h < cierra; h++) {
        const pico = h >= 17 && h <= 22 ? 1 : h >= 10 && h <= 15 ? 0.35 : 0.12;
        if (Math.random() > carga * pico) continue;

        const inicio = hhmm(h);
        const total = cancha.precio;

        /* R41. El pasado va todo pagado — nadie deja un saldo abierto de hace
           dos meses. El futuro se reparte, que es donde vive el trabajo del
           dueño: cobrar lo que falta. */
        const r = Math.random();
        const abonado = d < 0
          ? total
          : r < 0.42 ? total
          : r < 0.85 ? Math.round((total * 0.5) / 1000) * 1000
          : 0;

        // Seis de cada diez las hace alguien con cuenta: así el histórico del
        // jugador nace con contenido en vez de vacío.
        const conCuenta = clientes.length > 0 && Math.random() < 0.6;
        const p = conCuenta ? pick(clientes) : null;

        out.push({
          complejo_id: complejoId,
          cancha_id: cancha.id,
          fecha,
          inicio,
          fin: nextHour(inicio),
          persona_id: p?.id ?? null,
          cliente: p?.nombre ?? pick(NOMBRES),
          telefono: p?.telefono ?? telefono(),
          total,
          // `abonado` lo mantiene el trigger desde `pagos`, así que la semilla
          // también inserta los pagos. Aquí va solo para saber cuánto.
          abonado,
          origen: Math.random() < 0.62 ? 'bot' : 'mostrador',
          estado: fecha < hoyISO ? 'jugada' : 'confirmada',
          nota: ''
        });
      }
    }
  }

  return out;
}

/* ── Comunidad ───────────────────────────────────────────────────────────── */

export function equiposDeSemilla(
  complejoId: string,
  deporte: SportId,
  cuantos = 8
) {
  return EQUIPOS.slice(0, cuantos).map((nombre, i) => ({
    complejo_id: complejoId,
    nombre,
    deporte,
    color: TEAM_COLORS[i % TEAM_COLORS.length]
  }));
}

/** Reparte la plantilla sin repetir jugadores entre equipos. */
export function plantillasDeSemilla(
  equipos: { id: string; deporte: SportId }[],
  personas: PersonaSembrada[]
) {
  const filas: Record<string, unknown>[] = [];
  const pool = shuffle(personas);
  let k = 0;

  for (const e of equipos) {
    // R36: el tamaño sugerido depende del deporte, pero nunca más gente de la
    // que hay: repartir siete cuando hay veinte personas y ocho equipos deja
    // los últimos vacíos.
    const sugerido = SPORTS[e.deporte].squad;
    const cabe = Math.max(2, Math.floor(pool.length / equipos.length));
    const cuantos = Math.min(sugerido, cabe);
    const posiciones = POSITIONS[e.deporte];

    for (let i = 0; i < cuantos && k < pool.length; i++, k++) {
      filas.push({
        equipo_id: e.id,
        persona_id: pool[k].id,
        posicion: posiciones[i % posiciones.length]
      });
    }
  }

  return filas;
}

/* ── Torneos ─────────────────────────────────────────────────────────────── */

export interface PlanDeTorneo {
  nombre: string;
  deporte: SportId;
  tamano: 4 | 8 | 16;
  fechaInicio: string;
  inscripcionAbierta: boolean;
  /** Cuántas rondas dejar jugadas, desde la primera. */
  rondasJugadas: number;
  /** Equipos que arrancan dentro; el resto quedan como cupo libre. */
  equipos: { id: string; nombre: string; color: string }[];
}

/**
 * El torneo de ejemplo va jugado hasta semifinales y con la final pendiente:
 * así se puede marcar un resultado en vivo y ver cómo la llave avanza sola,
 * que es lo que hay que enseñar.
 */
export function planDeTorneos(
  equipos: { id: string; nombre: string; color: string; deporte: SportId }[],
  deporte: SportId
): PlanDeTorneo[] {
  const delDeporte = equipos.filter(e => e.deporte === deporte);

  return [
    {
      nombre: 'Copa Apertura',
      deporte,
      tamano: 8,
      fechaInicio: iso(addDays(today(), -21)),
      inscripcionAbierta: false,
      rondasJugadas: 2,               // cuartos y semis; la final espera
      equipos: delDeporte.slice(0, 8)
    },
    {
      // Uno abierto para que el jugador tenga qué hacer nada más entrar.
      nombre: 'Torneo Relámpago',
      deporte,
      tamano: 8,
      fechaInicio: iso(addDays(today(), 12)),
      inscripcionAbierta: true,
      rondasJugadas: 0,
      equipos: delDeporte.slice(0, 5)   // tres cupos libres
    }
  ];
}

/** Los marcadores de las rondas ya jugadas. Sin empates: es directa (R24). */
export function marcadoresDeSemilla(tamano: 4 | 8 | 16, rondasJugadas: number) {
  const forma = bracketShape(tamano);
  const rondas = [...new Set(forma.filter(f => f.ronda !== 'tercero').map(f => f.ronda))];
  const aJugar = rondas.slice(0, rondasJugadas);

  return forma
    .filter(f => aJugar.includes(f.ronda))
    .map(f => {
      const a = Math.floor(Math.random() * 6);
      let b = Math.floor(Math.random() * 6);
      if (a === b) b = a + 1;
      return { ronda: f.ronda, idx: f.idx, marcadorA: a, marcadorB: b };
    });
}

/** Dos anotadores por equipo, sacados de la plantilla real (R30). */
export function anotacionesDeSemilla(
  partidosJugados: { id: string; cupoA: string | null; cupoB: string | null; goles: number }[],
  plantillaPorCupo: Map<string, { personaId: string; nombre: string }[]>
) {
  const filas: Record<string, unknown>[] = [];

  for (const m of partidosJugados) {
    for (const cupoId of [m.cupoA, m.cupoB]) {
      if (!cupoId) continue;
      const gente = plantillaPorCupo.get(cupoId) ?? [];
      if (!gente.length) continue;

      let quedan = Math.ceil(m.goles / 2);
      while (quedan > 0) {
        const quien = pick(gente);
        const g = Math.min(quedan, 1 + Math.floor(Math.random() * 2));
        filas.push({
          partido_id: m.id,
          cupo_id: cupoId,
          persona_id: quien.personaId,
          nombre: quien.nombre,
          goles: g
        });
        quedan -= g;
      }
    }
  }

  return filas;
}

/** El plan por defecto de un complejo de demostración. */
export const PLAN_DEMO: PlanDeCanchas[] = [
  { deporte: 'futbol', cuantas: 4, precio: 120000 },
  { deporte: 'padel', cuantas: 2, precio: 90000 },
  { deporte: 'tenis', cuantas: 2, precio: 70000 },
  { deporte: 'voleibol', cuantas: 1, precio: 60000 },
  { deporte: 'paintball', cuantas: 1, precio: 25000 }
];
