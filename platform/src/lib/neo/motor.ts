import { SPORTS, type SportId } from '@/lib/sports';
import {
  iso, today, addDays, parseISO, hhmm, hourNum, fmtDate, fmtDateLong,
  fmtHour, money, firstName, pick, suggestedDeposit
} from '@/lib/util';
import { norm, RX, leerDeporte, leerCancha, leerFecha, leerHora } from './lectura';

/* ==========================================================================
   NEO · El cerebro

   Portado de `demo/app/core/neo.js`. Recibe texto y el MUNDO ya leído, y
   devuelve qué contestar. No toca la base y no toca el DOM.

   El cambio respecto a la demo es de costura, no de reglas: allí este
   archivo escribía en `S` directamente; aquí devuelve una `accion` que la
   Server Action ejecuta. Así se conserva R43 —la reserva que crea Neo es el
   MISMO registro que crea el mostrador— sin que el motor sepa que existe una
   base de datos.

   Las reglas que sostienen la conversación:
     R44. Un solo objetivo: llenar cuatro huecos —deporte, día, cancha,
          hora— y confirmar. Lo demás es acompañamiento.
     R45. Neo NUNCA promete una hora ocupada: lee disponibilidad de verdad.
     R46. La ambigüedad a. m./p. m. se resuelve hacia la tarde y SE AVISA.
     R49. Tras tres mensajes sin entender, ofrece opciones en vez de seguir
          preguntando abierto.
   ========================================================================== */

export interface Sesion {
  sport: SportId | null;
  courtId: string | null;
  /** ¿La cancha la pidió el jugador, o la eligió Neo? Cambiar en silencio la
      que alguien pidió por su nombre es apartarle otra cosa. */
  courtPedida: boolean;
  date: string | null;
  start: string | null;
  pago: 'adelanto' | 'completo' | 'cancha' | null;
  /** 'confirm' cuando ya hay un resumen sobre la mesa. */
  espera: 'confirm' | null;
  /** La hora se interpretó como p. m. sin que lo dijera. */
  ambigua: boolean;
  saludado: boolean;
  /** Mensajes seguidos sin entender (R49). */
  perdido: number;
  /** Código de la última reserva creada, para poder cancelarla. */
  ultima: string | null;
}

export const nuevaSesion = (): Sesion => ({
  sport: null, courtId: null, courtPedida: false, date: null, start: null,
  pago: null, espera: null, ambigua: false, saludado: false,
  perdido: 0, ultima: null
});

/* ── El mundo que ve Neo ─────────────────────────────────────────────────── */

export interface CanchaNeo {
  id: string;
  nombre: string;
  deporte: SportId;
  precio: number;
}

export interface ReservaNeo {
  id: string;
  codigo: string;
  canchaId: string;
  fecha: string;
  inicio: string;
  total: number;
  abonado: number;
}

export interface Mundo {
  negocio: string;
  abre: number;
  cierra: number;
  canchas: CanchaNeo[];
  /** Franjas tomadas: `canchaId` → set de '18:00'. Solo del día en juego. */
  ocupadas: Map<string, Set<string>>;
  /** El día del que se cargó `ocupadas`. */
  diaCargado: string;
  yo: { nombre: string } | null;
  misReservas: ReservaNeo[];
}

/* ── Lo que devuelve ─────────────────────────────────────────────────────── */

export type Mensaje =
  | { t: 'text'; text: string }
  | { t: 'courts'; items: ItemCatalogo[] }
  | { t: 'hours'; canchaId: string; fecha: string; horas: string[] }
  | { t: 'quote'; q: Cotizacion }
  | { t: 'ok'; b: Confirmada }
  | { t: 'list'; items: { cancha: string; cuando: string; saldo: number }[] };

export interface ItemCatalogo {
  sport: SportId; name: string; short: string; blurb: string;
  cuantas: number; precio: string;
}

export interface Cotizacion {
  cancha: string; canchaId: string; fecha: string; inicio: string;
  total: number; adelanto: number;
  pago: 'adelanto' | 'completo' | 'cancha';
  nota: string;
}

export interface Confirmada {
  codigo: string; cancha: string; fecha: string; inicio: string;
  total: number; abonado: number; saldo: number;
}

/** Lo que el motor pide que se escriba. La Server Action lo ejecuta. */
export type Accion =
  | { tipo: 'reservar'; canchaId: string; fecha: string; inicio: string; pago: 'adelanto' | 'completo' | 'cancha' }
  | { tipo: 'cancelar'; reservaId: string };

export interface Respuesta {
  msgs: Mensaje[];
  quick: string[];
  accion?: Accion;
}

/* ── Ayudas sobre el mundo ───────────────────────────────────────────────── */

const deportesDe = (m: Mundo) => [...new Set(m.canchas.map(c => c.deporte))];
const canchasDe = (m: Mundo, sp: SportId) => m.canchas.filter(c => c.deporte === sp);
const canchaPorId = (m: Mundo, id: string | null) => m.canchas.find(c => c.id === id) ?? null;

const tomada = (m: Mundo, canchaId: string, inicio: string) =>
  !!m.ocupadas.get(canchaId)?.has(inicio);

const pasada = (fecha: string, inicio: string) =>
  fecha === iso(today()) && hourNum(inicio) <= new Date().getHours();

function horasLibresDe(m: Mundo, canchaId: string, fecha: string): string[] {
  const n = Math.max(1, m.cierra - m.abre);
  return Array.from({ length: n }, (_, i) => hhmm(m.abre + i))
    .filter(h => !tomada(m, canchaId, h))
    .filter(h => !pasada(fecha, h));
}

/* ── El único punto de entrada ───────────────────────────────────────────── */

export function responder(ctx: Sesion, entrada: string, m: Mundo): Respuesta {
  const t = norm(entrada);
  const msgs: Mensaje[] = [];
  const di = (text: string) => msgs.push({ t: 'text', text });

  if (!t) return { msgs: [{ t: 'text', text: '¿Me repites?' }], quick: sugerencias(ctx, m) };

  /* 1. Lo que la frase trae puesto, venga sola o dentro de una pregunta. */
  const { date, resto } = leerFecha(t);
  const { hour, ambigua } = leerHora(resto, m.abre, m.cierra);
  const cancha = leerCancha(t, m.canchas);
  const deporte = leerDeporte(t, deportesDe(m));

  if (deporte && deporte !== ctx.sport) {
    ctx.sport = deporte;
    ctx.courtId = null;
    ctx.courtPedida = false;
    ctx.espera = null;
  }
  if (cancha) {
    ctx.courtId = cancha;
    ctx.courtPedida = true;
    ctx.sport = canchaPorId(m, cancha)!.deporte;
    ctx.espera = null;
  }
  if (date && date !== ctx.date) { ctx.date = date; ctx.espera = null; }
  if (hour != null) {
    const nueva = hhmm(hour);
    if (nueva !== ctx.start) ctx.espera = null;
    ctx.start = nueva;
    ctx.ambigua = ambigua;
  }

  if (/\ben cancha\b|\bal llegar\b|\bsin adelanto\b/.test(t)) ctx.pago = 'cancha';
  else if (/\bcompleto\b|\btodo ahora\b|\bpago todo\b/.test(t)) ctx.pago = 'completo';
  else if (/\badelanto\b|\babono\b|\bla mitad\b/.test(t)) ctx.pago = 'adelanto';

  /* Pedir cambio es VACIAR el hueco correspondiente. Sin esto, quien tocaba
     «Otra hora» recibía el mismo resumen de vuelta, porque el dato que quería
     cambiar seguía puesto. */
  if (/\botro dia\b|\botra fecha\b|\bcambia el dia\b/.test(t)) {
    ctx.date = null; ctx.start = null; ctx.espera = null;
  }
  if (/\botra hora\b|\bcambia la hora\b|\bmas tarde\b|\bmas temprano\b/.test(t)) {
    ctx.start = null; ctx.espera = null;
  }
  if (/\botra cancha\b/.test(t)) {
    ctx.courtId = null;
    ctx.courtPedida = false;
    ctx.espera = null;
  }

  const trajoAlgo = !!(deporte || cancha || date || hour != null);

  /* 2. Un sí sobre un resumen ya puesto cierra el trato. Va antes que todo lo
        demás: si el jugador dice «dale», no es momento de dar precios. */
  if (ctx.espera === 'confirm' && RX.si.test(t) && !trajoAlgo) return cerrar(ctx, m);
  if (ctx.espera === 'confirm' && RX.no.test(t) && !trajoAlgo) {
    ctx.espera = null;
    di('Sin problema. ¿Qué cambio: el día, la hora o la cancha?');
    return { msgs, quick: ['Otro día', 'Otra hora', 'Otra cancha'] };
  }

  /* 3. Preguntas que se contestan y no mueven la reserva. */
  if (RX.cancelar.test(t)) return cancelar(ctx, t, m);
  if (RX.mias.test(t)) return listarMias(ctx, m);

  let contesto = false;

  if (RX.saludo.test(t)) {
    // Presentarse dos veces es de robot; ignorar el saludo, de maleducado.
    di(ctx.saludado
      ? pick(['¡Hola! ¿Qué necesitas?', 'Dime, ¿para cuándo la quieres?', '¡Hey! Cuéntame.'])
      : `¡Hola${m.yo ? ' ' + firstName(m.yo.nombre) : ''}! Soy Neo, el asistente de ${m.negocio}. ` +
        'Dime qué quieres jugar y cuándo, y yo te la aparto.');
    ctx.saludado = true;
    contesto = true;
  }

  if (RX.gracias.test(t) || RX.adios.test(t)) {
    di(pick([
      'Con gusto. Aquí estoy si necesitas otra.',
      'A la orden. Nos vemos en la cancha.',
      'Con mucho gusto. Buen partido.'
    ]));
    contesto = true;
  }

  if (RX.ayuda.test(t)) {
    di('Miro la agenda en vivo: te digo qué canchas hay, a cuánto, qué horas quedan libres, ' +
       'y si me dices cuál te sirve la dejo apartada a tu nombre.');
    contesto = true;
  }

  /* La dirección no está en el estado del negocio, así que NO se inventa (§9.3:
     Neo no negocia ni inventa). Decir «estamos en el complejo» es peor que
     decir que no la tengo. */
  if (RX.donde.test(t)) {
    di(`La dirección exacta no la tengo aquí — te la confirman en ${m.negocio}. ` +
       'Lo que sí puedo es apartarte la cancha.');
    contesto = true;
  }

  if (RX.abren.test(t)) {
    di(`Abrimos todos los días de ${fmtHour(hhmm(m.abre))} a ${fmtHour(hhmm(m.cierra))}.`);
    contesto = true;
  }

  if (RX.pago.test(t) && !trajoAlgo) {
    di('Puedes apartar con la mitad y pagar el resto en cancha, pagar todo ahora, ' +
       'o pagar completo al llegar — en ese último caso el cupo puede liberarse si te demoras.');
    contesto = true;
  }

  /* Preguntar por «las canchas» es preguntar por todas, aunque venga hablando
     de una: el deporte solo manda si lo nombran en esta misma frase. */
  if (RX.precio.test(t) || RX.catalogo.test(t)) {
    const todo = RX.catalogo.test(t) && !deporte;
    const soloUno = todo ? null : (deporte ?? ctx.sport);
    di(soloUno
      ? precioTexto(m, soloUno)
      : RX.precio.test(t)
        ? pick(['Estos son los precios por hora:', 'Te dejo la lista, todo por hora:'])
        : 'Tenemos estas, con lo que vale cada hora:');
    msgs.push({ t: 'courts', items: catalogo(m, soloUno) });
    contesto = true;
  }

  /* 4. Y ahora, el hueco que falte para poder apartar. Se avanza aunque la
        frase fuera una pregunta: contestar y quedarse quieto obliga al
        jugador a repetir lo que ya dijo. */
  const pide = trajoAlgo || RX.reservar.test(t) || RX.libre.test(t);

  if (!contesto && !pide) {
    ctx.perdido++;
    di(ctx.perdido > 1
      ? 'Te leo mejor si me lo dices así: «sintética mañana a las 7».'
      : 'De eso no sé. Puedo decirte precios, horas libres, o apartarte una cancha.');
    // El hilo no se pierde por una pregunta suelta: se recuerda el hueco.
    if (ctx.sport && ctx.date && !ctx.start) {
      di(`Seguimos con ${SPORTS[ctx.sport].short.toLowerCase()} el ${fmtDate(ctx.date)} ` +
         'cuando quieras: dime la hora y te la aparto.');
    }
    return { msgs, quick: sugerencias(ctx, m) };
  }

  ctx.perdido = 0;
  if (!pide) return { msgs, quick: sugerencias(ctx, m) };

  seguir(ctx, msgs, contesto, m);
  return { msgs, quick: sugerencias(ctx, m) };
}

/** El siguiente hueco: deporte → día → cancha → hora → resumen (R44). */
function seguir(ctx: Sesion, msgs: Mensaje[], yaHablo: boolean, m: Mundo): void {
  const di = (text: string) => msgs.push({ t: 'text', text });
  const deportes = deportesDe(m);

  if (!ctx.sport) {
    if (deportes.length === 1) ctx.sport = deportes[0];
    else {
      di(yaHablo ? '¿Para cuál de las canchas?' : '¿Qué quieres jugar?');
      // Si la respuesta de precios ya puso el catálogo, repetirlo es ruido.
      if (!msgs.some(x => x.t === 'courts')) msgs.push({ t: 'courts', items: catalogo(m, null) });
      return;
    }
  }

  const courts = canchasDe(m, ctx.sport);
  if (!courts.length) {
    di(`Hoy no tenemos ${SPORTS[ctx.sport].name.toLowerCase()} habilitado. ¿Miramos otro deporte?`);
    ctx.sport = null;
    return;
  }

  if (!ctx.date) {
    di(`Listo, ${SPORTS[ctx.sport].short.toLowerCase()}. ¿Para qué día?`);
    return;
  }

  /* La disponibilidad que trae el mundo es la de UN día. Si la conversación se
     movió a otro, no se puede prometer nada todavía: se pide de nuevo, y la
     siguiente vuelta ya llega con el día correcto cargado. */
  if (ctx.date !== m.diaCargado) {
    di(`Déjame mirar el ${fmtDate(ctx.date)}…`);
    return;
  }

  // Con día y deporte pero sin hora, lo útil no es preguntar: es ENSEÑAR.
  if (!ctx.start) {
    /* Si pidió una cancha por su nombre, se le enseñan LAS SUYAS. Elegirle
       otra porque tiene más huecos es apartarle algo que no pidió: quien dice
       "la sintética 1" normalmente la dice por algo. Solo si esa se quedó sin
       horas se ofrece la alternativa, y diciéndolo. */
    const pedida = ctx.courtPedida ? canchaPorId(m, ctx.courtId) : null;

    if (pedida) {
      const suyas = horasLibresDe(m, pedida.id, ctx.date);
      if (suyas.length) {
        di(`Para ${fmtDateLong(ctx.date)} en ${pedida.nombre} me quedan estas horas ` +
           `(${money(pedida.precio)} la hora):`);
        msgs.push({ t: 'hours', canchaId: pedida.id, fecha: ctx.date, horas: suyas });
        return;
      }
      const otra = mejorCancha(ctx.date, courts.filter(c => c.id !== pedida.id), m);
      if (!otra.cancha) {
        di(`${pedida.nombre} está llena ese día, y las demás también. ` +
           `¿Miramos ${fmtDate(iso(addDays(parseISO(ctx.date), 1)))}?`);
        return;
      }
      ctx.courtId = otra.cancha.id;
      ctx.courtPedida = false;
      di(`${pedida.nombre} quedó llena ese día, pero en ${otra.cancha.nombre} ` +
         `me queda esto (${money(otra.cancha.precio)} la hora):`);
      msgs.push({ t: 'hours', canchaId: otra.cancha.id, fecha: ctx.date, horas: otra.horas });
      return;
    }

    const libre = mejorCancha(ctx.date, courts, m);
    if (!libre.cancha) {
      di(`Ese día ya no me queda nada de ${SPORTS[ctx.sport].short.toLowerCase()}. ` +
         `¿Miramos ${fmtDate(iso(addDays(parseISO(ctx.date), 1)))}?`);
      return;
    }
    ctx.courtId = libre.cancha.id;
    di(`Para ${fmtDateLong(ctx.date)} en ${libre.cancha.nombre} me quedan estas horas ` +
       `(${money(libre.cancha.precio)} la hora):`);
    msgs.push({ t: 'hours', canchaId: libre.cancha.id, fecha: ctx.date, horas: libre.horas });
    return;
  }

  // Hora dicha: ¿está libre de verdad? (R45)
  if (!ctx.courtId || canchaPorId(m, ctx.courtId)?.deporte !== ctx.sport) {
    const libreAhi = courts.find(c => !tomada(m, c.id, ctx.start!));
    ctx.courtId = (libreAhi ?? courts[0]).id;
  }

  const cancha = canchaPorId(m, ctx.courtId)!;

  if (hourNum(ctx.start) < m.abre || hourNum(ctx.start) >= m.cierra) {
    di(`A esa hora estamos cerrados: abrimos de ${fmtHour(hhmm(m.abre))} ` +
       `a ${fmtHour(hhmm(m.cierra))} — ¿otra hora?`);
    ctx.start = null;
    return;
  }

  if (pasada(ctx.date, ctx.start)) {
    di('Esa hora ya pasó. Dime otra y la miro.');
    ctx.start = null;
    return;
  }

  if (tomada(m, cancha.id, ctx.start)) {
    const otra = courts.find(c => c.id !== cancha.id && !tomada(m, c.id, ctx.start!));
    if (otra) {
      ctx.courtId = otra.id;
      ctx.courtPedida = false;
      di(`${cancha.nombre} está tomada a esa hora, pero tengo ${otra.nombre} libre — ` +
         `misma hora, ${money(otra.precio)}.`);
    } else {
      const libres = horasLibresDe(m, cancha.id, ctx.date);
      di(`Las ${fmtHour(ctx.start)} ya están tomadas` +
         (libres.length ? '. Te quedan estas:' : ' y ese día quedó lleno.'));
      if (libres.length) msgs.push({ t: 'hours', canchaId: cancha.id, fecha: ctx.date, horas: libres });
      ctx.start = null;
      return;
    }
  }

  // Todo en pie: el resumen ANTES de tocar la agenda.
  const c = canchaPorId(m, ctx.courtId)!;
  ctx.espera = 'confirm';
  msgs.push({
    t: 'quote',
    q: {
      cancha: c.nombre,
      canchaId: c.id,
      fecha: ctx.date,
      inicio: ctx.start,
      total: c.precio,
      adelanto: suggestedDeposit(c.precio),
      pago: ctx.pago ?? 'adelanto',
      // R46: la ambigüedad se avisa, para que corregirla cueste una palabra.
      nota: ctx.ambigua
        ? `Entendí ${fmtHour(ctx.start)} — si la querías de mañana, dime «${hourNum(ctx.start) - 12} a.m.».`
        : ''
    }
  });
}

/** La cancha del deporte con más horas libres ese día: la que sí sirve. */
function mejorCancha(fecha: string, courts: CanchaNeo[], m: Mundo) {
  let mejor: { cancha: CanchaNeo | null; horas: string[] } = { cancha: null, horas: [] };
  for (const c of courts) {
    const horas = horasLibresDe(m, c.id, fecha);
    if (horas.length > mejor.horas.length) mejor = { cancha: c, horas };
  }
  return mejor;
}

/* ── Cerrar ──────────────────────────────────────────────────────────────── */

/**
 * No escribe: PIDE que se escriba. La Server Action valida otra vez contra la
 * base antes de crear (R5), porque entre este resumen y el `sí` del jugador
 * puede haber pasado medio minuto.
 */
function cerrar(ctx: Sesion, m: Mundo): Respuesta {
  const cancha = canchaPorId(m, ctx.courtId);
  if (!cancha || !ctx.date || !ctx.start) {
    return {
      msgs: [{ t: 'text', text: 'Se me perdió la cancha. ¿Cuál era?' }],
      quick: sugerencias(ctx, m)
    };
  }

  if (tomada(m, cancha.id, ctx.start)) {
    ctx.espera = null;
    const libres = horasLibresDe(m, cancha.id, ctx.date);
    const msgs: Mensaje[] = [
      { t: 'text', text: 'Uy, alguien acaba de tomar esa hora mientras hablábamos.' }
    ];
    if (libres.length) msgs.push({ t: 'hours', canchaId: cancha.id, fecha: ctx.date, horas: libres });
    ctx.start = null;
    return { msgs, quick: sugerencias(ctx, m) };
  }

  const pago = ctx.pago ?? 'adelanto';
  ctx.espera = null;

  return {
    msgs: [],
    quick: ['Reservar otra', 'Mis reservas'],
    accion: { tipo: 'reservar', canchaId: cancha.id, fecha: ctx.date, inicio: ctx.start, pago }
  };
}

function cancelar(ctx: Sesion, t: string, m: Mundo): Respuesta {
  const hoyISO = iso(today());
  const mias = m.misReservas.filter(b => b.fecha >= hoyISO);

  // R48: «cancelar SP-3F9A». El código es la forma corta de señalar una.
  const pedido = t.match(/\bsp[- ]?([a-z0-9]{4})\b/)?.[1];
  const b =
    (pedido && mias.find(x => x.codigo.toLowerCase().endsWith(pedido))) ||
    mias.find(x => x.codigo === ctx.ultima) ||
    mias[0];

  if (!b) {
    return {
      msgs: [{ t: 'text', text: 'No te veo reservas activas para cancelar.' }],
      quick: sugerencias(ctx, m)
    };
  }

  const cancha = canchaPorId(m, b.canchaId);
  ctx.ultima = null;
  ctx.espera = null;

  return {
    msgs: [{
      t: 'text',
      text: `Listo, solté ${cancha?.nombre ?? 'la cancha'} del ${fmtDate(b.fecha)} ` +
        `a las ${fmtHour(b.inicio)}.` +
        (b.abonado ? ` El adelanto de ${money(b.abonado)} te lo devuelven en el complejo.` : '')
    }],
    quick: ['Reservar otra vez'],
    accion: { tipo: 'cancelar', reservaId: b.id }
  };
}

function listarMias(ctx: Sesion, m: Mundo): Respuesta {
  const hoyISO = iso(today());
  const mias = m.misReservas
    .filter(b => b.fecha >= hoyISO)
    .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));

  if (!mias.length) {
    return {
      msgs: [{ t: 'text', text: 'Todavía no tienes ninguna reservada. ¿Te busco una?' }],
      quick: sugerencias(ctx, m)
    };
  }

  const proximas = mias.slice(0, 4);
  const resto = mias.length - proximas.length;

  return {
    msgs: [
      {
        t: 'text',
        text: mias.length === 1
          ? 'Tienes esta:'
          : `Tienes ${mias.length}. Las próximas${resto ? ' cuatro' : ''}:`
      },
      {
        t: 'list',
        items: proximas.map(b => ({
          cancha: canchaPorId(m, b.canchaId)?.nombre ?? 'Cancha',
          cuando: `${fmtDate(b.fecha)} · ${fmtHour(b.inicio)}`,
          saldo: b.total - b.abonado
        }))
      },
      ...(resto
        ? [{ t: 'text' as const, text: `Y ${resto} más después de esas. Las ves todas en tu histórico.` }]
        : [])
    ],
    quick: ['Reservar otra', 'Cancelar la última']
  };
}

/* ── Catálogo y sugerencias ──────────────────────────────────────────────── */

function catalogo(m: Mundo, sport: SportId | null): ItemCatalogo[] {
  const lista = sport ? [sport] : deportesDe(m);
  return lista.map(sp => {
    const cs = canchasDe(m, sp);
    const precios = cs.map(c => c.precio);
    return {
      sport: sp,
      name: SPORTS[sp].name,
      short: SPORTS[sp].short,
      blurb: SPORTS[sp].blurb,
      cuantas: cs.length,
      precio: precios.length
        ? (Math.min(...precios) === Math.max(...precios)
            ? money(precios[0])
            : `${money(Math.min(...precios))}–${money(Math.max(...precios))}`)
        : '—'
    };
  }).filter(x => x.cuantas > 0);
}

function precioTexto(m: Mundo, sp: SportId): string {
  const p = canchasDe(m, sp)[0]?.precio ?? SPORTS[sp].price;
  return `Una hora de ${SPORTS[sp].short.toLowerCase()} está en ${money(p)}. ` +
    `Se aparta con ${money(suggestedDeposit(p))} y el resto se paga en cancha.`;
}

/** Lo que tiene sentido tocar en este punto exacto de la conversación (R49). */
function sugerencias(ctx: Sesion, m: Mundo): string[] {
  // Con el resumen en pantalla, sus propios botones son la acción: repetirlos
  // aquí abajo obliga a elegir entre dos sitios que hacen lo mismo.
  if (ctx.espera === 'confirm') return ['Pago todo en cancha'];
  if (!ctx.sport) return [...deportesDe(m).slice(0, 3).map(s => SPORTS[s].short), '¿Cuánto vale?'];
  if (!ctx.date) return ['Hoy', 'Mañana', 'El sábado'];
  if (!ctx.start) return ['A las 7', 'A las 8', 'Otro día'];
  return ['Mis reservas', '¿Cómo pago?'];
}

/** El primer mensaje, antes de que el jugador escriba nada. */
export function saludoInicial(m: Mundo, ctx?: Sesion): Respuesta {
  if (ctx) ctx.saludado = true;   // ya se presentó: no repetirlo si le dicen «hola»

  const deportes = deportesDe(m).map(s => SPORTS[s].short.toLowerCase());
  const lista = deportes.length > 1
    ? deportes.slice(0, -1).join(', ') + ' y ' + deportes.at(-1)
    : deportes[0] ?? 'canchas';

  return {
    msgs: [{
      t: 'text',
      text: `¡Hola${m.yo ? ' ' + firstName(m.yo.nombre) : ''}! Soy Neo, el asistente de ${m.negocio}. ` +
        `Tenemos ${lista}. Dime qué quieres jugar y cuándo — miro la agenda y te lo aparto aquí mismo.`
    }],
    quick: [...deportesDe(m).slice(0, 3).map(s => SPORTS[s].short), '¿Cuánto vale?', 'Mis reservas']
  };
}
