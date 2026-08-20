/* ==========================================================================
   NÚCLEO · Neo AI — el cerebro
   Entiende lo que el jugador escribe en español y devuelve qué contestar.
   No toca el DOM: recibe texto, actualiza el contexto de la conversación y
   devuelve una lista de mensajes que la vista sabe pintar.

   No hay modelo de lenguaje detrás y no hace falta: la conversación tiene un
   solo objetivo —apartar una cancha— y por eso el trabajo real no es
   entender cualquier frase, sino llenar cuatro huecos (deporte, día, cancha,
   hora) y leer la agenda de verdad para no prometer una hora que ya está
   tomada. Lo que sí exige es entender cómo habla la gente aquí: "mañana a
   las 7" es de noche, "el sábado" es el sábado que viene, y "la sintética"
   es fútbol. Eso es lo que resuelve este archivo.

   La reserva que crea es la MISMA que crea el formulario de Reservar —
   mismo objeto, mismo estado— así que cae en la agenda del dueño y en el
   histórico del jugador sin que nada más se entere de que vino hablando.
   ========================================================================== */

import { S, save } from './store.js';
import { SPORTS } from './sports.js';
import { courtById, freeHours, openHour, closeHour, slotTaken, bookingsOfPlayer } from './calc.js';
import { me } from './teams.js';
import { iso, today, addDays, parseISO, hhmm, hourNum, nextHour, fmtDate, fmtDateLong,
         fmtHour, money, uid, firstName, pick, MONTHS } from './util.js';

/* ── Contexto de la conversación ─────────────────────────────────────────── */

export function nuevaSesion() {
  return {
    sport: null, courtId: null, date: null, start: null,
    pago: null,          // 'adelanto' | 'completo' | 'cancha'
    espera: null,        // 'confirm' cuando ya hay resumen sobre la mesa
    ambigua: false,      // la hora se interpretó como p. m. sin que lo dijera
    saludado: false,
    perdido: 0,          // mensajes seguidos sin entender
    ultima: null         // id de la última reserva creada, para poder cancelarla
  };
}

/* ── Utilidades de texto ─────────────────────────────────────────────────── */

const norm = (s) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim();

const NUMS = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
               siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };

const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/* Cómo llama la gente a cada deporte cuando escribe rápido. La grama
   sintética casi nunca se pide por su nombre: se pide "la sintética". */
const SINONIMOS = {
  futbol:    ['futbol', 'sintetica', 'sintetico', 'grama', 'micro', 'futsal', 'soccer', 'f5', 'f6', 'f7', 'balompie'],
  padel:     ['padel', 'padle', 'paddle'],
  tenis:     ['tenis', 'tennis'],
  voleibol:  ['voleibol', 'volleyball', 'volley', 'voley', 'volei', 'playa'],
  paintball: ['paintball', 'pintball', 'paint ball', 'gotcha']
};

const RX = {
  saludo:   /\b(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas|quiubo|q hubo)\b/,
  gracias:  /\b(gracias|mil gracias|muy amable|te pasaste)\b/,
  adios:    /\b(chao|adios|hasta luego|nos vemos|listo entonces)\b/,
  precio:   /\b(precio|precios|cuanto|cuesta|cuestan|vale|valen|valor|tarifa|tarifas|cobran|caro)\b/,
  catalogo: /\b(canchas|cancha|deportes|deporte|que tienen|que hay|opciones|servicios|ofrecen)\b/,
  libre:    /\b(libre|libres|disponible|disponibles|disponibilidad|horas|horario|horarios|cupo|cupos|puedo|tienen)\b/,
  reservar: /\b(reservar|reserva|reservame|apartar|aparta|apartame|separar|separa|separame|agendar|agenda|quiero|necesito|me sirve|dejame)\b/,
  si:       /^(si|sii+|s|claro|dale|de una|obvio|correcto|confirmo|confirmar|confirmalo|hagale|listo|perfecto|ok|okey|okay|va|bueno)\b/,
  no:       /^(no|nop|nel|mejor no|todavia no|espera|cambia|cambiar|otra|otro)\b/,
  mias:     /\b(mis reservas|mi reserva|mis partidos|que tengo|tengo reservad)/,
  cancelar: /\b(cancelar|cancela|anular|anula|quitar la reserva)\b/,
  donde:    /\b(donde|direccion|ubicacion|como llego|queda|mapa)\b/,
  abren:    /\b(abren|cierran|abiertos|a que hora abren|hasta que hora)\b/,
  pago:     /\b(pago|pagar|adelanto|abono|abonar|transferencia|efectivo|nequi|daviplata|tarjeta|consignar)\b/,
  ayuda:    /\b(ayuda|que puedes hacer|que haces|quien eres|como funciona)\b/
};

/* ── Lectura de la frase ─────────────────────────────────────────────────── */

/** Deportes que este negocio realmente tiene, en el orden en que los ofrece. */
const misDeportes = () => (S.business.sports || []).filter(s => SPORTS[s]);
const canchasDe = (sport) => S.courts.filter(c => c.sport === sport && c.active !== false);

function leerDeporte(t) {
  for (const sp of misDeportes()) {
    if ((SINONIMOS[sp] || []).some(w => t.includes(w))) return sp;
    if (t.includes(norm(SPORTS[sp].short))) return sp;
  }
  return null;
}

/** "sintetica 2", "la 3 de padel": el nombre de la cancha tal cual existe. */
function leerCancha(t) {
  const activas = S.courts.filter(c => c.active !== false);
  return activas.find(c => t.includes(norm(c.name)))?.id || null;
}

/**
 * Fecha. Devuelve `{ date, resto }`: el texto sale sin el trozo que se comió,
 * para que después la hora no confunda el "20" de "el 20 de agosto" con las
 * ocho de la noche.
 */
function leerFecha(t) {
  const hoy = today();
  let s = t;
  let date = null;
  const come = (rx) => { const m = s.match(rx); if (m) s = s.replace(m[0], ' '); return m; };

  if (come(/\bpasado manana\b/))                 date = iso(addDays(hoy, 2));
  else if (come(/\bhoy\b|\besta noche\b|\besta tarde\b|\bahora\b/)) date = iso(hoy);
  else if (come(/\bmanana\b/))                   date = iso(addDays(hoy, 1));

  if (!date) {
    for (let i = 0; i < 7; i++) {
      if (come(new RegExp('\\b' + DIAS_SEM[i] + 's?\\b'))) {
        let delta = (i - hoy.getDay() + 7) % 7;
        if (delta === 0 && /\b(proximo|siguiente|entrante|que viene)\b/.test(t)) delta = 7;
        date = iso(addDays(hoy, delta));
        break;
      }
    }
  }
  if (!date && come(/\bfin de semana\b/)) date = iso(addDays(hoy, (6 - hoy.getDay() + 7) % 7));

  // "20 de agosto" · "20/8" · "el 20"
  if (!date) {
    let m = come(new RegExp('\\b(\\d{1,2}) de (' + MONTHS.map(x => norm(x)).join('|') + ')\\b'));
    if (m) date = iso(nuevoDia(+m[1], MONTHS.findIndex(x => norm(x) === m[2])));
  }
  if (!date) {
    const m = come(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})\b/);
    if (m) date = iso(nuevoDia(+m[1], +m[2] - 1));
  }
  if (!date) {
    const m = come(/\bel (?:dia )?(\d{1,2})\b/);
    if (m && +m[1] >= 1 && +m[1] <= 31) date = iso(nuevoDia(+m[1], null));
  }

  return { date, resto: s };
}

/** Un día de este mes o del que viene si ya pasó. Nadie reserva hacia atrás. */
function nuevoDia(dia, mes) {
  const hoy = today();
  const d = new Date(hoy.getFullYear(), mes ?? hoy.getMonth(), dia);
  if (d < hoy) d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Hora. Devuelve `{ hour, ambigua }`. Lo interesante es la ambigüedad: aquí
 * "a las 7" siempre son las 7 de la NOCHE, porque a las 7 de la mañana no
 * juega nadie. Se resuelve hacia la tarde, pero se marca — Neo lo dice en el
 * resumen para que corregirlo cueste una palabra y no una reserva perdida.
 */
function leerHora(t) {
  let s = ' ' + t + ' ';
  s = s.replace(/\b(de|por|en|a) la manana\b/g, ' ~am ');
  s = s.replace(/\b(de|por|en|a) la (tarde|noche)\b/g, ' ~pm ');
  s = s.replace(/\bmedio ?dia\b/g, ' 12 ~pm ');
  s = s.replace(/\bmedia ?noche\b/g, ' 0 ~am ');
  Object.entries(NUMS).forEach(([w, n]) => { s = s.replace(new RegExp('\\b' + w + '\\b', 'g'), ' ' + n + ' '); });

  /* El sufijo puede venir DENTRO del trozo reconocido ("6:00 p.m.", que es lo
     que manda un chip de hora) o justo después ("las 6 de la noche"). Mirar
     solo lo que sigue daba por ambigua una hora que el jugador dijo entera. */
  const suf = (m) => {
    const pos = s.indexOf(m);
    const trozo = m + s.slice(pos + m.length, pos + m.length + 6);
    const mm = trozo.match(/\d{1,2}(?::\d{2})?\s*~?([ap])\.?\s?m\.?/);
    return mm ? (mm[1] === 'p' ? 'pm' : 'am') : null;
  };

  // "a las 7", "las 7:00", "7 pm", o un mensaje que es solo la hora.
  let m = s.match(/\ba (?:la|las) (\d{1,2})(?:[:.](\d{2}))?/)
       || s.match(/\b(?:la|las) (\d{1,2})(?:[:.](\d{2}))?/)
       || s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:~?[ap]\.?m\.?)/)
       || (/^\s*\d{1,2}(?:[:.]\d{2})?\s*(?:~?[ap]\.?m\.?)?\s*$/.test(s) ? s.match(/(\d{1,2})(?:[:.](\d{2}))?/) : null);
  if (!m) return { hour: null, ambigua: false };

  const crudo = +m[1];
  if (crudo > 23) return { hour: null, ambigua: false };
  const sufijo = suf(m[0]);

  if (sufijo === 'pm') return { hour: crudo === 12 ? 12 : crudo + 12, ambigua: false };
  if (sufijo === 'am') return { hour: crudo === 12 ? 0 : crudo, ambigua: false };
  if (crudo >= 13) return { hour: crudo, ambigua: false };

  const tarde = crudo + 12;
  if (crudo <= 11 && tarde >= openHour() && tarde < closeHour()) return { hour: tarde, ambigua: true };
  return { hour: crudo, ambigua: false };
}

/* ── Respuesta ───────────────────────────────────────────────────────────── */

/**
 * El único punto de entrada. Devuelve `{ msgs, quick }`:
 *  · `msgs`  — burbujas a pintar, en orden. Cada una lleva su `t` (tipo).
 *  · `quick` — sugerencias tocables; al tocarlas vuelven aquí como texto,
 *              así que hablar y tocar recorren exactamente el mismo camino.
 */
export function responder(ctx, entrada) {
  const t = norm(entrada);
  const msgs = [];
  const di = (text) => msgs.push({ t: 'text', text });
  const yo = me();

  if (!t) return { msgs: [{ t: 'text', text: '¿Me repites?' }], quick: sugerencias(ctx) };

  /* 1. Lo que la frase trae puesto, venga sola o dentro de una pregunta. */
  const { date, resto } = leerFecha(t);
  const { hour, ambigua } = leerHora(resto);
  const cancha = leerCancha(t);
  const deporte = leerDeporte(t);

  if (deporte && deporte !== ctx.sport) { ctx.sport = deporte; ctx.courtId = null; ctx.espera = null; }
  if (cancha) { ctx.courtId = cancha; ctx.sport = courtById(cancha).sport; ctx.espera = null; }
  if (date && date !== ctx.date) { ctx.date = date; ctx.espera = null; }
  if (hour != null) {
    const nueva = hhmm(hour);
    if (nueva !== ctx.start) ctx.espera = null;
    ctx.start = nueva; ctx.ambigua = ambigua;
  }
  if (/\ben cancha\b|\bal llegar\b|\bsin adelanto\b/.test(t)) ctx.pago = 'cancha';
  else if (/\bcompleto\b|\btodo ahora\b|\bpago todo\b/.test(t)) ctx.pago = 'completo';
  else if (/\badelanto\b|\babono\b|\bla mitad\b/.test(t)) ctx.pago = 'adelanto';

  /* "otro día", "otra hora": pedir cambio es vaciar el hueco correspondiente.
     Sin esto, quien tocaba "Otra hora" recibía el mismo resumen de vuelta,
     porque el dato que quería cambiar seguía puesto. */
  if (/\botro dia\b|\botra fecha\b|\bcambia el dia\b/.test(t)) { ctx.date = null; ctx.start = null; ctx.espera = null; }
  if (/\botra hora\b|\bcambia la hora\b|\bmas tarde\b|\bmas temprano\b/.test(t)) { ctx.start = null; ctx.espera = null; }
  if (/\botra cancha\b/.test(t)) { ctx.courtId = null; ctx.espera = null; }

  const trajoAlgo = !!(deporte || cancha || date || hour != null);

  /* 2. Un sí sobre un resumen ya puesto cierra el trato. Va antes que todo
        lo demás: si el jugador dice "dale", no es momento de dar precios. */
  if (ctx.espera === 'confirm' && RX.si.test(t) && !trajoAlgo) return cerrar(ctx);
  if (ctx.espera === 'confirm' && RX.no.test(t) && !trajoAlgo) {
    ctx.espera = null;
    di('Sin problema. ¿Qué cambio: el día, la hora o la cancha?');
    return { msgs, quick: ['Otro día', 'Otra hora', 'Otra cancha'] };
  }

  /* 3. Preguntas que se contestan y no mueven la reserva. */
  if (RX.cancelar.test(t)) return cancelar(ctx, t);
  if (RX.mias.test(t)) return listarMias(ctx, yo);

  let contesto = false;
  if (RX.saludo.test(t)) {
    // Presentarse dos veces es de robot; ignorar el saludo, de maleducado.
    di(ctx.saludado
      ? pick(['¡Hola! ¿Qué necesitas?', 'Dime, ¿para cuándo la quieres?', '¡Hey! Cuéntame.'])
      : `¡Hola${yo ? ' ' + firstName(yo.name) : ''}! Soy Neo, el asistente de ${S.business.name}. ` +
        `Dime qué quieres jugar y cuándo, y yo te la aparto.`);
    ctx.saludado = true;
    contesto = true;
  }
  if (RX.gracias.test(t) || RX.adios.test(t)) {
    di(pick(['Con gusto. Aquí estoy si necesitas otra.',
             'A la orden. Nos vemos en la cancha.',
             'Con mucho gusto. Buen partido.']));
    contesto = true;
  }
  if (RX.ayuda.test(t)) {
    di('Miro la agenda en vivo: te digo qué canchas hay, a cuánto, qué horas quedan libres, ' +
       'y si me dices cuál te sirve la dejo apartada a tu nombre.');
    contesto = true;
  }
  /* La dirección no está en el estado del negocio, así que no se inventa:
     decir "estamos en el complejo" es peor que decir que no la tengo. */
  if (RX.donde.test(t)) {
    di(`La dirección exacta no la tengo aquí — te la confirman en ${S.business.name}. ` +
       `Lo que sí puedo es apartarte la cancha.`);
    contesto = true;
  }
  if (RX.abren.test(t)) {
    di(`Abrimos todos los días de ${fmtHour(hhmm(openHour()))} a ${fmtHour(hhmm(closeHour()))}`);
    contesto = true;
  }
  if (RX.pago.test(t) && !trajoAlgo) {
    di('Puedes apartar con la mitad y pagar el resto en cancha, pagar todo ahora, ' +
       'o pagar completo al llegar — en ese último caso el cupo puede liberarse si te demoras.');
    contesto = true;
  }
  /* Preguntar por "las canchas" es preguntar por todas, aunque venga hablando
     de una: el deporte solo manda si lo nombran en esta misma frase. */
  if (RX.precio.test(t) || RX.catalogo.test(t)) {
    const todo = RX.catalogo.test(t) && !deporte;
    const soloUno = todo ? null : (deporte || ctx.sport);
    msgs.push({ t: 'text', text: soloUno ? precioTexto(soloUno)
      : RX.precio.test(t) ? pick(['Estos son los precios por hora:', 'Te dejo la lista, todo por hora:'])
      : 'Tenemos estas, con lo que vale cada hora:' });
    msgs.push({ t: 'courts', items: catalogo(soloUno) });
    contesto = true;
  }

  /* 4. Y ahora, el hueco que falte para poder apartar. Se avanza aunque la
        frase fuera una pregunta: contestar y quedarse quieto obliga al
        jugador a repetir lo que ya dijo. */
  const pide = trajoAlgo || RX.reservar.test(t) || RX.libre.test(t);
  if (!contesto && !pide) {
    ctx.perdido++;
    di(ctx.perdido > 1
      ? 'Te leo mejor si me lo dices así: "sintética mañana a las 7".'
      : 'De eso no sé. Puedo decirte precios, horas libres, o apartarte una cancha.');
    // El hilo no se pierde por una pregunta suelta: se recuerda el hueco.
    if (ctx.sport && ctx.date && !ctx.start) di(pendiente(ctx));
    return { msgs, quick: sugerencias(ctx) };
  }
  ctx.perdido = 0;
  if (!pide) return { msgs, quick: sugerencias(ctx) };

  return { ...seguir(ctx, msgs, contesto), quick: sugerencias(ctx) };
}

/** El siguiente hueco: deporte → día → cancha → hora → resumen. */
function seguir(ctx, msgs, yaHablo) {
  const di = (text) => msgs.push({ t: 'text', text });
  const deportes = misDeportes();

  if (!ctx.sport) {
    if (deportes.length === 1) ctx.sport = deportes[0];
    else {
      di(yaHablo ? '¿Para cuál de las canchas?' : '¿Qué quieres jugar?');
      // Si la respuesta de precios ya puso el catálogo, repetirlo es ruido.
      if (!msgs.some(m => m.t === 'courts')) msgs.push({ t: 'courts', items: catalogo(null) });
      return { msgs };
    }
  }

  const courts = canchasDe(ctx.sport);
  if (!courts.length) {
    di(`Hoy no tenemos ${SPORTS[ctx.sport].name.toLowerCase()} habilitado. ¿Miramos otro deporte?`);
    ctx.sport = null;
    return { msgs };
  }

  if (!ctx.date) {
    di(`Listo, ${SPORTS[ctx.sport].short.toLowerCase()}. ¿Para qué día?`);
    return { msgs };
  }

  // Con día y deporte pero sin hora, lo útil no es preguntar: es enseñar.
  if (!ctx.start) {
    const libre = mejorCancha(ctx, courts);
    if (!libre.court) {
      di(`Ese día ya no me queda nada de ${SPORTS[ctx.sport].short.toLowerCase()}. ` +
         `¿Miramos ${fmtDate(iso(addDays(parseISO(ctx.date), 1)))}?`);
      return { msgs };
    }
    ctx.courtId = libre.court.id;
    di(`Para ${fmtDateLong(ctx.date)} en ${libre.court.name} me quedan estas horas ` +
       `(${money(libre.court.price)} la hora):`);
    msgs.push({ t: 'hours', courtId: libre.court.id, date: ctx.date, hours: libre.hours });
    return { msgs };
  }

  // Hora dicha: ¿está libre de verdad?
  if (!ctx.courtId || courtById(ctx.courtId)?.sport !== ctx.sport) {
    const libreAhi = courts.find(c => !slotTaken(c.id, ctx.date, ctx.start));
    ctx.courtId = (libreAhi || courts[0]).id;
  }
  const court = courtById(ctx.courtId);

  if (hourNum(ctx.start) < openHour() || hourNum(ctx.start) >= closeHour()) {
    di(`A esa hora estamos cerrados: abrimos de ${fmtHour(hhmm(openHour()))} ` +
       `a ${fmtHour(hhmm(closeHour()))} — ¿otra hora?`);
    ctx.start = null;
    return { msgs };
  }
  if (pasada(ctx.date, ctx.start)) {
    di('Esa hora ya pasó. Dime otra y la miro.');
    ctx.start = null;
    return { msgs };
  }
  if (slotTaken(court.id, ctx.date, ctx.start)) {
    const otra = courts.find(c => c.id !== court.id && !slotTaken(c.id, ctx.date, ctx.start));
    if (otra) {
      ctx.courtId = otra.id;
      di(`${court.name} está tomada a esa hora, pero tengo ${otra.name} libre — misma hora, ${money(otra.price)}.`);
    } else {
      const libres = freeHours(court.id, ctx.date).filter(h => !pasada(ctx.date, h));
      di(`Las ${fmtHour(ctx.start)} ya están tomadas${libres.length ? '. Te quedan estas:' : ' y ese día quedó lleno.'}`);
      if (libres.length) msgs.push({ t: 'hours', courtId: court.id, date: ctx.date, hours: libres });
      ctx.start = null;
      return { msgs };
    }
  }

  // Todo en pie: el resumen antes de tocar la agenda.
  const c = courtById(ctx.courtId);
  ctx.espera = 'confirm';
  msgs.push({ t: 'quote', q: {
    court: c.name, courtId: c.id, date: ctx.date, start: ctx.start,
    total: c.price, dep: adelanto(c), pago: ctx.pago || 'adelanto',
    nota: ctx.ambigua
      ? `Entendí ${fmtHour(ctx.start)} — si la querías de mañana, dime "${hourNum(ctx.start) - 12} a.m."`
      : ''
  } });
  return { msgs };
}

/** Dónde se quedó la reserva a medias, en una línea. */
function pendiente(ctx) {
  return `Seguimos con ${SPORTS[ctx.sport].short.toLowerCase()} el ${fmtDate(ctx.date)} ` +
         `cuando quieras: dime la hora y te la aparto.`;
}

/** La cancha del deporte con más horas libres ese día: la que sí sirve. */
function mejorCancha(ctx, courts) {
  let mejor = { court: null, hours: [] };
  courts.forEach(c => {
    const hours = freeHours(c.id, ctx.date).filter(h => !pasada(ctx.date, h));
    if (hours.length > mejor.hours.length) mejor = { court: c, hours };
  });
  return mejor;
}

const pasada = (date, start) => {
  const ahora = new Date();
  return date === iso(today()) && hourNum(start) <= ahora.getHours();
};

const adelanto = (court) => Math.round(court.price * 0.5 / 1000) * 1000;

/* ── Cerrar la reserva ───────────────────────────────────────────────────── */

/* Es el único punto del archivo que escribe. La reserva sale idéntica a la
   del formulario salvo por `source`: 'neo' y no 'bot', porque 'bot' significa
   WhatsApp en esta base y esta entró hablando dentro de la app. Las dos son
   Neo, y la vista de automatización las suma; la agenda las distingue. */
function cerrar(ctx) {
  const court = courtById(ctx.courtId);
  const yo = me();
  if (!court) return { msgs: [{ t: 'text', text: 'Se me perdió la cancha. ¿Cuál era?' }], quick: sugerencias(ctx) };

  if (slotTaken(court.id, ctx.date, ctx.start)) {
    ctx.espera = null;
    const libres = freeHours(court.id, ctx.date).filter(h => !pasada(ctx.date, h));
    const msgs = [{ t: 'text', text: 'Uy, alguien acaba de tomar esa hora mientras hablábamos.' }];
    if (libres.length) msgs.push({ t: 'hours', courtId: court.id, date: ctx.date, hours: libres });
    ctx.start = null;
    return { msgs, quick: sugerencias(ctx) };
  }

  const dep = ctx.pago === 'completo' ? court.price : ctx.pago === 'cancha' ? 0 : adelanto(court);
  const b = {
    id: uid('b'), courtId: court.id, date: ctx.date, start: ctx.start, end: nextHour(ctx.start),
    playerId: yo?.id ?? null,
    customer: yo?.name || 'Invitado',
    phone: yo?.phone || '',
    total: court.price, deposit: dep, source: 'neo',
    status: 'confirmada', note: 'Reservada hablando con Neo AI'
  };
  S.bookings.push(b);
  save();

  ctx.ultima = b.id;
  ctx.espera = null;
  ctx.start = null;

  return {
    msgs: [
      { t: 'ok', b: { ...b, code: codigo(b), courtName: court.name, saldo: court.price - dep } },
      { t: 'text', text: `Quedó a tu nombre${yo ? `, ${firstName(yo.name)}` : ''}. ` +
          `Ya te aparece en tu inicio y en tus reservas. Si te toca cancelar, escríbeme ` +
          `"cancelar ${codigo(b)}" y lo suelto.` }
    ],
    quick: ['Reservar otra', 'Mis reservas']
  };
}

export const codigo = (b) => 'SP-' + String(b.id).slice(-4).toUpperCase();

function cancelar(ctx, t = '') {
  const yo = me();
  const mias = bookingsOfPlayer(yo?.id).filter(b => b.date >= iso(today()));
  const pedido = (t.match(/\bsp[- ]?([a-z0-9]{4})\b/) || [])[1];
  const b = (pedido && mias.find(x => codigo(x).toLowerCase().endsWith(pedido)))
    || mias.find(x => x.id === ctx.ultima) || mias[0];
  if (!b) return { msgs: [{ t: 'text', text: 'No te veo reservas activas para cancelar.' }], quick: sugerencias(ctx) };

  const court = courtById(b.courtId);
  S.bookings = S.bookings.filter(x => x.id !== b.id);
  save();
  ctx.ultima = null;
  ctx.espera = null;
  return {
    msgs: [{ t: 'text', text: `Listo, solté ${court?.name || 'la cancha'} del ${fmtDate(b.date)} ` +
      `a las ${fmtHour(b.start)}${b.deposit ? ` El adelanto de ${money(b.deposit)} te lo devolvemos hoy mismo.` : ''}` }],
    quick: ['Reservar otra vez']
  };
}

function listarMias(ctx, yo) {
  const mias = bookingsOfPlayer(yo?.id).filter(b => b.date >= iso(today()))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  if (!mias.length) {
    return { msgs: [{ t: 'text', text: 'Todavía no tienes ninguna reservada. ¿Te busco una?' }],
             quick: sugerencias(ctx) };
  }
  const proximas = mias.slice(0, 4);
  const resto = mias.length - proximas.length;
  return {
    msgs: [
      { t: 'text', text: mias.length === 1 ? 'Tienes esta:'
          : `Tienes ${mias.length}. Las próximas${resto ? ' cuatro' : ''}:` },
      { t: 'list', items: proximas.map(b => ({
          court: courtById(b.courtId)?.name || 'Cancha',
          when: `${fmtDate(b.date)} · ${fmtHour(b.start)}`,
          saldo: b.total - b.deposit
        })) },
      ...(resto ? [{ t: 'text', text: `Y ${resto} más después de esas. Las ves todas en tu histórico.` }] : [])
    ],
    quick: ['Reservar otra', 'Cancelar la última']
  };
}

/* ── Catálogo y sugerencias ──────────────────────────────────────────────── */

function catalogo(sport) {
  const lista = sport ? [sport] : misDeportes();
  return lista.map(sp => {
    const cs = canchasDe(sp);
    const precios = cs.map(c => c.price);
    return {
      sport: sp, name: SPORTS[sp].name, short: SPORTS[sp].short, blurb: SPORTS[sp].blurb,
      cuantas: cs.length,
      precio: precios.length ? (Math.min(...precios) === Math.max(...precios)
        ? money(precios[0]) : `${money(Math.min(...precios))}–${money(Math.max(...precios))}`) : '—'
    };
  }).filter(x => x.cuantas);
}

function precioTexto(sp) {
  const p = canchasDe(sp)[0]?.price || SPORTS[sp].price;
  return `Una hora de ${SPORTS[sp].short.toLowerCase()} está en ${money(p)}. ` +
         `Se aparta con ${money(Math.round(p * .5 / 1000) * 1000)} y el resto se paga en cancha.`;
}

/** Lo que tiene sentido tocar en este punto exacto de la conversación. */
function sugerencias(ctx) {
  // Con el resumen en pantalla, sus propios botones son la acción: repetirlos
  // aquí abajo obliga a elegir entre dos sitios que hacen lo mismo.
  if (ctx.espera === 'confirm') return ['Pago todo en cancha'];
  if (!ctx.sport) return [...misDeportes().slice(0, 3).map(s => SPORTS[s].short), '¿Cuánto vale?'];
  if (!ctx.date) return ['Hoy', 'Mañana', 'El sábado'];
  if (!ctx.start) return ['A las 7', 'A las 8', 'Otro día'];
  return ['Mis reservas', '¿Cómo pago?'];
}

/** El primer mensaje, antes de que el jugador escriba nada. */
export function saludoInicial(ctx = null) {
  const yo = me();
  if (ctx) ctx.saludado = true;   // ya se presentó: no repetirlo si le dicen "hola"
  const deportes = misDeportes().map(s => SPORTS[s].short.toLowerCase());
  const lista = deportes.length > 1
    ? deportes.slice(0, -1).join(', ') + ' y ' + deportes.at(-1)
    : deportes[0] || 'canchas';
  return {
    msgs: [{ t: 'text', text:
      `¡Hola${yo ? ' ' + firstName(yo.name) : ''}! Soy Neo, el asistente de ${S.business.name}. ` +
      `Tenemos ${lista}. Dime qué quieres jugar y cuándo — miro la agenda y te lo aparto aquí mismo.` }],
    quick: [...misDeportes().slice(0, 3).map(s => SPORTS[s].short), '¿Cuánto vale?', 'Mis reservas']
  };
}
