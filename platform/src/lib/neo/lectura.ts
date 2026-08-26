import { iso, today, addDays, MONTHS } from '@/lib/util';
import { SPORTS, type SportId } from '@/lib/sports';

/* ==========================================================================
   NEO · Leer lo que escribió

   Portado de `demo/app/core/neo.js` casi carácter por carácter: los
   sinónimos, las expresiones y el parser de fecha y hora son lo caro de
   acertar, y ya están probados con usuarios reales.

   Aquí no hay modelo de lenguaje y para el 80% de las conversaciones no hace
   falta (§9.1): la conversación tiene un solo objetivo —apartar una cancha—
   así que el trabajo no es entender cualquier frase, sino llenar cuatro
   huecos. Lo que SÍ exige es entender cómo habla la gente aquí: «mañana a
   las 7» es de noche, «el sábado» es el sábado que viene, y «la sintética»
   es fútbol.

   Todo lo de este archivo es puro. No lee la base y no escribe nada.
   ========================================================================== */

export const norm = (s: string) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim();

const NUMS: Record<string, number> = {
  una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12
};

const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/* Cómo llama la gente a cada deporte cuando escribe rápido. La grama
   sintética casi nunca se pide por su nombre: se pide «la sintética». */
export const SINONIMOS: Record<SportId, string[]> = {
  futbol:    ['futbol', 'sintetica', 'sintetico', 'grama', 'micro', 'futsal', 'soccer', 'f5', 'f6', 'f7', 'balompie'],
  padel:     ['padel', 'padle', 'paddle'],
  tenis:     ['tenis', 'tennis'],
  voleibol:  ['voleibol', 'volleyball', 'volley', 'voley', 'volei', 'playa'],
  paintball: ['paintball', 'pintball', 'paint ball', 'gotcha']
};

export const RX = {
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

export function leerDeporte(t: string, disponibles: SportId[]): SportId | null {
  for (const sp of disponibles) {
    if ((SINONIMOS[sp] ?? []).some(w => t.includes(w))) return sp;
    if (t.includes(norm(SPORTS[sp].short))) return sp;
  }
  return null;
}

/** «sintética 2», «la 3 de pádel»: el nombre de la cancha tal cual existe. */
export function leerCancha(t: string, canchas: { id: string; nombre: string }[]): string | null {
  return canchas.find(c => t.includes(norm(c.nombre)))?.id ?? null;
}

/** Un día de este mes o del que viene si ya pasó. Nadie reserva hacia atrás. */
function nuevoDia(dia: number, mes: number | null): Date {
  const hoy = today();
  const d = new Date(hoy.getFullYear(), mes ?? hoy.getMonth(), dia);
  if (d < hoy) d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Fecha. Devuelve `{ date, resto }`: el texto sale sin el trozo que se comió,
 * para que después la hora no confunda el «20» de «el 20 de agosto» con las
 * ocho de la noche.
 */
export function leerFecha(t: string): { date: string | null; resto: string } {
  const hoy = today();
  let s = t;
  let date: string | null = null;

  const come = (rx: RegExp) => {
    const m = s.match(rx);
    if (m) s = s.replace(m[0], ' ');
    return m;
  };

  if (come(/\bpasado manana\b/)) date = iso(addDays(hoy, 2));
  else if (come(/\bhoy\b|\besta noche\b|\besta tarde\b|\bahora\b/)) date = iso(hoy);
  else if (come(/\bmanana\b/)) date = iso(addDays(hoy, 1));

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

  if (!date && come(/\bfin de semana\b/)) {
    date = iso(addDays(hoy, (6 - hoy.getDay() + 7) % 7));
  }

  // «20 de agosto» · «20/8» · «el 20»
  if (!date) {
    const m = come(new RegExp('\\b(\\d{1,2}) de (' + MONTHS.map(x => norm(x)).join('|') + ')\\b'));
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

/**
 * Hora. Lo interesante es la ambigüedad: aquí «a las 7» siempre son las 7 de
 * la NOCHE, porque a las 7 de la mañana no juega nadie. Se resuelve hacia la
 * tarde, pero se MARCA — Neo lo dice en el resumen para que corregirlo cueste
 * una palabra y no una reserva perdida (R46).
 */
export function leerHora(
  t: string,
  abre: number,
  cierra: number
): { hour: number | null; ambigua: boolean } {
  let s = ' ' + t + ' ';
  s = s.replace(/\b(de|por|en|a) la manana\b/g, ' ~am ');
  s = s.replace(/\b(de|por|en|a) la (tarde|noche)\b/g, ' ~pm ');
  s = s.replace(/\bmedio ?dia\b/g, ' 12 ~pm ');
  s = s.replace(/\bmedia ?noche\b/g, ' 0 ~am ');
  for (const [w, n] of Object.entries(NUMS)) {
    s = s.replace(new RegExp('\\b' + w + '\\b', 'g'), ' ' + n + ' ');
  }

  /* El sufijo puede venir DENTRO del trozo reconocido («6:00 p.m.», que es lo
     que manda un chip de hora) o justo después («las 6 de la noche»). Mirar
     solo lo que sigue daba por ambigua una hora que el jugador dijo entera. */
  const suf = (m: string): 'am' | 'pm' | null => {
    const pos = s.indexOf(m);
    const trozo = m + s.slice(pos + m.length, pos + m.length + 6);
    const mm = trozo.match(/\d{1,2}(?::\d{2})?\s*~?([ap])\.?\s?m\.?/);
    return mm ? (mm[1] === 'p' ? 'pm' : 'am') : null;
  };

  const m =
    s.match(/\ba (?:la|las) (\d{1,2})(?:[:.](\d{2}))?/) ??
    s.match(/\b(?:la|las) (\d{1,2})(?:[:.](\d{2}))?/) ??
    s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:~?[ap]\.?m\.?)/) ??
    (/^\s*\d{1,2}(?:[:.]\d{2})?\s*(?:~?[ap]\.?m\.?)?\s*$/.test(s)
      ? s.match(/(\d{1,2})(?:[:.](\d{2}))?/)
      : null);

  if (!m) return { hour: null, ambigua: false };

  const crudo = +m[1];
  if (crudo > 23) return { hour: null, ambigua: false };
  const sufijo = suf(m[0]);

  if (sufijo === 'pm') return { hour: crudo === 12 ? 12 : crudo + 12, ambigua: false };
  if (sufijo === 'am') return { hour: crudo === 12 ? 0 : crudo, ambigua: false };
  if (crudo >= 13) return { hour: crudo, ambigua: false };

  const tarde = crudo + 12;
  if (crudo <= 11 && tarde >= abre && tarde < cierra) return { hour: tarde, ambigua: true };
  return { hour: crudo, ambigua: false };
}
